/**
 * restore.mjs — restore portfolio holdings from the CSV backup.
 * Run:  node restore.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the old blob row — it has everything we need.
const csv = readFileSync(resolve(__dirname, 'database/portfolios_rows.csv'), 'utf8');
const lines = csv.trim().split('\n');
// CSV format: id,data,updated_at  (data may contain commas inside quoted JSON)
const headerEnd = lines[0].length; // "id,data,updated_at"
const dataRow   = lines[1]; // First data row

// The id is everything up to the first comma.
const firstComma = dataRow.indexOf(',');
const id = dataRow.slice(0, firstComma);

// The data is the quoted JSON field in the middle.
// It starts after the first comma+quote and ends before the last comma+quote.
const rest = dataRow.slice(firstComma + 1);
// Strip surrounding double-quotes and unescape doubled double-quotes.
const dataRaw = rest.slice(1, rest.lastIndexOf('",'));
const data = dataRaw.replace(/""/g, '"');

// Quick sanity check
const parsed = JSON.parse(data);
const holdingCount = Object.values(parsed.holdings || {}).reduce((s, arr) => s + arr.length, 0);
console.log(`Restoring id=${id}  holdings=${holdingCount}  sectors=${Object.keys(parsed.sectors || {}).length}`);

const API = 'http://localhost:3000/api/portfolio';

const resp = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id, data }),
});

const json = await resp.json();
if (resp.ok && json.ok) {
  console.log('✓ Data restored successfully!');
  console.log('  Refresh the app to see your portfolio.');
} else {
  console.error('✗ Restore failed:', resp.status, json);
}
