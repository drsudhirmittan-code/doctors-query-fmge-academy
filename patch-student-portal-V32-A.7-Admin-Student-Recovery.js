const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server.js');
const ADMIN = path.join(ROOT, 'admin.html');

if (fs.existsSync(SERVER)) {
  let server = fs.readFileSync(SERVER, 'utf8');

  if (!server.includes('DQ_V32_A7_ADMIN_STUDENT_ACCOUNTS')) {
    const marker = '// DQ_V32_A7_ADMIN_STUDENT_ACCOUNTS';
    const block = `
${marker}
app.get('/api/admin/student-accounts', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT student_id,name,email,whatsapp,university,country,year,status,access_expires_at,must_change_password,password_changed_at,created_at FROM student_accounts ORDER BY id DESC'
    );
    res.json({ accounts: result.rows });
  } catch (e) {
    console.error('Admin student accounts error:', e.message);
    res.status(500).json({ error: 'Unable to load student accounts.' });
  }
});
`;
    const anchor = 'app.use(express.static(__dirname));';

    if (!server.includes(anchor)) {
      console.error('V32-A.7 could not find static middleware anchor.');
      process.exit(1);
    }

    server = server.replace(anchor, block + '\\n' + anchor);
    fs.writeFileSync(SERVER, server, 'utf8');
  }
}

if (fs.existsSync(ADMIN)) {
  let html = fs.readFileSync(ADMIN, 'utf8');

  if (!html.includes('DQ_V32_A7_ADMIN_STUDENT_ACCOUNTS')) {
    const css = String.raw`
<style>
.dq-v32-a7-panel{background:#fff;border:1px solid #e2e9f2;border-radius:14px;padding:16px;margin:0 0 14px;box-shadow:0 5px 18px rgba(20,45,75,.06)}
.dq-v32-a7-panel h2{margin:0 0 5px;font-size:18px}
.dq-v32-a7-panel p{margin:0 0 12px;color:#68788c;font-size:13px}
.dq-v32-a7-table{border-collapse:collapse;width:100%;min-width:1050px}
.dq-v32-a7-table th,.dq-v32-a7-table td{padding:11px 12px;border-bottom:1px solid #edf1f5;text-align:left;font-size:13px;vertical-align:top}
.dq-v32-a7-table th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#617187}
.dq-v32-a7-action{border:0;border-radius:8px;padding:8px 10px;background:#0b5cab;color:#fff;font-weight:650;cursor:pointer}
.dq-v32-a7-action:disabled{opacity:.55;cursor:wait}
.dq-v32-a7-note{font-size:12px;color:#68788c;margin-top:10px}
.dq-v32-a7-status{font-size:12px;margin-left:8px}
</style>
`;
    html = html.replace('</head>', css + '\\n</head>');

    const panel = String.raw`
<!-- DQ_V32_A7_ADMIN_STUDENT_ACCOUNTS -->
<div class="dq-v32-a7-panel">
  <h2>Student Account Security</h2>
  <p>Manage student password recovery from the admin panel. The existing secure recovery-link flow is used; student passwords are never displayed.</p>
  <div class="toolbar" style="padding:0;border:0;box-shadow:none;margin:0 0 10px">
    <input id="dq-v32-a7-student-search" placeholder="Search Student ID, name, email or university…">
    <button onclick="dqV32A7LoadStudents()">Refresh Students</button>
  </div>
  <div class="tablebox" style="box-shadow:none">
    <table class="dq-v32-a7-table">
      <thead><tr><th>Student ID</th><th>Student</th><th>Email</th><th>University</th><th>Status</th><th>Access Until</th><th>Password Status</th><th>Action</th></tr></thead>
      <tbody id="dq-v32-a7-student-body"></tbody>
    </table>
    <div id="dq-v32-a7-student-empty" class="empty" style="display:none">No student accounts found.</div>
  </div>
  <div class="dq-v32-a7-note">Send Reset Link creates a fresh one-time recovery link for the student's registered email. Previous unused recovery links are invalidated.</div>
</div>
`;

    const tableMarker = '<div class="tablebox"><table><thead><tr><th>Date</th>';
    if (!html.includes(tableMarker)) {
      console.error('V32-A.7 could not locate enrollment table.');
      process.exit(1);
    }
    html = html.replace(tableMarker, panel + '\\n' + tableMarker);

    const script = String.raw`
<script>
let dqV32A7Students=[];

async function dqV32A7LoadStudents(){
  try{
    const r=await fetch('/api/admin/student-accounts',{credentials:'same-origin'});
    if(!r.ok) throw new Error(r.status===401?'Admin authentication required.':'Unable to load student accounts.');
    const d=await r.json();
    dqV32A7Students=d.accounts||[];
    dqV32A7RenderStudents();
  }catch(e){
    alert(e.message||'Unable to load student accounts.');
  }
}

function dqV32A7Esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function dqV32A7RenderStudents(){
  const q=(document.getElementById('dq-v32-a7-student-search')?.value||'').toLowerCase().trim();
  const rows=dqV32A7Students.filter(x=>!q||[
    x.student_id,x.name,x.email,x.university,x.country,x.whatsapp
  ].join(' ').toLowerCase().includes(q));

  const body=document.getElementById('dq-v32-a7-student-body');
  const empty=document.getElementById('dq-v32-a7-student-empty');
  empty.style.display=rows.length?'none':'block';

  body.innerHTML=rows.map(x=>{
    const state=x.must_change_password?'Reset required':'Active';
    return `<tr>
      <td><strong>${dqV32A7Esc(x.student_id)}</strong></td>
      <td>${dqV32A7Esc(x.name)}</td>
      <td>${dqV32A7Esc(x.email)}</td>
      <td>${dqV32A7Esc(x.university)}</td>
      <td>${dqV32A7Esc(x.status)}</td>
      <td>${dqV32A7Esc(x.access_expires_at?new Date(x.access_expires_at).toLocaleDateString():'—')}</td>
      <td>${dqV32A7Esc(state)}</td>
      <td><button class="dq-v32-a7-action" type="button" onclick="dqV32A7SendReset('${dqV32A7Esc(x.student_id)}',this)">Send Reset Link</button><span class="dq-v32-a7-status" id="dq-v32-a7-status-${dqV32A7Esc(x.student_id)}"></span></td>
    </tr>`;
  }).join('');
}

async function dqV32A7SendReset(studentId,button){
  if(!confirm('Send a fresh password recovery link to this student’s registered email?')) return;
  const status=document.getElementById('dq-v32-a7-status-'+studentId);
  button.disabled=true;
  status.textContent='Sending…';
  try{
    const r=await fetch('/api/admin/students/'+encodeURIComponent(studentId)+'/send-recovery-link',{method:'POST',credentials:'same-origin'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'Unable to send recovery link.');
    status.textContent='Sent ✓';
  }catch(e){
    status.textContent='Failed';
    alert(e.message||'Unable to send recovery link.');
  }finally{
    button.disabled=false;
  }
}

document.getElementById('dq-v32-a7-student-search').addEventListener('input',dqV32A7RenderStudents);
dqV32A7LoadStudents();
</script>
`;

    html = html.replace('</body>', script + '\\n</body>');
    fs.writeFileSync(ADMIN, html, 'utf8');
  }
}

console.log('Applied Doctors Query FMGE Academy V32-A.7 Admin Student Account Recovery UI.');
