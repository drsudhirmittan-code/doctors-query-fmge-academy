require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const Razorpay = require('razorpay');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || KEY_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const PROGRAM_AMOUNT_PAISE = 99900;
const CURRENCY = 'INR';
const PAYMENT_CALLBACK_URL = process.env.PAYMENT_CALLBACK_URL || 'https://doctorsqueryfmgeacademy.com/api/payment-link/callback';

if (!KEY_ID || !KEY_SECRET) {
  console.error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Connect the Railway PostgreSQL database to this service.');
  process.exit(1);
}

const app = express();
const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
const pool = new Pool({ connectionString: DATABASE_URL });

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('Missing ADMIN_PASSWORD in .env');
  process.exit(1);
}

function adminAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Doctors Query FMGE Admin"');
    return res.status(401).send('Admin login required.');
  }
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const split = decoded.indexOf(':');
    const user = split >= 0 ? decoded.slice(0, split) : '';
    const pass = split >= 0 ? decoded.slice(split + 1) : '';
    if (user !== ADMIN_USER || pass !== ADMIN_PASSWORD) {
      res.set('WWW-Authenticate', 'Basic realm="Doctors Query FMGE Admin"');
      return res.status(401).send('Invalid admin credentials.');
    }
    next();
  } catch {
    res.set('WWW-Authenticate', 'Basic realm="Doctors Query FMGE Admin"');
    return res.status(401).send('Invalid admin credentials.');
  }
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id SERIAL PRIMARY KEY,
      enrollment_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL,
      country TEXT NOT NULL,
      university TEXT NOT NULL,
      year TEXT NOT NULL,
      razorpay_order_id TEXT UNIQUE,
      razorpay_payment_id TEXT UNIQUE,
      payment_link_id TEXT,
      payment_link_reference_id TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending'
    );
    ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS payment_link_id TEXT;
    ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS payment_link_reference_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_payment_link_id ON enrollments(payment_link_id) WHERE payment_link_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_payment_link_reference_id ON enrollments(payment_link_reference_id) WHERE payment_link_reference_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(email);
    CREATE INDEX IF NOT EXISTS idx_enrollments_created_at ON enrollments(created_at);
  `);
  console.log('PostgreSQL database initialized.');
}

function clean(v) { return String(v ?? '').trim(); }
function validStudent(s) {
  return s && clean(s.name) && clean(s.whatsapp) && clean(s.email) && clean(s.country) && clean(s.university) && clean(s.year);
}
function makeEnrollmentId() {
  return `DQ-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
function signatureIsValid(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return typeof signature === 'string' && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
function paymentLinkSignatureIsValid(paymentLinkId, referenceId, status, paymentId, signature) {
  const expected = crypto.createHmac('sha256', KEY_SECRET)
    .update(`${paymentLinkId}|${referenceId}|${status}|${paymentId}`)
    .digest('hex');
  return typeof signature === 'string' && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
function webhookIsValid(rawBody, signature) {
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return typeof signature === 'string' && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function insertOrGetEnrollment(student, orderId, paymentId, paymentStatus) {
  const existing = await pool.query(
    'SELECT * FROM enrollments WHERE razorpay_payment_id = $1 OR razorpay_order_id = $2 LIMIT 1',
    [paymentId || null, orderId || null]
  );
  if (existing.rows[0]) return existing.rows[0];

  const enrollmentId = makeEnrollmentId();
  const now = new Date().toISOString();
  const result = await pool.query(
    `INSERT INTO enrollments
      (enrollment_id,status,created_at,confirmed_at,name,whatsapp,email,country,university,year,razorpay_order_id,razorpay_payment_id,payment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      enrollmentId,
      paymentStatus === 'captured' ? 'confirmed' : 'pending',
      now,
      paymentStatus === 'captured' ? now : null,
      clean(student.name), clean(student.whatsapp), clean(student.email), clean(student.country), clean(student.university), clean(student.year),
      orderId || null, paymentId || null, paymentStatus || 'pending'
    ]
  );
  return result.rows[0];
}

async function confirmPaymentLink(paymentLinkId, referenceId, paymentId) {
  const result = await pool.query(
    'SELECT * FROM enrollments WHERE payment_link_id = $1 OR payment_link_reference_id = $2 LIMIT 1',
    [paymentLinkId, referenceId]
  );
  const row = result.rows[0];
  if (!row) return null;

  let payment = null;
  if (paymentId) {
    payment = await razorpay.payments.fetch(paymentId);
    if (Number(payment.amount) !== PROGRAM_AMOUNT_PAISE || payment.currency !== CURRENCY || payment.status !== 'captured') {
      throw new Error('Payment amount/currency/status validation failed.');
    }
  }

  const now = new Date().toISOString();
  await pool.query(
    `UPDATE enrollments SET status='confirmed', confirmed_at=COALESCE(confirmed_at,$1),
      razorpay_payment_id=COALESCE(razorpay_payment_id,$2), payment_status='captured'
     WHERE id=$3`,
    [now, paymentId || null, row.id]
  );
  return row;
}

// Webhook route must receive the raw body for signature verification.
app.post('/api/razorpay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('X-Razorpay-Signature');
    if (!webhookIsValid(req.body, signature)) return res.status(400).json({ error: 'Invalid webhook signature.' });
    const event = JSON.parse(req.body.toString('utf8'));

    if (event.event === 'payment_link.paid') {
      const link = event?.payload?.payment_link?.entity;
      const payment = event?.payload?.payment?.entity;
      if (link?.id && link?.reference_id) {
        await confirmPaymentLink(link.id, link.reference_id, payment?.id || null);
      }
    } else {
      const payment = event?.payload?.payment?.entity;
      if (payment?.id) {
        const result = await pool.query(
          'SELECT * FROM enrollments WHERE razorpay_payment_id = $1 OR razorpay_order_id = $2 LIMIT 1',
          [payment.id, payment.order_id || null]
        );
        const row = result.rows[0];
        if (row) {
          const status = event.event === 'payment.captured' || payment.status === 'captured' ? 'confirmed' : row.status;
          const pstatus = payment.status || row.payment_status;
          const confirmedAt = status === 'confirmed' && !row.confirmed_at ? new Date().toISOString() : row.confirmed_at;
          await pool.query(
            'UPDATE enrollments SET status=$1, payment_status=$2, confirmed_at=$3 WHERE id=$4',
            [status, pstatus, confirmedAt, row.id]
          );
        }
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e.message);
    res.status(400).json({ error: 'Webhook processing failed.' });
  }
});

app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(__dirname));

const FRONTEND_FILE = path.join(__dirname, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');
const PAYMENT_UI_BLOCK = `<div style="margin:12px 0 16px;padding:13px 14px;border:1px solid rgba(11,92,171,.18);border-radius:12px;background:rgba(11,92,171,.05);font-size:13px;line-height:1.55"><strong>SECURE ONLINE PAYMENT</strong><br>You will be redirected to Razorpay's secure payment page to complete the ₹999 enrollment payment. After successful payment, your enrollment will be verified automatically.</div>`;
const PAYMENT_TEST_BLOCK_RE = /<div style="margin:12px 0 16px;padding:13px 14px;border:1px solid rgba\(11,92,171,\.18\)[\s\S]*?<\/div><div style="margin:0 0 16px;padding:12px 14px;border:1px solid rgba\(11,92,171,\.14\)[\s\S]*?<\/div>/;
const PAYMENT_SCRIPT = `<script>
/*
  Doctors Query FMGE Academy — Payment Link Flow
  1) Browser sends student details to POST /api/create-payment-link
  2) Server creates a unique Razorpay Payment Link and stores the pending enrollment
  3) Browser redirects to Razorpay's hosted secure payment page
  4) Razorpay redirects to the signed server callback after payment
  5) Server verifies the signature and confirms the enrollment in PostgreSQL
  6) Razorpay webhooks provide an additional server-side fallback when configured
*/
(function () {
  const API_BASE = window.DQ_API_BASE || "";
  function getValue(form, name) { const el = form.querySelector('[name="' + name + '"]'); return el ? el.value.trim() : ""; }
  async function postJSON(path, payload) {
    const res = await fetch(API_BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Server request failed.");
    return data;
  }
  function showPaymentResult() {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      const enrollmentId = params.get("enrollment_id") || "";
      const paymentId = params.get("payment_id") || "";
      alert("Payment verified successfully!\\n\\n" + (paymentId ? "Payment ID: " + paymentId + "\\n\\n" : "") + (enrollmentId ? "Enrollment ID: " + enrollmentId + "\\n\\n" : "") + "Your FMGE Foundation Program enrollment is confirmed.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (payment === "failed") {
      alert("Payment could not be verified automatically. If your bank account was charged, please contact Doctors Query FMGE Academy with your Razorpay payment details.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showPaymentResult); else showPaymentResult();
  window.startDQPayment = async function (form) {
    const name = getValue(form, "name") || getValue(form, "fullName");
    const whatsapp = getValue(form, "whatsapp") || getValue(form, "whatsappNumber");
    const email = getValue(form, "email");
    const country = getValue(form, "country");
    const university = getValue(form, "university");
    const year = getValue(form, "year") || getValue(form, "currentYear");
    if (!name || !whatsapp || !email || !country || !university || !year) { alert("Please complete all student details before continuing to payment."); return false; }
    const button = form.querySelector('button[type="submit"]');
    const oldText = button ? button.innerHTML : "";
    if (button) { button.disabled = true; button.innerHTML = "CREATING SECURE PAYMENT LINK…"; }
    try {
      const paymentLink = await postJSON("/api/create-payment-link", { name, whatsapp, email, country, university, year });
      if (!paymentLink.short_url || !paymentLink.payment_link_id || !paymentLink.enrollment_id) throw new Error("Invalid payment link received from server.");
      window.location.href = paymentLink.short_url;
    } catch (err) {
      alert("Unable to start secure payment.\\n\\n" + err.message);
      if (button) { button.disabled = false; button.innerHTML = oldText; }
    }
    return false;
  };
})();
</script>`;

app.get('/', (req, res) => {
  try {
    let html = require('fs').readFileSync(FRONTEND_FILE, 'utf8');
    html = html.replace(PAYMENT_TEST_BLOCK_RE, PAYMENT_UI_BLOCK);
    html = html.replace(/<script>\s*\/\*\s*Doctors Query FMGE Academy — V18 SECURE DATABASE[\s\S]*?<\/script>/, PAYMENT_SCRIPT);
    res.type('html').send(html);
  } catch (e) {
    console.error('Frontend render error:', e.message);
    res.status(500).send('Unable to load website.');
  }
});
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'Doctors Query FMGE payment server', database: 'postgresql', time: new Date().toISOString() }));

// Payment Link callback: verifies Razorpay's signed redirect and confirms the enrollment.
app.get('/api/payment-link/callback', async (req, res) => {
  try {
    const paymentLinkId = clean(req.query.razorpay_payment_link_id);
    const referenceId = clean(req.query.razorpay_payment_link_reference_id);
    const status = clean(req.query.razorpay_payment_link_status);
    const paymentId = clean(req.query.razorpay_payment_id);
    const signature = clean(req.query.razorpay_signature);

    if (!paymentLinkId || !referenceId || !status || !paymentId || !signature) {
      return res.redirect('/?payment=failed');
    }
    if (!paymentLinkSignatureIsValid(paymentLinkId, referenceId, status, paymentId, signature)) {
      return res.redirect('/?payment=failed');
    }
    if (status !== 'paid') return res.redirect('/?payment=failed');

    const row = await confirmPaymentLink(paymentLinkId, referenceId, paymentId);
    if (!row) return res.redirect('/?payment=failed');

    return res.redirect(`/?payment=success&enrollment_id=${encodeURIComponent(row.enrollment_id)}&payment_id=${encodeURIComponent(paymentId)}`);
  } catch (e) {
    console.error('Payment Link callback error:', e.message);
    return res.redirect('/?payment=failed');
  }
});

app.get('/admin', adminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/api/admin/enrollments', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM enrollments ORDER BY id DESC');
    const enrollments = result.rows;
    const stats = {
      total: enrollments.length,
      confirmed: enrollments.filter(x => x.status === 'confirmed').length,
      pending: enrollments.filter(x => x.status === 'pending').length,
      captured: enrollments.filter(x => x.payment_status === 'captured').length
    };
    res.json({ stats, enrollments });
  } catch (e) {
    console.error('Admin enrollments error:', e.message);
    res.status(500).json({ error: 'Unable to load enrollments.' });
  }
});

// Legacy Order + Checkout endpoint retained for backward compatibility.
app.post('/api/create-order', async (req, res) => {
  try {
    const student = req.body || {};
    if (!validStudent(student)) return res.status(400).json({ error: 'Please complete all student details.' });
    const order = await razorpay.orders.create({
      amount: PROGRAM_AMOUNT_PAISE,
      currency: CURRENCY,
      receipt: `DQ-${Date.now()}`,
      notes: { student_email: clean(student.email), university: clean(student.university), current_year: clean(student.year) }
    });

    const now = new Date().toISOString();
    const enrollmentId = makeEnrollmentId();
    await pool.query(
      `INSERT INTO enrollments
        (enrollment_id,status,created_at,name,whatsapp,email,country,university,year,razorpay_order_id,payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        enrollmentId, 'pending', now,
        clean(student.name), clean(student.whatsapp), clean(student.email), clean(student.country), clean(student.university), clean(student.year),
        order.id, 'pending'
      ]
    );

    res.json({ key_id: KEY_ID, order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    console.error('Create order error:', e);
    res.status(500).json({ error: 'Unable to create secure payment order.' });
  }
});

// New FMGE Academy Payment Link flow.
app.post('/api/create-payment-link', async (req, res) => {
  try {
    const student = req.body || {};
    if (!validStudent(student)) return res.status(400).json({ error: 'Please complete all student details.' });

    const enrollmentId = makeEnrollmentId();
    const link = await razorpay.paymentLink.create({
      amount: PROGRAM_AMOUNT_PAISE,
      currency: CURRENCY,
      accept_partial: false,
      reference_id: enrollmentId,
      description: 'FMGE Foundation Program — 1 Year Access',
      customer: {
        name: clean(student.name),
        email: clean(student.email),
        contact: clean(student.whatsapp)
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: {
        program: 'FMGE Foundation Program',
        student_email: clean(student.email),
        university: clean(student.university),
        current_year: clean(student.year),
        country: clean(student.country)
      },
      callback_url: PAYMENT_CALLBACK_URL,
      callback_method: 'get'
    });

    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO enrollments
        (enrollment_id,status,created_at,name,whatsapp,email,country,university,year,payment_link_id,payment_link_reference_id,payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        enrollmentId, 'pending', now,
        clean(student.name), clean(student.whatsapp), clean(student.email), clean(student.country), clean(student.university), clean(student.year),
        link.id, link.reference_id, 'pending'
      ]
    );

    res.json({ payment_link_id: link.id, reference_id: link.reference_id, short_url: link.short_url, enrollment_id: enrollmentId });
  } catch (e) {
    console.error('Create payment link error:', e);
    res.status(500).json({ error: 'Unable to create secure payment link.' });
  }
});

app.post('/api/verify-payment', async (req, res) => {
  try {
    const { student, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (!validStudent(student) || !orderId || !paymentId || !signature) return res.status(400).json({ error: 'Incomplete payment verification data.' });
    if (!signatureIsValid(orderId, paymentId, signature)) return res.status(400).json({ error: 'Payment signature verification failed.' });

    const order = await razorpay.orders.fetch(orderId);
    if (Number(order.amount) !== PROGRAM_AMOUNT_PAISE || order.currency !== CURRENCY) return res.status(400).json({ error: 'Payment amount/currency validation failed.' });
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.order_id !== orderId) return res.status(400).json({ error: 'Payment/order mismatch.' });
    if (Number(payment.amount) !== PROGRAM_AMOUNT_PAISE || payment.currency !== CURRENCY) return res.status(400).json({ error: 'Payment amount validation failed.' });
    if (payment.status !== 'captured') return res.status(400).json({ error: `Payment is not captured. Current status: ${payment.status}` });

    const existingResult = await pool.query('SELECT * FROM enrollments WHERE razorpay_order_id = $1 LIMIT 1', [orderId]);
    const existing = existingResult.rows[0];
    if (existing) {
      await pool.query(
        `UPDATE enrollments SET status='confirmed', confirmed_at=COALESCE(confirmed_at,$1),
         name=$2, whatsapp=$3, email=$4, country=$5, university=$6, year=$7,
         razorpay_payment_id=$8, payment_status='captured' WHERE id=$9`,
        [new Date().toISOString(), clean(student.name), clean(student.whatsapp), clean(student.email), clean(student.country), clean(student.university), clean(student.year), paymentId, existing.id]
      );
      return res.json({ ok: true, enrollment_id: existing.enrollment_id, status: 'confirmed' });
    }

    const row = await insertOrGetEnrollment(student, orderId, paymentId, 'captured');
    res.json({ ok: true, enrollment_id: row.enrollment_id, status: row.status });
  } catch (e) {
    console.error('Verify payment error:', e);
    res.status(500).json({ error: 'Payment verification could not be completed.' });
  }
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => console.log(`Doctors Query FMGE payment server running on http://localhost:${PORT}`));
  } catch (e) {
    console.error('Database initialization error:', e);
    process.exit(1);
  }
}

async function shutdown() {
  try { await pool.end(); } finally { process.exit(0); }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
