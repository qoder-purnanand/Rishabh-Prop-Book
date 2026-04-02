/**
 * server.js — Prop Book hosted deployment
 *
 * Usage:
 *   npm install express
 *   node server.js
 *
 * Opens:  http://localhost:3000
 * Auto-loads the most recently modified .xlsx file in the same directory.
 * The dashboard calls GET /api/data on boot and skips the upload screen.
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const DIR  = __dirname;

// Serve all static files (dashboard HTML, CDN fallback assets, etc.)
app.use(express.static(DIR));

// Find the most recently modified .xlsx in DIR (ignores temp/lock files)
function findLatestExcel() {
  const files = fs.readdirSync(DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? files[0].name : null;
}

// GET /api/data  →  latest Excel file as binary
app.get('/api/data', (req, res) => {
  const xlsxFile = findLatestExcel();
  if (!xlsxFile) {
    return res.status(404).json({ error: 'No Excel file found in server directory.' });
  }
  const filePath = path.join(DIR, xlsxFile);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('X-Filename', xlsxFile);
  res.setHeader('Access-Control-Expose-Headers', 'X-Filename');
  res.sendFile(filePath);
});

// GET /api/info  →  metadata about what's loaded
app.get('/api/info', (req, res) => {
  const xlsxFile = findLatestExcel();
  const mtime    = xlsxFile
    ? fs.statSync(path.join(DIR, xlsxFile)).mtime.toISOString()
    : null;
  res.json({ file: xlsxFile, modified: mtime, dir: DIR });
});

app.listen(PORT, () => {
  const excel = findLatestExcel();
  console.log(`Prop Book server running at http://localhost:${PORT}`);
  console.log(`Auto-loading: ${excel || '(no Excel file found)'}`);
});
