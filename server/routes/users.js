const express = require('express');
const { db } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/:id
router.get('/:id', optionalAuth, (req, res) => {
  const user = getDB().prepare('SELECT id, username, display_name, bio, avatar_url, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const entryCount = getDB().prepare('SELECT COUNT(*) as c FROM entries WHERE user_id = ? AND is_public = 1').get(req.params.id).c;
  const followerCount = getDB().prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').get(req.params.id).c;
  const followingCount = getDB().prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?').get(req.params.id).c;
  let isFollowing = false;
  if (req.userId && parseInt(req.userId) !== parseInt(req.params.id)) {
    isFollowing = !!getDB().prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.userId, req.params.id);
  }

  res.json({ user: { ...user, entryCount, followerCount, followingCount, isFollowing } });
});

// GET /api/users/:id/entries
router.get('/:id/entries', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const entries = getDB().prepare('SELECT e.*, u.username, u.display_name, u.avatar_url FROM entries e JOIN users u ON e.user_id = u.id WHERE e.user_id = ? AND e.is_public = 1 ORDER BY e.created_at DESC LIMIT ? OFFSET ?').all(req.params.id, parseInt(limit), offset);
  const total = getDB().prepare('SELECT COUNT(*) as c FROM entries WHERE user_id = ? AND is_public = 1').get(req.params.id).c;

  const enriched = entries.map(e => {
    const images = getDB().prepare('SELECT image_url FROM entry_images WHERE entry_id = ? ORDER BY sort_order').all(e.id).map(r => r.image_url);
    const likes_count = getDB().prepare('SELECT COUNT(*) as c FROM likes WHERE entry_id = ?').get(e.id).c;
    const comments_count = getDB().prepare('SELECT COUNT(*) as c FROM comments WHERE entry_id = ?').get(e.id).c;
    return { ...e, images, likes_count, comments_count, user: { username: e.username, display_name: e.display_name, avatar_url: e.avatar_url } };
  });

  res.json({ entries: enriched, total, page: parseInt(page) });
});

// POST /api/users/:id/follow — toggle follow
router.post('/:id/follow', requireAuth, (req, res) => {
  if (parseInt(req.params.id) === req.userId) return res.status(400).json({ error: '不能关注自己' });
  const user = getDB().prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const existing = getDB().prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.userId, req.params.id);
  if (existing) {
    getDB().prepare('DELETE FROM follows WHERE id = ?').run(existing.id);
    res.json({ following: false });
  } else {
    getDB().prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.userId, req.params.id);
    res.json({ following: true });
  }
});

// GET /api/users/:id/followers
router.get('/:id/followers', (req, res) => {
  const followers = getDB().prepare('SELECT u.id, u.username, u.display_name, u.avatar_url FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.following_id = ?').all(req.params.id);
  res.json({ followers });
});

// GET /api/users/:id/following
router.get('/:id/following', (req, res) => {
  const following = getDB().prepare('SELECT u.id, u.username, u.display_name, u.avatar_url FROM follows f JOIN users u ON f.following_id = u.id WHERE f.follower_id = ?').all(req.params.id);
  res.json({ following });
});

module.exports = router;
