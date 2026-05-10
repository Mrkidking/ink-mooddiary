let currentUser = null;

// ==================== API TOKEN STORAGE ====================
const TokenStore = {
  get() { return localStorage.getItem('ink_token') || sessionStorage.getItem('ink_token') || ''; },
  set(token, remember) {
    API.token = token;
    if (remember) localStorage.setItem('ink_token', token);
    else { localStorage.removeItem('ink_token'); sessionStorage.setItem('ink_token', token); }
  },
  clear() { API.token = ''; localStorage.removeItem('ink_token'); sessionStorage.removeItem('ink_token'); }
};

// ==================== AUTH STATE ====================
const Auth = {
  async init() {
    API.token = TokenStore.get();
    if (API.token) {
      try {
        const data = await API.get('/api/auth/me');
        if (data.user) currentUser = data.user;
        else TokenStore.clear();
      } catch { TokenStore.clear(); }
    }
  },

  async login(email, password, remember) {
    const data = await API.post('/api/auth/login', { email, password, remember_me: remember });
    if (data.error) return data;
    TokenStore.set(data.token, remember);
    currentUser = data.user;
    return {};
  },

  async register(email, phone, display_name, password, remember) {
    const data = await API.post('/api/auth/register', { email, phone, display_name, password, remember_me: remember });
    if (data.error) return data;
    TokenStore.set(data.token, remember);
    currentUser = data.user;
    return {};
  },

  async updateProfile(fields) {
    const data = await API.put('/api/auth/me', fields);
    if (data.user) currentUser = data.user;
    return data;
  },

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    const h = {}; if (API.token) h['Authorization'] = 'Bearer ' + API.token;
    const r = await fetch('/api/auth/avatar', { method: 'POST', headers: h, body: formData });
    const data = await r.json();
    if (data.avatar_url) { currentUser.avatar_url = data.avatar_url; }
    return data;
  },

  logout() {
    TokenStore.clear();
    currentUser = null;
    router._onChange();
  }
};

// ==================== MODAL LOGIN (quick access) ====================
const authUI = (() => {
  let mode = 'login';
  function show() { mode = 'login'; document.getElementById('loginOverlay').classList.add('open'); }
  function hide() { document.getElementById('loginOverlay').classList.remove('open'); }
  async function submit() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { document.getElementById('loginError').textContent = '请填写完整'; return; }
    const r = mode === 'login' ? await Auth.login(email, password, false) : await Auth.register(email, '', email.split('@')[0], password, false);
    if (r.error) { document.getElementById('loginError').textContent = r.error; return; }
    hide(); router._onChange();
  }
  return { show, hide, submit };
})();

// ==================== STANDALONE LOGIN PAGE ====================
const loginPage = (() => {
  let mode = 'login';

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
  }

  function togglePwd(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
    else { input.type = 'password'; btn.textContent = '👁️'; }
  }

  function switchTab(tab) {
    mode = tab; clearErrors();
    document.querySelectorAll('#view-login .tab').forEach(t => t.classList.toggle('active', (t.textContent.includes('登录') && tab === 'login') || (t.textContent.includes('注册') && tab === 'register')));
    document.getElementById('loginFormBlock').style.display = tab === 'login' ? '' : 'none';
    document.getElementById('registerFormBlock').style.display = tab === 'register' ? '' : 'none';
  }

  async function submit() {
    const btn = document.querySelector('#view-login .btn-full');
    const origText = btn.textContent;
    clearErrors();
    btn.disabled = true; btn.textContent = '请稍候...';

    try {
      if (mode === 'login') {
        const email = document.getElementById('lpEmail').value.trim();
        const password = document.getElementById('lpPassword').value;
        const remember = document.getElementById('lpRemember').checked;
        if (!email) { document.getElementById('lpEmailErr').textContent = '请输入邮箱'; btn.disabled = false; btn.textContent = origText; return; }
        if (!password) { document.getElementById('lpPwdErr').textContent = '请输入密码'; btn.disabled = false; btn.textContent = origText; return; }
        const r = await Auth.login(email, password, remember);
        if (r.error) { document.getElementById('lpPwdErr').textContent = r.error; btn.disabled = false; btn.textContent = origText; return; }
      } else {
        const email = document.getElementById('rpEmail').value.trim();
        const phone = document.getElementById('rpPhone').value.trim();
        const name = document.getElementById('rpName').value.trim();
        const password = document.getElementById('rpPassword').value;
        const remember = document.getElementById('rpRemember').checked;
        if (!email) { document.getElementById('rpEmailErr').textContent = '请输入邮箱'; btn.disabled = false; btn.textContent = origText; return; }
        if (!password || password.length < 4) { document.getElementById('rpPwdErr').textContent = '密码至少4位'; btn.disabled = false; btn.textContent = origText; return; }
        const r = await Auth.register(email, phone, name || email.split('@')[0], password, remember);
        if (r.error) { document.getElementById('rpEmailErr').textContent = r.error; btn.disabled = false; btn.textContent = origText; return; }
      }
      router.navigate('home');
    } finally {
      btn.disabled = false; btn.textContent = origText;
    }
  }

  function handleCallback() {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const token = params.get('token');
    const user = params.get('user');
    if (token && user) {
      TokenStore.set(token, true);
      try { currentUser = JSON.parse(user); } catch {}
      router.navigate('home');
    }
  }

  return { switchTab, submit, togglePwd, handleCallback };
})();
