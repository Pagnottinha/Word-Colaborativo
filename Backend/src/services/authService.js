import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import database from '../database/index.js';
import config from '../config/index.js';

class AuthService {
  async register(username, email, password) {
    const db = database.getDb();
    
    if (!username || !email || !password) {
      throw new Error('Username, email e senha são obrigatórios');
    }

    if (password.length < config.PASSWORD_MIN_LENGTH) {
      throw new Error(`A senha deve ter pelo menos ${config.PASSWORD_MIN_LENGTH} caracteres`);
    }

    const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
    const userId = uuidv4();

    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
        [userId, username, email, passwordHash],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed: users.username')) {
              reject(new Error('Username já está em uso'));
            } else if (err.message.includes('UNIQUE constraint failed: users.email')) {
              reject(new Error('Email já está cadastrado'));
            } else {
              reject(new Error('Erro interno do servidor'));
            }
          } else {
            const token = jwt.sign(
              { id: userId, username, email },
              config.JWT_SECRET,
              { expiresIn: '24h' }
            );

            resolve({
              token,
              user: { id: userId, username, email }
            });
          }
        }
      );
    });
  }

  async login(email, password) {
    const db = database.getDb();

    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE email = ?",
        [email],
        async (err, user) => {
          if (err) {
            reject(new Error('Erro interno do servidor'));
            return;
          }

          if (!user) {
            reject(new Error('Email ou senha incorretos'));
            return;
          }

          const isValidPassword = await bcrypt.compare(password, user.password_hash);
          if (!isValidPassword) {
            reject(new Error('Email ou senha incorretos'));
            return;
          }

          const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            config.JWT_SECRET,
            { expiresIn: '24h' }
          );

          resolve({
            token,
            user: { 
              id: user.id, 
              username: user.username, 
              email: user.email 
            }
          });
        }
      );
    });
  }

  async getUserByEmail(email) {
    const db = database.getDb();

    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, username, email FROM users WHERE email = ?",
        [email],
        (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(user);
          }
        }
      );
    });
  }
}

const authService = new AuthService();
export default authService;
