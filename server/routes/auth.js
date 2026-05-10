const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { getDB } = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars'),
    filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, 'avatar_' + req.userId + '_' + Date.now() + ext); }
  }),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => { cb(null, /\.(jpg|jpeg|png|webp)$/i.test(path.extname(file.originalname))); }
});

// POST /api/auth/register — email + phone + password
router.post('/register', (req, res) => {
  try {
    const db = getDB();
    const { email, phone, password, display_name, remember_me } = req.body;
    if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
    if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: '该邮箱已注册' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (email, phone, password, display_name) VALUES (?, ?, ?, ?)').run(
      email, phone || '', hash, display_name || email.split('@')[0]
    );

    const expiresIn = remember_me ? '30d' : '7d';
    const token = generateToken(result.lastInsertRowid, expiresIn);

    res.json({ token, user: { id: result.lastInsertRowid, email, display_name: display_name || email.split('@')[0], phone: phone || '', avatar_url: '' } });
  } catch (e) {
    res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login — email + password
router.post('/login', (req, res) => {
  try {
    const db = getDB();
    const { email, password, remember_me } = req.body;
    if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: '邮箱或密码错误' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: '邮箱或密码错误' });

    const expiresIn = remember_me ? '30d' : '7d';
    const token = generateToken(user.id, expiresIn);

    res.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, phone: user.phone, bio: user.bio, avatar_url: user.avatar_url, created_at: user.created_at } });
  } catch (e) {
    res.status(500).json({ error: '登录失败' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, email, phone, display_name, bio, avatar_url, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});

// PUT /api/auth/me
router.put('/me', requireAuth, (req, res) => {
  const db = getDB();
  const { display_name, phone, bio } = req.body;
  db.prepare('UPDATE users SET display_name = ?, phone = ?, bio = ? WHERE id = ?').run(display_name || '', phone || '', bio || '', req.userId);
  const user = db.prepare('SELECT id, email, phone, display_name, bio, avatar_url, created_at FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

// POST /api/auth/avatar
router.post('/avatar', requireAuth, avatarUpload.single('avatar'), (req, res) => {
  const db = getDB();
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  const url = '/uploads/avatars/' + req.file.filename;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, req.userId);
  res.json({ avatar_url: url });
});

module.exports = router;
