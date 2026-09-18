const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server.js');
const FRONTEND = path.join(ROOT, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');

if (!fs.existsSync(SERVER)) process.exit(0);

let server = fs.readFileSync(SERVER, 'utf8');

if (!server.includes('DQ_V32_A1_EMAIL_OTP_SERVER')) {
  const block = String.raw`
// DQ_V32_A1_EMAIL_OTP_SERVER
const DQ_V32_A1_RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DQ_V32_A1_EMAIL_FROM = process.env.PASSWORD_EMAIL_FROM || 'Doctors Query FMGE Academy <support@doctorsqueryfmgeacademy.com>';
const DQ_V32_A1_OTP_MINUTES = 10;
const DQ_V32_A1_VERIFY_MINUTES = 30;
const DQ_V32_A1_RATE = new Map();

function dqV32A1NormalizeEmail(value) {
  return clean(value).toLowerCase();
}
function dqV32A1ValidEmail(value) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}
function dqV32A1Hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
function dqV32A1RateLimit(key, max, windowMs) {
  const now = Date.now();
  let item = DQ_V32_A1_RATE.get(key);
  if (!item || item.resetAt <= now) item = { count: 0, resetAt: now + windowMs };
  item.count += 1;
  DQ_V32_A1_RATE.set(key, item);
  return item.count <= max;
}
function dqV32A1Cookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const part = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}
async function dqV32A1SendEmail(to, otp) {
  if (!DQ_V32_A1_RESEND_API_KEY || !DQ_V32_A1_EMAIL_FROM) throw new Error('Email delivery is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + DQ_V32_A1_RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: DQ_V32_A1_EMAIL_FROM,
      to: [to],
      subject: 'Verify your email — Doctors Query FMGE Academy',
      text: [
        'Doctors Query FMGE Academy',
        '',
        'Your email verification code is: ' + otp,
        '',
        'This OTP expires in 10 minutes and can be used only once.',
        'If you did not request this verification, you can ignore this email.'
      ].join('\\n')
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error('Resend rejected the email: ' + body.slice(0, 300));
  }
}

async function dqV32A1EnsureEmailOtpSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      verification_token_hash TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_email ON email_verification_tokens(email);
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);
  `);
}

app.post('/api/registration/send-email-otp', async (req, res) => {
  try {
    await DQ_V32_A1_EMAIL_OTP_READY;
    const email = dqV32A1NormalizeEmail(req.body?.email);
    if (!dqV32A1ValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!dqV32A1RateLimit('ip:' + ip, 5, 15 * 60 * 1000) ||
        !dqV32A1RateLimit('email:' + email, 3, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = dqV32A1Hash(otp);
    const expiresAt = new Date(Date.now() + DQ_V32_A1_OTP_MINUTES * 60 * 1000);

    await pool.query(
      'UPDATE email_verification_tokens SET used_at=NOW() WHERE email=$1 AND used_at IS NULL',
      [email]
    );
    await pool.query(
      'INSERT INTO email_verification_tokens (email,otp_hash,expires_at) VALUES ($1,$2,$3)',
      [email, otpHash, expiresAt]
    );

    await dqV32A1SendEmail(email, otp);
    res.json({
      ok: true,
      message: 'OTP sent to your email. Please check Inbox, Spam/Junk and Promotions.'
    });
  } catch (e) {
    console.error('V32-A.1 send email OTP error:', e.message);
    res.status(500).json({
      error: 'We could not send the verification email. Please check your email address and try again.'
    });
  }
});

app.post('/api/registration/verify-email-otp', async (req, res) => {
  try {
    await DQ_V32_A1_EMAIL_OTP_READY;
    const email = dqV32A1NormalizeEmail(req.body?.email);
    const otp = clean(req.body?.otp);
    if (!dqV32A1ValidEmail(email) || !/^\\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP sent to your email.' });
    }

    const row = (await pool.query(
      'SELECT * FROM email_verification_tokens WHERE email=$1 AND used_at IS NULL AND verified_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [email]
    )).rows[0];

    const suppliedHash = dqV32A1Hash(otp);
    if (!row || row.otp_hash.length !== suppliedHash.length ||
        !crypto.timingSafeEqual(Buffer.from(row.otp_hash), Buffer.from(suppliedHash))) {
      return res.status(400).json({ error: 'Incorrect or expired OTP. Please request a new OTP and try again.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'UPDATE email_verification_tokens SET verified_at=NOW(),used_at=NOW(),verification_token_hash=$1 WHERE id=$2',
      [dqV32A1Hash(verificationToken), row.id]
    );

    res.setHeader(
      'Set-Cookie',
      'dq_email_verification=' + encodeURIComponent(verificationToken) + '; Max-Age=' + (DQ_V32_A1_VERIFY_MINUTES * 60) + '; Path=/; HttpOnly; Secure; SameSite=Lax'
    );
    res.json({ ok: true, verified: true, message: 'Email verified successfully.' });
  } catch (e) {
    console.error('V32-A.1 verify email OTP error:', e.message);
    res.status(500).json({ error: 'Unable to verify the email right now.' });
  }
});

async function dqV32A1RequireVerifiedEmail(req, res, next) {
  try {
    await DQ_V32_A1_EMAIL_OTP_READY;
    const email = dqV32A1NormalizeEmail(req.body?.email);
    const token = dqV32A1Cookie(req, 'dq_email_verification');
    if (!dqV32A1ValidEmail(email) || !token) {
      return res.status(400).json({ error: 'Please verify your email address before continuing to payment.' });
    }
    const row = (await pool.query(
      'SELECT id FROM email_verification_tokens WHERE email=$1 AND verification_token_hash=$2 AND verified_at IS NOT NULL AND expires_at > NOW() LIMIT 1',
      [email, dqV32A1Hash(token)]
    )).rows[0];
    if (!row) {
      return res.status(400).json({ error: 'Your email verification has expired. Please verify your email again before payment.' });
    }
    next();
  } catch (e) {
    console.error('V32-A.1 email verification guard error:', e.message);
    res.status(500).json({ error: 'Unable to verify your email status right now.' });
  }
}

const DQ_V32_A1_EMAIL_OTP_READY = dqV32A1EnsureEmailOtpSchema().catch(e => {
  console.error('V32-A.1 email OTP schema error:', e.message);
  throw e;
});
`;

  const anchor = "app.use(express.static(__dirname));";
  if (!server.includes(anchor)) {
    console.error('V32-A.1 could not find server middleware anchor.');
    process.exit(1);
  }
  server = server.replace(anchor, block + "\n" + anchor);
}

if (!server.includes('DQ_V32_A1_PAYMENT_GUARD_ATTACHED')) {
  const marker = "app.post('/api/create-payment-link', async (req, res) => {";
  if (!server.includes(marker)) {
    console.error('V32-A.1 could not find payment-link route.');
    process.exit(1);
  }
  server = server.replace(
    marker,
    "app.post('/api/create-payment-link', dqV32A1RequireVerifiedEmail, async (req, res) => {\n  // DQ_V32_A1_PAYMENT_GUARD_ATTACHED"
  );
}

if (fs.existsSync(FRONTEND)) {
  let html = fs.readFileSync(FRONTEND, 'utf8');
  if (!html.includes('DQ_V32_A1_EMAIL_OTP_UI')) {
    const ui = String.raw`
<!-- DQ_V32_A1_EMAIL_OTP_UI -->
<style>
.dq-email-verify{margin:8px 0 16px;padding:14px;border:1px solid #d9e6f2;border-radius:12px;background:#f7fbff}
.dq-email-verify .dq-ev-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dq-email-verify input{flex:1;min-width:180px}
.dq-email-verify button{white-space:nowrap}
.dq-email-verify .dq-ev-msg{font-size:13px;margin-top:8px}
.dq-email-verify .dq-ev-ok{color:#176b42}
.dq-email-verify .dq-ev-err{color:#9b2525}
``;

    const script = String.raw`
<script>
(function(){
  function bootEmailVerification(){
    if(window.__DQ_V32_A1_EMAIL_BOOTED) return;
    const email=document.querySelector('input[name="email"],input[type="email"]');
    const form=email ? email.closest('form') : null;
    if(!email || !form) return;
    window.__DQ_V32_A1_EMAIL_BOOTED=true;

    const box=document.createElement('div');
    box.className='dq-email-verify';
    box.innerHTML=
      '<strong>Verify your email before payment</strong>' +
      '<div style="font-size:13px;margin:5px 0 10px">A 6-digit OTP will be sent to your email address.</div>' +
      '<div class="dq-ev-row">' +
        '<input id="dq-ev-otp" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit OTP" autocomplete="one-time-code" style="display:none">' +
        '<button type="button" id="dq-ev-send">Send OTP</button>' +
        '<button type="button" id="dq-ev-verify" style="display:none">Verify OTP</button>' +
      '</div>' +
      '<div id="dq-ev-msg" class="dq-ev-msg"></div>';
    email.insertAdjacentElement('afterend',box);

    const otp=box.querySelector('#dq-ev-otp');
    const send=box.querySelector('#dq-ev-send');
    const verify=box.querySelector('#dq-ev-verify');
    const msg=box.querySelector('#dq-ev-msg');

    let verifiedEmail='';
    let busy=false;

    const controls=[...form.querySelectorAll('input,select,textarea,button')];
    function lockForm(lock){
      controls.forEach(el=>{
        if(el===email || box.contains(el)) return;
        el.disabled=lock;
      });
    }
    lockForm(true);
    email.disabled=false;

    function message(text,ok){
      msg.textContent=text;
      msg.className='dq-ev-msg '+(ok?'dq-ev-ok':'dq-ev-err');
    }

    function address(){ return String(email.value||'').trim(); }

    send.onclick=async function(){
      const value=address();
      if(!/^\S+@\S+\.\S+$/.test(value)){
        message('Please enter a valid email address.',false);
        return;
      }
      if(busy) return;
      busy=true; send.disabled=true;
      message('Sending verification OTP…',true);
      try{
        const r=await fetch('/api/registration/send-email-otp',{
          method:'POST',
          credentials:'same-origin',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email:value})
        });
        const data=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(data.error||'Unable to send OTP.');
        verifiedEmail='';
        otp.value='';
        otp.style.display='block';
        verify.style.display='inline-block';
        message(data.message||'OTP sent. Please check your email.',true);
      }catch(e){
        message(e.message||'Unable to send OTP. Please check your email address.',false);
      }finally{
        busy=false; send.disabled=false;
      }
    };

    verify.onclick=async function(){
      const value=address();
      const code=otp.value.trim();
      if(!/^\S+@\S+\.\S+$/.test(value)){
        message('Please enter a valid email address.',false); return;
      }
      if(!/^\d{6}$/.test(code)){
        message('Enter the 6-digit OTP sent to your email.',false); return;
      }
      if(busy) return;
      busy=true; verify.disabled=true;
      try{
        const r=await fetch('/api/registration/verify-email-otp',{
          method:'POST',
          credentials:'same-origin',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email:value,otp:code})
        });
        const data=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(data.error||'OTP verification failed.');
        verifiedEmail=value.toLowerCase();
        email.readOnly=true;
        otp.disabled=true; verify.disabled=true; send.disabled=true;
        lockForm(false);
        message('✓ Email verified successfully. You can now complete the registration and continue to payment.',true);
      }catch(e){
        verify.disabled=false;
        message(e.message||'Incorrect or expired OTP. Please request a new OTP.',false);
      }finally{
        busy=false;
      }
    };

    const originalStart=window.startDQPayment;
    if(typeof originalStart==='function'){
      window.startDQPayment=async function(formElement){
        if(!verifiedEmail || address().toLowerCase()!==verifiedEmail){
          message('Please verify your email address before continuing to payment.',false);
          box.scrollIntoView({behavior:'smooth',block:'center'});
          return false;
        }
        return originalStart(formElement);
      };
    }

    const originalSubmit=form.onsubmit;
    if(originalSubmit){
      form.onsubmit=function(e){
        if(!verifiedEmail || address().toLowerCase()!==verifiedEmail){
          e.preventDefault();
          message('Please verify your email address before continuing to payment.',false);
          box.scrollIntoView({behavior:'smooth',block:'center'});
          return false;
        }
        return originalSubmit.call(this,e);
      };
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootEmailVerification);
  else bootEmailVerification();
  setTimeout(bootEmailVerification,500);
  setTimeout(bootEmailVerification,1500);
})();
</script>
`;

    html = html.replace('</body>', ui + script + '\n</body>');
    fs.writeFileSync(FRONTEND, html, 'utf8');
  }
}

console.log('Applied Doctors Query FMGE Academy V32-A.1 Email OTP Verification patch.');
