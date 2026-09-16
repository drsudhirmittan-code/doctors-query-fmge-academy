const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');
if (!fs.existsSync(file)) {
  console.error('FMGE Academy HTML file not found:', file);
  process.exit(1);
}

let html = fs.readFileSync(file, 'utf8');

if (html.includes('DQ_BRAND_SCHEMA_V29')) {
  console.log('Doctors Query FMGE Academy brand schema V29 already applied.');
  process.exit(0);
}

const marker = '<!-- DQ_BRAND_SCHEMA_V29 -->';

const schema = `
${marker}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://doctorsqueryfmgeacademy.com/#website",
      "url": "https://doctorsqueryfmgeacademy.com/",
      "name": "Doctors Query FMGE Academy",
      "alternateName": [
        "Doctors Query FMG Academy",
        "Doctors Query FMGE Academy | FMGE Foundation Program"
      ],
      "description": "Doctors Query FMGE Academy offers the FMGE Foundation Program for foreign medical students and foreign medical graduates, with structured coverage of all 19 FMGE subjects.",
      "publisher": {
        "@id": "https://doctorsqueryfmgeacademy.com/#organization"
      }
    },
    {
      "@type": "Organization",
      "@id": "https://doctorsqueryfmgeacademy.com/#organization",
      "name": "Doctors Query FMGE Academy",
      "alternateName": "Doctors Query FMG Academy",
      "legalName": "Doctors Query Private Limited",
      "url": "https://doctorsqueryfmgeacademy.com/",
      "sameAs": [
        "https://www.instagram.com/doctorsqueryfmgeacademy/",
        "https://youtube.com/@doctorsqueryfmgeacademy"
      ],
      "parentOrganization": {
        "@type": "Organization",
        "name": "Doctors Query Private Limited"
      }
    },
    {
      "@type": "Person",
      "@id": "https://doctorsqueryfmgeacademy.com/#dr-sudhir-mittan",
      "name": "Dr. Sudhir Mittan",
      "url": "https://doctorsqueryfmgeacademy.com/",
      "worksFor": {
        "@id": "https://doctorsqueryfmgeacademy.com/#organization"
      }
    }
  ]
}
</script>
`;

const headAnchor = '</head>';
if (!html.includes(headAnchor)) {
  console.error('Could not find </head> in Academy HTML.');
  process.exit(1);
}

html = html.replace(headAnchor, schema + '\n' + headAnchor);
fs.writeFileSync(file, html, 'utf8');

console.log('Applied Doctors Query FMGE Academy brand schema V29.');
