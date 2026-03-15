const jwt = require('jsonwebtoken');

/**
 * Middleware: verifikasi JWT dari Authorization header atau cookie
 */
function authMiddleware(req, res, next) {
  try {
    // Cek dari Authorization Bearer header
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Fallback: cek dari httpOnly cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token tidak ditemukan.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, name, email }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Sesi telah berakhir. Silakan login kembali.',
        expired: true
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid.'
    });
  }
}

module.exports = authMiddleware;
