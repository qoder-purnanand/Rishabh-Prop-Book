/**
 * api/data.js — Vercel serverless function
 *
 * GET /api/data  →  proxies the Excel file to the dashboard for auto-load
 *
 * Configure one of these in your Vercel project environment variables:
 *
 *   DATA_URL   A direct download URL to the .xlsx file.
 *              Examples:
 *               • OneDrive/SharePoint "Download" link (not the share link)
 *               • Vercel Blob public URL
 *               • Any authenticated or public HTTPS URL returning the .xlsx binary
 *
 * If DATA_URL is not set, the endpoint returns 404 and the dashboard
 * falls back to the manual file-upload screen.
 */

module.exports = async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dataUrl = process.env.DATA_URL;
  if (!dataUrl) {
    return res.status(404).json({
      error: 'DATA_URL environment variable is not configured.',
      hint: 'Set DATA_URL in your Vercel project settings → Environment Variables.'
    });
  }

  let response;
  try {
    response = await fetch(dataUrl, {
      headers: {
        // Forward any auth headers if needed (add more env vars here)
        ...(process.env.DATA_AUTH_HEADER
          ? { Authorization: process.env.DATA_AUTH_HEADER }
          : {})
      }
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch Excel file', detail: err.message });
  }

  if (!response.ok) {
    return res.status(502).json({
      error: `Upstream returned ${response.status}`,
      hint: 'Check that DATA_URL is a valid direct-download link.'
    });
  }

  const buffer  = await response.arrayBuffer();
  const rawName = dataUrl.split('/').pop().split('?')[0];
  const filename = rawName.endsWith('.xlsx') ? rawName : 'data.xlsx';

  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('X-Filename', filename);
  res.setHeader('Access-Control-Expose-Headers', 'X-Filename');
  res.setHeader('Cache-Control', 'no-store, must-revalidate'); // always fresh data
  res.send(Buffer.from(buffer));
};
