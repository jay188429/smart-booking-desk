import fs from 'node:fs';
import crypto from 'node:crypto';
const manifest = JSON.parse(fs.readFileSync(new URL('../SHA256.json', import.meta.url)));
let failures = 0;
for (const [file, expected] of Object.entries(manifest)) {
  const url = new URL(`../${file}`, import.meta.url);
  const actual = fs.existsSync(url) ? crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex') : 'MISSING';
  if (actual !== expected) { console.error(`${file}: ${actual}`); failures++; }
}
console.log(`${Object.keys(manifest).length} files checked; ${failures} differences. Manifest was not changed.`);
process.exitCode = failures ? 1 : 0;
