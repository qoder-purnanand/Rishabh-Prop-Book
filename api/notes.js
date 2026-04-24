/**
 * api/notes.js — Vercel serverless function
 *
 * GET  /api/notes                                    → all notes, newest first
 * POST /api/notes  { action:'create', content }      → create note
 * POST /api/notes  { action:'update', id, content }  → edit note
 * POST /api/notes  { action:'delete', id }           → delete note
 *
 * All notes persisted as propbook-notes.json in Vercel Blob.
 */

const { put, list } = require('@vercel/blob');

const NOTES_KEY = 'propbook-notes.json';

async function readNotes() {
  try {
    const { blobs } = await list({ prefix: 'propbook-notes' });
    if (!blobs.length) return [];
    const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    const res = await fetch(latest.url);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function writeNotes(notes) {
  await put(NOTES_KEY, JSON.stringify(notes), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

module.exports = async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(501).json({ error: 'Blob storage not configured' });
  }

  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const notes = await readNotes();
    notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json(notes);
  }

  if (req.method === 'POST') {
    const body = req.body;
    if (!body || !body.action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    const notes = await readNotes();
    const now = new Date().toISOString();

    if (body.action === 'create') {
      if (!body.content || !body.content.trim()) {
        return res.status(400).json({ error: 'Content is required' });
      }
      const note = {
        id: crypto.randomUUID(),
        content: body.content.trim(),
        author: body.author ? String(body.author).trim() : '',
        parentId: body.parentId || null,
        createdAt: now,
        updatedAt: now,
      };
      notes.unshift(note);
      await writeNotes(notes);
      return res.status(201).json(note);
    }

    if (body.action === 'update') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      if (!body.content || !body.content.trim()) return res.status(400).json({ error: 'Content is required' });
      const idx = notes.findIndex(n => n.id === body.id);
      if (idx === -1) return res.status(404).json({ error: 'Note not found' });
      notes[idx].content   = body.content.trim();
      notes[idx].author    = body.author !== undefined ? String(body.author).trim() : notes[idx].author;
      notes[idx].updatedAt = now;
      await writeNotes(notes);
      return res.status(200).json(notes[idx]);
    }

    if (body.action === 'delete') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const exists = notes.some(n => n.id === body.id);
      if (!exists) return res.status(404).json({ error: 'Note not found' });
      // Cascade: remove the note and all its replies
      const remaining = notes.filter(n => n.id !== body.id && n.parentId !== body.id);
      await writeNotes(remaining);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
