const fs = require('fs');
const path = require('path');

const dir = __dirname;
const outputFile = path.join(dir, 'SAproject.sql');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

// split one CSV line on commas, but keep commas inside "quoted values" (e.g. addresses)
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

let sqlOutput = `-- Auto-generated from CSV files\nCREATE DATABASE IF NOT EXISTS \`saproject_db\`;\nUSE \`saproject_db\`;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

files.forEach(file => {
  const tableName = path.basename(file, '.csv').replace(/\s*\(.*?\)/g, '');
  const content = fs.readFileSync(path.join(dir, file), 'utf-8').trim();
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const headers = splitCsvLine(lines[0]).map(h => h.trim().replace(/\s*\(.*?\)/g, '').replace(/["']/g, ''));
  
  sqlOutput += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
  sqlOutput += `CREATE TABLE \`${tableName}\` (\n` + headers.map(h => `  \`${h}\` TEXT`).join(',\n') + `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  if (lines.length > 1) {
    sqlOutput += `INSERT INTO \`${tableName}\` (\`${headers.join('`, `')}\`) VALUES\n`;
    const rows = lines.slice(1).map(line => {
      const cols = splitCsvLine(line).map(c => `'${c.trim().replace(/['\\]/g, '')}'`);
      return `(${cols.join(', ')})`;
    });
    sqlOutput += rows.join(',\n') + ';\n\n';
  }
});

sqlOutput += `SET FOREIGN_KEY_CHECKS = 1;\n`;
fs.writeFileSync(outputFile, sqlOutput, 'utf-8');
console.log('✅ แปลงไฟล์ CSV เป็น SAproject.sql เรียบร้อยแล้ว!');