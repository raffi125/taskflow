const express        = require('express');
const { sql }        = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/tasks ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { filter = 'all', sort = 'deadline' } = req.query;

    // Build query langsung — Neon tidak support nested sql`` fragment
    let tasks;
    const orderBy = sort === 'priority'
      ? `ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, deadline ASC`
      : sort === 'newest' || sort === 'created'
        ? `ORDER BY created_at DESC`
        : `ORDER BY is_done ASC, deadline ASC`;

    const filterMap = {
      all:     `user_id = ${userId}`,
      done:    `user_id = ${userId} AND is_done = true`,
      pending: `user_id = ${userId} AND is_done = false`,
      high:    `user_id = ${userId} AND priority = 'high'   AND is_done = false`,
      medium:  `user_id = ${userId} AND priority = 'medium' AND is_done = false`,
      low:     `user_id = ${userId} AND priority = 'low'    AND is_done = false`,
    };
    const where = filterMap[filter] || filterMap.all;

    // Gunakan query string langsung karena Neon tidak support fragment interpolation
    tasks = await sql(`SELECT * FROM tasks WHERE ${where} ${orderBy}`, []);

    const [stats] = await sql`
      SELECT
        COUNT(*)                                                              AS total,
        COUNT(*) FILTER (WHERE is_done = true)                               AS done,
        COUNT(*) FILTER (WHERE is_done = false)                              AS pending,
        COUNT(*) FILTER (WHERE priority = 'high' AND is_done = false)        AS high_priority,
        COUNT(*) FILTER (WHERE is_done = false AND deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days') AS due_soon,
        COUNT(*) FILTER (WHERE is_done = false AND deadline < CURRENT_DATE)  AS overdue
      FROM tasks WHERE user_id = ${userId}
    `;

    return res.json({ success: true, tasks, stats });
  } catch (err) {
    console.error('[Get Tasks Error]', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data tugas.' });
  }
});

// ── GET /api/tasks/notifications ──────────────────────────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await sql`
      SELECT id, name, subject, priority, deadline,
        CURRENT_DATE - deadline AS days_overdue,
        deadline - CURRENT_DATE AS days_remaining
      FROM tasks
      WHERE user_id = ${req.user.id}
        AND is_done = false
        AND deadline <= CURRENT_DATE + INTERVAL '3 days'
      ORDER BY deadline ASC
    `;

    const result = notifications.map(t => ({
      ...t,
      type: t.days_overdue > 0 ? 'overdue' : t.days_remaining === 0 ? 'today' : 'soon'
    }));

    return res.json({ success: true, notifications: result, count: result.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi.' });
  }
});

// ── POST /api/tasks ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, subject, priority, deadline, notes } = req.body;

    if (!name || !subject || !priority || !deadline)
      return res.status(400).json({ success: false, message: 'Field name, subject, priority, dan deadline wajib diisi.' });
    if (!['low', 'medium', 'high'].includes(priority))
      return res.status(400).json({ success: false, message: 'Priority harus: low, medium, atau high.' });

    const [task] = await sql`
      INSERT INTO tasks (user_id, name, subject, priority, deadline, notes)
      VALUES (${req.user.id}, ${name}, ${subject}, ${priority}, ${deadline}, ${notes || null})
      RETURNING *
    `;

    return res.status(201).json({ success: true, message: 'Tugas berhasil ditambahkan!', task });
  } catch (err) {
    console.error('[Create Task Error]', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat tugas.' });
  }
});

// ── PUT /api/tasks/:id ────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { name, subject, priority, deadline, notes, is_done } = req.body;

    const [existing] = await sql`SELECT id FROM tasks WHERE id = ${taskId} AND user_id = ${req.user.id}`;
    if (!existing)
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });

    if (priority && !['low', 'medium', 'high'].includes(priority))
      return res.status(400).json({ success: false, message: 'Priority tidak valid.' });

    const [updated] = await sql`
      UPDATE tasks SET
        name     = COALESCE(${name     ?? null}, name),
        subject  = COALESCE(${subject  ?? null}, subject),
        priority = COALESCE(${priority ?? null}, priority),
        deadline = COALESCE(${deadline ?? null}, deadline),
        notes    = COALESCE(${notes    ?? null}, notes),
        is_done  = COALESCE(${is_done  ?? null}, is_done)
      WHERE id = ${taskId} AND user_id = ${req.user.id}
      RETURNING *
    `;

    return res.json({ success: true, message: 'Tugas berhasil diperbarui!', task: updated });
  } catch (err) {
    console.error('[Update Task Error]', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui tugas.' });
  }
});

// ── PATCH /api/tasks/:id/toggle ───────────────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const [task] = await sql`
      UPDATE tasks SET is_done = NOT is_done
      WHERE id = ${taskId} AND user_id = ${req.user.id}
      RETURNING *
    `;
    if (!task) return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    return res.json({ success: true, message: task.is_done ? 'Tugas selesai!' : 'Tugas dibatalkan.', task });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengubah status tugas.' });
  }
});

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const [deleted] = await sql`
      DELETE FROM tasks WHERE id = ${taskId} AND user_id = ${req.user.id}
      RETURNING id, name
    `;
    if (!deleted) return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    return res.json({ success: true, message: `Tugas "${deleted.name}" dihapus.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus tugas.' });
  }
});

module.exports = router;
