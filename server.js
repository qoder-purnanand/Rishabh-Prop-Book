/**
 * server.js — local development server
 *
 * Usage:
 *   npm install
 *   npm run dev          →  http://localhost:3000
 *
 * Place your .xlsx file in the data/ folder.
 * The dashboard auto-loads the most recently modified one at startup.
 *
 * For Vercel deployment, see api/data.js and set the DATA_URL env var.
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app     = express();
const PORT    = process.env.PORT || 3000;
const ROOT    = __dirname;
const DATA_DIR = path.join(ROOT, 'data');

// Ensure data/ directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Serve the dashboard HTML and other static files from project root
app.use(express.static(ROOT));

// Find the most recently modified .xlsx in data/ (ignores Office temp files)
function findLatestExcel() {
  if (!fs.existsSync(DATA_DIR)) return null;
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(DATA_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? files[0].name : null;
}

// GET /api/data  →  latest Excel file as binary (mirrors Vercel api/data.js)
app.get('/api/data', (req, res) => {
  const xlsxFile = findLatestExcel();
  if (!xlsxFile) {
    return res.status(404).json({
      error: 'No Excel file found.',
      hint: 'Place your .xlsx file in the data/ folder.'
    });
  }
  const filePath = path.join(DATA_DIR, xlsxFile);
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('X-Filename', xlsxFile);
  res.setHeader('Access-Control-Expose-Headers', 'X-Filename');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(filePath);
});

// GET /api/info  →  metadata (useful for debugging)
app.get('/api/info', (req, res) => {
  const xlsxFile = findLatestExcel();
  res.json({
    file:     xlsxFile || null,
    modified: xlsxFile
      ? fs.statSync(path.join(DATA_DIR, xlsxFile)).mtime.toISOString()
      : null,
    dataDir:  DATA_DIR
  });
});

// GET /  →  serve the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'propbook_dashboard.html'));
});

app.listen(PORT, () => {
  const excel = findLatestExcel();
  console.log(`\nProp Book — local server`);
  console.log(`URL:  http://localhost:${PORT}`);
  console.log(`Data: ${excel ? `data/${excel}` : '(no Excel in data/ — upload manually)'}\n`);
});
