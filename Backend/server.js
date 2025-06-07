const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Importar configurações e módulos
const config = require('./src/config');
const database = require('./src/database');
const authRoutes = require('./src/routes/auth');
const { setupSocketHandlers } = require('./src/socket');
const documentService = require('./src/services/documentService');

// Criar aplicação Express
const app = express();
const server = http.createServer(app);

// Configurar Socket.IO
const io = socketIo(server, config.SOCKET_IO_OPTIONS);

// Middleware
app.use(cors());
app.use(express.json());

// Rotas
app.use('/api/auth', authRoutes);

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Word Colaborativo API está funcionando',
    timestamp: new Date().toISOString()
  });
});

// Rota para verificar documento salvo no banco
app.get('/api/documents/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const db = database.getDb();
    
    db.get('SELECT content, updated_at FROM documents WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Erro ao buscar documento:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
        return;
      }
      
      if (!row) {
        res.status(404).json({ error: 'Documento não encontrado' });
        return;
      }
      
      console.log(`📖 Documento ${id} - Conteúdo no banco: ${row.content?.length || 0} caracteres, atualizado em: ${row.updated_at}`);
      
      res.json({
        documentId: id,
        content: row.content,
        contentLength: row.content?.length || 0,
        updatedAt: row.updated_at,
        memoryContent: documentService.getDocumentFromMemory(id),
        memoryLength: documentService.getDocumentFromMemory(id)?.length || 0
      });
    });
  } catch (error) {
    console.error('Erro ao verificar documento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Configurar Socket.IO
io.on('connection', (socket) => {
  setupSocketHandlers(socket, io);
});

// Inicializar servidor
const startServer = async () => {
  try {
    // Conectar ao banco de dados
    await database.connect();
    console.log('✅ Database connected and initialized');

    // Iniciar servidor
    const PORT = config.PORT;
    server.listen(PORT,'0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🌐 Frontend should connect to: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Gerenciar encerramento graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  
  try {
    await database.close();
    console.log('✅ Database connection closed');
    
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Iniciar servidor
startServer();