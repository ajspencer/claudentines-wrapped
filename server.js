const express = require('express');
const path = require('path');
const { getAllWrappeds, getWrappedById, createWrapped } = require('./db');
const { seedDatabase } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — allow all origins (generated wrappeds POST from file:// origin)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// JSON body parser with generous limit for HTML blobs
app.use(express.json({ limit: '500kb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──

// List all public wrappeds
app.get('/api/wrappeds', (req, res) => {
  const wrappeds = getAllWrappeds();
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
});

// Serve a wrapped
app.get('/w/:id', (req, res) => {
  const wrapped = getWrappedById(req.params.id);
  if (!wrapped) return res.status(404).send('Wrapped not found');

  if (wrapped.static_path) {
    // Serve the static file
    const filePath = path.join(__dirname, 'public', wrapped.static_path);
    return res.sendFile(filePath);
  }

  if (wrapped.html_content) {
    // Serve the HTML blob
    res.setHeader('Content-Type', 'text/html');
    return res.send(wrapped.html_content);
  }

  res.status(404).send('Wrapped content not found');
});

// Submit a new wrapped
app.post('/api/wrappeds', (req, res) => {
  const { names, date_range, emoji, gradient, html_content, visibility } = req.body;

  if (!names || !date_range || !html_content) {
    return res.status(400).json({ error: 'names, date_range, and html_content are required' });
  }

  if (html_content.length > 500000) {
    return res.status(400).json({ error: 'html_content exceeds 500KB limit' });
  }

  const vis = visibility === 'private' ? 'private' : 'public';
  const { id } = createWrapped({ names, date_range, emoji, gradient, html_content, visibility: vis });
  res.json({ id, url: `/w/${id}` });
});

// Seed database and start server
seedDatabase();

app.listen(PORT, () => {
  console.log(`Claudentines server running on http://localhost:${PORT}`);
});
