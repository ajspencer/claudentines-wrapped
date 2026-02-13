const express = require('express');
const path = require('path');
const { initDb, getAllWrappeds, getWrappedById, createWrapped } = require('./db');
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
app.get('/api/wrappeds', async (req, res) => {
  try {
    const wrappeds = await getAllWrappeds();
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
