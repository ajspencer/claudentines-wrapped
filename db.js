const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wrappeds (
      id TEXT PRIMARY KEY,
      names TEXT NOT NULL,
      date_range TEXT NOT NULL,
      emoji TEXT DEFAULT '💕',
      gradient TEXT,
      html_content TEXT,
      static_path TEXT,
      is_sample INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

async function getAllWrappeds() {
  const { rows } = await pool.query(`
    SELECT id, names, date_range, emoji, gradient, is_sample, created_at
    FROM wrappeds
    ORDER BY is_sample DESC, created_at DESC
  `);
  return rows;
}

async function getWrappedById(id) {
  const { rows } = await pool.query('SELECT * FROM wrappeds WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createWrapped({ names, date_range, emoji, gradient, html_content }) {
  const id = generateId();
  await pool.query(
    `INSERT INTO wrappeds (id, names, date_range, emoji, gradient, html_content)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, names, date_range, emoji || '💕', gradient, html_content]
  );
  return { id };
}

async function upsertSample({ id, names, date_range, emoji, gradient, static_path }) {
  await pool.query(
    `INSERT INTO wrappeds (id, names, date_range, emoji, gradient, static_path, is_sample)
     VALUES ($1, $2, $3, $4, $5, $6, 1)
     ON CONFLICT (id) DO NOTHING`,
    [id, names, date_range, emoji, gradient, static_path]
  );
}

module.exports = { initDb, getAllWrappeds, getWrappedById, createWrapped, upsertSample };
