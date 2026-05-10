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

  async login(username, password, remember) {
    const data = await API.post('/api/auth/login', { username, password, remember_me: remember });
    if (data.error) return data;
    TokenStore.set(data.token, remember);
    currentUser = data.user;
    return {};
  },

  async register(username, password, question, answer, remember) {
    const data = await API.post('/api/auth/register', { username, password, display_name: username, security_question: question, security_answer: answer, remember_me: remember });
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
  function show(m = 'login') { mode = m; switchTab(m); document.getElementById('loginOverlay').classList.add('open'); }
  function hide() { document.getElementById('loginOverlay').classList.remove('open'); }
  function switchTab(tab) {
    mode = tab;
    document.querySelectorAll('#loginOverlay .login-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('loginSubtitle').textContent = tab === 'login' ? '登录你的账号' : '创建一个新账号';
    document.getElementById('loginBtn').textContent = tab === 'login' ? '登录' : '注册';
    document.getElementById('loginError').textContent = '';
  }
  async function submit() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) { document.getElementById('loginError').textContent = '请填写完整'; return; }
    const r = mode === 'login' ? await Auth.login(username, password, false) : await Auth.register(username, password, '', '', false);
    if (r.error) { document.getElementById('loginError').textContent = r.error; return; }
    hide(); router._onChange();
  }
  function oauthLogin(provider) { window.location.href = '/api/auth/' + provider; }
  return { show, hide, switchTab, submit, oauthLogin };
})();

// ==================== STANDALONE LOGIN PAGE ====================
const loginPage = (() => {
  let mode = 'login';
  let forgotUserId = null;
  let forgotQuestion = '';

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
    document.getElementById('forgotBlock').classList.remove('active');
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotStep3').style.display = 'none';
    document.getElementById('forgotStep1').style.display = '';
  }

  async function submit() {
    const btn = document.querySelector('#view-login .btn-full');
    const origText = btn.textContent;
    clearErrors();
    btn.disabled = true; btn.textContent = '请稍候...';

    try {
      if (mode === 'login') {
        const username = document.getElementById('lpUsername').value.trim();
        const password = document.getElementById('lpPassword').value;
        const remember = document.getElementById('lpRemember').checked;
        if (!username) { document.getElementById('lpUserErr').textContent = '请输入用户名'; btn.disabled = false; btn.textContent = origText; return; }
        if (!password) { document.getElementById('lpPwdErr').textContent = '请输入密码'; btn.disabled = false; btn.textContent = origText; return; }
        const r = await Auth.login(username, password, remember);
        if (r.error) { document.getElementById('lpPwdErr').textContent = r.error; btn.disabled = false; btn.textContent = origText; return; }
      } else {
        const username = document.getElementById('rpUsername').value.trim();
        const password = document.getElementById('rpPassword').value;
        const question = document.getElementById('rpQuestion').value.trim();
        const answer = document.getElementById('rpAnswer').value.trim();
        const remember = document.getElementById('rpRemember').checked;
        if (!username) { document.getElementById('rpUserErr').textContent = '请输入用户名'; btn.disabled = false; btn.textContent = origText; return; }
        if (!password || password.length < 4) { document.getElementById('rpPwdErr').textContent = '密码至少4位'; btn.disabled = false; btn.textContent = origText; return; }
        if (!question || !answer) { document.getElementById('rpAnsErr').textContent = '请设置密保问题和答案（用于找回密码）'; btn.disabled = false; btn.textContent = origText; return; }
        const r = await Auth.register(username, password, question, answer, remember);
        if (r.error) { document.getElementById('rpUserErr').textContent = r.error; btn.disabled = false; btn.textContent = origText; return; }
      }
      router.navigate('home');
    } finally {
      btn.disabled = false; btn.textContent = origText;
    }
  }

  async function showForgot() {
    document.getElementById('loginFormBlock').style.display = 'none';
    document.getElementById('registerFormBlock').style.display = 'none';
    document.getElementById('forgotBlock').classList.add('active');
  }

  function backToLogin() {
    document.getElementById('forgotBlock').classList.remove('active');
    document.getElementById('loginFormBlock').style.display = '';
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotStep3').style.display = 'none';
    document.getElementById('forgotStep1').style.display = '';
  }

  async function forgotSubmit() {
    const username = document.getElementById('fpUsername').value.trim();
    if (!username) { toast('请输入用户名'); return; }
    const data = await API.post('/api/auth/forgot-password', { username });
    if (data.error) { toast(data.error); return; }
    forgotUserId = data.userId;
    forgotQuestion = data.question;
    document.getElementById('fpQuestion').textContent = forgotQuestion;
    document.getElementById('forgotStep1').style.display = 'none';
    document.getElementById('forgotStep2').style.display = '';
  }

  async function resetSubmit() {
    const answer = document.getElementById('fpAnswer').value.trim();
    const newPassword = document.getElementById('fpNewPwd').value;
    if (!answer || !newPassword) { toast('请填写完整'); return; }
    if (newPassword.length < 4) { toast('新密码至少4位'); return; }
    const data = await API.post('/api/auth/reset-password', { userId: forgotUserId, answer, newPassword });
    if (data.error) { toast(data.error); return; }
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotStep3').style.display = '';
  }

  // Handle OAuth callback
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

  return { switchTab, submit, showForgot, backToLogin, forgotSubmit, resetSubmit, handleCallback };
})();
