const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDB } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'img_' + Date.now() + '_' + Math.round(Math.random() * 1000) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => { cb(null, /\.(jpg|jpeg|png|webp)$/i.test(path.extname(file.originalname))); } });

// GET /api/entries
router.get('/', optionalAuth, (req, res) => {
  try {
    const { mood, date, user_id } = req.query;
    const params = [];
    let where = 'WHERE e.is_public = 1';

    if (mood) { where += ' AND e.mood_key = ?'; params.push(mood); }
    if (date) { where += ' AND e.date = ?'; params.push(date); }
    if (user_id) { const uid = safeInt(user_id); if (uid > 0) { where += ' AND e.user_id = ?'; params.push(uid); } }

    const countRow = await getDB().prepare(`SELECT COUNT(*) as total FROM entries e ${where}`).get(...params);
    const total = countRow ? (countRow.total || 0) : 0;
    const entries = await getDB().prepare(`SELECT e.*, u.display_name, u.avatar_url FROM entries e JOIN users u ON e.user_id = u.id ${where} ORDER BY e.created_at DESC`).all(...params);

    const enriched = (entries || []).map(e => {
      const images = (await getDB().prepare('SELECT image_url FROM entry_images WHERE entry_id = ? ORDER BY sort_order').all(e.id) || []).map(r => r.image_url);
      const lc = await getDB().prepare('SELECT COUNT(*) as c FROM likes WHERE entry_id = ?').get(e.id);
      const cc = await getDB().prepare('SELECT COUNT(*) as c FROM comments WHERE entry_id = ?').get(e.id);
      let liked = false;
      if (req.userId) liked = !!await getDB().prepare('SELECT id FROM likes WHERE user_id = ? AND entry_id = ?').get(req.userId, e.id);
      return { ...e, images, likes_count: lc ? lc.c : 0, comments_count: cc ? cc.c : 0, liked, user: { display_name: e.display_name, avatar_url: e.avatar_url } };
    });

    res.json({ entries: enriched, total, page: 1 });
  } catch (err) {
    console.error('[Entries] GET error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: safely parse int, returns 0 for invalid input
function safeInt(v) { const n = parseInt(v, 10); return (isNaN(n) || n <= 0) ? 0 : n; }
// Helper: robust is_public check
function isPublic(val) { return ![false, 'false', 0, '0'].includes(val); }

// GET /api/entries/:id
router.get('/:id', optionalAuth, (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ error: '无效的日记ID' });
  const e = await getDB().prepare('SELECT e.*, u.display_name, u.avatar_url FROM entries e JOIN users u ON e.user_id = u.id WHERE e.id = ?').get(id);
  if (!e) return res.status(404).json({ error: '日记不存在' });

  const images = (await getDB().prepare('SELECT image_url FROM entry_images WHERE entry_id = ? ORDER BY sort_order').all(e.id) || []).map(r => r.image_url);
  const lc = await getDB().prepare('SELECT COUNT(*) as c FROM likes WHERE entry_id = ?').get(e.id);
  const cc = await getDB().prepare('SELECT COUNT(*) as c FROM comments WHERE entry_id = ?').get(e.id);
  let liked = false;
  if (req.userId) liked = !!await getDB().prepare('SELECT id FROM likes WHERE user_id = ? AND entry_id = ?').get(req.userId, e.id);

  res.json({ entry: { ...e, images, likes_count: lc ? lc.c : 0, comments_count: cc ? cc.c : 0, liked, user: { display_name: e.display_name, avatar_url: e.avatar_url } } });
});

// POST /api/entries
router.post('/', requireAuth, upload.array('images', 4), (req, res) => {
  const { mood_key, title, content, is_public, date: entryDate } = req.body;
  if (!mood_key) return res.status(400).json({ error: '请选择心情' });

  const dateStr = entryDate || new Date().toISOString().split('T')[0];
  const result = await getDB().prepare("INSERT INTO entries (user_id, mood_key, title, content, is_public, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))").run(req.userId, mood_key, title || '', content || '', isPublic(is_public) ? 1 : 0, dateStr);

  if (req.files && req.files.length > 0) {
    const ins = await getDB().prepare('INSERT INTO entry_images (entry_id, image_url, sort_order) VALUES (?, ?, ?)');
    req.files.forEach(async (f, i) => await ins.run(result.lastInsertRowid, '/uploads/' + f.filename, i));
  }

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/entries/:id
router.put('/:id', requireAuth, upload.array('images', 4), (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ error: '无效的日记ID' });
  const entry = await getDB().prepare('SELECT * FROM entries WHERE id = ?').get(id);
  if (!entry) return res.status(404).json({ error: '日记不存在' });
  if (entry.user_id !== req.userId) return res.status(403).json({ error: '无权编辑' });

  const { mood_key, title, content, is_public, date: eDate, keep_images } = req.body;
  await getDB().prepare("UPDATE entries SET mood_key = ?, title = ?, content = ?, is_public = ?, date = ?, updated_at = datetime('now') WHERE id = ?").run(
    mood_key || entry.mood_key, title !== undefined ? title : entry.title,
    content !== undefined ? content : entry.content,
    is_public !== undefined ? (isPublic(is_public) ? 1 : 0) : entry.is_public,
    eDate || entry.date, id
  );

  if (keep_images !== 'true') {
    await getDB().prepare('DELETE FROM entry_images WHERE entry_id = ?').run(id);
    if (req.files && req.files.length > 0) {
      const ins = await getDB().prepare('INSERT INTO entry_images (entry_id, image_url, sort_order) VALUES (?, ?, ?)');
      req.files.forEach(async (f, i) => await ins.run(id, '/uploads/' + f.filename, i));
    }
  }

  res.json({ success: true });
});

// DELETE /api/entries/:id
router.delete('/:id', requireAuth, (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ error: '无效的日记ID' });
  const entry = await getDB().prepare('SELECT * FROM entries WHERE id = ?').get(id);
  if (!entry) return res.status(404).json({ error: '日记不存在' });
  if (entry.user_id !== req.userId) return res.status(403).json({ error: '无权删除' });

  await getDB().prepare('DELETE FROM entries WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
