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
      is_public INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Migration: add is_public column if it doesn't exist (for existing DBs)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE wrappeds ADD COLUMN IF NOT EXISTS is_public INTEGER DEFAULT 1;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prompt_events (
      id SERIAL PRIMARY KEY,
      include_share BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ── Public queries ──

async function getPublicWrappeds() {
  const { rows } = await pool.query(`
    SELECT id, names, date_range, emoji, gradient, is_sample, created_at
    FROM wrappeds
    WHERE is_public = 1
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
    `INSERT INTO wrappeds (id, names, date_range, emoji, gradient, html_content, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, 1)`,
    [id, names, date_range, emoji || '💕', gradient, html_content]
  );
  return { id };
}

async function upsertSample({ id, names, date_range, emoji, gradient, static_path }) {
  await pool.query(
    `INSERT INTO wrappeds (id, names, date_range, emoji, gradient, static_path, is_sample, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, 1, 1)
     ON CONFLICT (id) DO NOTHING`,
    [id, names, date_range, emoji, gradient, static_path]
  );
}

// ── Admin queries ──

async function getAllWrappedsAdmin() {
  const { rows } = await pool.query(`
    SELECT id, names, date_range, emoji, gradient, is_sample, is_public,
           created_at, static_path,
           COALESCE(LENGTH(html_content), 0) AS html_size
    FROM wrappeds
    ORDER BY created_at DESC
  `);
  return rows;
}

async function deleteWrapped(id) {
  const { rowCount } = await pool.query('DELETE FROM wrappeds WHERE id = $1', [id]);
  return rowCount > 0;
}

async function setWrappedVisibility(id, isPublic) {
  const { rowCount } = await pool.query(
    'UPDATE wrappeds SET is_public = $1 WHERE id = $2',
    [isPublic ? 1 : 0, id]
  );
  return rowCount > 0;
}

async function recordPromptEvent(includeShare) {
  await pool.query(
    'INSERT INTO prompt_events (include_share) VALUES ($1)',
    [includeShare]
  );
}

async function getPromptEventCount() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM prompt_events');
  return rows[0].count;
}

module.exports = {
  initDb,
  getPublicWrappeds,
  getWrappedById,
  createWrapped,
  upsertSample,
  getAllWrappedsAdmin,
  deleteWrapped,
  setWrappedVisibility,
  recordPromptEvent,
  getPromptEventCount
};
