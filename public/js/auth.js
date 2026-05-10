// Auth UI and state management
let currentUser = null;

const Auth = {
  async init() {
    if (API.token) {
      try {
        const data = await API.get('/api/auth/me');
        if (data.user) currentUser = data.user;
        else API.clearToken();
      } catch {
        API.clearToken();
      }
    }
  },

  async login(username, password) {
    const data = await API.post('/api/auth/login', { username, password });
    if (data.error) return data;
    API.setToken(data.token);
    currentUser = data.user;
    return {};
  },

  async register(username, password, display_name) {
    const data = await API.post('/api/auth/register', { username, password, display_name });
    if (data.error) return data;
    API.setToken(data.token);
    currentUser = data.user;
    return {};
  },

  async updateProfile(fields) {
    const data = await API.put('/api/auth/me', fields);
    if (data.user) currentUser = data.user;
    return data;
  },

  logout() {
    API.clearToken();
    currentUser = null;
    router._onChange();
  }
};

// Login modal UI
const authUI = (() => {
  let mode = 'login';

  function show(m = 'login') { mode = m; switchTab(m); document.getElementById('loginOverlay').classList.add('open'); }
  function hide() { document.getElementById('loginOverlay').classList.remove('open'); }

  function switchTab(tab) {
    mode = tab;
    document.querySelectorAll('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('loginSubtitle').textContent = tab === 'login' ? '登录你的账号' : '创建一个新账号';
    document.getElementById('loginBtn').textContent = tab === 'login' ? '登录' : '注册';
    document.getElementById('loginError').textContent = '';
  }

  async function submit() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    if (!username || !password) { errEl.textContent = '请填写完整'; return; }
    btn.disabled = true; btn.textContent = '...';

    const r = mode === 'login' ? await Auth.login(username, password) : await Auth.register(username, password, username);
    if (r.error) { errEl.textContent = r.error; btn.disabled = false; btn.textContent = mode === 'login' ? '登录' : '注册'; return; }
    hide();
    router._onChange();
  }

  return { show, hide, switchTab, submit };
})();
