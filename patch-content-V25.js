const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');
if (!fs.existsSync(file)) process.exit(0);

let html = fs.readFileSync(file, 'utf8');
if (html.includes('DQ_CONTENT_UPDATE_V25')) process.exit(0);

const injection = `
<!-- DQ_CONTENT_UPDATE_V25 -->
<style id="dq-content-update-v25">
.dq-v25-section{padding:88px 0!important;box-sizing:border-box}
.dq-v25-container{width:min(1120px,calc(100% - 48px));margin:0 auto}
.dq-v25-eyebrow{display:block;margin:0 0 12px;font-size:12px;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;font-weight:700}
.dq-v25-title{margin:0!important;font-size:clamp(32px,4vw,52px)!important;line-height:1.05!important;letter-spacing:-.035em!important}
.dq-v25-intro{max-width:760px;margin:16px 0 0!important;font-size:16px;line-height:1.7}
.dq-v25-subject-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:38px}
.dq-v25-subject-card{padding:22px 22px 20px;border:1px solid rgba(20,48,80,.10);border-radius:16px;background:#fff;box-shadow:0 8px 26px rgba(18,45,75,.06);min-height:118px;box-sizing:border-box}
.dq-v25-subject-number{font-size:11px;font-weight:800;letter-spacing:.12em;margin-bottom:9px;opacity:.65}
.dq-v25-subject-name{font-size:17px;font-weight:750;line-height:1.25;margin:0 0 8px}
.dq-v25-subject-desc{font-size:13px;line-height:1.55;margin:0;opacity:.68}
.dq-v25-expect-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:38px}
.dq-v25-expect-card{padding:28px;border-radius:18px;background:#fff;border:1px solid rgba(20,48,80,.10);box-shadow:0 10px 30px rgba(18,45,75,.07)}
.dq-v25-expect-num{font-size:11px;font-weight:800;letter-spacing:.12em;margin-bottom:22px;opacity:.65}
.dq-v25-expect-card h3{margin:0 0 10px;font-size:19px;line-height:1.25}
.dq-v25-expect-card p{margin:0;font-size:14px;line-height:1.65;opacity:.7}
.dq-v25-note{margin:26px auto 0;padding:20px 24px;border-radius:16px;background:rgba(224,236,248,.65);font-size:13px;line-height:1.65;max-width:980px}
.dq-v25-note strong{font-weight:800}
@media(max-width:850px){.dq-v25-subject-grid,.dq-v25-expect-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){
  .dq-v25-section{padding:64px 0!important}
  .dq-v25-container{width:min(100% - 32px,1120px)}
  .dq-v25-subject-grid,.dq-v25-expect-grid{grid-template-columns:1fr;gap:13px;margin-top:28px}
  .dq-v25-subject-card{min-height:0;padding:19px}
  .dq-v25-expect-card{padding:22px}
  .dq-v25-title{font-size:34px!important}
}
</style>
<script>
(function(){
  function norm(t){return (t||'').replace(/\\s+/g,' ').trim().toUpperCase();}
  function heading(text){
    var target=norm(text);
    return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).find(function(el){return norm(el.textContent)===target;});
  }
  function section(text){
    var h=heading(text);
    return h ? (h.closest('section') || h.parentElement) : null;
  }

  var subjects=[
    ['Anatomy','Build a strong understanding of human structure and relationships.'],
    ['Physiology','Understand normal body functions and the mechanisms behind them.'],
    ['Biochemistry','Strengthen core biochemical pathways and clinical correlations.'],
    ['Pathology','Connect disease processes with mechanisms, morphology and clinical findings.'],
    ['Pharmacology','Learn drugs through mechanisms, uses, adverse effects and clinical application.'],
    ['Microbiology','Cover important organisms, infections, diagnosis and prevention.'],
    ['Forensic Medicine','Build essential concepts in forensic medicine and toxicology.'],
    ['Community Medicine','Develop a foundation in public health, epidemiology and preventive medicine.'],
    ['General Medicine','Strengthen clinical concepts across major medicine systems and conditions.'],
    ['Psychiatry','Cover core psychiatric concepts, disorders and clinical principles.'],
    ['Dermatology','Learn common skin disorders with focused clinical understanding.'],
    ['Radiodiagnosis','Build familiarity with imaging principles and common radiological findings.'],
    ['Pediatrics','Cover essential concepts in child health, growth, development and disease.'],
    ['General Surgery','Develop a structured foundation in surgical conditions and principles.'],
    ['Orthopedics','Understand common musculoskeletal conditions, injuries and management principles.'],
    ['Anesthesiology','Cover essential anesthesia concepts, procedures and perioperative principles.'],
    ['ENT','Build core knowledge of ear, nose and throat disorders and clinical practice.'],
    ['Ophthalmology','Strengthen understanding of common eye diseases and clinical findings.'],
    ['Obstetrics & Gynaecology','Cover essential maternal, reproductive and women’s health concepts.']
  ];

  function applyContent(){
    var subject=section('BUILD YOUR MEDICAL FOUNDATION');
    var expect=section('WHAT STUDENTS CAN EXPECT');

    if(subject){
      subject.classList.add('dq-v25-section');
      subject.innerHTML='<div class="dq-v25-container">'+
        '<span class="dq-v25-eyebrow">FOUNDATION SUBJECTS</span>'+
        '<h2 class="dq-v25-title">BUILD YOUR MEDICAL FOUNDATION</h2>'+
        '<p class="dq-v25-intro">All 19 FMGE subjects are covered through a structured, concept-focused learning pathway.</p>'+
        '<div class="dq-v25-subject-grid">'+
        subjects.map(function(s,i){
          return '<article class="dq-v25-subject-card">'+
            '<div class="dq-v25-subject-number">'+String(i+1).padStart(2,'0')+'</div>'+
            '<h3 class="dq-v25-subject-name">'+s[0]+'</h3>'+
            '<p class="dq-v25-subject-desc">'+s[1]+'</p>'+
          '</article>';
        }).join('')+
        '</div></div>';
    }

    if(expect){
      expect.classList.add('dq-v25-section');
      expect.innerHTML='<div class="dq-v25-container">'+
        '<span class="dq-v25-eyebrow">REALISTIC EXPECTATIONS</span>'+
        '<h2 class="dq-v25-title">WHAT STUDENTS CAN EXPECT</h2>'+
        '<p class="dq-v25-intro">A properly structured preparation program designed to support students throughout a six-year MBBS journey and build long-term FMGE/NEXT readiness.</p>'+
        '<div class="dq-v25-expect-grid">'+
        '<article class="dq-v25-expect-card"><div class="dq-v25-expect-num">01</div><h3>A Structured Program</h3><p>A clear learning pathway designed to be followed consistently throughout your MBBS journey.</p></article>'+
        '<article class="dq-v25-expect-card"><div class="dq-v25-expect-num">02</div><h3>Complete 19-Subject Coverage</h3><p>All 19 FMGE subjects are covered through structured video lessons and concept-focused learning.</p></article>'+
        '<article class="dq-v25-expect-card"><div class="dq-v25-expect-num">03</div><h3>Videos, Tests & Revision</h3><p>Regular learning, topic-wise practice, assessments, PYQs and revision resources to help you track your preparation.</p></article>'+
        '</div>'+
        '<div class="dq-v25-note"><strong>YOUR ROLE MATTERS:</strong> Follow the program consistently, complete the learning pathway, practise regularly and assess your progress at every stage. The program is designed to build strong preparation for FMGE/NEXT; examination outcomes ultimately depend on the student’s learning, practice and performance.</div>'+
        '</div>';
    }
  }

  function reorder(){
    var subject=section('BUILD YOUR MEDICAL FOUNDATION');
    var expect=section('WHAT STUDENTS CAN EXPECT');
    var plan=section('A STRUCTURED PLAN. TESTED AT EVERY STEP.');
    var why=section('WHY LEARN WITH DOCTORS QUERY?') || section('WHY LEARN WITH DOCTORS QUERY');
    var mentor=section('MEET YOUR MENTOR');

    if(!subject||!expect||!plan||!why||!mentor) return;
    var parent=subject.parentElement;
    if(!parent || expect.parentElement!==parent || plan.parentElement!==parent || why.parentElement!==parent || mentor.parentElement!==parent) return;

    parent.insertBefore(expect,subject.nextSibling);
    parent.insertBefore(plan,expect.nextSibling);
    parent.insertBefore(why,plan.nextSibling);
    parent.insertBefore(mentor,why.nextSibling);
  }

  function apply(){
    applyContent();
    reorder();
    setTimeout(reorder,50);
    setTimeout(reorder,300);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply);
  else apply();
})();
</script>`;

html=html.replace('</body>', injection+'\\n</body>');
fs.writeFileSync(file,html,'utf8');
console.log('Applied Doctors Query FMGE Academy content update V25.');
