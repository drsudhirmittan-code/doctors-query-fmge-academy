const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;

// V31 is cumulative: apply the complete public-site baseline first.
const baselinePatch = path.join(ROOT, 'patch-content-V30.js');
if (fs.existsSync(baselinePatch)) require(baselinePatch);

const serverFile = path.join(ROOT, 'server.js');
const publicFile = path.join(ROOT, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');
const studentFile = path.join(ROOT, 'student.html');

if (!fs.existsSync(serverFile)) process.exit(0);
let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes('DQ_STUDENT_PORTAL_V31')) {
  const marker = '// DQ_STUDENT_PORTAL_V31\\n';

  const studentHelpers = `
${marker}
function randomStudentId() {
  return 'DQST-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
function randomTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
  let out = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length];
  return out;
}
function hashStudentPassword(password, salt) {
  return new Promise((resolve, reject) => {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, useSalt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      resolve({ salt: useSalt, hash: derived.toString('hex') });
    });
  });
}
async function verifyStudentPassword(password, salt, expectedHash) {
  const result = await hashStudentPassword(password, salt);
  const a = Buffer.from(result.hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
async function createStudentAccountForEnrollment(enrollmentId) {
  const found = await pool.query('SELECT * FROM student_accounts WHERE enrollment_id=$1 LIMIT 1', [enrollmentId]);
  const enrollment = (await pool.query('SELECT * FROM enrollments WHERE enrollment_id=$1 LIMIT 1', [enrollmentId])).rows[0];
  if (!enrollment || enrollment.status !== 'confirmed') return null;

  if (found.rows[0]) {
    return { account: found.rows[0], temporaryPassword: null, activationToken: '' };
  }

  const studentId = randomStudentId();
  const temporaryPassword = randomTempPassword();
  const hp = await hashStudentPassword(temporaryPassword);

  const result = await pool.query(
    \`INSERT INTO student_accounts
      (student_id,enrollment_id,name,email,whatsapp,university,country,year,password_hash,password_salt,access_started_at,access_expires_at,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')
     RETURNING student_id,enrollment_id,name,email,whatsapp,university,country,year,access_started_at,access_expires_at,status\`,
    [
      studentId, enrollment.enrollment_id, enrollment.name, enrollment.email, enrollment.whatsapp,
      enrollment.university, enrollment.country, enrollment.year, hp.hash, hp.salt,
      new Date().toISOString(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    ]
  );

  const activationToken = crypto.randomBytes(32).toString('hex');
  await pool.query(
    \`INSERT INTO student_activation_tokens (token_hash,student_id,temporary_password,expires_at)
     VALUES ($1,$2,$3,$4)\`,
    [hashSessionToken(activationToken), studentId, temporaryPassword, new Date(Date.now() + 30 * 60 * 1000).toISOString()]
  );

  return { account: result.rows[0], temporaryPassword, activationToken };
}

async function studentFromRequest(req) {
  const cookieHeader = req.get('Cookie') || '';
  const token = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith('dq_student_session='))?.slice('dq_student_session='.length) || '';
  if (!token) return null;
  const row = (await pool.query(
    \`SELECT s.* FROM student_sessions ss
     JOIN student_accounts s ON s.student_id=ss.student_id
     WHERE ss.token_hash=$1 AND ss.expires_at > NOW() AND s.status='active'
       AND s.access_expires_at > NOW()\`,
    [hashSessionToken(token)]
  )).rows[0];
  return row || null;
}
`;

  const dbBlock = `
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS student_accounts (
      id SERIAL PRIMARY KEY,
      student_id TEXT NOT NULL UNIQUE,
      enrollment_id TEXT NOT NULL UNIQUE REFERENCES enrollments(enrollment_id),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      university TEXT NOT NULL,
      country TEXT NOT NULL,
      year TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      access_started_at TIMESTAMPTZ NOT NULL,
      access_expires_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_student_accounts_email ON student_accounts(email);
    CREATE TABLE IF NOT EXISTS student_sessions (
      id SERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL REFERENCES student_accounts(student_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_student_sessions_student_id ON student_sessions(student_id);
    CREATE TABLE IF NOT EXISTS student_activation_tokens (
      id SERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL REFERENCES student_accounts(student_id) ON DELETE CASCADE,
      temporary_password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_student_activation_tokens_student_id ON student_activation_tokens(student_id);
  \`);
`;

  if (server.includes("const app = express();")) {
    server = server.replace("const app = express();", studentHelpers + "\nconst app = express();");
  }

  server = server.replace(
    "const pool = new Pool({ connectionString: DATABASE_URL });",
    "const pool = new Pool({ connectionString: DATABASE_URL });"
  );

  server = server.replace(
    "app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN }));",
    "app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN, credentials: true }));"
  );

  const dbAnchor = "  console.log('PostgreSQL database initialized.');";
  if (server.includes(dbAnchor)) {
    server = server.replace(dbAnchor, dbBlock + "\n" + dbAnchor);
  }

  // Create an account immediately when payment is confirmed.
  server = server.replace(
    "  return row;\\n}\\n\\n// Webhook route",
    "  const updated = (await pool.query('SELECT * FROM enrollments WHERE id=$1', [row.id])).rows[0];\n  if (updated?.status === 'confirmed') await createStudentAccountForEnrollment(updated.enrollment_id);\n  return updated || row;\n}\n\n// Webhook route"
  );

  // Add student routes before the static frontend middleware.
  const routeAnchor = "app.use(express.static(__dirname));";
  const routes = `
app.get('/student-login', (req, res) => res.sendFile(path.join(__dirname, 'student.html')));
app.get('/student-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'student.html')));

app.get('/api/student/activate', async (req, res) => {
  try {
    const token = clean(req.query.token);
    if (!token) return res.status(400).json({ error: 'Activation token is required.' });
    const row = (await pool.query(
      'SELECT * FROM student_activation_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
      [hashSessionToken(token)]
    )).rows[0];
    if (!row) return res.status(410).json({ error: 'This activation link is invalid or has expired.' });
    await pool.query('UPDATE student_activation_tokens SET used_at=NOW() WHERE id=$1', [row.id]);
    const account = (await pool.query(
      'SELECT student_id,name,email,university,country,year,access_started_at,access_expires_at,status FROM student_accounts WHERE student_id=$1',
      [row.student_id]
    )).rows[0];
    res.json({ student: account, temporary_password: row.temporary_password });
  } catch (e) {
    console.error('Activation error:', e.message);
    res.status(500).json({ error: 'Unable to activate the student account.' });
  }
});

app.post('/api/student/login', async (req, res) => {
  try {
    const studentId = clean(req.body.student_id).toUpperCase();
    const password = clean(req.body.password);
    if (!studentId || !password) return res.status(400).json({ error: 'Student ID and password are required.' });
    const account = (await pool.query('SELECT * FROM student_accounts WHERE student_id=$1 LIMIT 1', [studentId])).rows[0];
    if (!account || account.status !== 'active' || new Date(account.access_expires_at) <= new Date()) {
      return res.status(401).json({ error: 'Invalid Student ID, password, or expired access.' });
    }
    if (!(await verifyStudentPassword(password, account.password_salt, account.password_hash))) {
      return res.status(401).json({ error: 'Invalid Student ID or password.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO student_sessions(token_hash,student_id,expires_at) VALUES($1,$2,$3)',
      [hashSessionToken(token), account.student_id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );
    res.cookie('dq_student_session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
    res.json({ ok: true, student: { student_id: account.student_id, name: account.name, access_expires_at: account.access_expires_at } });
  } catch (e) {
    console.error('Student login error:', e.message);
    res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

app.get('/api/student/me', async (req, res) => {
  try {
    const account = await studentFromRequest(req);
    if (!account) return res.status(401).json({ error: 'Not signed in.' });
    res.json({ student: {
      student_id: account.student_id, name: account.name, email: account.email,
      whatsapp: account.whatsapp, university: account.university, country: account.country,
      year: account.year, access_started_at: account.access_started_at,
      access_expires_at: account.access_expires_at
    }});
  } catch (e) {
    res.status(500).json({ error: 'Unable to load student profile.' });
  }
});

app.post('/api/student/logout', async (req, res) => {
  try {
    const cookieHeader = req.get('Cookie') || '';
    const token = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith('dq_student_session='))?.slice('dq_student_session='.length) || '';
    if (token) await pool.query('DELETE FROM student_sessions WHERE token_hash=$1', [hashSessionToken(token)]);
    res.clearCookie('dq_student_session', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to log out.' });
  }
});

`;
  if (server.includes(routeAnchor)) server = server.replace(routeAnchor, routes + routeAnchor);

  // Callback: create account and issue one-time activation URL.
  const callbackNeedle = "return res.redirect(`/?payment=success&enrollment_id=${encodeURIComponent(row.enrollment_id)}&payment_id=${encodeURIComponent(paymentId)}`);";
  if (server.includes(callbackNeedle)) {
    server = server.replace(
      callbackNeedle,
      "const activation = await createStudentAccountForEnrollment(row.enrollment_id);\n      if (activation?.activationToken) {\n        return res.redirect('/student-dashboard?activated=1&token=' + encodeURIComponent(activation.activationToken));\n      }\n      return res.redirect('/student-dashboard');"
    );
  }

  fs.writeFileSync(serverFile, server, 'utf8');
  console.log('Applied Doctors Query FMGE Academy Student Portal V31 backend.');
}

// Create the student portal UI.
if (!fs.existsSync(studentFile) || !fs.readFileSync(studentFile, 'utf8').includes('DQ_STUDENT_PORTAL_UI_V31')) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Doctors Query FMGE Academy — Student Portal</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7fb;color:#152238}
header{background:linear-gradient(135deg,#092f57,#0b5cab);color:#fff;padding:22px 24px}.wrap{max-width:1100px;margin:26px auto;padding:0 16px}.card{background:#fff;border:1px solid #e1e8f0;border-radius:18px;padding:24px;box-shadow:0 8px 30px rgba(15,40,70,.07);margin-bottom:18px}
h1,h2,h3{margin-top:0}.muted{color:#68788c}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.module{padding:18px;border:1px solid #e0e8f1;border-radius:14px;background:#fbfdff}.locked{opacity:.72}.tag{display:inline-block;padding:5px 9px;border-radius:999px;background:#edf5ff;color:#15548b;font-size:11px;font-weight:700}
input{width:100%;height:46px;border:1px solid #cfd9e5;border-radius:10px;padding:0 13px;font-size:15px;margin:6px 0 12px}button{height:46px;border:0;border-radius:10px;padding:0 18px;background:#0b5cab;color:#fff;font-weight:700;cursor:pointer}button.secondary{background:#edf3f9;color:#164a78}.error{display:none;background:#fff0f0;color:#9b2525;border-radius:10px;padding:12px;margin-bottom:12px}.success{background:#eefaf3;color:#176b42;border-radius:12px;padding:14px;margin-bottom:14px}.credentials{background:#f5f9ff;border:1px dashed #9bb8d4;border-radius:12px;padding:16px;margin-top:14px;font-family:ui-monospace,monospace}.row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
@media(max-width:800px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header><div class="wrap" style="margin:0 auto"><strong>DOCTORS QUERY</strong><div style="font-size:13px;opacity:.85">FMGE ACADEMY • STUDENT PORTAL</div></div></header>
<div class="wrap">
<div id="activation" class="card" style="display:none">
<h2>Welcome to FMGE Foundation Program</h2>
<p class="muted">Your payment has been verified and your student account has been created.</p>
<div id="activationMessage"></div>
</div>
<div id="login" class="card">
<h2>Student Login</h2>
<p class="muted">Use the Student ID and password provided after your enrollment.</p>
<div id="loginError" class="error"></div>
<form id="loginForm">
<label>Student ID</label><input id="studentId" autocomplete="username" placeholder="DQST-XXXXXXXX" required>
<label>Password</label><input id="password" type="password" autocomplete="current-password" required>
<button type="submit">LOGIN TO STUDENT PORTAL</button>
</form>
</div>
<div id="dashboard" style="display:none">
<div class="card"><div class="row"><div><h2 id="welcome">Student Dashboard</h2><div id="profile" class="muted"></div></div><button class="secondary" onclick="logout()">Logout</button></div></div>
<div class="card"><h2>FMGE Foundation Program</h2><p class="muted">Your learning dashboard is active. Course content modules will be added through the Academy Admin Control Room.</p>
<div class="grid">
<div class="module"><span class="tag">19 SUBJECTS</span><h3>Foundation Subjects</h3><p class="muted">All 19 FMGE subjects will be organized here.</p></div>
<div class="module locked"><span class="tag">COMING NEXT</span><h3>Recorded Lectures</h3><p class="muted">Protected course videos will be available here.</p></div>
<div class="module locked"><span class="tag">COMING NEXT</span><h3>Study Materials</h3><p class="muted">Protected PDF study material library.</p></div>
<div class="module locked"><span class="tag">COMING NEXT</span><h3>Tests & PYQs</h3><p class="muted">Topic tests, monthly tests, subject tests and Grand Tests.</p></div>
<div class="module locked"><span class="tag">COMING NEXT</span><h3>Rapid Revision</h3><p class="muted">Revision resources for structured preparation.</p></div>
<div class="module"><span class="tag">ACCESS</span><h3>1-Year Access</h3><p id="expiry" class="muted"></p></div>
</div></div>
</div>
</div>
<script>
// DQ_STUDENT_PORTAL_UI_V31
const $=id=>document.getElementById(id);
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
async function api(url,opts={}){const r=await fetch(url,{credentials:'same-origin',...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d;}
async function loadMe(){try{const d=await api('/api/student/me');$('login').style.display='none';$('dashboard').style.display='block';$('welcome').textContent='Welcome, '+d.student.name;$('profile').textContent=d.student.student_id+' • '+d.student.university;$('expiry').textContent='Access until '+new Date(d.student.access_expires_at).toLocaleDateString();return true}catch{return false}}
async function activation(){const p=new URLSearchParams(location.search);const token=p.get('token');if(!token)return false;try{const d=await api('/api/student/activate?token='+encodeURIComponent(token));$('activation').style.display='block';$('activationMessage').innerHTML='<div class="success">Your Student ID and temporary password are ready. Save them securely before continuing.</div><div class="credentials"><div><strong>Student ID:</strong> '+esc(d.student.student_id)+'</div><div style="margin-top:8px"><strong>Temporary Password:</strong> '+esc(d.temporary_password)+'</div></div><p class="muted" style="margin-bottom:0">Use these credentials below to log in. The activation link is one-time and expires shortly.</p>';return true}catch(e){$('activation').style.display='block';$('activationMessage').innerHTML='<div class="error" style="display:block">'+esc(e.message)+'</div>';return false}}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').style.display='none';try{const d=await api('/api/student/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({student_id:$('studentId').value,password:$('password').value})});$('activation').style.display='none';await loadMe()}catch(e){$('loginError').textContent=e.message;$('loginError').style.display='block'}});
async function logout(){await api('/api/student/logout',{method:'POST'});location.reload()}
(async()=>{await activation();await loadMe()})();
</script>
</body></html>`;
  fs.writeFileSync(studentFile, html, 'utf8');
  console.log('Created Doctors Query FMGE Academy Student Portal V31.');
}

// Make the existing public Login navigation point to the portal.
if (fs.existsSync(publicFile)) {
  let html = fs.readFileSync(publicFile, 'utf8');
  if (!html.includes('DQ_STUDENT_LOGIN_LINK_V31')) {
    const inject = `
<!-- DQ_STUDENT_LOGIN_LINK_V31 -->
<script>
document.addEventListener('click', function(e){
  const el=e.target.closest('a,button');
  if(!el) return;
  const text=(el.textContent||'').trim().toLowerCase();
  if(text==='login' || text==='student login'){
    e.preventDefault();
    window.location.href='/student-login';
  }
});
</script>
`;
    html = html.replace('</body>', inject + '\n</body>');
    fs.writeFileSync(publicFile, html, 'utf8');
    console.log('Connected public Login button to Student Portal V31.');
  }
}
