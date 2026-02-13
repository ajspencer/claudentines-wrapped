const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const db = new Database(path.join(__dirname, 'claudentines.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS wrappeds (
    id TEXT PRIMARY KEY,
    names TEXT NOT NULL,
    date_range TEXT NOT NULL,
    emoji TEXT DEFAULT '💕',
    gradient TEXT,
    html_content TEXT,
    static_path TEXT,
    is_sample INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

function getAllWrappeds() {
  return db.prepare(`
    SELECT id, names, date_range, emoji, gradient, is_sample, created_at
    FROM wrappeds
    ORDER BY is_sample DESC, created_at DESC
  `).all();
}

function getWrappedById(id) {
  return db.prepare('SELECT * FROM wrappeds WHERE id = ?').get(id);
}

function createWrapped({ names, date_range, emoji, gradient, html_content }) {
  const id = generateId();
  db.prepare(`
    INSERT INTO wrappeds (id, names, date_range, emoji, gradient, html_content)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, names, date_range, emoji || '💕', gradient, html_content);
  return { id };
}

function upsertSample({ id, names, date_range, emoji, gradient, static_path }) {
  db.prepare(`
    INSERT OR IGNORE INTO wrappeds (id, names, date_range, emoji, gradient, static_path, is_sample)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(id, names, date_range, emoji, gradient, static_path);
}

module.exports = { getAllWrappeds, getWrappedById, createWrapped, upsertSample };
