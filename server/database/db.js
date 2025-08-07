import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取数据库路径的函数
const getDbPath = () => {
  if (process.env.ELECTRON_APP === 'true') {
    try {
      // 在Electron环境中，尝试使用进程参数传递的用户数据路径
      const userDataPath = process.env.ELECTRON_USER_DATA || path.join(process.cwd(), 'userData');
      
      // 确保目录存在
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      return path.join(userDataPath, 'auth.db');
    } catch (error) {
      console.warn('Failed to get user data path, using current directory:', error.message);
      return path.join(__dirname, 'auth.db');
    }
  }
  // 开发环境或非Electron环境
  return path.join(__dirname, 'auth.db');
};

const DB_PATH = getDbPath();
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

console.log('Database path:', DB_PATH);

// 确保数据库目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
let db;
try {
  db = new Database(DB_PATH);
  console.log('Connected to SQLite database at:', DB_PATH);
} catch (error) {
  console.error('Failed to connect to database:', error.message);
  console.error('Database path:', DB_PATH);
  throw error;
}

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    // 检查SQL文件是否存在
    if (!fs.existsSync(INIT_SQL_PATH)) {
      console.warn('Init SQL file not found at:', INIT_SQL_PATH);
      
      // 如果SQL文件不存在，手动创建表结构
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_active BOOLEAN DEFAULT 1
        );
      `;
      
      db.exec(createTableSQL);
      console.log('Database schema created manually');
    } else {
      const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
      db.exec(initSQL);
      console.log('Database initialized from SQL file');
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new user
  createUser: (username, passwordHash) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  }
};

export {
  db,
  initializeDatabase,
  userDb
};