const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const db = getDB();
  const { username, password, display_name } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: '用户名已存在' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password, display_name) VALUES (?, ?, ?)').run(username, hash, display_name || username);
  const token = generateToken(result.lastInsertRowid);

  res.json({ token, user: { id: result.lastInsertRowid, username, display_name: display_name || username } });
});

router.post('/login', (req, res) => {
  const db = getDB();
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: '用户名或密码错误' });

  const token = generateToken(user.id);
  res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name, bio: user.bio, created_at: user.created_at } });
});

router.get('/me', requireAuth, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, username, display_name, bio, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});

router.put('/me', requireAuth, (req, res) => {
  const db = getDB();
  const { display_name, bio } = req.body;
  db.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?').run(display_name || '', bio || '', req.userId);
  const user = db.prepare('SELECT id, username, display_name, bio, created_at FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

module.exports = router;
