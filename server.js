require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || KEY_SECRET;
const PROGRAM_AMOUNT_PAISE = 99900;
const CURRENCY = 'INR';

if (!KEY_ID || !KEY_SECRET) {
  console.error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env');
  process.exit(1);
}

const app = express();
const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('Missing ADMIN_PASSWORD in .env');
  process.exit(1);
}

function adminAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm=\"Doctors Query FMGE Admin\"');
    return res.status(401).send('Admin login required.');
  }
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const split = decoded.indexOf(':');
    const user = split >= 0 ? decoded.slice(0, split) : '';
    const pass = split >= 0 ? decoded.slice(split + 1) : '';
    if (user !== ADMIN_USER || pass !== ADMIN_PASSWORD) {
      res.set('WWW-Authenticate', 'Basic realm=\"Doctors Query FMGE Admin\"');
      return res.status(401).send('Invalid admin credentials.');
    }
    next();
  } catch {
    res.set('WWW-Authenticate', 'Basic realm=\"Doctors Query FMGE Admin\"');
    return res.status(401).send('Invalid admin credentials.');
  }
}

// SQLite is local for this stage and keeps the enrollment record out of a JSON file.
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'fmge.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    payment_status TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(email);
  CREATE INDEX IF NOT EXISTS idx_enrollments_created_at ON enrollments(created_at);
`);

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
function webhookIsValid(rawBody, signature) {
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return typeof signature === 'string' && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
function insertOrGetEnrollment(student, orderId, paymentId, paymentStatus) {
  const existing = db.prepare('SELECT * FROM enrollments WHERE razorpay_payment_id = ? OR razorpay_order_id = ? LIMIT 1').get(paymentId || null, orderId || null);
  if (existing) return existing;
  const enrollmentId = makeEnrollmentId();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO enrollments
    (enrollment_id,status,created_at,confirmed_at,name,whatsapp,email,country,university,year,razorpay_order_id,razorpay_payment_id,payment_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      enrollmentId, paymentStatus === 'captured' ? 'confirmed' : 'pending', now,
      paymentStatus === 'captured' ? now : null,
      clean(student.name), clean(student.whatsapp), clean(student.email), clean(student.country), clean(student.university), clean(student.year),
      orderId || null, paymentId || null, paymentStatus || 'pending'
    );
  return db.prepare('SELECT * FROM enrollments WHERE enrollment_id = ?').get(enrollmentId);
}

// Webhook route must receive the raw body for signature verification.
app.post('/api/razorpay/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const signature = req.get('X-Razorpay-Signature');
    if (!webhookIsValid(req.body, signature)) return res.status(400).json({ error: 'Invalid webhook signature.' });
    const event = JSON.parse(req.body.toString('utf8'));
    const payment = event?.payload?.payment?.entity;
    if (payment?.id) {
      const row = db.prepare('SELECT * FROM enrollments WHERE razorpay_payment_id = ? OR razorpay_order_id = ? LIMIT 1').get(payment.id, payment.order_id || null);
      if (row) {
        const status = event.event === 'payment.captured' || payment.status === 'captured' ? 'confirmed' : row.status;
        const pstatus = payment.status || row.payment_status;
        db.prepare('UPDATE enrollments SET status=?, payment_status=?, confirmed_at=CASE WHEN ? = \'confirmed\' AND confirmed_at IS NULL THEN ? ELSE confirmed_at END WHERE id=?')
          .run(status, pstatus, status, new Date().toISOString(), row.id);
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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html')));
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'Doctors Query FMGE payment server', database: 'sqlite', time: new Date().toISOString() }));

app.get('/admin', adminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/api/admin/enrollments', adminAuth, (req, res) => {
  const enrollments = db.prepare('SELECT * FROM enrollments ORDER BY id DESC').all();
  const stats = {
    total: enrollments.length,
    confirmed: enrollments.filter(x => x.status === 'confirmed').length,
    pending: enrollments.filter(x => x.status === 'pending').length,
    captured: enrollments.filter(x => x.payment_status === 'captured').length
  };
  res.json({ stats, enrollments });
});

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
    // Save the pending order before checkout so an abandoned/failed payment is still traceable.
    const now = new Date().toISOString();
    const enrollmentId = makeEnrollmentId();
    db.prepare(`INSERT INTO enrollments
      (enrollment_id,status,created_at,name,whatsapp,email,country,university,year,razorpay_order_id,payment_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      enrollmentId, 'pending', now, clean(student.name), clean(student.whatsapp), clean(student.email), clean(student.country), clean(student.university), clean(student.year), order.id, 'pending'
    );
    res.json({ key_id: KEY_ID, order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    console.error('Create order error:', e);
    res.status(500).json({ error: 'Unable to create secure payment order.' });
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

    const existing = db.prepare('SELECT * FROM enrollments WHERE razorpay_order_id = ? LIMIT 1').get(orderId);
    if (existing) {
      db.prepare(`UPDATE enrollments SET status='confirmed', confirmed_at=COALESCE(confirmed_at,?), name=?,whatsapp=?,email=?,country=?,university=?,year=?,razorpay_payment_id=?,payment_status='captured' WHERE id=?`)
        .run(new Date().toISOString(), clean(student.name), clean(student.whatsapp), clean(student.email), clean(student.country), clean(student.university), clean(student.year), paymentId, existing.id);
      return res.json({ ok: true, enrollment_id: existing.enrollment_id, status: 'confirmed' });
    }
    const row = insertOrGetEnrollment(student, orderId, paymentId, 'captured');
    res.json({ ok: true, enrollment_id: row.enrollment_id, status: row.status });
  } catch (e) {
    console.error('Verify payment error:', e);
    res.status(500).json({ error: 'Payment verification could not be completed.' });
  }
});

process.on('SIGINT', () => { try { db.close(); } finally { process.exit(0); } });
process.on('SIGTERM', () => { try { db.close(); } finally { process.exit(0); } });

app.listen(PORT, () => console.log(`Doctors Query FMGE payment server running on http://localhost:${PORT}`));
