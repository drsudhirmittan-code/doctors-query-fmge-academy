const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const serverFile = path.join(ROOT, 'server.js');
const studentFile = path.join(ROOT, 'student.html');

if (!fs.existsSync(serverFile)) process.exit(0);

let server = fs.readFileSync(serverFile, 'utf8');

if (server.includes('DQ_STUDENT_PORTAL_V32_A')) {
  console.log('Doctors Query FMGE Academy V32-A already applied.');
} else {

const marker = '// DQ_STUDENT_PORTAL_V32_A';
const v32 = `
${marker}
const V32_PASSWORD_APP_URL = process.env.PASSWORD_APP_URL || 'https://doctorsqueryfmgeacademy.com';
const V32_PASSWORD_EMAIL_FROM = process.env.PASSWORD_EMAIL_FROM || '';
const V32_RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const V32_PASSWORD_MIN_LENGTH = 10;
// V32-A-REVIEWED: no plaintext temporary/reset password is stored or returned.
const V32_RESET_WINDOW_MS = 15 * 60 * 1000;
const V32_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function v32PasswordValid(password) {
  return typeof password === 'string' &&
    password.length >= V32_PASSWORD_MIN_LENGTH &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

function v32NormalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function v32TokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function v32CreatePasswordToken(studentId, purpose, channel) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = v32TokenHash(token);
  await pool.query(
    'INSERT INTO student_password_tokens (token_hash,student_id,purpose,delivery_channel,expires_at) VALUES ($1,$2,$3,$4,$5)',
    [tokenHash, studentId, purpose, channel, new Date(Date.now() + V32_RESET_TOKEN_TTL_MS).toISOString()]
  );
  return token;
}

async function v32SendPasswordEmail(account, token, purpose) {
  if (!V32_RESEND_API_KEY || !V32_PASSWORD_EMAIL_FROM) {
    throw new Error('Password email delivery is not configured.');
  }
  const action = purpose === 'setup' ? 'Set your FMGE Academy password' : 'Reset your FMGE Academy password';
  const url = V32_PASSWORD_APP_URL.replace(/\\/$/, '') + '/student-dashboard?password_token=' + encodeURIComponent(token);
  const text = [
    'Doctors Query FMGE Academy',
    '',
    action,
    '',
    'Student ID: ' + account.student_id,
    '',
    'Use this one-time link to continue:',
    url,
    '',
    'This link expires in 15 minutes and can be used only once.',
    'If you did not request this, you can ignore this email.'
  ].join('\\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + V32_RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: V32_PASSWORD_EMAIL_FROM,
      to: [account.email],
      subject: action,
      text
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error('Password email delivery failed: ' + response.status + ' ' + body.slice(0, 300));
  }
}

async function createStudentAccountForEnrollmentV32(enrollmentId) {
  const found = await pool.query('SELECT * FROM student_accounts WHERE enrollment_id=$1 LIMIT 1', [enrollmentId]);
  const enrollment = (await pool.query('SELECT * FROM enrollments WHERE enrollment_id=$1 LIMIT 1', [enrollmentId])).rows[0];
  if (!enrollment || enrollment.status !== 'confirmed') return null;
  if (found.rows[0]) return { account: found.rows[0], temporaryPassword: null, activationToken: '' };

  const studentId = randomStudentId();
  const initialPassword = crypto.randomBytes(24).toString('base64url');
  const hp = await hashStudentPassword(initialPassword);
  const result = await pool.query(
    \`INSERT INTO student_accounts
      (student_id,enrollment_id,name,email,whatsapp,university,country,year,password_hash,password_salt,access_started_at,access_expires_at,status,must_change_password)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',TRUE)
     RETURNING student_id,enrollment_id,name,email,whatsapp,university,country,year,access_started_at,access_expires_at,status,must_change_password\`,
    [
      studentId, enrollment.enrollment_id, enrollment.name, enrollment.email, enrollment.whatsapp,
      enrollment.university, enrollment.country, enrollment.year, hp.hash, hp.salt,
      new Date().toISOString(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    ]
  );

  const account = result.rows[0];
  const setupToken = await v32CreatePasswordToken(account.student_id, 'setup', 'email');
  try {
    await v32SendPasswordEmail(account, setupToken, 'setup');
  } catch (e) {
    console.error('V32-A setup email warning:', e.message);
  }
  return { account, temporaryPassword: null, activationToken: setupToken };
}

// V31 declares the same function later in server.js. Replace that binding before
// any payment-confirmation route can call it, while keeping the V31 route/UI intact.
createStudentAccountForEnrollment = createStudentAccountForEnrollmentV32;

async function v32IssuePasswordLink(account, purpose, channel) {
  await pool.query(
    'UPDATE student_password_tokens SET used_at=NOW() WHERE student_id=$1 AND used_at IS NULL',
    [account.student_id]
  );
  const token = await v32CreatePasswordToken(account.student_id, purpose, channel);
  try {
    await v32SendPasswordEmail(account, token, purpose);
  } catch (e) {
    await pool.query('UPDATE student_password_tokens SET used_at=NOW() WHERE token_hash=$1', [v32TokenHash(token)]);
    throw e;
  }
}

async function v32ConsumePasswordToken(rawToken, purpose) {
  const token = String(rawToken || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const row = (await pool.query(
    'SELECT * FROM student_password_tokens WHERE token_hash=$1 AND purpose=$2 AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
    [v32TokenHash(token), purpose]
  )).rows[0];
  return row || null;
}

async function v32RevokeStudentSessions(studentId, client) {
  const db = client || pool;
  await db.query('DELETE FROM student_sessions WHERE student_id=$1', [studentId]);
}

async function v32RateLimit(req, key, limit) {
  if (!global.__DQ_V32_RATE_LIMIT) global.__DQ_V32_RATE_LIMIT = new Map();
  const now = Date.now();
  const existing = global.__DQ_V32_RATE_LIMIT.get(key) || [];
  const recent = existing.filter(ts => now - ts < V32_RESET_WINDOW_MS);
  if (recent.length >= limit) return false;
  recent.push(now);
  global.__DQ_V32_RATE_LIMIT.set(key, recent);
  if (global.__DQ_V32_RATE_LIMIT.size > 5000) {
    for (const [k, values] of global.__DQ_V32_RATE_LIMIT.entries()) {
      if (!values.some(ts => now - ts < V32_RESET_WINDOW_MS)) global.__DQ_V32_RATE_LIMIT.delete(k);
    }
  }
  return true;
}

async function v32ScrubLegacyActivationPasswords() {
  try {
    // Legacy V31 activation tokens contained plaintext temporary passwords.
    // V32-A replaces that flow with one-time setup/reset links, so legacy
    // activation tokens are obsolete. Delete them rather than attempting to
    // write NULL into the legacy NOT NULL temporary_password column.
    await pool.query('DELETE FROM student_activation_tokens');
  } catch (e) {
    console.error('V32-A legacy activation cleanup warning:', e.message);
  }
}

async function ensureV32PasswordSchema() {
  await pool.query(\`
    ALTER TABLE student_accounts ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE student_accounts ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS student_password_tokens (
      id SERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL REFERENCES student_accounts(student_id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK (purpose IN ('setup','reset')),
      delivery_channel TEXT NOT NULL DEFAULT 'email',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_student_password_tokens_student ON student_password_tokens(student_id);
    CREATE INDEX IF NOT EXISTS idx_student_password_tokens_expiry ON student_password_tokens(expires_at);
  \`);
  await v32ScrubLegacyActivationPasswords();
}

function v32PasswordCorsGuard(req, res, next) {
  const allowed = (process.env.FRONTEND_ORIGIN || 'https://doctorsqueryfmgeacademy.com').replace(/\\/$/, '');
  const origin = String(req.get('Origin') || '').replace(/\\/$/, '');
  if (origin && origin !== allowed) return res.status(403).json({ error: 'Request origin is not allowed.' });
  next();
}

app.post('/api/student/change-password', v32PasswordCorsGuard, async (req, res) => {
  try {
    await DQ_V32_READY;
    const account = await studentFromRequest(req);
    if (!account) return res.status(401).json({ error: 'Please sign in again.' });

    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    const confirmPassword = String(req.body?.confirm_password || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }
    if (!v32PasswordValid(newPassword)) {
      return res.status(400).json({ error: 'Password must be 10–128 characters and include uppercase, lowercase, number, and special character.' });
    }
    if (await verifyStudentPassword(currentPassword, account.password_salt, account.password_hash) === false) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    if (await verifyStudentPassword(newPassword, account.password_salt, account.password_hash)) {
      return res.status(400).json({ error: 'New password must be different from the current password.' });
    }

    const hp = await hashStudentPassword(newPassword);
    await pool.query(
      'UPDATE student_accounts SET password_hash=$1,password_salt=$2,must_change_password=FALSE,password_changed_at=NOW() WHERE student_id=$3',
      [hp.hash, hp.salt, account.student_id]
    );
    await v32RevokeStudentSessions(account.student_id);
    res.clearCookie('dq_student_session', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    res.json({ ok: true, message: 'Password changed successfully. Please sign in again.' });
  } catch (e) {
    console.error('V32-A change password error:', e.message);
    res.status(500).json({ error: 'Unable to change password right now.' });
  }
});

app.post('/api/student/forgot-password', v32PasswordCorsGuard, async (req, res) => {
  await DQ_V32_READY;
  const generic = { ok: true, message: 'If the Student ID and registered email match an active account, a password reset link has been sent.' };
  try {
    const studentId = String(req.body?.student_id || '').trim().toUpperCase();
    const email = v32NormalizeEmail(req.body?.email);
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    if (!studentId || !email) return res.status(400).json({ error: 'Student ID and registered email are required.' });
    if (!v32RateLimit(req, 'ip:' + ip, 5) || !v32RateLimit(req, 'student:' + studentId, 3)) return res.json(generic);

    const account = (await pool.query(
      'SELECT * FROM student_accounts WHERE student_id=$1 AND LOWER(email)=LOWER($2) AND status=\\'active\\' AND access_expires_at > NOW() LIMIT 1',
      [studentId, email]
    )).rows[0];
    if (!account) return res.json(generic);

    try {
      await v32IssuePasswordLink(account, 'reset', 'email');
    } catch (e) {
      console.error('V32-A reset email error:', e.message);
    }
    return res.json(generic);
  } catch (e) {
    console.error('V32-A forgot password error:', e.message);
    res.json(generic);
  }
});

app.post('/api/student/reset-password', v32PasswordCorsGuard, async (req, res) => {
  try {
    await DQ_V32_READY;
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.new_password || '');
    const confirmPassword = String(req.body?.confirm_password || '');
    if (!token || !newPassword || !confirmPassword) return res.status(400).json({ error: 'Token and all password fields are required.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ error: 'New password and confirmation do not match.' });
    if (!v32PasswordValid(newPassword)) return res.status(400).json({ error: 'Password must be 10–128 characters and include uppercase, lowercase, number, and special character.' });

    const tokenRow = await v32ConsumePasswordToken(token, 'reset');
    if (!tokenRow) return res.status(410).json({ error: 'This reset link is invalid or has expired.' });

    const account = (await pool.query('SELECT * FROM student_accounts WHERE student_id=$1 AND status=\\'active\\' LIMIT 1', [tokenRow.student_id])).rows[0];
    if (!account || new Date(account.access_expires_at) <= new Date()) return res.status(410).json({ error: 'This reset link is invalid or has expired.' });

    const hp = await hashStudentPassword(newPassword);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const consumed = await client.query('UPDATE student_password_tokens SET used_at=NOW() WHERE id=$1 AND used_at IS NULL', [tokenRow.id]);
      if (consumed.rowCount !== 1) throw new Error('Reset token was already consumed.');
      await client.query(
        'UPDATE student_accounts SET password_hash=$1,password_salt=$2,must_change_password=FALSE,password_changed_at=NOW() WHERE student_id=$3',
        [hp.hash, hp.salt, account.student_id]
      );
      await v32RevokeStudentSessions(account.student_id, client);
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true, message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (e) {
    console.error('V32-A reset password error:', e.message);
    res.status(500).json({ error: 'Unable to reset password right now.' });
  }
});

app.post('/api/student/setup-password', v32PasswordCorsGuard, async (req, res) => {
  try {
    await DQ_V32_READY;
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.new_password || '');
    const confirmPassword = String(req.body?.confirm_password || '');
    if (!token || !newPassword || !confirmPassword) return res.status(400).json({ error: 'Token and all password fields are required.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ error: 'New password and confirmation do not match.' });
    if (!v32PasswordValid(newPassword)) return res.status(400).json({ error: 'Password must be 10–128 characters and include uppercase, lowercase, number, and special character.' });

    const tokenRow = await v32ConsumePasswordToken(token, 'setup');
    if (!tokenRow) return res.status(410).json({ error: 'This setup link is invalid or has expired.' });
    const account = (await pool.query('SELECT * FROM student_accounts WHERE student_id=$1 AND status=\\'active\\' LIMIT 1', [tokenRow.student_id])).rows[0];
    if (!account || new Date(account.access_expires_at) <= new Date()) return res.status(410).json({ error: 'This setup link is invalid or has expired.' });

    const hp = await hashStudentPassword(newPassword);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const consumed = await client.query('UPDATE student_password_tokens SET used_at=NOW() WHERE id=$1 AND used_at IS NULL', [tokenRow.id]);
      if (consumed.rowCount !== 1) throw new Error('Reset token was already consumed.');
      await client.query(
        'UPDATE student_accounts SET password_hash=$1,password_salt=$2,must_change_password=FALSE,password_changed_at=NOW() WHERE student_id=$3',
        [hp.hash, hp.salt, account.student_id]
      );
      await v32RevokeStudentSessions(account.student_id, client);
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true, message: 'Password set successfully. Please sign in with your new password.' });
  } catch (e) {
    console.error('V32-A setup password error:', e.message);
    res.status(500).json({ error: 'Unable to set password right now.' });
  }
});

app.post('/api/admin/students/:studentId/send-recovery-link', adminAuth, async (req, res) => {
  try {
    await DQ_V32_READY;
    const studentId = String(req.params.studentId || '').trim().toUpperCase();
    const account = (await pool.query('SELECT * FROM student_accounts WHERE student_id=$1 LIMIT 1', [studentId])).rows[0];
    if (!account) return res.status(404).json({ error: 'Student account not found.' });
    await v32IssuePasswordLink(account, 'reset', 'email');
    res.json({ ok: true, message: 'Recovery link sent to the student’s registered email.' });
  } catch (e) {
    console.error('V32-A admin recovery error:', e.message);
    res.status(500).json({ error: 'Unable to send the recovery link.' });
  }
});

async function provisionV32ExistingAccounts() {
  try {
    const rows = (await pool.query('SELECT student_id FROM student_accounts')).rows;
    for (const row of rows) {
      await pool.query('UPDATE student_accounts SET must_change_password=FALSE WHERE student_id=$1', [row.student_id]);
    }
  } catch (e) {
    console.error('V32-A account compatibility warning:', e.message);
  }
}

const DQ_V32_READY = ensureV32PasswordSchema()
  .then(provisionV32ExistingAccounts)
  .catch(e => {
    console.error('V32-A startup error:', e.message);
    throw e;
  });

`;


const unsafeProvisionRoute = "app.get('/api/admin/provision-student-accounts', adminAuth, async (req, res) => {";
if (server.includes(unsafeProvisionRoute)) {
  const start = server.indexOf(unsafeProvisionRoute);
  const endMarker = "\n});";
  const end = server.indexOf(endMarker, start);
  if (end !== -1) {
    const routeEnd = end + endMarker.length;
    const oldRoute = server.slice(start, routeEnd);
    if (oldRoute.includes('provisionConfirmedStudentAccounts')) {
      server = server.slice(0, start) +
        "app.get('/api/admin/provision-student-accounts', adminAuth, async (req, res) => res.status(405).json({ error: 'Bulk password reset is disabled. Use per-student recovery.' }));" +
        server.slice(routeEnd);
    }
  }
}

const anchor = "app.use(express.static(__dirname));";
if (!server.includes(anchor)) {
  console.error('V32-A could not find static middleware anchor; no changes made.');
  process.exit(1);
}
server = server.replace(anchor, v32 + "\n" + anchor);
fs.writeFileSync(serverFile, server, 'utf8');

if (fs.existsSync(studentFile)) {
  let html = fs.readFileSync(studentFile, 'utf8');
  if (!html.includes('DQ_STUDENT_PORTAL_UI_V32_A')) {
    const ui = `
<!-- DQ_STUDENT_PORTAL_UI_V32_A -->
<style>
.dq-v32-card{background:#fff;border:1px solid #dfe8f1;border-radius:14px;padding:18px;margin-top:16px}
.dq-v32-card input{width:100%;margin:6px 0 10px}
.dq-v32-row{display:flex;gap:10px;flex-wrap:wrap}
.dq-v32-msg{display:none;border-radius:10px;padding:10px;margin:8px 0}
.dq-v32-msg.err{background:#fff0f0;color:#9b2525}
.dq-v32-msg.ok{background:#eefaf3;color:#176b42}
.dq-v32-link{border:0;background:none;color:#0b5cab;padding:4px 0;cursor:pointer;text-decoration:underline;font-weight:600}
</style>
<div id="dq-v32-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:9999;padding:20px;overflow:auto">
  <div class="dq-v32-card" style="max-width:520px;margin:8vh auto">
    <div class="dq-v32-row" style="justify-content:space-between;align-items:center">
      <h3 id="dq-v32-title" style="margin:0">Password Security</h3>
      <button type="button" id="dq-v32-close" class="secondary">Close</button>
    </div>
    <div id="dq-v32-msg" class="dq-v32-msg"></div>
    <form id="dq-v32-form">
      <div id="dq-v32-current-wrap"><label>Current Password</label><input id="dq-v32-current" type="password" autocomplete="current-password"></div>
      <div id="dq-v32-student-wrap" style="display:none"><label>Student ID</label><input id="dq-v32-student" autocomplete="username"></div>
      <div id="dq-v32-email-wrap" style="display:none"><label>Registered Email</label><input id="dq-v32-email" type="email" autocomplete="email"></div>
      <div id="dq-v32-new-wrap"><label>New Password</label><input id="dq-v32-new" type="password" autocomplete="new-password"></div>
      <div id="dq-v32-confirm-wrap"><label>Confirm New Password</label><input id="dq-v32-confirm" type="password" autocomplete="new-password"></div>
      <div class="muted" style="font-size:12px;margin:4px 0 12px">10–128 characters, with uppercase, lowercase, number and special character.</div>
      <div class="dq-v32-row">
        <button type="submit" id="dq-v32-submit">Save</button>
        <button type="button" id="dq-v32-forgot" class="secondary">Forgot Password</button>
      </div>
    </form>
  </div>
</div>
<script>
(function(){
  const API = '';
  const overlay = document.getElementById('dq-v32-overlay');
  if (!overlay) return;
  const title = document.getElementById('dq-v32-title');
  const msg = document.getElementById('dq-v32-msg');
  const form = document.getElementById('dq-v32-form');
  const currentWrap = document.getElementById('dq-v32-current-wrap');
  const studentWrap = document.getElementById('dq-v32-student-wrap');
  const emailWrap = document.getElementById('dq-v32-email-wrap');
  const current = document.getElementById('dq-v32-current');
  const student = document.getElementById('dq-v32-student');
  const email = document.getElementById('dq-v32-email');
  const newer = document.getElementById('dq-v32-new');
  const confirm = document.getElementById('dq-v32-confirm');
  const submit = document.getElementById('dq-v32-submit');
  const forgot = document.getElementById('dq-v32-forgot');
  let mode = 'change';
  let token = '';

  function showMessage(text, ok){
    msg.textContent = text; msg.className = 'dq-v32-msg ' + (ok ? 'ok' : 'err'); msg.style.display='block';
  }
  function setMode(next){
    mode=next; msg.style.display='none';
    const setup = next==='setup' || next==='reset';
    title.textContent = next==='change' ? 'Change Password' : (next==='forgot' ? 'Forgot Password' : (next==='setup' ? 'Set Password' : 'Reset Password'));
    currentWrap.style.display = next==='change' ? '' : 'none';
    studentWrap.style.display = next==='forgot' ? '' : 'none';
    emailWrap.style.display = next==='forgot' ? '' : 'none';
    newer.style.display = next==='forgot' ? 'none' : '';
    confirm.style.display = next==='forgot' ? 'none' : '';
    document.querySelector('#dq-v32-form .muted').style.display = next==='forgot' ? 'none' : '';
    submit.textContent = next==='change' ? 'Change Password' : (next==='forgot' ? 'Send Reset Link' : 'Set New Password');
    forgot.style.display = next==='change' ? '' : 'none';
  }
  function open(next){ overlay.style.display='block'; setMode(next||'change'); }
  function close(){ overlay.style.display='none'; }
  document.getElementById('dq-v32-close').onclick=close;
  forgot.onclick=function(){ setMode('forgot'); };
  form.onsubmit=async function(e){
    e.preventDefault(); msg.style.display='none';
    let url='', body={};
    if(mode==='change'){
      url='/api/student/change-password';
      body={current_password:current.value,new_password:newer.value,confirm_password:confirm.value};
    } else if(mode==='forgot'){
      url='/api/student/forgot-password';
      body={student_id:student.value,email:email.value};
    } else {
      url=mode==='setup'?'/api/student/setup-password':'/api/student/reset-password';
      body={token,new_password:newer.value,confirm_password:confirm.value};
    }
    try{
      const r=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await r.json().catch(()=>({error:'Unexpected server response.'}));
      if(!r.ok) return showMessage(data.error||'Request failed.',false);
      showMessage(data.message||'Done.',true);
      if(mode==='forgot'){ form.reset(); return; }
      if(mode==='change'||mode==='setup'||mode==='reset'){
        setTimeout(()=>{ window.location.href='/student-login'; },900);
      }
    }catch(err){ showMessage('Unable to complete the request. Please try again.',false); }
  };

  function installForgotLink(){
    const passwordInputs=[...document.querySelectorAll('input[type="password"]')];
    const loginPassword=passwordInputs.find(el=>!el.id.startsWith('dq-v32-'));
    if(!loginPassword) return false;
    if(document.getElementById('dq-v32-login-link')) return true;
    const link=document.createElement('button');
    link.type='button'; link.id='dq-v32-login-link'; link.className='dq-v32-link';
    link.textContent='Forgot password?';
    link.onclick=()=>open('forgot');
    loginPassword.insertAdjacentElement('afterend',link);
    return true;
  }

  async function installDashboardCard(){
    try{
      const r=await fetch('/api/student/me',{credentials:'include'});
      if(!r.ok) return;
      const host=document.querySelector('.wrap') || document.body;
      if(document.getElementById('dq-v32-dashboard-card')) return;
      const card=document.createElement('div');
      card.id='dq-v32-dashboard-card'; card.className='dq-v32-card';
      card.innerHTML='<h3>Account Security</h3><p class="muted">Keep your Student Portal password secure.</p><button type="button" id="dq-v32-change-btn">Change Password</button>';
      host.appendChild(card);
      document.getElementById('dq-v32-change-btn').onclick=()=>open('change');
    }catch(e){}
  }

  const query=new URLSearchParams(location.search);
  token=query.get('password_token')||'';
  if(token){ open('reset'); }
  else {
    installForgotLink();
    setTimeout(installForgotLink,300);
    setTimeout(installForgotLink,1000);
    installDashboardCard();
    setTimeout(installDashboardCard,500);
  }
})();
</script>
`;
    html = html.replace('</body>', ui + '\n</body>');
    fs.writeFileSync(studentFile, html, 'utf8');
  }
}

console.log('Applied Doctors Query FMGE Academy V32-A secure password patch.');
}
