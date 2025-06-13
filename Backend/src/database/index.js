import sqlite3 from 'sqlite3';
import config from '../config/index.js';

const { verbose } = sqlite3;
const sqlite = verbose();

class Database {
  constructor() {
    this.db = null;
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite.Database(config.DB_PATH, (err) => {
        if (err) {
          console.error('Error connecting to database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.initializeTables().then(resolve).catch(reject);
        }
      });
    });
  }

  initializeTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Tabela de usuários
        this.db.run(`CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabela de documentos
        this.db.run(`CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          is_public BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users (id)
        )`);

        // Tabela para permissões de compartilhamento
        this.db.run(`CREATE TABLE IF NOT EXISTS document_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          permission_type TEXT NOT NULL DEFAULT 'read',
          granted_by TEXT NOT NULL,
          granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES documents (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (granted_by) REFERENCES users (id),
          UNIQUE(document_id, user_id)
        )`);

        // Tabela para operações de documento
        this.db.run(`CREATE TABLE IF NOT EXISTS document_operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id TEXT,
          operation_type TEXT,
          operation_data TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES documents (id)
        )`);

        // Adicionar coluna is_public se não existir (para bancos existentes)
        this.db.run(`ALTER TABLE documents ADD COLUMN is_public BOOLEAN DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding is_public column:', err);
          }
          resolve();
        });
      });
    });
  }

  getDb() {
    return this.db;
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

const database = new Database();
export default database;
