const fs = require('fs');
const path = require('path');

const w1 = require('./weeks_1.js');
const w2 = require('./weeks_2.js');
const w3 = require('./weeks_3.js');

const weeks = { ...w1, ...w2, ...w3 };

const dir = path.join(__dirname, 'weeks');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

for (const [weekNum, data] of Object.entries(weeks)) {
  const padded = String(weekNum).padStart(2, '0');
  const full = { week: parseInt(weekNum), ...data };
  const filePath = path.join(dir, `week-${padded}.json`);
  fs.writeFileSync(filePath, JSON.stringify(full, null, 2) + '\n');
  console.log(`Created week-${padded}.json`);
}
console.log('Done!');
