/**
 * TaskFlow App — Main Controller
 */

const State = {
  user: null, tasks: [], stats: {}, notifications: [],
  filter: 'all', sort: 'deadline', editingId: null
};

const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Page ───────────────────────────────────────────────────────────────────────
function showPage(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  const el = $('page-' + page);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

// ── Auth Tab ───────────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  $('tab-login').classList.toggle('act', isLogin);
  $('tab-register').classList.toggle('act', !isLogin);
  $('form-login').style.display    = isLogin ? 'block' : 'none';
  $('form-register').style.display = isLogin ? 'none'  : 'block';
  // Bersihkan pesan error
  ['login-err','reg-err','reg-ok'].forEach(id => {
    const el = $(id); if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
}

// ── Password Toggle ────────────────────────────────────────────────────────────
function togglePw(inputId, btn) {
  const inp = $(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'text' ? '🙈' : '👁';
}

// ── Message Boxes ──────────────────────────────────────────────────────────────
function showMsg(id, text) {
  const el = $(id); if (!el) return;
  el.textContent = text; el.style.display = 'block';
}
function hideMsg(id) {
  const el = $(id); if (el) el.style.display = 'none';
}

// ── Password Strength ──────────────────────────────────────────────────────────
function checkStrength(pw) {
  const reqs = $('pw-reqs'); if (reqs) reqs.style.display = pw.length > 0 ? 'block' : 'none';
  const checks = [pw.length >= 6, /\d/.test(pw), /[A-Z]/.test(pw)];
  ['req-len','req-num','req-upper'].forEach((id, i) => {
    const el = $(id); if (el) el.classList.toggle('ok', checks[i]);
  });
  const bar = $('strength-bar'); if (!bar) return;
  const score = checks.filter(Boolean).length;
  bar.style.width      = ['0%','33%','66%','100%'][score];
  bar.style.background = ['','var(--danger)','var(--warn)','var(--green-m)'][score];
}

// ── Init ───────────────────────────────────────────────────────────────────────
async function initApp() {
  const token   = localStorage.getItem('tf_token');
  const userStr = localStorage.getItem('tf_user');
  if (token && userStr) {
    try {
      State.user = JSON.parse(userStr);
      showPage('app');
      $('nav-username').textContent = State.user.name;
      await loadAll();
    } catch {
      localStorage.clear();
      showPage('login');
    }
  } else {
    showPage('login');
  }
}

// ── Login ──────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn      = $('btn-login');
  const username = $('login-username').value.trim();
  const password = $('login-password').value;
  hideMsg('login-err');

  if (!username || !password) return showMsg('login-err', 'Username dan password wajib diisi.');

  setLoading(btn, true, 'Masuk...');
  const { ok, data } = await API.Auth.login({ username, password });
  setLoading(btn, false, 'Masuk');

  if (!ok) return showMsg('login-err', data.message);

  localStorage.setItem('tf_token', data.token);
  localStorage.setItem('tf_user', JSON.stringify(data.user));
  State.user = data.user;
  $('nav-username').textContent = data.user.name;
  showPage('app');
  showToast('Selamat datang, ' + data.user.name + '! 👋', 'success');
  await loadAll();
}

// ── Register ───────────────────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const btn      = $('btn-register');
  const name     = $('reg-name').value.trim();
  const username = $('reg-username').value.trim();
  const email    = $('reg-email').value.trim();
  const password = $('reg-password').value;
  const confirm  = $('reg-confirm').value;
  hideMsg('reg-err'); hideMsg('reg-ok');

  if (!name || !username || !email || !password) return showMsg('reg-err', 'Semua field wajib diisi.');
  if (!/^[a-zA-Z0-9_]+$/.test(username))          return showMsg('reg-err', 'Username hanya huruf, angka, underscore.');
  if (password.length < 6)                         return showMsg('reg-err', 'Password minimal 6 karakter.');
  if (password !== confirm)                        return showMsg('reg-err', 'Konfirmasi password tidak cocok.');

  setLoading(btn, true, 'Mendaftar...');
  const { ok, data } = await API.Auth.register({ name, username, email, password });
  setLoading(btn, false, 'Buat Akun');

  if (!ok) return showMsg('reg-err', data.message);

  localStorage.setItem('tf_token', data.token);
  localStorage.setItem('tf_user', JSON.stringify(data.user));
  State.user = data.user;
  $('nav-username').textContent = data.user.name;
  showPage('app');
  showToast('Akun berhasil dibuat! Selamat datang, ' + data.user.name + ' 🎉', 'success');
  await loadAll();
}

// ── Logout ─────────────────────────────────────────────────────────────────────
async function handleLogout() {
  await API.Auth.logout();
  localStorage.removeItem('tf_token');
  localStorage.removeItem('tf_user');
  State.user = null; State.tasks = [];
  showPage('login');
  showToast('Sampai jumpa!', 'success');
}

// ── Data ───────────────────────────────────────────────────────────────────────
async function loadAll() { await Promise.all([loadTasks(), loadNotifications()]); }

async function loadTasks() {
  const { ok, data } = await API.Tasks.getAll({ filter: State.filter, sort: State.sort });
  if (!ok) return showToast(data?.message || 'Gagal memuat tugas.', 'error');
  State.tasks = data.tasks; State.stats = data.stats;
  renderStats(); renderTasks();
}

async function loadNotifications() {
  const { ok, data } = await API.Tasks.getNotifications();
  if (!ok) return;
  State.notifications = data.notifications;
  renderNotifBadge(); renderNotifPanel();
}

// ── Task CRUD ──────────────────────────────────────────────────────────────────
async function handleAddTask(e) {
  e.preventDefault();
  const btn      = $('btn-add-task');
  const name     = $('task-name').value.trim();
  const subject  = $('task-subject').value.trim();
  const priority = $('task-priority').value;
  const deadline = $('task-deadline').value;
  const notes    = $('task-notes').value.trim();

  if (!name || !subject || !deadline)
    return showToast('Nama, mata kuliah, dan deadline wajib diisi!', 'error');

  setLoading(btn, true, 'Menyimpan...');
  const result = State.editingId
    ? await API.Tasks.update(State.editingId, { name, subject, priority, deadline, notes })
    : await API.Tasks.create({ name, subject, priority, deadline, notes });
  setLoading(btn, false, State.editingId ? 'Simpan Perubahan' : '+ Tambah Tugas');

  if (!result.ok) return showToast(result.data.message, 'error');
  showToast(result.data.message, 'success');
  resetForm(); await loadAll();
}

function editTask(id) {
  const task = State.tasks.find(t => t.id === id); if (!task) return;
  State.editingId = id;
  $('task-name').value     = task.name;
  $('task-subject').value  = task.subject;
  $('task-priority').value = task.priority;
  $('task-deadline').value = (task.deadline || '').split('T')[0];
  $('task-notes').value    = task.notes || '';
  $('btn-add-task').textContent      = 'Simpan Perubahan';
  $('btn-cancel-edit').style.display = 'inline-block';
  $('form-title').textContent        = 'Edit Tugas';
  $('task-name').focus();
  $('add-form').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
  State.editingId = null;
  $('task-form').reset();
  const t = new Date(); t.setDate(t.getDate() + 1);
  $('task-deadline').value           = t.toISOString().split('T')[0];
  $('btn-add-task').textContent      = '+ Tambah Tugas';
  $('btn-cancel-edit').style.display = 'none';
  $('form-title').textContent        = 'Tambah Tugas Baru';
}

async function toggleTask(id) {
  const { ok, data } = await API.Tasks.toggle(id);
  if (!ok) return showToast(data.message, 'error');
  showToast(data.message, 'success'); await loadAll();
}

async function deleteTask(id) {
  const task = State.tasks.find(t => t.id === id);
  if (!confirm('Hapus tugas "' + (task?.name || '') + '"?')) return;
  const { ok, data } = await API.Tasks.delete(id);
  if (!ok) return showToast(data.message, 'error');
  showToast(data.message, 'success'); await loadAll();
}

// ── Render ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const s = State.stats;
  $('stat-total').textContent   = s.total        || 0;
  $('stat-pending').textContent = s.pending       || 0;
  $('stat-done').textContent    = s.done          || 0;
  $('stat-high').textContent    = s.high_priority || 0;
  $('stat-overdue').textContent = s.overdue       || 0;
  $('stat-soon').textContent    = s.due_soon      || 0;
}

function renderTasks() {
  const list = $('task-list');
  if (!State.tasks.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Tidak ada tugas ditemukan</div><div class="empty-sub">Tambahkan tugas baru di form kiri</div></div>';
    return;
  }
  const priLabel = { high:'Tinggi', medium:'Sedang', low:'Rendah' };
  list.innerHTML = State.tasks.map(task => {
    const dl    = new Date(task.deadline);
    const today = new Date(); today.setHours(0,0,0,0);
    const diff  = Math.floor((dl - today) / 86400000);
    const fmt   = dl.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
    let dateClass = 'date-normal', dateText = fmt;
    if (!task.is_done) {
      if (diff < 0)        { dateClass = 'date-overdue'; dateText = fmt + ' (Terlambat ' + Math.abs(diff) + 'h)'; }
      else if (diff === 0) { dateClass = 'date-overdue'; dateText = 'Hari ini!'; }
      else if (diff <= 3)  { dateClass = 'date-soon';    dateText = fmt + ' (' + diff + 'h lagi)'; }
    }
    return '<div class="task-card ' + (task.is_done ? 'done' : '') + '" data-id="' + task.id + '">' +
      '<div class="pbar pbar-' + task.priority + '"></div>' +
      '<button class="task-check ' + (task.is_done ? 'checked' : '') + '" onclick="toggleTask(' + task.id + ')" title="' + (task.is_done ? 'Tandai belum selesai' : 'Tandai selesai') + '"></button>' +
      '<div class="task-body">' +
        '<div class="task-name">' + escHtml(task.name) + '</div>' +
        '<div class="task-meta">' +
          '<span class="tag tag-subject">' + escHtml(task.subject) + '</span>' +
          '<span class="tag tag-pri tag-pri-' + task.priority + '">' + priLabel[task.priority] + '</span>' +
          '<span class="tag ' + dateClass + '">📅 ' + dateText + '</span>' +
          (task.notes ? '<span class="tag tag-notes" title="' + escHtml(task.notes) + '">📝 Ada catatan</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="task-actions">' +
        '<button class="btn-icon btn-edit" onclick="editTask(' + task.id + ')" title="Edit">✏️</button>' +
        '<button class="btn-icon btn-del" onclick="deleteTask(' + task.id + ')" title="Hapus">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderNotifBadge() {
  const badge = $('notif-badge');
  const count = State.notifications.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function renderNotifPanel() {
  const panel = $('notif-list');
  if (!State.notifications.length) {
    panel.innerHTML = '<div class="notif-empty">Semua tugas aman 🎉</div>'; return;
  }
  panel.innerHTML = State.notifications.map(function(n) {
    const label = n.type === 'overdue' ? 'Terlambat ' + n.days_overdue + ' hari'
                : n.type === 'today'   ? 'Deadline hari ini!'
                : n.days_remaining + ' hari lagi';
    return '<div class="notif-item notif-' + n.type + '">' +
      '<div class="notif-name">' + escHtml(n.name) + '</div>' +
      '<div class="notif-sub">' + escHtml(n.subject) + ' · <strong>' + label + '</strong></div>' +
    '</div>';
  }).join('');
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function toggleNotif() { $('notif-panel').classList.toggle('open'); }

function showToast(msg, type) {
  type = type || 'info';
  const wrap  = $('toast-wrap');
  const toast = document.createElement('div');
  toast.className   = 'toast toast-' + type;
  toast.textContent = msg;
  wrap.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3500);
}

function setLoading(btn, loading, text) {
  btn.disabled    = loading;
  btn.textContent = loading ? text : (btn.dataset.label || text);
  if (!loading) btn.dataset.label = btn.textContent;
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// ── BOOT ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

  // ── Auth tab buttons ───────────────────────────────────────────────────────
  $('tab-login').onclick    = function() { switchAuthTab('login'); };
  $('tab-register').onclick = function() { switchAuthTab('register'); };

  // ── Link "Daftar sekarang" & "Masuk di sini" ───────────────────────────────
  $('link-to-register').onclick = function() { switchAuthTab('register'); };
  $('link-to-login').onclick    = function() { switchAuthTab('login'); };

  // ── Password toggle ────────────────────────────────────────────────────────
  $('toggle-login-pw').onclick    = function() { togglePw('login-password', this); };
  $('toggle-reg-pw').onclick      = function() { togglePw('reg-password',   this); };
  $('toggle-reg-confirm').onclick = function() { togglePw('reg-confirm',    this); };

  // ── Password strength ──────────────────────────────────────────────────────
  $('reg-password').oninput = function() { checkStrength(this.value); };
  $('reg-username').oninput = function() {
    this.style.borderColor = /^[a-zA-Z0-9_]*$/.test(this.value) ? '' : 'var(--danger)';
  };

  // ── Form submit ────────────────────────────────────────────────────────────
  $('login-form').onsubmit    = handleLogin;
  $('register-form').onsubmit = handleRegister;
  $('task-form').onsubmit     = handleAddTask;

  // ── Buttons ────────────────────────────────────────────────────────────────
  $('btn-cancel-edit').onclick = resetForm;
  $('btn-logout').onclick      = handleLogout;

  // ── Notif bell ─────────────────────────────────────────────────────────────
  $('btn-notif').onclick = function(e) { e.stopPropagation(); toggleNotif(); };
  document.addEventListener('click', function(e) {
    if (!$('notif-wrapper').contains(e.target)) $('notif-panel').classList.remove('open');
  });

  // ── Filter bar ─────────────────────────────────────────────────────────────
  $('filter-bar').onclick = function(e) {
    var btn = e.target.closest('.filter-btn');
    if (!btn) return;
    $$('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    State.filter = btn.dataset.filter;
    loadTasks();
  };

  // ── Sort ───────────────────────────────────────────────────────────────────
  $('sort-select').onchange = function() { State.sort = this.value; loadTasks(); };

  // ── Default deadline besok ─────────────────────────────────────────────────
  var t = new Date(); t.setDate(t.getDate() + 1);
  $('task-deadline').value = t.toISOString().split('T')[0];

  // ── Auto-refresh notif ─────────────────────────────────────────────────────
  setInterval(function() { if (State.user) loadNotifications(); }, 60000);

  // ── Start app ──────────────────────────────────────────────────────────────
  initApp();
});
