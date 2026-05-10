const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { getDB } = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Avatar upload
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars'),
    filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, 'avatar_' + req.userId + '_' + Date.now() + ext); }
  }),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => { cb(null, /\.(jpg|jpeg|png|webp)$/i.test(path.extname(file.originalname))); }
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const db = getDB();
    const { username, password, display_name, security_question, security_answer, remember_me } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: '用户名已存在' });

    const hash = bcrypt.hashSync(password, 10);
    const answerHash = security_answer ? bcrypt.hashSync(security_answer, 10) : '';
    const result = db.prepare('INSERT INTO users (username, password, display_name, security_question, security_answer) VALUES (?, ?, ?, ?, ?)').run(
      username, hash, display_name || username, security_question || '', answerHash
    );

    const expiresIn = remember_me ? '30d' : '7d';
    const token = generateToken(result.lastInsertRowid, expiresIn);

    res.json({ token, user: { id: result.lastInsertRowid, username, display_name: display_name || username, avatar_url: '' } });
  } catch (e) {
    res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const db = getDB();
    const { username, password, remember_me } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: '用户名或密码错误' });

    const expiresIn = remember_me ? '30d' : '7d';
    const token = generateToken(user.id, expiresIn);

    res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name, bio: user.bio, avatar_url: user.avatar_url, created_at: user.created_at } });
  } catch (e) {
    res.status(500).json({ error: '登录失败' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, username, display_name, bio, avatar_url, security_question, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});

// PUT /api/auth/me
router.put('/me', requireAuth, (req, res) => {
  const db = getDB();
  const { display_name, bio } = req.body;
  db.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?').run(display_name || '', bio || '', req.userId);
  const user = db.prepare('SELECT id, username, display_name, bio, avatar_url, created_at FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

// POST /api/auth/avatar — upload avatar
router.post('/avatar', requireAuth, avatarUpload.single('avatar'), (req, res) => {
  const db = getDB();
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  const url = '/uploads/avatars/' + req.file.filename;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, req.userId);
  res.json({ avatar_url: url });
});

// POST /api/auth/forgot-password — get security question
router.post('/forgot-password', (req, res) => {
  const db = getDB();
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: '请输入用户名' });

  const user = db.prepare('SELECT id, security_question FROM users WHERE username = ?').get(username);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (!user.security_question) return res.status(400).json({ error: '该用户未设置密保问题，无法找回密码' });

  res.json({ userId: user.id, question: user.security_question });
});

// POST /api/auth/reset-password — verify answer and reset
router.post('/reset-password', (req, res) => {
  const db = getDB();
  const { userId, answer, newPassword } = req.body;
  if (!userId || !answer || !newPassword) return res.status(400).json({ error: '请填写完整' });
  if (newPassword.length < 4) return res.status(400).json({ error: '新密码至少4位' });

  const user = db.prepare('SELECT security_answer FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (!bcrypt.compareSync(answer, user.security_answer)) return res.status(401).json({ error: '密保答案错误' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
  res.json({ success: true });
});

// GET /api/auth/github — redirect to GitHub OAuth
router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'GitHub OAuth not configured' });
  const redirect = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email`;
  res.redirect(redirect);
});

// GET /api/auth/github/callback
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/#login?error=oauth_failed');

    // Exchange code for access token
    const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code })
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) return res.redirect('/#login?error=oauth_failed');

    // Get user info
    const userResp = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + tokenData.access_token, 'User-Agent': 'INK-Diary' } });
    const githubUser = await userResp.json();
    if (!githubUser.login) return res.redirect('/#login?error=oauth_failed');

    // Find or create user
    const db = getDB();
    const username = 'gh_' + githubUser.login;
    let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      const result = db.prepare('INSERT INTO users (username, password, display_name, avatar_url) VALUES (?, ?, ?, ?)').run(
        username, bcrypt.hashSync(Math.random().toString(36), 10), githubUser.name || githubUser.login, githubUser.avatar_url || ''
      );
      user = { id: result.lastInsertRowid, username, display_name: githubUser.name || githubUser.login, avatar_url: githubUser.avatar_url || '' };
    }

    const token = generateToken(user.id, '30d');
    res.redirect(`/#login?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  } catch (e) {
    res.redirect('/#login?error=oauth_failed');
  }
});

// GET /api/auth/google — redirect to Google OAuth
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });
  const redirectUri = (process.env.BASE_URL || 'http://localhost:3000') + '/api/auth/google/callback';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20profile%20email`;
  res.redirect(url);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/#login?error=oauth_failed');

    const redirectUri = (process.env.BASE_URL || 'http://localhost:3000') + '/api/auth/google/callback';
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, code, redirect_uri: redirectUri, grant_type: 'authorization_code' })
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) return res.redirect('/#login?error=oauth_failed');

    const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tokenData.access_token } });
    const googleUser = await userResp.json();
    if (!googleUser.email) return res.redirect('/#login?error=oauth_failed');

    const db = getDB();
    const username = 'go_' + googleUser.email.split('@')[0];
    let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      const result = db.prepare('INSERT INTO users (username, password, display_name, avatar_url) VALUES (?, ?, ?, ?)').run(
        username, bcrypt.hashSync(Math.random().toString(36), 10), googleUser.name || googleUser.email, googleUser.picture || ''
      );
      user = { id: result.lastInsertRowid, username, display_name: googleUser.name || googleUser.email, avatar_url: googleUser.picture || '' };
    }

    const token = generateToken(user.id, '30d');
    res.redirect(`/#login?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  } catch (e) {
    res.redirect('/#login?error=oauth_failed');
  }
});

module.exports = router;
