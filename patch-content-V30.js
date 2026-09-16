const path = require('path');

const patches = [
  'patch-content-V25.js',
  'patch-content-V26.js',
  'patch-content-V27.js',
  'patch-content-V29.js'
];

for (const name of patches) {
  const file = path.join(__dirname, name);
  console.log('Applying ' + name + '...');
  require(file);
}

console.log('Applied Doctors Query FMGE Academy consolidated content + policy + social + brand SEO V30.');
