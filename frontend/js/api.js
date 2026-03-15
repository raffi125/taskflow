/**
 * TaskFlow API Client
 * Semua komunikasi ke backend Express dilakukan di sini.
 *
 * Development : http://localhost:3001/api
 * Production  : /api  (same-origin Vercel)
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

// ── Core Fetch Wrapper ────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Attach JWT dari localStorage sebagai fallback (selain httpOnly cookie)
  const token = localStorage.getItem('tf_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res  = await fetch(`${API_BASE}${endpoint}`, {
      credentials: 'include', // kirim httpOnly cookie
      ...options,
      headers
    });
    const data = await res.json();

    // Sesi expired → bersihkan storage dan redirect ke login
    if (res.status === 401 && data.expired) {
      localStorage.removeItem('tf_token');
      localStorage.removeItem('tf_user');
      window.location.href = '/';
      return;
    }

    return { ok: res.ok, status: res.status, data };

  } catch (err) {
    console.error('[API Error]', endpoint, err);
    return {
      ok: false,
      status: 0,
      data: { message: 'Tidak dapat terhubung ke server. Periksa koneksi kamu.' }
    };
  }
}

// ── Auth API ──────────────────────────────────────────────────────────────────
const Auth = {
  async register({ name, username, email, password }) {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password })
    });
  },

  async login({ username, password }) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async logout() {
    return apiFetch('/auth/logout', { method: 'POST' });
  },

  async me() {
    return apiFetch('/auth/me');
  }
};

// ── Tasks API ─────────────────────────────────────────────────────────────────
const Tasks = {
  async getAll({ filter = 'all', sort = 'deadline' } = {}) {
    return apiFetch(`/tasks?filter=${filter}&sort=${sort}`);
  },

  async getNotifications() {
    return apiFetch('/tasks/notifications');
  },

  async create({ name, subject, priority, deadline, notes }) {
    return apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({ name, subject, priority, deadline, notes })
    });
  },

  async update(id, fields) {
    return apiFetch(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields)
    });
  },

  async toggle(id) {
    return apiFetch(`/tasks/${id}/toggle`, { method: 'PATCH' });
  },

  async delete(id) {
    return apiFetch(`/tasks/${id}`, { method: 'DELETE' });
  }
};

// ── Export Global ─────────────────────────────────────────────────────────────
window.API = { Auth, Tasks };