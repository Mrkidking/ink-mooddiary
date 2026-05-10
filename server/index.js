const express = require('express');
const cors = require('cors');
const path = require('path');
const { init: initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api', require('./routes/interactions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/weather', require('./routes/weather'));

// Community stats
app.get('/api/stats/community', (req, res) => {
  const { getDB } = require('./db');
  const db = getDB();
  const totalEntries = db.prepare('SELECT COUNT(*) as c FROM entries WHERE is_public = 1').get().c;
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const today = new Date().toISOString().split('T')[0];
  const todayMoods = db.prepare("SELECT mood_key, COUNT(*) as c FROM entries WHERE is_public = 1 AND date = ? GROUP BY mood_key ORDER BY c DESC LIMIT 1").all(today);
  res.json({ totalEntries: totalEntries || 0, totalUsers: totalUsers || 0, todayTopMood: todayMoods[0] || null });
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`[INK] Server running at http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
