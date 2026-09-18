const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STUDENT = path.join(ROOT, 'student.html');

if (!fs.existsSync(STUDENT)) process.exit(0);

let html = fs.readFileSync(STUDENT, 'utf8');

if (!html.includes('DQ_V32_A3_CHANGE_PASSWORD_VISIBILITY')) {
  const start = html.indexOf('  async function installDashboardCard(){');
  const end = html.indexOf('\n  const query=new URLSearchParams(location.search);', start);
  if (start < 0 || end < 0) {
    console.error('V32-A.3 could not locate dashboard card function.');
    process.exit(1);
  }

  const replacement = String.raw`  async function installDashboardCard(){
    try{
      const r=await fetch('/api/student/me',{credentials:'include'});
      if(!r.ok) return;

      const dashboard=document.getElementById('dashboard');
      if(!dashboard) return;

      if(document.getElementById('dq-v32-dashboard-card')) return;

      const card=document.createElement('div');
      card.id='dq-v32-dashboard-card';
      card.className='dq-v32-card';
      card.setAttribute('data-patch','DQ_V32_A3_CHANGE_PASSWORD_VISIBILITY');
      card.innerHTML='<h3>Account Security</h3><p class="muted">Keep your Student Portal password secure.</p><button type="button" id="dq-v32-change-btn">Change Password</button>';

      dashboard.appendChild(card);

      const button=document.getElementById('dq-v32-change-btn');
      if(button){
        button.onclick=function(){ open('change'); };
      }
    }catch(e){}
  }

`;

  html = html.slice(0,start) + replacement + html.slice(end);
  fs.writeFileSync(STUDENT, html, 'utf8');
}

console.log('Applied Doctors Query FMGE Academy V32-A.3 Change Password visibility patch.');
