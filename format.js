const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/pdfme_template.json', 'utf8'));
console.log(`Pages: ${data.schemas.length}`);
data.schemas.forEach((page, index) => {
    console.log(`Page ${index + 1}: ${page.length} fields`);
    const ys = page.map(f => f.position.y);
    console.log(`  Min Y: ${Math.min(...ys)}, Max Y: ${Math.max(...ys)}`);
});
