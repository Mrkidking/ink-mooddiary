// API request wrapper — automatically attaches JWT token
const API = {
  token: localStorage.getItem('ink_token') || '',

  setToken(t) { this.token = t; localStorage.setItem('ink_token', t); },
  clearToken() { this.token = ''; localStorage.removeItem('ink_token'); },

  headers(isJson = true) {
    const h = {};
    if (isJson) h['Content-Type'] = 'application/json';
    if (this.token) h['Authorization'] = 'Bearer ' + this.token;
    return h;
  },

  async get(path) {
    const r = await fetch(path, { headers: this.headers() });
    return r.json();
  },

  async post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    return r.json();
  },

  async put(path, body) {
    const r = await fetch(path, { method: 'PUT', headers: this.headers(), body: JSON.stringify(body) });
    return r.json();
  },

  async del(path) {
    const r = await fetch(path, { method: 'DELETE', headers: this.headers() });
    return r.json();
  },

  async upload(path, formData) {
    const h = {};
    if (this.token) h['Authorization'] = 'Bearer ' + this.token;
    const r = await fetch(path, { method: 'POST', headers: h, body: formData });
    return r.json();
  }
};
