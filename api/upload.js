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
 *   (prevents random people from overwriting your data)
 *
 * The dashboard calls this automatically after every file upload,
 * so all devices see the same data at /api/data.
 */

const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional upload password
  const secret = process.env.UPLOAD_SECRET;
  if (secret && req.headers['x-upload-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized — set X-Upload-Secret header' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'Vercel Blob not configured.',
      hint: 'Enable Blob Storage in your Vercel project (Storage tab).'
    });
  }

  // Collect request body chunks
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  if (!buffer.length) {
    return res.status(400).json({ error: 'Empty body — no file received' });
  }

  const filename = req.headers['x-filename'] || 'propbook-data.xlsx';

  // Store with a fixed key so /api/data always finds the latest
  const blob = await put('propbook-data.xlsx', buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  res.status(200).json({ ok: true, url: blob.url, filename });
};
