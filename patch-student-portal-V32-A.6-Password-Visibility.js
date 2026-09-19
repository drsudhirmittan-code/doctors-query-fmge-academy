const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STUDENT = path.join(ROOT, 'student.html');

if (!fs.existsSync(STUDENT)) process.exit(0);

let html = fs.readFileSync(STUDENT, 'utf8');

if (!html.includes('DQ_V32_A6_PASSWORD_VISIBILITY')) {
  const ui = String.raw`
<!-- DQ_V32_A6_PASSWORD_VISIBILITY -->
<style>
.dq-v32-password-wrap{display:flex;align-items:center;gap:8px;margin:6px 0 10px}
.dq-v32-password-wrap input{flex:1!important;width:auto!important;margin:0!important}
.dq-v32-password-toggle{height:38px;border:1px solid #d5dfeb;border-radius:9px;background:#f7fafc;color:#174b7a;padding:0 11px;font-weight:650;cursor:pointer;white-space:nowrap}
.dq-v32-password-toggle:hover{background:#eef4fb}
</style>
<script>
(function(){
  function addToggle(input){
    if(!input || input.dataset.dqPasswordToggle==='1') return;
    const wrap=document.createElement('div');
    wrap.className='dq-v32-password-wrap';
    input.parentNode.insertBefore(wrap,input);
    wrap.appendChild(input);
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='dq-v32-password-toggle';
    btn.textContent='Show';
    btn.setAttribute('aria-label','Show password');
    btn.addEventListener('click',function(){
      const visible=input.type==='text';
      input.type=visible?'password':'text';
      btn.textContent=visible?'Show':'Hide';
      btn.setAttribute('aria-label',visible?'Show password':'Hide password');
    });
    wrap.appendChild(btn);
    input.dataset.dqPasswordToggle='1';
  }

  function scan(){
    document.querySelectorAll('input[type="password"]').forEach(addToggle);
  }

  scan();
  setTimeout(scan,300);
  setTimeout(scan,1000);
  setTimeout(scan,2000);
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
})();
</script>
`;
  html = html.replace('</body>', ui + '\n</body>');
  fs.writeFileSync(STUDENT, html, 'utf8');
}

console.log('Applied Doctors Query FMGE Academy V32-A.6 password visibility patch.');
