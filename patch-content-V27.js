const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');
if (!fs.existsSync(file)) process.exit(0);

let html = fs.readFileSync(file, 'utf8');

if (html.includes('DQ_CONTENT_UPDATE_V27')) process.exit(0);

const injection = `
<!-- DQ_CONTENT_UPDATE_V27 -->
<script>
(function(){
  var DQ_SOCIAL_LINKS = {
    instagram: 'https://www.instagram.com/doctorsqueryfmgeacademy/',
    youtube: 'https://youtube.com/@doctorsqueryfmgeacademy'
  };

  function normalizedText(el){
    return ((el && el.textContent) || '').replace(/\\s+/g,' ').trim().toLowerCase();
  }

  function isInstagram(el){
    var text = normalizedText(el);
    var href = ((el && el.getAttribute && el.getAttribute('href')) || '').toLowerCase();
    return text.indexOf('instagram') >= 0 || href.indexOf('instagram.com') >= 0;
  }

  function isYouTube(el){
    var text = normalizedText(el);
    var href = ((el && el.getAttribute && el.getAttribute('href')) || '').toLowerCase();
    return text.indexOf('youtube') >= 0 || href.indexOf('youtube.com') >= 0 || href.indexOf('youtu.be') >= 0;
  }

  function findSocialTarget(start){
    var el = start;
    for(var i=0; el && i<6; i++, el=el.parentElement){
      var text = normalizedText(el);
      if(text === 'instagram' || text === 'youtube' || text === 'youtube channel' || text === 'instagram channel') return el;
      if((text.indexOf('instagram') >= 0 || text.indexOf('youtube') >= 0) && text.length <= 120) return el;
    }
    return null;
  }

  function applyExistingLinks(){
    Array.from(document.querySelectorAll('a')).forEach(function(a){
      if(isInstagram(a)){
        a.setAttribute('href', DQ_SOCIAL_LINKS.instagram);
        a.setAttribute('target','_blank');
        a.setAttribute('rel','noopener noreferrer');
      } else if(isYouTube(a)){
        a.setAttribute('href', DQ_SOCIAL_LINKS.youtube);
        a.setAttribute('target','_blank');
        a.setAttribute('rel','noopener noreferrer');
      }
    });
  }

  document.addEventListener('click', function(e){
    var target = findSocialTarget(e.target);
    if(!target) return;

    var text = normalizedText(target);
    var url = null;
    if(text.indexOf('instagram') >= 0) url = DQ_SOCIAL_LINKS.instagram;
    else if(text.indexOf('youtube') >= 0) url = DQ_SOCIAL_LINKS.youtube;

    if(!url) return;

    e.preventDefault();
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  }, true);

  function apply(){
    applyExistingLinks();
    setTimeout(applyExistingLinks, 100);
    setTimeout(applyExistingLinks, 500);
    setTimeout(applyExistingLinks, 1500);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
</script>`;

html = html.replace('</body>', injection + '\n</body>');
fs.writeFileSync(file, html, 'utf8');
console.log('Applied Doctors Query FMGE Academy social-link fix V27.');
