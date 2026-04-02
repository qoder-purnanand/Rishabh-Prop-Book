/**
 * server.js — local development server
 *
 * Usage:
 *   npm install
 *   npm run dev          →  http://localhost:3000
 *
 * Workflow:
 *   1. Open http://localhost:3000 in any browser
 *   2. Upload your .xlsx via the dashboard — the file is saved to data/
 *   3. Any other browser/device on the same network can open
 *      http://<your-local-ip>:3000 and will auto-load the same data
 *
 * For Vercel deployment see api/data.js and api/upload.js.
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = process.env.PORT || 3000;
const ROOT     = __dirname;
const DATA_DIR = path.join(ROOT, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Serve static files (dashboard HTML, etc.)
app.use(express.static(ROOT));

// Find the most recently modified .xlsx in data/
function findLatestExcel() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(DATA_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? files[0].name : null;
}

// GET /api/data  →  serve latest Excel from data/
app.get('/api/data', (req, res) => {
  const xlsxFile = findLatestExcel();
  if (!xlsxFile) {
    return res.status(404).json({
      error: 'No Excel file found.',
      hint: 'Upload a file via the dashboard — it will be saved to data/ automatically.'
    });
  }
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('X-Filename', xlsxFile);
  res.setHeader('Access-Control-Expose-Headers', 'X-Filename');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(DATA_DIR, xlsxFile));
});

// POST /api/upload  →  save uploaded Excel to data/
app.post('/api/upload', (req, res) => {
  const filename = (req.headers['x-filename'] || 'propbook-data.xlsx')
    .replace(/[^a-zA-Z0-9._-]/g, '_');  // sanitise
  const dest = path.join(DATA_DIR, filename);
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    if (!buf.length) return res.status(400).json({ error: 'Empty body' });
    fs.writeFileSync(dest, buf);
    console.log(`Saved: data/${filename} (${(buf.length / 1024).toFixed(0)} KB)`);
    res.json({ ok: true, filename });
  });
  req.on('error', err => res.status(500).json({ error: err.message }));
});

// GET /api/info  →  metadata
app.get('/api/info', (req, res) => {
  const xlsxFile = findLatestExcel();
  res.json({
    file:    xlsxFile || null,
    modified: xlsxFile
      ? fs.statSync(path.join(DATA_DIR, xlsxFile)).mtime.toISOString()
      : null,
    dataDir: DATA_DIR
  });
});

// Root → dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'propbook_dashboard.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const excel = findLatestExcel();
  const ip    = getLocalIp();
  console.log(`\nProp Book — local server`);
  console.log(`Local:   http://localhost:${PORT}`);
  if (ip) console.log(`Network: http://${ip}:${PORT}  ← share with phone/tablet`);
  console.log(`Data:    ${excel ? `data/${excel}` : '(no file yet — upload via dashboard)'}\n`);
});

function getLocalIp() {
  try {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch { return null; }
}
