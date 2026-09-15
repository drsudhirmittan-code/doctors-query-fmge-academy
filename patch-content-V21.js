const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');
if (!fs.existsSync(file)) process.exit(0);
let html = fs.readFileSync(file, 'utf8');
if (html.includes('DQ_CONTENT_UPDATE_V21')) process.exit(0);

const injection = `
<!-- DQ_CONTENT_UPDATE_V21 -->
<style id="dq-content-update-v21">
.dq-subject-grid-v21{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:34px auto 0;max-width:960px;text-align:left}
.dq-subject-card-v21{background:#fff;border:1px solid rgba(31,93,155,.12);border-radius:18px;padding:22px;box-shadow:0 10px 28px rgba(18,58,96,.06);min-height:105px;box-sizing:border-box}
.dq-subject-card-v21 strong{display:block;color:#102a47;font-size:15px;line-height:1.35;margin-bottom:8px}
.dq-subject-card-v21 span{display:block;color:#6b7f95;font-size:12px;line-height:1.5}
.dq-expect-grid-v21{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:34px auto 0;max-width:960px;text-align:left}
.dq-expect-card-v21{background:#fff;border:1px solid rgba(31,93,155,.12);border-radius:18px;padding:26px;box-shadow:0 10px 28px rgba(18,58,96,.06)}
.dq-expect-card-v21 .num{font-size:12px;font-weight:700;letter-spacing:.12em;color:#1675c4;margin-bottom:24px}
.dq-expect-card-v21 h3{margin:0 0 10px;color:#102a47;font-size:17px;line-height:1.3}
.dq-expect-card-v21 p{margin:0;color:#6b7f95;font-size:13px;line-height:1.65}
.dq-expect-note-v21{max-width:960px;margin:24px auto 0;padding:18px 22px;border-radius:14px;background:rgba(15,73,120,.055);color:#49677f;font-size:13px;line-height:1.65;text-align:center}
@media(max-width:800px){.dq-subject-grid-v21,.dq-expect-grid-v21{grid-template-columns:1fr 1fr;gap:14px}.dq-subject-card-v21,.dq-expect-card-v21{padding:18px}}
@media(max-width:560px){.dq-subject-grid-v21,.dq-expect-grid-v21{grid-template-columns:1fr}.dq-subject-card-v21{min-height:0}.dq-expect-note-v21{margin-left:0;margin-right:0}}
</style>
<script>
(function(){
  function findHeading(text){
    return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).find(function(el){
      return el.textContent.replace(/\s+/g,' ').trim().toUpperCase()===text.toUpperCase();
    });
  }
  function replaceSection(headingText, html){
    var heading=findHeading(headingText); if(!heading) return false;
    var section=heading.closest('section'); if(!section) section=heading.parentElement;
    section.innerHTML=html;
    return true;
  }
  function apply(){
    replaceSection('BUILD YOUR MEDICAL FOUNDATION',
      '<div class="section-label">FOUNDATION SUBJECTS</div>'+
      '<h2>BUILD YOUR MEDICAL FOUNDATION</h2>'+
      '<p>All <strong>19 FMGE subjects</strong> are covered through a structured, concept-focused learning pathway.</p>'+
      '<div class="dq-subject-grid-v21">'+[
        'Anatomy','Physiology','Biochemistry','Pathology','Pharmacology','Microbiology','Forensic Medicine','Community Medicine','General Medicine','Psychiatry','Dermatology','Radiodiagnosis','Pediatrics','General Surgery','Orthopedics','Anesthesiology','ENT','Ophthalmology','Obstetrics & Gynaecology'
      ].map(function(s,i){
        return '<div class="dq-subject-card-v21"><strong>'+String(i+1).padStart(2,'0')+' &nbsp; '+s+'</strong><span>Covered as part of the 19-subject FMGE foundation pathway.</span></div>';
      }).join('')+'</div>'
    );

    replaceSection('WHAT STUDENTS CAN EXPECT',
      '<div class="section-label">REALISTIC EXPECTATIONS</div>'+
      '<h2>WHAT STUDENTS CAN EXPECT</h2>'+
      '<p>A properly structured preparation program designed to support students throughout a six-year MBBS journey and build long-term FMGE/NEXT readiness.</p>'+
      '<div class="dq-expect-grid-v21">'+[
        ['01','A Structured Program','A clear learning pathway designed to be followed consistently throughout your MBBS journey.'],
        ['02','Complete 19-Subject Coverage','All 19 FMGE subjects are covered through structured video lessons and concept-focused learning.'],
        ['03','Videos, Tests & Revision','Regular learning, topic-wise practice, assessments, PYQs and revision resources to help you track your preparation.']
      ].map(function(x){
        return '<div class="dq-expect-card-v21"><div class="num">'+x[0]+'</div><h3>'+x[1]+'</h3><p>'+x[2]+'</p></div>';
      }).join('')+'</div>'+
      '<div class="dq-expect-note-v21"><strong>YOUR ROLE MATTERS:</strong> Follow the program consistently, complete the learning pathway, practise regularly and assess your progress at every stage. The program is designed to build strong preparation for FMGE/NEXT; examination outcomes ultimately depend on the student’s learning, practice and performance.</div>'
    );
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
})();
</script>`;

html = html.replace('</body>', injection + '\n</body>');
fs.writeFileSync(file, html, 'utf8');
console.log('Applied Doctors Query FMGE Academy content update V21.');
