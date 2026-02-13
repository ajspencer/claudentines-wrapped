const { upsertSample } = require('./db');

const samples = [
  {
    id: 'alex-jordan',
    names: 'Alex & Jordan',
    date_range: 'Jun 2024 – Feb 2025',
    emoji: '🔥',
    gradient: 'linear-gradient(135deg, #7c4dff, #1a1040)',
    static_path: '/wrappeds/alex-jordan.html'
  },
  {
    id: 'sam-riley',
    names: 'Sam & Riley',
    date_range: 'Mar 2025 – Feb 2026',
    emoji: '🌙',
    gradient: 'linear-gradient(135deg, #00bfa5, #0d3b3b)',
    static_path: '/wrappeds/sam-riley.html'
  },
  {
    id: 'chris-morgan',
    names: 'Chris & Morgan',
    date_range: 'Jan 2025 – Feb 2026',
    emoji: '☀️',
    gradient: 'linear-gradient(135deg, #ff9800, #e65100)',
    static_path: '/wrappeds/chris-morgan.html'
  },
  {
    id: 'taylor-casey',
    names: 'Taylor & Casey',
    date_range: 'Sep 2025 – Feb 2026',
    emoji: '🎵',
    gradient: 'linear-gradient(135deg, #ff6b6b, #c0392b)',
    static_path: '/wrappeds/taylor-casey.html'
  }
];

function seedDatabase() {
  for (const sample of samples) {
    upsertSample(sample);
  }
  console.log(`Seeded ${samples.length} sample wrappeds`);
}

module.exports = { seedDatabase };
