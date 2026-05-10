// View rendering functions

// ==================== HOME VIEW ====================
const homeView = {
  async render() {
    const data = await API.get('/api/entries?limit=50');
    const entries = data.entries || [];
    const list = document.getElementById('diaryPosts');
    const empty = document.getElementById('emptyHome');

    if (entries.length === 0) { list.innerHTML = ''; empty.style.display = 'flex'; }
    else { empty.style.display = 'none'; list.innerHTML = entries.map((e, i) => diaryCardHTML(e, i)).join(''); }

    // Stories row — last 6 days
    renderStories(entries);

    // Quick mood picker
    document.getElementById('quickMoods').innerHTML = quickMoodPickerHTML('happy');
    document.getElementById('quickMoods').dataset.selected = 'happy';
  }
};

function renderStories(entries) {
  const row = document.getElementById('storiesRow');
  if (!row) return;
  const today = new Date();
  const map = {};
  for (const e of entries) { if (!map[e.date]) map[e.date] = e; }

  let html = '';
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const entry = map[ds]; const mood = entry ? MOOD_MAP[entry.mood_key] : null;
    const label = i === 0 ? '今天' : i === 1 ? '昨天' : ['日','一','二','三','四','五','六'][d.getDay()];
    html += `<div class="story-ring-wrap" ${mood ? `onclick="router.navigate('write');setTimeout(()=>app.editEntry(${entry.id}),50)"` : ''}>
      <div class="story-ring${mood?'':' no-story'}"><div class="story-ring-inner">${mood ? mood.emoji : '+'}</div></div>
      <span class="story-label">${label}</span></div>`;
  }
  row.innerHTML = html;
}

// ==================== EXPLORE VIEW ====================
const exploreView = {
  currentTag: null,
  async render() {
    document.getElementById('exploreTags').innerHTML = `<span class="tag-pill${!this.currentTag?' active':''}" onclick="exploreView.filter(null)">全部</span>` + MOODS.map(m => `<span class="tag-pill${this.currentTag===m.key?' active':''}" onclick="exploreView.filter('${m.key}')">${m.emoji} ${m.label}</span>`).join('');
    await this.showEntries();
  },
  async showEntries() {
    const url = this.currentTag ? `/api/entries?mood=${this.currentTag}&limit=50` : '/api/entries?limit=50';
    const data = await API.get(url);
    const entries = data.entries || [];
    const list = document.getElementById('explorePosts');
    const empty = document.getElementById('exploreEmpty');
    if (entries.length === 0) { list.innerHTML = ''; empty.style.display = 'flex'; }
    else { empty.style.display = 'none'; list.innerHTML = entries.map((e, i) => diaryCardHTML(e, i)).join(''); }
  },
  filter(tag) { this.currentTag = tag; this.render(); }
};

// ==================== WRITE VIEW ====================
const writeView = {
  render() {
    const editId = document.getElementById('editId').value;
    const sel = document.querySelector('#moodPicker .mood-btn.selected');
    document.getElementById('moodPicker').innerHTML = moodPickerHTML(sel ? sel.dataset.mood : 'happy');
    if (!editId) {
      document.getElementById('diaryTitle').value = '';
      document.getElementById('diaryContent').value = '';
      document.getElementById('charCount').textContent = '0 字';
      ImagePreviews.reset(); ImagePreviews.render('imageArea');
    }
  }
};

// ==================== CALENDAR VIEW ====================
const calView = (() => {
  let year, month, selDate = '';
  function init() { const n = new Date(); year = n.getFullYear(); month = n.getMonth(); }
  function goToday() { const n = new Date(); year = n.getFullYear(); month = n.getMonth(); selDate = ''; render(); }
  function prevMonth() { month--; if (month < 0) { month = 11; year--; } selDate = ''; render(); }
  function nextMonth() { month++; if (month > 11) { month = 0; year++; } selDate = ''; render(); }

  async function render() {
    document.getElementById('calMonthTitle').textContent = `${year}年 ${month + 1}月`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Fetch all entries for this month
    const firstDay = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const lastDay = `${year}-${String(month+1).padStart(2,'0')}-${new Date(year,month+1,0).getDate()}`;
    const data = await API.get(`/api/entries?date=&limit=200`);
    const allEntries = data.entries || [];
    const entryMap = {};
    for (const e of allEntries) {
      const entryDate = e.date || e.created_at?.split('T')[0];
      if (!entryDate) continue;
      if (!entryMap[entryDate]) entryMap[entryDate] = [];
      entryMap[entryDate].push(e);
    }

    const firstDoW = new Date(year, month, 1).getDay();
    const daysIn = new Date(year, month+1, 0).getDate();
    let html = ['日','一','二','三','四','五','六'].map(l => `<div class="cal-day-label">${l}</div>`).join('');

    for (let i = firstDoW - 1; i >= 0; i--) html += `<div class="cal-day other-month"><span>${new Date(year,month,0).getDate()-i}</span></div>`;
    for (let d = 1; d <= daysIn; d++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const entries = entryMap[ds] || [];
      const mood = entries.length > 0 ? (MOOD_MAP[entries[0].mood_key] || MOODS[0]) : null;
      let cls = 'cal-day';
      if (ds === todayStr) cls += ' today';
      if (mood) cls += ' has-entry';
      if (ds === selDate) cls += ' selected';
      html += `<div class="cal-day${cls.includes('other')?'':''}" style="aspect-ratio:1;border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-size:14px;border:1px solid ${mood?'var(--border)':'transparent'};${ds===todayStr?'font-weight:700;color:var(--accent-blue);':''}${ds===selDate?'border-color:var(--accent-blue);background:rgba(232,146,124,0.08);':''}" onclick="calView.selectDay('${ds}')"><span>${d}</span>${mood?`<span style="font-size:18px;">${mood.emoji}</span>`:''}</div>`;
    }
    const rem = 42 - (firstDoW + daysIn);
    for (let d = 1; d <= rem; d++) html += `<div class="cal-day other-month"><span>${d}</span></div>`;
    document.getElementById('calGrid').innerHTML = html;
    await renderPreview();
  }

  async function selectDay(dateStr) { selDate = dateStr; await render(); }

  async function renderPreview() {
    const preview = document.getElementById('calPreview');
    if (!selDate) { preview.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;">点击某一天查看公开心情</div>'; return; }
    const data = await API.get(`/api/entries?date=${selDate}&limit=20`);
    const entries = data.entries || [];
    if (entries.length === 0) { preview.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;">${selDate} 没有公开日记</div>`; return; }
    preview.innerHTML = entries.map((e, i) => diaryCardHTML(e, i)).join('');
  }

  init(); return { render, goToday, prevMonth, nextMonth, selectDay };
})();

// ==================== PROFILE VIEW ====================
const profileView = {
  profileUserId: null,
  async render(uid) {
    const userId = uid || (currentUser ? currentUser.id : null);
    if (!userId) return;
    this.profileUserId = userId;

    const data = await API.get(`/api/users/${userId}`);
    const user = data.user;
    if (!user) return;

    const isSelf = currentUser && parseInt(currentUser.id) === parseInt(userId);
    const avatarEl = document.getElementById('profileAvatar');
    const avatarUrl = user.avatar_url || '';
    if (avatarUrl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      avatarEl.style.background = 'none';
    } else {
      avatarEl.textContent = (user.display_name || user.username).charAt(0).toUpperCase();
      avatarEl.style.background = 'var(--gradient-ins)';
    }
    document.getElementById('profileName').textContent = user.display_name || user.username;
    document.getElementById('profileHandle').textContent = '@' + (user.username || 'unknown');
    document.getElementById('profileBio').textContent = user.bio || '这个人很懒，什么都没有写...';
    document.getElementById('profileEntryCount').textContent = user.entryCount || 0;
    document.getElementById('profileFollowerCount').textContent = user.followerCount || 0;
    document.getElementById('profileFollowingCount').textContent = user.followingCount || 0;

    document.getElementById('btnEditProfile').style.display = isSelf ? '' : 'none';
    const followBtn = document.getElementById('btnFollowProfile');
    if (!isSelf && currentUser) {
      followBtn.style.display = '';
      followBtn.textContent = user.isFollowing ? '已关注' : '关注';
      followBtn.className = 'btn-follow' + (user.isFollowing ? ' following' : '');
    } else { followBtn.style.display = 'none'; }

    // Load user entries
    const eData = await API.get(`/api/users/${userId}/entries?limit=50`);
    const entries = eData.entries || [];
    document.getElementById('profilePosts').innerHTML = entries.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-muted);">还没有公开日记</div>' : entries.map((e, i) => diaryCardHTML(e, i)).join('');
  }
};

// ==================== RIGHT PANEL ====================
async function updateRightPanel() {
  try {
    // Community stats
    const stats = await API.get('/api/stats/community');
    if (stats.todayTopMood) {
      const m = MOOD_MAP[stats.todayTopMood.mood_key] || MOODS[0];
      document.getElementById('hotMoodEmoji').textContent = m.emoji;
      document.getElementById('hotMoodLabel').textContent = m.label;
      document.getElementById('hotMoodCount').textContent = `${stats.todayTopMood.c} 人`;
    }

    // Who to follow — fetch all users
    const usersData = await API.get('/api/users/1/followers'); // just to get some users
    // For who-to-follow, we'll use the stats data
    document.getElementById('whoToFollow').innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:8px;">注册更多用户来发现新朋友</div>';

    // Mood tag cloud
    document.getElementById('moodTagCloud').innerHTML = MOODS.map(m => `<span class="tag-pill" onclick="router.navigate('explore');setTimeout(()=>exploreView.filter('${m.key}'),100)">${m.emoji} ${m.label}</span>`).join('');
  } catch {}
}

// ==================== WEATHER ====================
async function updateWeather() {
  try {
    const data = await API.get('/api/weather');
    if (data.weather) {
      const w = data.weather;
      document.getElementById('weatherError').style.display = 'none';
      document.getElementById('weatherBody').style.display = '';
      document.getElementById('weatherIcon').innerHTML = weatherIcons.pick(w.code);
      document.getElementById('weatherCity').textContent = w.city || '--';
      document.getElementById('weatherTemp').textContent = `${w.temp}°C`;
      document.getElementById('weatherDesc').textContent = w.desc || '';
      document.getElementById('weatherExtra').textContent = `体感 ${w.feelsLike}°C · 湿度 ${w.humidity}%`;
    }
  } catch {
    document.getElementById('weatherBody').style.display = 'none';
    document.getElementById('weatherError').style.display = '';
  }
}
