const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STUDENT = path.join(ROOT, 'student.html');

if (!fs.existsSync(STUDENT)) process.exit(0);

let html = fs.readFileSync(STUDENT, 'utf8');

if (!html.includes('DQ_V32_A5_DASHBOARD_CHANGE_PASSWORD_ROBUST')) {
  const ui = String.raw`
<!-- DQ_V32_A5_DASHBOARD_CHANGE_PASSWORD_ROBUST -->
<script>
(function(){
  async function installV32A5(){
    try{
      const dashboard = document.getElementById('dashboard');
      if(!dashboard) return false;
      if(document.getElementById('dq-v32-a5-dashboard-card')) return true;

      const response = await fetch('/api/student/me', { credentials:'include' });
      if(!response.ok) return false;

      const card = document.createElement('div');
      card.id = 'dq-v32-a5-dashboard-card';
      card.className = 'dq-v32-card';
      card.setAttribute('data-patch','DQ_V32_A5_DASHBOARD_CHANGE_PASSWORD_ROBUST');
      card.innerHTML =
        '<h3>Account Security</h3>' +
        '<p class="muted">Keep your Student Portal password secure.</p>' +
        '<button type="button" id="dq-v32-a5-change-btn">Change Password</button>';

      dashboard.appendChild(card);

      const button = document.getElementById('dq-v32-a5-change-btn');
      if(button){
        button.addEventListener('click', function(){
          const overlay = document.getElementById('dq-v32-overlay');
          if(!overlay) return;
          overlay.style.display = 'block';

          const title = document.getElementById('dq-v32-title');
          const currentWrap = document.getElementById('dq-v32-current-wrap');
          const studentWrap = document.getElementById('dq-v32-student-wrap');
          const emailWrap = document.getElementById('dq-v32-email-wrap');
          const newer = document.getElementById('dq-v32-new');
          const confirm = document.getElementById('dq-v32-confirm');
          const submit = document.getElementById('dq-v32-submit');
          const forgot = document.getElementById('dq-v32-forgot');
          const msg = document.getElementById('dq-v32-msg');

          if(title) title.textContent = 'Change Password';
          if(currentWrap) currentWrap.style.display = '';
          if(studentWrap) studentWrap.style.display = 'none';
          if(emailWrap) emailWrap.style.display = 'none';
          if(newer) newer.style.display = '';
          if(confirm) confirm.style.display = '';
          if(submit) submit.textContent = 'Change Password';
          if(forgot) forgot.style.display = '';
          if(msg) msg.style.display = 'none';
        });
      }

      return true;
    }catch(e){
      return false;
    }
  }

  installV32A5();
  setTimeout(installV32A5, 300);
  setTimeout(installV32A5, 1000);
  setTimeout(installV32A5, 2000);
})();
</script>
`;
  html = html.replace('</body>', ui + '\n</body>');
  fs.writeFileSync(STUDENT, html, 'utf8');
}

console.log('Applied Doctors Query FMGE Academy V32-A.5 robust Dashboard Change Password patch.');
