const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');
if (!fs.existsSync(file)) process.exit(0);

let html = fs.readFileSync(file, 'utf8');
if (html.includes('DQ_CONTENT_UPDATE_V24')) process.exit(0);

const injection = `
<!-- DQ_CONTENT_UPDATE_V24 -->
<style id="dq-content-update-v24">
/* V24 keeps the existing premium design and only corrects section order. */
</style>
<script>
(function(){
  function normalize(text){
    return (text || '').replace(/\\s+/g,' ').trim().toUpperCase();
  }

  function findHeading(text){
    var target = normalize(text);
    return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).find(function(el){
      return normalize(el.textContent) === target;
    });
  }

  function sectionFor(text){
    var h = findHeading(text);
    return h ? (h.closest('section') || h.parentElement) : null;
  }

  function reorder(){
    var subject = sectionFor('BUILD YOUR MEDICAL FOUNDATION');
    var expect = sectionFor('WHAT STUDENTS CAN EXPECT');
    var plan = sectionFor('A STRUCTURED PLAN. TESTED AT EVERY STEP.');
    var why = sectionFor('WHY LEARN WITH DOCTORS QUERY?') || sectionFor('WHY LEARN WITH DOCTORS QUERY');
    var mentor = sectionFor('MEET YOUR MENTOR');

    if(!subject || !expect || !plan || !why || !mentor) return;

    /*
      Put the five sections into the intended reading flow:
      19 Subjects
      -> What Students Can Expect
      -> Structured Plan
      -> Why Learn With Doctors Query?
      -> Meet Your Mentor
    */
    var parent = subject.parentElement;
    if(!parent || expect.parentElement !== parent || plan.parentElement !== parent ||
       why.parentElement !== parent || mentor.parentElement !== parent) return;

    parent.insertBefore(expect, subject.nextSibling);
    parent.insertBefore(plan, expect.nextSibling);
    parent.insertBefore(why, plan.nextSibling);
    parent.insertBefore(mentor, why.nextSibling);
  }

  function apply(){
    reorder();
    setTimeout(reorder, 50);
    setTimeout(reorder, 300);
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
</script>`;

html = html.replace('</body>', injection + '\n</body>');
fs.writeFileSync(file, html, 'utf8');
console.log('Applied Doctors Query FMGE Academy content update V24.');
