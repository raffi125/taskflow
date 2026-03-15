const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 hari
};

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    // Validasi input
    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Username hanya boleh huruf, angka, dan underscore.' });
    }

    // Cek duplikat
    const existing = await sql`
      SELECT id FROM users
      WHERE username = ${username.toLowerCase()} OR email = ${email.toLowerCase()}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username atau email sudah terdaftar.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Simpan user
    const [user] = await sql`
      INSERT INTO users (name, username, email, password)
      VALUES (${name}, ${username.toLowerCase()}, ${email.toLowerCase()}, ${hashedPassword})
      RETURNING id, name, username, email, created_at
    `;

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);
    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil!',
      token,
      user: { id: user.id, name: user.name, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    }

    // Cari user (bisa login dengan username atau email)
    const [user] = await sql`
      SELECT id, name, username, email, password
      FROM users
      WHERE username = ${username.toLowerCase()} OR email = ${username.toLowerCase()}
      LIMIT 1
    `;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);
    return res.json({
      success: true,
      message: 'Login berhasil!',
      token,
      user: { id: user.id, name: user.name, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  return res.json({ success: true, message: 'Logout berhasil.' });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [user] = await sql`
      SELECT id, name, username, email, created_at
      FROM users WHERE id = ${req.user.id}
    `;
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
