const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');
if (!fs.existsSync(file)) process.exit(0);

let html = fs.readFileSync(file, 'utf8');

if (html.includes('DQ_CONTENT_UPDATE_V26')) process.exit(0);

const injection = `
<!-- DQ_CONTENT_UPDATE_V26 -->
<style id="dq-content-update-v26">
.dq-v26-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(8,24,42,.62);backdrop-filter:blur(6px);box-sizing:border-box}
.dq-v26-modal.is-open{display:flex}
.dq-v26-panel{width:min(820px,100%);max-height:min(86vh,900px);overflow:auto;background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.24);position:relative;padding:34px 34px 30px;box-sizing:border-box;color:#17324d}
.dq-v26-close{position:absolute;right:18px;top:16px;width:38px;height:38px;border:0;border-radius:50%;background:#edf3f8;color:#17324d;font-size:24px;line-height:38px;cursor:pointer}
.dq-v26-label{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.58;margin:0 0 9px}
.dq-v26-title{font-size:clamp(28px,4vw,42px);line-height:1.08;letter-spacing:-.03em;margin:0 44px 12px}
.dq-v26-updated{font-size:12px;opacity:.55;margin:0 0 24px}
.dq-v26-panel h3{font-size:17px;margin:24px 0 8px}
.dq-v26-panel p,.dq-v26-panel li{font-size:14px;line-height:1.72;opacity:.82}
.dq-v26-panel ul{padding-left:20px}
.dq-v26-note{margin-top:24px;padding:14px 16px;border-radius:13px;background:#eef5fb;font-size:12px;line-height:1.6;opacity:.82}
@media(max-width:560px){.dq-v26-modal{padding:10px}.dq-v26-panel{padding:26px 20px 24px;border-radius:18px}.dq-v26-title{font-size:30px}}
</style>
<script>
(function(){
  var SOCIAL = {
    instagram: 'https://www.instagram.com/doctorsqueryfmgeacademy/',
    youtube: 'https://youtube.com/@doctorsqueryfmgeacademy'
  };

  var POLICIES = {
    'privacy policy': {
      label: 'DOCTORS QUERY FMGE ACADEMY',
      title: 'Privacy Policy',
      html:
        '<h3>Information We Collect</h3>' +
        '<p>When you make an enquiry or enroll in the FMGE Foundation Program, we may collect information such as your name, WhatsApp number, email address, country, university and current year of MBBS. Payment details are processed through Razorpay; Doctors Query does not store your full card, UPI or banking credentials.</p>' +
        '<h3>How We Use Information</h3>' +
        '<p>Your information may be used to process enrollment, confirm payment, provide program-related communication, respond to enquiries and maintain enrollment records.</p>' +
        '<h3>Payment Processing</h3>' +
        '<p>Online payments are handled through Razorpay. Payment-related information may be processed by Razorpay according to its own policies and security practices.</p>' +
        '<h3>Data Protection</h3>' +
        '<p>We take reasonable measures to protect enrollment information and limit access to it for legitimate business and service purposes.</p>' +
        '<h3>Contact</h3>' +
        '<p>For privacy-related questions or requests concerning your enrollment information, please contact Doctors Query FMGE Academy through the contact details provided on this website.</p>'
    },
    'refund policy': {
      label: 'DOCTORS QUERY FMGE ACADEMY',
      title: 'Refund Policy',
      html:
        '<h3>Program Fee</h3>' +
        '<p>The FMGE Foundation Program is a digital education program offered for ₹999 for one year of access.</p>' +
        '<h3>Refund Requests</h3>' +
        '<p>Because access to digital learning content may begin after successful enrollment, refund requests are considered on a case-by-case basis. If you were charged but did not receive successful enrollment confirmation or access due to a technical issue attributable to the service, please contact us with your Razorpay payment details so the transaction can be reviewed.</p>' +
        '<h3>Duplicate or Incorrect Payments</h3>' +
        '<p>Duplicate payments or payments made due to a verified technical error will be reviewed and, where applicable, refunded to the original payment method.</p>' +
        '<h3>Non-Refundable Circumstances</h3>' +
        '<p>Change of mind, non-use of the program, or failure to complete the course does not by itself create an automatic entitlement to a refund after access has been provided.</p>' +
        '<h3>How to Request a Review</h3>' +
        '<p>Please contact Doctors Query FMGE Academy with your name, registered WhatsApp number or email, Enrollment ID and Razorpay Payment ID. Requests will be reviewed using the enrollment and payment records available to us.</p>'
    },
    'terms & conditions': {
      label: 'DOCTORS QUERY FMGE ACADEMY',
      title: 'Terms & Conditions',
      html:
        '<h3>Program Access</h3>' +
        '<p>The FMGE Foundation Program is an educational preparation program intended to support students studying medicine abroad and preparing progressively for FMGE/NEXT-related examinations.</p>' +
        '<h3>Student Responsibility</h3>' +
        '<p>Students are responsible for following the learning pathway, attending or watching the available lessons, practising, taking assessments and using the provided study resources appropriately.</p>' +
        '<h3>No Guaranteed Examination Result</h3>' +
        '<p>Enrollment in the program does not guarantee a particular examination score, rank, pass result, internship outcome or registration outcome. Examination performance depends on the student’s preparation, practice and performance as well as applicable rules and requirements.</p>' +
        '<h3>Content and Materials</h3>' +
        '<p>Course videos, notes, PDFs, tests, PYQs and other learning resources are provided for the enrolled student’s educational use. They should not be copied, resold, redistributed or publicly shared without permission.</p>' +
        '<h3>Fees and Payment</h3>' +
        '<p>The listed program fee is ₹999 for one year of access. Payments are processed through the payment provider shown during checkout.</p>' +
        '<h3>Changes to the Program</h3>' +
        '<p>Doctors Query FMGE Academy may update educational content, schedules, resources or website information when reasonably required to maintain or improve the program.</p>' +
        '<h3>Acceptance</h3>' +
        '<p>By enrolling in the program, the student confirms that they have read and understood these terms and agree to use the program and its materials responsibly.</p>'
    },
    'terms and conditions': {
      label: 'DOCTORS QUERY FMGE ACADEMY',
      title: 'Terms & Conditions',
      html:
        '<h3>Program Access</h3><p>The FMGE Foundation Program is an educational preparation program intended to support students studying medicine abroad and preparing progressively for FMGE/NEXT-related examinations.</p>' +
        '<h3>Student Responsibility</h3><p>Students are responsible for following the learning pathway, practising, taking assessments and using the provided study resources appropriately.</p>' +
        '<h3>No Guaranteed Examination Result</h3><p>Enrollment does not guarantee a particular examination score, rank, pass result, internship outcome or registration outcome.</p>' +
        '<h3>Content and Materials</h3><p>Course videos, notes, PDFs, tests, PYQs and other learning resources are provided for the enrolled student’s educational use and must not be copied, resold or publicly redistributed without permission.</p>' +
        '<h3>Fees and Payment</h3><p>The listed program fee is ₹999 for one year of access. Payments are processed through the payment provider shown during checkout.</p>'
    }
  };

  function cleanText(el){ return (el.textContent || '').replace(/\\s+/g,' ').trim().toLowerCase(); }

  function makeModal(){
    if(document.getElementById('dq-v26-modal')) return document.getElementById('dq-v26-modal');
    var modal=document.createElement('div');
    modal.id='dq-v26-modal';
    modal.className='dq-v26-modal';
    modal.innerHTML='<div class="dq-v26-panel" role="dialog" aria-modal="true" aria-labelledby="dq-v26-title">'+
      '<button class="dq-v26-close" type="button" aria-label="Close">×</button>'+
      '<div class="dq-v26-label" id="dq-v26-label"></div>'+
      '<h2 class="dq-v26-title" id="dq-v26-title"></h2>'+
      '<p class="dq-v26-updated">Website policy information • Doctors Query FMGE Academy</p>'+
      '<div id="dq-v26-body"></div>'+
      '<div class="dq-v26-note">This website policy text is provided for the Academy website and may be updated when required. For a matter specific to your enrollment or payment, please contact Doctors Query FMGE Academy directly.</div>'+
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',function(e){ if(e.target===modal) closeModal(); });
    modal.querySelector('.dq-v26-close').addEventListener('click',closeModal);
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeModal(); });
    return modal;
  }

  function closeModal(){
    var modal=document.getElementById('dq-v26-modal');
    if(modal) modal.classList.remove('is-open');
    document.body.style.overflow='';
  }

  function openPolicy(key){
    var data=POLICIES[key];
    if(!data) return;
    var modal=makeModal();
    modal.querySelector('#dq-v26-label').textContent=data.label;
    modal.querySelector('#dq-v26-title').textContent=data.title;
    modal.querySelector('#dq-v26-body').innerHTML=data.html;
    modal.classList.add('is-open');
    document.body.style.overflow='hidden';
  }

  function applySocialLinks(){
    Array.from(document.querySelectorAll('a')).forEach(function(a){
      var text=cleanText(a);
      var href=(a.getAttribute('href')||'').toLowerCase();
      if(text.indexOf('instagram')>=0 || href.indexOf('instagram.com')>=0){
        a.href=SOCIAL.instagram;
        a.target='_blank';
        a.rel='noopener noreferrer';
      }
      if(text.indexOf('youtube')>=0 || href.indexOf('youtube.com')>=0 || href.indexOf('youtu.be')>=0){
        a.href=SOCIAL.youtube;
        a.target='_blank';
        a.rel='noopener noreferrer';
      }
    });
  }

  function applyPolicies(){
    Array.from(document.querySelectorAll('a')).forEach(function(a){
      var text=cleanText(a);
      var key=null;
      if(text==='privacy policy' || text.indexOf('privacy policy')>=0) key='privacy policy';
      else if(text==='refund policy' || text.indexOf('refund policy')>=0) key='refund policy';
      else if(text==='terms & conditions' || text.indexOf('terms & conditions')>=0) key='terms & conditions';
      else if(text==='terms and conditions' || text.indexOf('terms and conditions')>=0) key='terms and conditions';
      if(!key) return;
      a.href='#'+key.replace(/\\s+/g,'-').replace(/&/g,'and');
      a.addEventListener('click',function(e){
        e.preventDefault();
        openPolicy(key);
      });
    });
  }

  function apply(){
    makeModal();
    applySocialLinks();
    applyPolicies();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply);
  else apply();
})();
</script>`;

html = html.replace('</body>', injection + '\n</body>');
fs.writeFileSync(file, html, 'utf8');
console.log('Applied Doctors Query FMGE Academy content update V26.');
