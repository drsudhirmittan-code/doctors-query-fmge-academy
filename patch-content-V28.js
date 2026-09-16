const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server.js');
if (!fs.existsSync(file)) process.exit(0);

let server = fs.readFileSync(file, 'utf8');

if (server.includes('DQ_SEO_ROUTES_V28')) process.exit(0);

const marker = "// DQ_SEO_ROUTES_V28\n";
const seoRoutes = `${marker}const DQ_SITE_URL = 'https://doctorsqueryfmgeacademy.com';

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\\nAllow: /\\nSitemap: ' + DQ_SITE_URL + '/sitemap.xml\\n');
});

app.get('/sitemap.xml', (req, res) => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    '<url><loc>' + DQ_SITE_URL + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>' +
    '</urlset>';
  res.type('application/xml').send(xml);
});

`;

const anchor = "app.get('/', (req, res) => {";
if (!server.includes(anchor)) {
  console.error('Could not find root route anchor in server.js.');
  process.exit(1);
}

server = server.replace(anchor, seoRoutes + anchor);
fs.writeFileSync(file, server, 'utf8');
console.log('Applied Doctors Query FMGE Academy SEO routes V28.');
