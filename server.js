const express = require('express');
const path = require('path');
const crypto = require('crypto');
const {
  initDb, getPublicWrappeds, getWrappedById, createWrapped,
  getAllWrappedsAdmin, deleteWrapped, setWrappedVisibility
} = require('./db');
const { seedDatabase } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jA36jbPvTMHWBCk_';

// Generate a stable token from the password so it survives restarts
const ADMIN_TOKEN = crypto.createHmac('sha256', ADMIN_PASSWORD).update('claudentines-admin').digest('hex');

// CORS — allow all origins (generated wrappeds POST from file:// origin)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Parse cookies
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(c => {
      const [k, ...v] = c.trim().split('=');
      req.cookies[k] = decodeURIComponent(v.join('='));
    });
  }
  next();
});

// JSON body parser with generous limit for HTML blobs
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: false }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ── Admin Auth Middleware ──
function requireAdmin(req, res, next) {
  if (req.cookies.admin_token === ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ── Public API Routes ──

// List all public wrappeds
app.get('/api/wrappeds', async (req, res) => {
  try {
    const wrappeds = await getPublicWrappeds();
    const result = wrappeds.map(w => ({
      id: w.id,
      names: w.names,
      date_range: w.date_range,
      emoji: w.emoji,
      gradient: w.gradient,
      is_sample: w.is_sample,
      created_at: w.created_at,
      url: `/w/${w.id}`
    }));
    res.json(result);
  } catch (err) {
    console.error('Error listing wrappeds:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve a wrapped
app.get('/w/:id', async (req, res) => {
  try {
    const wrapped = await getWrappedById(req.params.id);
    if (!wrapped) return res.status(404).send('Wrapped not found');

    if (wrapped.static_path) {
      const filePath = path.join(__dirname, 'public', wrapped.static_path);
      return res.sendFile(filePath);
    }

    if (wrapped.html_content) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(wrapped.html_content);
    }

    res.status(404).send('Wrapped content not found');
  } catch (err) {
    console.error('Error serving wrapped:', err);
    res.status(500).send('Internal server error');
  }
});

// Submit a new wrapped
app.post('/api/wrappeds', async (req, res) => {
  try {
    const { names, date_range, emoji, gradient, html_content } = req.body;

    if (!names || !date_range || !html_content) {
      return res.status(400).json({ error: 'names, date_range, and html_content are required' });
    }

    if (html_content.length > 500000) {
      return res.status(400).json({ error: 'html_content exceeds 500KB limit' });
    }

    const { id } = await createWrapped({ names, date_range, emoji, gradient, html_content });
    res.json({ id, url: `/w/${id}` });
  } catch (err) {
    console.error('Error creating wrapped:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin Routes ──

// Serve admin login / dashboard page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Admin login
app.post('/admin/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  // Timing-safe comparison
  const input = Buffer.from(password);
  const expected = Buffer.from(ADMIN_PASSWORD);

  if (input.length !== expected.length || !crypto.timingSafeEqual(input, expected)) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  res.setHeader('Set-Cookie', `admin_token=${ADMIN_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
  res.json({ ok: true });
});

// Admin logout
app.post('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ ok: true });
});

// Check if admin is authenticated
app.get('/admin/api/check', requireAdmin, (req, res) => {
  res.json({ authenticated: true });
});

// List all wrappeds (admin view — includes private, sizes, etc.)
app.get('/admin/api/wrappeds', requireAdmin, async (req, res) => {
  try {
    const wrappeds = await getAllWrappedsAdmin();
    res.json(wrappeds);
  } catch (err) {
    console.error('Admin list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle visibility
app.patch('/admin/api/wrappeds/:id', requireAdmin, async (req, res) => {
  try {
    const { is_public } = req.body;
    if (typeof is_public === 'undefined') {
      return res.status(400).json({ error: 'is_public is required' });
    }
    const updated = await setWrappedVisibility(req.params.id, is_public);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a wrapped
app.delete('/admin/api/wrappeds/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteWrapped(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize database, seed, and start server
async function start() {
  try {
    await initDb();
    await seedDatabase();
    app.listen(PORT, () => {
      console.log(`Claudentines server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
