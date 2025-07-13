const jwt = require('jsonwebtoken');
const database = require('../config/database');
const { logError } = require('../utils/errorHandler');

// Fungsi buat ngecek token, jangan coba-coba masuk tanpa token ya!
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Ambil TOKEN dari Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Woy, token-nya mana? Gak boleh masuk tanpa token!'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token-nya salah atau udah expired, jangan bohong ya!'
      });
    }

    req.user = user; // Simpen data user di request biar gampang diakses
    next(); // Lanjut ke proses berikutnya
  });
};

// Fungsi buat ngecek API key
const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key tidak ditemukan!'
    });
  }

  try {
    const db = database.getDb();
    
    // Cari user berdasarkan API key
    const [rows] = await db.query('SELECT * FROM users WHERE api_key = ?', [apiKey]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'API key tidak valid!'
      });
    }

    // Simpan data user di request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    await logError('error', error.message, 'middleware/auth.js', error.stack, null);
    return res.status(500).json({
      success: false,
      message: 'Server error saat autentikasi',
      error: error.message
    });
  }
};

// Fungsi buat bikin token baru, biar user bisa masuk-masuk terus
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email,
      role: user.role || 'user' // Tambahkan role ke token
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } // Expired 7 hari, jangan lupa login lagi ya!
  );
};

module.exports = {
  authenticateToken,
  authenticateApiKey,
  generateToken
}; // Export biar bisa dipake di file lain