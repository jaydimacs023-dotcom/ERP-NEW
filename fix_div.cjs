const fs = require('fs');
const path = 'e:/laragon/www/AT-ERP/views/InvoicesView.tsx';
let content = fs.readFileSync(path, 'utf8');
let lines = content.split(/\r?\n/);

// Line 1055 is index 1054 - it's the extra </div> that prematurely closes the flex-1 content area
// Verify it's actually </div> before removing
console.log('Line 1055 (index 1054):', JSON.stringify(lines[1054]));
console.log('Line 1054 (index 1053):', JSON.stringify(lines[1053]));
console.log('Line 1056 (index 1055):', JSON.stringify(lines[1055]));

if (lines[1054].trim() === '</div>') {
    lines.splice(1054, 1); // Remove the extra </div>
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Successfully removed extra </div> at line 1055');
} else {
    console.log('WARNING: Line 1055 is not </div>, skipping');
}
