/**
 * api/upload.js — Vercel serverless function
 *
 * POST /api/upload  →  saves the Excel file to Vercel Blob Storage
 *
 * Prerequisites (Vercel dashboard):
 *   1. Enable Blob Storage on your project (Storage → Create a Blob Store)
 *   2. The BLOB_READ_WRITE_TOKEN env var is automatically set by Vercel after linking
 *
 * Optional security:
 *   Set UPLOAD_SECRET env var → requests must include X-Upload-Secret header
 */

const { put } = require('@vercel/blob');

// REQUIRED: disable Vercel's default body parser so we can read raw binary
module.exports.config = {
  api: { bodyParser: false }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional upload password
  const secret = process.env.UPLOAD_SECRET;
  if (secret && req.headers['x-upload-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Not configured — return 501 so the dashboard knows to fail silently
    return res.status(501).json({ error: 'Blob storage not configured' });
  }

  // Read raw binary body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  if (!buffer.length) {
    return res.status(400).json({ error: 'Empty body — no file received' });
  }

  const blob = await put('propbook-data.xlsx', buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  res.status(200).json({ ok: true, url: blob.url });
};
