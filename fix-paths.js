const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'out', 'index.html');
let html = fs.readFileSync(htmlFile, 'utf8');

// Replace all absolute paths with relative paths
html = html.replace(/(['"(])\/?content\/tools\/metronome\//g, '$1./');

// Fix any remaining absolute paths that might be generated
html = html.replace(/href="\//g, 'href="./');
html = html.replace(/src="\//g, 'src="./');

// Fix any full URLs to the site that might have been generated
html = html.replace(/https:\/\/pulse\.berklee\.edu\/content\/tools\/metronome\//g, './');

fs.writeFileSync(htmlFile, html); 