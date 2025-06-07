// Configurações da aplicação
const config = {
  // Server
  PORT: process.env.PORT || 3001,
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  
  // Database
  DB_PATH: process.env.DB_PATH || './documents.db',
  
  // Security
  BCRYPT_ROUNDS: 10,
  PASSWORD_MIN_LENGTH: 6,

  // WebSocket
  SOCKET_IO_OPTIONS: {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"]
    }
  }
};

module.exports = config;
