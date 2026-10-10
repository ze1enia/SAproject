const fs = require('fs');
const path = require('path');

const dir = __dirname;
const outputFile = path.join(dir, 'SAproject.sql');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

let sqlOutput = `-- Auto-generated from CSV files\nCREATE DATABASE IF NOT EXISTS \`saproject_db\`;\nUSE \`saproject_db\`;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

files.forEach(file => {
  const tableName = path.basename(file, '.csv').replace(/\s*\(.*?\)/g, '');
  const content = fs.readFileSync(path.join(dir, file), 'utf-8').trim();
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const headers = lines[0].split(',').map(h => h.trim().replace(/\s*\(.*?\)/g, '').replace(/["']/g, ''));
  
  sqlOutput += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
  sqlOutput += `CREATE TABLE \`${tableName}\` (\n` + headers.map(h => `  \`${h}\` TEXT`).join(',\n') + `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  if (lines.length > 1) {
    sqlOutput += `INSERT INTO \`${tableName}\` (\`${headers.join('`, `')}\`) VALUES\n`;
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => `'${c.trim().replace(/['\\]/g, '')}'`);
      return `(${cols.join(', ')})`;
    });
    sqlOutput += rows.join(',\n') + ';\n\n';
  }
});

sqlOutput += `SET FOREIGN_KEY_CHECKS = 1;\n`;
fs.writeFileSync(outputFile, sqlOutput, 'utf-8');
console.log('✅ แปลงไฟล์ CSV เป็น SAproject.sql เรียบร้อยแล้ว!');