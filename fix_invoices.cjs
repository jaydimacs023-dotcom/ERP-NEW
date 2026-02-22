const fs = require('fs');
const path = 'e:/laragon/www/AT-ERP/views/InvoicesView.tsx';
let content = fs.readFileSync(path, 'utf8');
let lines = content.split(/\r?\n/);
// Line 1321 is index 1320
lines[1320] = '      </>';
lines[1321] = '    )}';
// Line 1323 is index 1322 - it contains '}'
if (lines[1322] && lines[1322].trim() === '}') {
    lines.splice(1322, 1);
}
fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed lines 1321-1323');
