/**
 * Utility untuk menangani error dan logging
 */

/**
 * Log error ke console dan database jika diperlukan
 * @param {string|object} level - Level error (error, warn, info) atau objek error
 * @param {string} message - Pesan error
 * @param {string} source - Sumber error (file/function)
 * @param {string} stack - Stack trace error
 * @param {object} data - Data tambahan terkait error
 */
const logError = async (level = 'error', message, source, stack, data = null) => {
  // Handle jika parameter pertama adalah objek error
  if (typeof level === 'object' && level !== null) {
    const errorObj = level;
    source = message || 'unknown';
    message = errorObj.message || 'Unknown error';
    stack = errorObj.stack;
    level = 'error';
  }
  
  // Log ke console
  console.error(`[${level.toUpperCase()}] ${message} (${source})`);
  if (stack) console.error(stack);
  
  // Di sini bisa ditambahkan logging ke database atau service eksternal
  // jika diperlukan di masa depan
  
  return true;
};

/**
 * Middleware untuk menangani error global
 */
const errorMiddleware = (err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
};

module.exports = {
  logError,
  errorMiddleware
};