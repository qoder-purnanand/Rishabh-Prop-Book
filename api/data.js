/**
 * api/data.js — Vercel serverless function
 *
 * GET /api/data  →  serves the latest Excel file to the dashboard
 *
 * Priority order:
 *   1. Vercel Blob  (if BLOB_READ_WRITE_TOKEN is set and a file has been uploaded)
 *   2. DATA_URL env var  (manual fallback — any public/authenticated HTTPS link)
 *   3. 404 → dashboard shows the manual upload screen
 *
 * No configuration needed if you use the upload flow:
 *   user uploads Excel → dashboard POSTs to /api/upload → saved to Blob
 *   any other device → GET /api/data → served from Blob → auto-rendered
 */

const { list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 1. Try Vercel Blob ──────────────────────────────────────────
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: 'propbook-data' });
      if (blobs.length) {
        const latest = blobs.sort((a, b) =>
          new Date(b.uploadedAt) - new Date(a.uploadedAt)
        )[0];

        const upstream = await fetch(latest.url);
        if (upstream.ok) {
          const buffer = await upstream.arrayBuffer();
          res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('X-Filename', latest.pathname.split('/').pop());
          res.setHeader('X-Source', 'blob');
          res.setHeader('Access-Control-Expose-Headers', 'X-Filename, X-Source');
          res.setHeader('Cache-Control', 'no-store');
          return res.send(Buffer.from(buffer));
        }
      }
    } catch (e) {
      // Blob unavailable — fall through to DATA_URL
    }
  }

  // ── 2. Try DATA_URL env var ────────────────────────────────────
  const dataUrl = process.env.DATA_URL;
  if (dataUrl) {
    let upstream;
    try {
      upstream = await fetch(dataUrl, {
        headers: process.env.DATA_AUTH_HEADER
          ? { Authorization: process.env.DATA_AUTH_HEADER }
          : {}
      });
    } catch (err) {
      return res.status(502).json({ error: 'Failed to fetch DATA_URL', detail: err.message });
    }

    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream returned ${upstream.status}` });
    }

    const buffer   = await upstream.arrayBuffer();
    const rawName  = dataUrl.split('/').pop().split('?')[0];
    const filename = rawName.endsWith('.xlsx') ? rawName : 'data.xlsx';

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('X-Filename', filename);
    res.setHeader('X-Source', 'url');
    res.setHeader('Access-Control-Expose-Headers', 'X-Filename, X-Source');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(buffer));
  }

  // ── 3. Nothing configured ──────────────────────────────────────
  return res.status(404).json({
    error: 'No data available.',
    hint: 'Upload an Excel file via the dashboard, or set DATA_URL / BLOB_READ_WRITE_TOKEN in Vercel.'
  });
};
