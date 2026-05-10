// ==================== ROUTER ====================
const router = {
  current: 'home',
  navigate(route) { location.hash = route; },

  async _onChange() {
    const route = (location.hash || '#home').replace('#', '').split('?')[0] || 'home';
    this.current = route;

    document.querySelectorAll('.feed .view').forEach(v => v.classList.remove('active'));
    const ve = document.getElementById('view-' + route);
    if (ve) ve.classList.add('active');

    document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
    document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));

    // Show/hide explore panel
    const ep = document.getElementById('explorePanel');
    if (ep) ep.style.display = (route === 'write') ? 'none' : '';

    // Auth-gated routes
    if (route === 'write' && !currentUser) { authUI.show(); router.navigate('home'); return; }

    if (route === 'home') { await homeView.render(); updateWeather(); updateRightPanel(); }
    if (route === 'explore') exploreView.render();
    if (route === 'write') writeView.render();
    if (route === 'calendar') await calView.render();
    if (route === 'profile') {
      const params = new URLSearchParams(location.hash.split('?')[1] || '');
      await profileView.render(params.get('user'));
    }

    updateUIState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

window.addEventListener('hashchange', () => router._onChange());

// ==================== UI STATE ====================
function updateUIState() {
  const loggedIn = !!currentUser;
  document.getElementById('guestBanner').style.display = loggedIn ? 'none' : '';
  document.getElementById('homeCompose').style.display = loggedIn ? '' : 'none';
  document.getElementById('sidebarLogout').style.display = loggedIn ? '' : 'none';

  const avatar = document.getElementById('sidebarAvatar');
  const name = document.getElementById('sidebarName');
  const handle = document.getElementById('sidebarHandle');
  const composeAvatar = document.getElementById('composeAvatar');

  if (loggedIn) {
    const initial = (currentUser.display_name || currentUser.username || '?').charAt(0).toUpperCase();
    avatar.textContent = initial; avatar.style.background = 'var(--gradient-story)';
    name.textContent = currentUser.display_name || currentUser.username;
    handle.textContent = '@' + (currentUser.username || '...');
    if (composeAvatar) composeAvatar.textContent = initial;
  } else {
    avatar.textContent = '?'; avatar.style.background = 'var(--bg-elevated)';
    name.textContent = '未登录'; handle.textContent = '点击登录';
  }
}

// ==================== APP LOGIC ====================
let isPublicEntry = true;

const app = {
  async init() {
    await Auth.init();
    updateUIState();

    document.getElementById('diaryContent').addEventListener('input', () => {
      document.getElementById('charCount').textContent = `${document.getElementById('diaryContent').value.length} 字`;
    });
    document.getElementById('quickContent').addEventListener('input', function() {
      this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    router._onChange();
  },

  // Quick compose
  selectQuickMood(btn) {
    document.querySelectorAll('#quickMoods .compose-mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('quickMoods').dataset.selected = btn.dataset.mood;
  },

  selectMood(btn, pickerId) {
    const picker = document.getElementById(pickerId);
    if (picker) picker.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  },

  togglePrivacy() {
    isPublicEntry = !isPublicEntry;
    document.getElementById('privacyToggle').textContent = isPublicEntry ? '🌐 公开' : '🔒 私密';
  },

  toggleWritePrivacy() {
    isPublicEntry = !isPublicEntry;
    document.getElementById('writePrivacyToggle').textContent = isPublicEntry ? '🌐 公开' : '🔒 私密';
  },

  async quickPublish() {
    if (!currentUser) { authUI.show(); return; }
    const moodKey = document.getElementById('quickMoods').dataset.selected || 'happy';
    const content = document.getElementById('quickContent').value.trim();
    if (!content) { toast('请写点什么吧'); return; }

    await API.post('/api/entries', { mood_key: moodKey, content, is_public: isPublicEntry ? 'true' : 'false' });
    document.getElementById('quickContent').value = ''; document.getElementById('quickContent').style.height = 'auto';
    isPublicEntry = true; document.getElementById('privacyToggle').textContent = '🌐 公开';
    toast('已发布 🎉');
    await router._onChange();
  },

  // Full editor
  async saveEntry() {
    if (!currentUser) { authUI.show(); return; }
    const moodBtn = document.querySelector('#moodPicker .mood-btn.selected');
    if (!moodBtn) { toast('请选择心情'); return; }
    const title = document.getElementById('diaryTitle').value.trim();
    const content = document.getElementById('diaryContent').value.trim();
    if (!content && !title) { toast('请输入内容'); return; }

    const editId = document.getElementById('editId').value;
    const formData = new FormData();
    formData.append('mood_key', moodBtn.dataset.mood);
    formData.append('title', title);
    formData.append('content', content);
    formData.append('is_public', isPublicEntry ? 'true' : 'false');

    // Add images
    for (const file of document.getElementById('imageInput')?.files || []) {
      formData.append('images', file);
    }

    if (editId) {
      formData.append('keep_images', 'true');
      await fetch(`/api/entries/${editId}`, { method: 'PUT', headers: { Authorization: 'Bearer ' + API.token }, body: formData });
    } else {
      await fetch('/api/entries', { method: 'POST', headers: { Authorization: 'Bearer ' + API.token }, body: formData });
    }

    document.getElementById('editId').value = '';
    ImagePreviews.reset(); ImagePreviews.render('imageArea');
    document.getElementById('diaryTitle').value = '';
    document.getElementById('diaryContent').value = '';
    isPublicEntry = true;
    toast(editId ? '已更新' : '已保存');
    router.navigate('home');
  },

  async editEntry(id) {
    if (!currentUser) { authUI.show(); return; }
    const data = await API.get(`/api/entries/${id}`);
    const e = data.entry;
    if (!e) return;

    document.getElementById('editId').value = e.id;
    document.getElementById('diaryTitle').value = e.title || '';
    document.getElementById('diaryContent').value = e.content || '';
    document.getElementById('charCount').textContent = `${(e.content||'').length} 字`;
    isPublicEntry = e.is_public !== 0;
    document.getElementById('moodPicker').innerHTML = moodPickerHTML(e.mood_key);

    ImagePreviews.set(e.images || []);
    ImagePreviews.render('imageArea');
    router.navigate('write');
  },

  // Interactions
  async toggleLike(entryId, btn) {
    if (!currentUser) { toast('请先登录'); return; }
    const data = await API.post(`/api/entries/${entryId}/like`);
    if (!data.error) {
      btn.classList.toggle('liked', data.liked);
      const svg = btn.querySelector('svg');
      if (svg) {
        if (data.liked) { svg.setAttribute('fill', 'currentColor'); svg.setAttribute('stroke', 'currentColor'); }
        else { svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); }
      }
      btn.classList.add('like-anim');
      setTimeout(() => btn.classList.remove('like-anim'), 600);
    }
  },

  async toggleComments(entryId) {
    const el = document.getElementById('comments-' + entryId);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }

    // Fetch comments
    const data = await API.get(`/api/entries/${entryId}/comments`);
    const comments = data.comments || [];
    el.innerHTML = comments.map(c => {
      const avatarBg = `background:linear-gradient(135deg,#F0A89A,#E8927C);`;
      return `<div class="comment-item">
        <div class="comment-avatar" style="${avatarBg}">${(c.user.display_name||c.user.username||'?').charAt(0)}</div>
        <div class="comment-body">
          <span class="comment-user">${esc(c.user.display_name||c.user.username)}</span>
          <span class="comment-text">${esc(c.content)}</span>
          <div class="comment-time">${timeAgo(c.created_at)}</div>
        </div>
      </div>`;
    }).join('') + `<div class="comment-input-row">
      <input class="comment-input" id="commentInput-${entryId}" placeholder="写评论..." onkeydown="if(event.key==='Enter')app.addComment(${entryId})">
      <button class="btn-post" style="padding:6px 14px;font-size:12px;" onclick="app.addComment(${entryId})">发送</button>
    </div>`;
    el.style.display = '';
    const inp = document.getElementById('commentInput-' + entryId);
    if (inp) setTimeout(() => inp.focus(), 100);
  },

  async addComment(entryId) {
    if (!currentUser) { toast('请先登录'); return; }
    const inp = document.getElementById('commentInput-' + entryId);
    if (!inp) return;
    const content = inp.value.trim();
    if (!content) return;
    await API.post(`/api/entries/${entryId}/comments`, { content });
    inp.value = '';
    this.toggleComments(entryId); // collapse
    setTimeout(() => this.toggleComments(entryId), 50); // re-expand with new comment
  },

  // Follow
  async toggleFollow(userId) {
    if (!currentUser) { toast('请先登录'); return; }
    const data = await API.post(`/api/users/${userId}/follow`);
    if (router.current === 'profile') profileView.render(profileView.profileUserId);
    updateRightPanel();
  },

  // Profile edit
  openProfileEdit() {
    document.getElementById('editName').value = currentUser.display_name || '';
    document.getElementById('editHandle').value = '';
    document.getElementById('editBio').value = currentUser.bio || '';
    document.getElementById('modalOverlay').classList.add('open');
  },
  closeProfileEdit() { document.getElementById('modalOverlay').classList.remove('open'); },
  async saveProfile() {
    const display_name = document.getElementById('editName').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    await Auth.updateProfile({ display_name, bio });
    this.closeProfileEdit();
    updateUIState();
    if (router.current === 'profile') profileView.render(currentUser.id);
    toast('资料已更新');
  }
};

// ==================== INIT ====================
document.getElementById('modalOverlay').addEventListener('click', function(e) { if (e.target === this) app.closeProfileEdit(); });
document.getElementById('loginOverlay').addEventListener('click', function(e) { if (e.target === this) authUI.hide(); });
document.getElementById('lightbox').addEventListener('click', function() { this.classList.remove('open'); });

app.init();
