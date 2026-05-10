// Reusable UI components
const MOODS = [
  { key:'happy', emoji:'😊', label:'开心' }, { key:'calm', emoji:'😌', label:'平静' },
  { key:'excited', emoji:'🤩', label:'兴奋' }, { key:'love', emoji:'🥰', label:'恋爱' },
  { key:'sad', emoji:'😢', label:'难过' }, { key:'anxious', emoji:'😰', label:'焦虑' },
  { key:'angry', emoji:'😡', label:'生气' }, { key:'tired', emoji:'😴', label:'疲惫' }
];
const MOOD_MAP = Object.fromEntries(MOODS.map(m => [m.key, m]));
const QUICK_MOODS = MOODS.slice(0, 5);

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function timeAgo(dateStr) {
  const d = new Date(dateStr); const now = new Date();
  const diffHr = Math.floor((now - d) / 3600000);
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHr < 24) return `${diffHr}小时前`;
  return `${Math.floor(diffHr / 24)}天前`;
}

function avatarGradient(userId) {
  const colors = [['#F0A89A','#E8927C'],['#E8927C','#D4A574'],['#D4A574','#C9A87C'],['#C9A87C','#7CBF8A'],['#F0A89A','#C9A87C']];
  const pair = colors[(userId || '?').charCodeAt(0) % colors.length];
  return `background:linear-gradient(135deg,${pair[0]},${pair[1]});`;
}

// Diary card HTML (used in home, explore, profile)
function diaryCardHTML(entry, index) {
  const user = entry.user || {};
  const mood = MOOD_MAP[entry.mood_key] || MOODS[0];
  const likes = entry.likes_count || 0;
  const comments = entry.comments_count || 0;
  const liked = entry.liked;
  const imgs = entry.images || [];
  const avatarBg = avatarGradient(user['email'] || entry.user_id);
  const initial = (user.display_name || user['email'] || '?').charAt(0).toUpperCase();

  const imgHTML = imgs.length ? `<div class="post-media"><div class="post-media-grid cols-${Math.min(imgs.length,2)}">${imgs.map(img => `<div class="media-item"><img src="${img}" alt="" onclick="event.stopPropagation();Lightbox.open('${img}')"></div>`).join('')}</div></div>` : '';

  return `<article class="post" style="animation-delay:${(index||0)*0.03}s">
    <div class="post-header">
      <div class="post-avatar" style="${avatarBg}" onclick="router.navigate('profile?user=${entry.user_id}')">${initial}</div>
      <div class="post-info">
        <div class="post-name-row">
          <span class="post-name" onclick="router.navigate('profile?user=${entry.user_id}')">${esc(user.display_name || user['email'] || '未知')}</span>
          <span class="post-handle">${esc(user.display_name || user['email'] || '?')}</span>
        </div>
        <span class="post-time">${mood.emoji} ${mood.label} · ${timeAgo(entry.created_at)}</span>
      </div>
    </div>
    ${entry.title ? `<div style="font-weight:700;font-size:15px;margin-bottom:6px;">${esc(entry.title)}</div>` : ''}
    ${entry.content ? `<div class="post-text">${esc(entry.content).substring(0,300)}${entry.content.length>300?'...':''}</div>` : ''}
    ${imgHTML}
    <div class="post-stats">
      <button class="stat-btn like${liked?' liked':''}" onclick="app.toggleLike(${entry.id}, this)">${liked ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>'} ${likes}</button>
      <button class="stat-btn comment" onclick="app.toggleComments(${entry.id})">💬 ${comments}</button>
    </div>
    <div class="comments-section" id="comments-${entry.id}" style="display:none;"></div>
  </article>`;
}

// Mood picker HTML
function moodPickerHTML(selected) {
  return MOODS.map(m => `<button class="mood-btn${m.key===selected?' selected':''}" data-mood="${m.key}" onclick="app.selectMood(this, 'moodPicker')"><span class="mood-emoji">${m.emoji}</span><span class="mood-label">${m.label}</span></button>`).join('');
}

// Quick mood picker
function quickMoodPickerHTML(selected) {
  return QUICK_MOODS.map(m => `<button class="compose-mood-btn${m.key===selected?' selected':''}" data-mood="${m.key}" onclick="app.selectQuickMood(this)" title="${m.label}">${m.emoji}</button>`).join('');
}

// Image preview renderer
const ImagePreviews = {
  imgs: [],
  reset() { this.imgs = []; },
  get() { return [...this.imgs]; },
  set(arr) { this.imgs = [...arr]; },
  add(urls) { this.imgs.push(...urls); this.render('imageArea'); },
  remove(idx) { this.imgs.splice(idx, 1); this.render('imageArea'); },
  render(areaId) {
    const area = document.getElementById(areaId);
    if (!area) return;
    area.innerHTML = this.imgs.map((img, i) => `<div class="image-preview"><img src="${img}" alt=""><button class="remove-btn" onclick="ImagePreviews.remove(${i})">&times;</button></div>`).join('') + (this.imgs.length < 4 ? `<div class="image-upload-btn" onclick="document.getElementById('imageInput').click()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>添加图片</div>` : '');
  }
};

// Lightbox
const Lightbox = {
  open(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('open'); }
};

// Toast
function toast(msg) {
  const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(el._timeout); el._timeout = setTimeout(() => el.classList.remove('show'), 2000);
}
