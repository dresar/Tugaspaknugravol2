const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'todolist'
    };
    this.pool = null;
    this.instance = null;
  }

  // Bikin instance database, pake Singleton pattern biar gak bikin banyak koneksi
  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  // Konek ke database
  async connect() {
    try {
      // Buat koneksi pool untuk mengelola koneksi database
      this.pool = mysql.createPool(this.config);
      
      // Test koneksi
      const connection = await this.pool.getConnection();
      console.log('Hore! Berhasil konek ke database MySQL!');
      connection.release();
      return true;
    } catch (err) {
      console.error('Waduh, gagal konek ke database:', err.message);
      throw err;
    }
  }

  // Verifikasi tabel ada di database
  async verifyTable(tableName) {
    if (!this.pool) {
      await this.connect();
    }

    try {
      const [rows] = await this.pool.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [this.config.database, tableName]
      );
      return rows.length > 0;
    } catch (err) {
      console.error(`Error memeriksa tabel ${tableName}:`, err.message);
      throw err;
    }
  }

  // Bikin tabel error_logs
  async createErrorLogsTable() {
    if (!this.pool) {
      await this.connect();
    }

    const tableExists = await this.verifyTable('error_logs');
    if (tableExists) {
      console.log('Tabel error_logs sudah ada');
      return true;
    }

    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS error_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          level ENUM('error', 'warning', 'info') DEFAULT 'error',
          message TEXT NOT NULL,
          source VARCHAR(255),
          stack TEXT,
          user_id INT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('Tabel error_logs berhasil dibuat');
      return true;
    } catch (err) {
      console.error('Duh, gagal bikin tabel error_logs:', err.message);
      throw err;
    }
  }

  // Bikin tabel-tabel yang dibutuhin
  async init() {
    if (!this.pool) {
      await this.connect();
    }

    try {
      // Bikin database jika belum ada
      await this.pool.query(`CREATE DATABASE IF NOT EXISTS ${this.config.database}`);
      
      // Gunakan database
      await this.pool.query(`USE ${this.config.database}`);
      
      // Bikin tabel users dengan kolom role untuk membedakan admin dan user biasa
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          api_key VARCHAR(100),
          role ENUM('user', 'admin') DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Bikin tabel categories
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(50) NOT NULL,
          color VARCHAR(20) DEFAULT '#3498db',
          user_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(name, user_id)
        )
      `);

      // Bikin tabel tasks
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(100) NOT NULL,
          description TEXT,
          status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
          priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
          due_date DATE,
          category_id INT,
          user_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      // Bikin tabel settings untuk menyimpan pengaturan API
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id INT PRIMARY KEY CHECK (id = 1),
          apiRateLimit INT DEFAULT 60,
          apiTokenExpiry INT DEFAULT 24,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      
      // Bikin tabel error_logs untuk menyimpan log error
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS error_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          level ENUM('error', 'warning', 'info') DEFAULT 'error',
          message TEXT NOT NULL,
          source VARCHAR(255),
          stack TEXT,
          user_id INT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      
      // Cek apakah sudah ada data di tabel settings, jika belum tambahkan default
      const [settingsRows] = await this.pool.query('SELECT * FROM settings WHERE id = 1');
      if (settingsRows.length === 0) {
        await this.pool.query(
          'INSERT INTO settings (id, apiRateLimit, apiTokenExpiry) VALUES (1, 60, 24)'
        );
        console.log('Data default settings berhasil ditambahkan');
      }
      
      // Verifikasi semua tabel yang diperlukan
      const missingTables = await this.verifyRequiredTables();
      if (missingTables.length > 0) {
        console.warn('Peringatan: Beberapa tabel tidak ditemukan:', missingTables.join(', '));
        // Coba perbaiki tabel yang hilang
        const fixed = await this.fixDatabase();
        if (fixed) {
          console.log('Database berhasil diperbaiki');
        } else {
          console.warn('Gagal memperbaiki database sepenuhnya');
        }
      } else {
        console.log('Yeay! Semua tabel berhasil dibuat!');
      }
      
      return true;
    } catch (err) {
      console.error('Error saat inisialisasi database:', err.message);
      throw err;
    }
  }

  // Verifikasi semua tabel yang diperlukan
  async verifyRequiredTables() {
    const requiredTables = ['users', 'categories', 'tasks', 'settings', 'error_logs'];
    const missingTables = [];

    for (const table of requiredTables) {
      const exists = await this.verifyTable(table);
      if (!exists) {
        missingTables.push(table);
      }
    }

    return missingTables;
  }

  // Perbaiki database jika ada tabel yang hilang
  async fixDatabase() {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const missingTables = await this.verifyRequiredTables();
      
      if (missingTables.length === 0) {
        console.log('Semua tabel sudah ada, tidak perlu perbaikan');
        return true;
      }

      console.log('Tabel yang perlu dibuat:', missingTables.join(', '));

      // Buat tabel yang hilang
      if (missingTables.includes('error_logs')) {
        await this.createErrorLogsTable();
      }

      // Verifikasi lagi setelah perbaikan
      const remainingMissing = await this.verifyRequiredTables();
      if (remainingMissing.length > 0) {
        console.warn('Masih ada tabel yang belum dibuat:', remainingMissing.join(', '));
        return false;
      }

      console.log('Database berhasil diperbaiki!');
      return true;
    } catch (error) {
      console.error('Error saat memperbaiki database:', error);
      return false;
    }
  }

  // Ambil koneksi database
  getDb() {
    if (!this.pool) {
      throw new Error('Waduh, database belum diinisialisasi! Panggil init() dulu dong!');
    }
    return this.pool;
  }

  // Tutup koneksi database
  async close() {
    try {
      if (this.pool) {
        await this.pool.end();
        console.log('Koneksi database udah ditutup, dadah~');
        this.pool = null;
      }
      return true;
    } catch (err) {
      console.error('Waduh, gagal nutup koneksi database:', err.message);
      throw err;
    }
  }

  // Fungsi untuk mencatat error ke dalam database
  async logError(level, message, source, stack, userId) {
    try {
      if (!this.pool) {
        console.error('Database belum diinisialisasi untuk mencatat error');
        throw new Error('Database belum diinisialisasi');
      }

      // Validasi level error
      const validLevels = ['error', 'warning', 'info'];
      if (!validLevels.includes(level)) {
        level = 'error'; // Default ke error jika level tidak valid
      }

      const [result] = await this.pool.query(
        `INSERT INTO error_logs (level, message, source, stack, user_id, timestamp) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [level, message, source, stack, userId]
      );
      
      return {
        id: result.insertId,
        level,
        message,
        source,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('Gagal mencatat error ke database:', err.message);
      throw err;
    }
  }
}

// Export instance dari Database, bukan class-nya
module.exports = Database.getInstance();