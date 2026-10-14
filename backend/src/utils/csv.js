const fs = require('fs');
const path = require('path');

const DATABASE_DIR = path.join(__dirname, '../database');

// แยก 1 บรรทัด CSV ออกเป็นคอลัมน์ (รองรับค่าที่ครอบด้วย "..." และมี , อยู่ข้างใน)
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else current += ch;
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            values.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    values.push(current.trim());
    return values;
}

// ครอบค่าด้วย "..." เมื่อมี , หรือ " อยู่ข้างใน
function toCSVValue(value) {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// อ่านไฟล์ใน database/ เป็น Array ของ object (ตัด BOM และหมายเหตุอย่าง "(PK)" ออกจากชื่อคอลัมน์)
function readCSV(fileName) {
    const filePath = path.isAbsolute(fileName) ? fileName : path.join(DATABASE_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        console.error(`ไม่พบไฟล์ ${fileName}`);
        return [];
    }

    const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0].replace(/^﻿/, ''))
        .map(h => h.replace(/\(.*?\)/g, '').trim());

    return lines.slice(1)
        .filter(line => line.trim() !== '')
        .map(line => {
            const values = parseCSVLine(line);
            const row = {};
            headers.forEach((header, index) => { row[header] = values[index]; });
            return row;
        });
}

module.exports = { readCSV, parseCSVLine, toCSVValue };
