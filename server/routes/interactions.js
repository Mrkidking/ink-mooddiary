const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
    filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, 'cmt_' + Date.now() + '_' + Math.round(Math.random() * 1000) + ext); }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => { cb(null, /\.(jpg|jpeg|png|webp)$/i.test(path.extname(file.originalname))); }
});

// POST /api/entries/:id/like — toggle like
router.post('/entries/:id/like', requireAuth, (req, res) => {
  const entryId = req.params.id;
  const entry = await getDB().prepare('SELECT id FROM entries WHERE id = ?').get(entryId);
  if (!entry) return res.status(404).json({ error: '日记不存在' });

  const existing = await getDB().prepare('SELECT id FROM likes WHERE user_id = ? AND entry_id = ?').get(req.userId, entryId);
  if (existing) {
    await getDB().prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
    res.json({ liked: false });
  } else {
    await getDB().prepare('INSERT INTO likes (user_id, entry_id) VALUES (?, ?)').run(req.userId, entryId);
    res.json({ liked: true });
  }
});

// GET /api/entries/:id/comments
router.get('/entries/:id/comments', (req, res) => {
  const comments = await getDB().prepare('SELECT c.*, u.username, u.display_name, u.avatar_url FROM comments c JOIN users u ON c.user_id = u.id WHERE c.entry_id = ? ORDER BY c.created_at ASC').all(req.params.id);
  res.json({ comments: comments.map(c => ({ ...c, user: { username: c.username, display_name: c.display_name, avatar_url: c.avatar_url } })) });
});

// POST /api/entries/:id/comments
router.post('/entries/:id/comments', requireAuth, upload.single('image'), (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '评论内容不能为空' });

  const entry = await getDB().prepare('SELECT id FROM entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: '日记不存在' });

  const imageUrl = req.file ? '/uploads/' + req.file.filename : '';
  const result = await getDB().prepare('INSERT INTO comments (user_id, entry_id, content, image_url) VALUES (?, ?, ?, ?)').run(req.userId, req.params.id, content.trim(), imageUrl);

  const comment = await getDB().prepare('SELECT c.*, u.username, u.display_name, u.avatar_url FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(result.lastInsertRowid);
  res.status(201).json({ comment: { ...comment, user: { username: comment.username, display_name: comment.display_name, avatar_url: comment.avatar_url } } });
});

module.exports = router;
