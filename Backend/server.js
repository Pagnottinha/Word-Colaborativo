const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar banco de dados
const db = new sqlite3.Database('./documents.db');

// Criar tabelas se não existirem
db.serialize(() => {
  // Tabela de usuários
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS documents (
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
  db.run(`CREATE TABLE IF NOT EXISTS document_permissions (
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

  // Adicionar coluna is_public se não existir (para bancos existentes)
  db.run(`ALTER TABLE documents ADD COLUMN is_public BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding is_public column:', err);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS document_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT,
    operation_type TEXT,
    operation_data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents (id)
  )`);
});

// Store de documentos em memória para operações em tempo real
const documentsStore = new Map();
// Store para rastrear usuários por documento
const documentUsers = new Map();
// Store para rastrear usuários conectados por userId
const connectedUsers = new Map();

// Funções auxiliares para notificações em tempo real
const broadcastDocumentListUpdate = (userId) => {
  const userSocket = connectedUsers.get(userId);
  if (userSocket) {
    // Buscar documentos próprios
    db.all(
      "SELECT id, title, is_public, created_at, updated_at, 'own' as type FROM documents WHERE owner_id = ? ORDER BY updated_at DESC",
      [userId],
      (err, ownDocuments) => {
        if (err) {
          console.error('Error fetching own documents for broadcast:', err);
          return;
        }
        // Buscar documentos compartilhados
        db.all(
          `SELECT d.id, d.title, d.is_public, d.created_at, d.updated_at, u.username as owner_username, dp.permission_type, dp.granted_at, 'shared' as type 
           FROM documents d 
           JOIN users u ON d.owner_id = u.id 
           JOIN document_permissions dp ON d.id = dp.document_id 
           WHERE dp.user_id = ? 
           ORDER BY d.updated_at DESC`,
          [userId],
          (err, sharedDocuments) => {
            if (err) {
              console.error('Error fetching shared documents for broadcast:', err);
              sharedDocuments = [];
            }

            // Buscar documentos públicos de outros usuários (excluindo os já compartilhados)
            const sharedDocIds = sharedDocuments.map(doc => doc.id);
            const excludeSharedQuery = sharedDocIds.length > 0 ?
              `AND d.id NOT IN (${sharedDocIds.map(() => '?').join(',')})` : '';

            db.all(
              `SELECT d.id, d.title, d.is_public, d.created_at, d.updated_at, u.username as owner_username, 'public' as type 
               FROM documents d 
               JOIN users u ON d.owner_id = u.id 
               WHERE d.is_public = 1 AND d.owner_id != ? ${excludeSharedQuery}
               ORDER BY d.updated_at DESC`,
              [userId, ...sharedDocIds],
              (err, publicDocuments) => {
                if (!err) {
                  console.log(`Broadcasting document list update to user ${userId}: ${ownDocuments.length} own, ${sharedDocuments.length} shared, ${publicDocuments.length} public`);
                  userSocket.emit('documents-list', {
                    ownDocuments: ownDocuments,
                    sharedDocuments: sharedDocuments,
                    publicDocuments: publicDocuments
                  });
                }
              }
            );
          }
        );
      }
    );
  }
};

// Função para fazer broadcast da lista de documentos para todos os usuários conectados
const broadcastDocumentListUpdateToAll = () => {
  console.log('Broadcasting document list update to all connected users');
  connectedUsers.forEach((socket, userId) => {
    broadcastDocumentListUpdate(userId);
  });
};

const broadcastDocumentUpdate = (documentId, userId) => {
  const userSocket = connectedUsers.get(userId);
  if (userSocket) {
    // Buscar documento atualizado
    db.get(
      "SELECT * FROM documents WHERE id = ? AND owner_id = ?",
      [documentId, userId],
      (err, row) => {
        if (!err && row) {
          console.log(`Broadcasting document update to user ${userId}: ${documentId}`);
          userSocket.emit('document-updated', { document: row });
        }
      }
    );
  }
};

// Função auxiliar para verificar token WebSocket
const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Rotas de Autenticação
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email e senha são obrigatórios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();

    db.run(
      "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
      [userId, username, email, passwordHash],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username ou email já existe' });
          }
          return res.status(500).json({ error: err.message });
        }

        const token = jwt.sign({ userId, username, email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
          message: 'Usuário criado com sucesso',
          token,
          user: { id: userId, username, email }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      try {
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
          { userId: user.id, username: user.username, email: user.email },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          message: 'Login realizado com sucesso',
          token,
          user: { id: user.id, username: user.username, email: user.email }
        });
      } catch (error) {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  );
});

// Socket.IO para colaboração em tempo real
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  // Middleware de autenticação para Socket.IO
  socket.on('authenticate', (data) => {
    const { token } = data;
    const user = verifySocketToken(token);

    if (!user) {
      socket.emit('auth-error', { error: 'Token inválido' });
      socket.disconnect();
      return;
    }

    socket.userId = user.userId;
    socket.username = user.username;

    // Registrar usuário no mapa de conectados
    connectedUsers.set(user.userId, socket);

    console.log(`User authenticated: ${user.username} (${socket.id})`);
    socket.emit('authenticated', { user: { id: user.userId, username: user.username, email: user.email } });

    // Enviar lista inicial de documentos
    broadcastDocumentListUpdate(user.userId);
  });

  // Listar documentos via WebSocket (requer autenticação)  
  socket.on('get-documents', () => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    console.log('Received get-documents request from:', socket.id);      // Buscar documentos próprios (privados e públicos)
    db.all(
      "SELECT id, title, is_public, created_at, updated_at, owner_id, 'own' as type FROM documents WHERE owner_id = ? ORDER BY updated_at DESC",
      [socket.userId],
      (err, ownDocuments) => {
        if (err) {
          console.error('Error fetching own documents:', err);
          socket.emit('documents-error', { error: err.message });
          return;
        }

        // Buscar documentos compartilhados
        db.all(
          `SELECT d.id, d.title, d.is_public, d.created_at, d.updated_at, d.owner_id, u.username as owner_username, dp.permission_type, dp.granted_at, 'shared' as type 
           FROM documents d 
           JOIN users u ON d.owner_id = u.id 
           JOIN document_permissions dp ON d.id = dp.document_id 
           WHERE dp.user_id = ? 
           ORDER BY d.updated_at DESC`,
          [socket.userId], (err, sharedDocuments) => {
            if (err) {
              console.error('Error fetching shared documents:', err);
              sharedDocuments = [];
            }

            // Buscar documentos públicos de outros usuários (excluindo os já compartilhados)
            const sharedDocIds = sharedDocuments.map(doc => doc.id);
            const excludeSharedQuery = sharedDocIds.length > 0 ?
              `AND d.id NOT IN (${sharedDocIds.map(() => '?').join(',')})` : '';

            db.all(
              `SELECT d.id, d.title, d.is_public, d.created_at, d.updated_at, d.owner_id, u.username as owner_username, 'public' as type
               FROM documents d 
               JOIN users u ON d.owner_id = u.id 
               WHERE d.is_public = 1 AND d.owner_id != ? ${excludeSharedQuery}
               ORDER BY d.updated_at DESC`,
              [socket.userId, ...sharedDocIds],
              (err, publicDocuments) => {
                if (err) {
                  console.error('Error fetching public documents:', err);
                  publicDocuments = [];
                }

                console.log(`Sending documents to client: ${ownDocuments.length} own, ${sharedDocuments.length} shared, ${publicDocuments.length} public`);
                socket.emit('documents-list', {
                  ownDocuments: ownDocuments,
                  sharedDocuments: sharedDocuments,
                  publicDocuments: publicDocuments
                });
              }
            );
          }
        );
      });
  });

  // Criar documento via WebSocket (requer autenticação)
  socket.on('create-document', (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { title, content = '', isPublic = false } = data;
    const id = uuidv4();

    db.run(
      "INSERT INTO documents (id, title, content, owner_id, is_public) VALUES (?, ?, ?, ?, ?)",
      [id, title, content, socket.userId, isPublic ? 1 : 0],
      function (err) {
        if (err) {
          socket.emit('document-error', { error: err.message });
          return;
        }

        const newDocument = {
          id,
          title,
          content,
          is_public: isPublic,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        console.log(`Document created: ${id} (${isPublic ? 'public' : 'private'}) by user ${socket.userId}`);
        // Notificar o criador sobre o documento criado
        socket.emit('document-created', { document: newDocument });

        // Se for público, atualizar lista para todos os usuários
        // Se for privado, apenas para o criador
        if (isPublic) {
          broadcastDocumentListUpdateToAll();
        } else {
          broadcastDocumentListUpdate(socket.userId);
        }
      }
    );
  });
  // Entrar em um documento (requer autenticação)
  socket.on('join-document', (documentId) => {
    console.log(`Received join-document request from ${socket.username} (${socket.id}) for document ${documentId}`);

    if (!socket.userId) {
      console.log('User not authenticated, sending auth-error');
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }      // Verificar se o usuário tem acesso ao documento (dono, documento público ou permissão compartilhada)
    console.log(`Checking access for user ${socket.userId} to document ${documentId}`);
    db.get(
      `SELECT d.*, dp.permission_type 
       FROM documents d 
       LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
       WHERE d.id = ? AND (d.owner_id = ? OR d.is_public = 1 OR dp.permission_type IS NOT NULL)`,
      [socket.userId, documentId, socket.userId],
      (err, row) => {
        if (err) {
          console.error('Database error checking document access:', err);
          socket.emit('document-error', { error: 'Erro ao verificar documento' });
          return;
        }

        console.log('Document query result:', row);

        if (!row) {
          console.log(`Access denied for user ${socket.userId} to document ${documentId}`);
          socket.emit('document-error', { error: 'Documento não encontrado ou acesso negado' });
          return;
        }

        socket.join(documentId); console.log(`User ${socket.username} (${socket.id}) successfully joined document ${documentId}`);

        // Adicionar usuário à lista do documento
        if (!documentUsers.has(documentId)) {
          documentUsers.set(documentId, new Set());
        }
        documentUsers.get(documentId).add(socket.id);

        console.log(`Users in document ${documentId}:`, Array.from(documentUsers.get(documentId)));
        // Enviar documento atual
        const documentData = {
          id: row.id,
          title: row.title,
          content: row.content,
          owner_id: row.owner_id,
          is_public: row.is_public === 1,
          permission_type: row.permission_type
        };
        documentsStore.set(documentId, documentData);
        socket.emit('document-data', documentData);
        // Enviar lista atualizada de usuários para todos no documento
        const usersInDocument = documentUsers.get(documentId) ? Array.from(documentUsers.get(documentId)) : [];
        console.log(`Raw users in document:`, usersInDocument);

        const usersWithNames = usersInDocument.map(socketId => {
          // Encontrar o socket pelo ID para obter o username
          const userSocket = io.sockets.sockets.get(socketId);
          return {
            id: socketId,
            username: userSocket ? userSocket.username : 'Usuário desconhecido'
          };
        });

        console.log(`Users with names:`, usersWithNames); console.log(`Emitting users-update to document ${documentId} with ${usersWithNames.length} users`);

        io.to(documentId).emit('users-update', {
          users: usersWithNames,
          count: usersWithNames.length
        });

        // Informar outros usuários sobre a entrada de um novo usuário
        socket.to(documentId).emit('user-joined', {
          userId: socket.userId,
          username: socket.username,
          timestamp: Date.now()
        });

        // Solicitar que outros usuários enviem suas posições de cursor atuais
        socket.to(documentId).emit('request-cursor-positions');
      }
    );
  });
  // Sair de um documento
  socket.on('leave-document', (documentId) => {
    socket.leave(documentId);

    // Remover usuário da lista do documento
    if (documentUsers.has(documentId)) {
      documentUsers.get(documentId).delete(socket.id);

      // Se não há mais usuários, limpar o documento da memória
      if (documentUsers.get(documentId).size === 0) {
        documentUsers.delete(documentId);
      } else {
        // Enviar lista atualizada de usuários
        const usersInDocument = Array.from(documentUsers.get(documentId));
        const usersWithNames = usersInDocument.map(socketId => {
          const userSocket = io.sockets.sockets.get(socketId);
          return {
            id: socketId,
            username: userSocket ? userSocket.username : 'Usuário desconhecido'
          };
        });

        io.to(documentId).emit('users-update', {
          users: usersWithNames,
          count: usersWithNames.length
        });
      }
    }
    socket.to(documentId).emit('user-left', { userId: socket.id });
  });
  // Edição em tempo real com auto-save (requer autenticação)
  socket.on('text-change', (data) => {
    console.log('📝 Received text-change from user:', socket.username, 'for document:', data.documentId);

    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId, content, operation } = data;      // Verificar se o usuário pode editar o documento (dono ou tem permissão de escrita)
    db.get(
      `SELECT d.owner_id, dp.permission_type 
       FROM documents d 
       LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
       WHERE d.id = ?`,
      [socket.userId, documentId],
      (err, row) => {
        if (err) {
          console.error('Database error checking document permissions:', err);
          socket.emit('document-error', { error: 'Erro ao verificar permissões do documento' });
          return;
        }

        if (!row) {
          console.log('Document not found:', documentId);
          socket.emit('document-error', { error: 'Documento não encontrado' });
          return;
        }

        // Verificar se o usuário é dono ou tem permissão de escrita
        const isOwner = row.owner_id === socket.userId;
        const hasWritePermission = row.permission_type === 'write';

        console.log('Permission check:', {
          userId: socket.userId,
          documentId,
          isOwner,
          hasWritePermission,
          ownerIdFromDb: row.owner_id,
          permissionType: row.permission_type
        });

        if (!isOwner && !hasWritePermission) {
          socket.emit('document-error', { error: 'Apenas o dono do documento ou usuários com permissão podem editá-lo' });
          return;
        }

        // Atualizar no store
        if (documentsStore.has(documentId)) {
          const doc = documentsStore.get(documentId);
          doc.content = content;
          documentsStore.set(documentId, doc);
        }
        // Auto-save no banco de dados
        db.run("UPDATE documents SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [content, documentId],
          function (err) {
            if (err) {
              console.error('Error auto-saving content:', err);
              socket.emit('document-error', { error: 'Erro ao salvar documento' });
            } else {
              console.log('Document content saved successfully for document:', documentId);
              // Enviar atualização da lista de documentos após salvar
              broadcastDocumentListUpdate(socket.userId);
            }
          }
        );

        // Broadcast para outros usuários no mesmo documento
        socket.to(documentId).emit('text-change', {
          content,
          operation,
          userId: socket.id,
          username: socket.username
        });
      });

    // Salvar operação no banco (para auditoria)
    db.run("INSERT INTO document_operations (document_id, operation_type, operation_data) VALUES (?, ?, ?)",
      [documentId, 'text-change', JSON.stringify(operation)]
    );
  });

  // Mudança de título com auto-save (requer autenticação)
  socket.on('title-change', (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId, title } = data;

    // Verificar se o usuário tem acesso ao documento
    db.get(
      "SELECT id FROM documents WHERE id = ? AND owner_id = ?",
      [documentId, socket.userId],
      (err, row) => {
        if (err || !row) {
          socket.emit('document-error', { error: 'Acesso negado ao documento' });
          return;
        }

        // Atualizar no store
        if (documentsStore.has(documentId)) {
          const doc = documentsStore.get(documentId);
          doc.title = title;
          documentsStore.set(documentId, doc);
        }

        // Auto-save no banco de dados
        db.run("UPDATE documents SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?",
          [title, documentId, socket.userId],
          function (err) {
            if (err) {
              console.error('Error auto-saving title:', err);
            } else {
              // Enviar atualização da lista de documentos após salvar
              broadcastDocumentListUpdate(socket.userId);
            }
          }
        );        // Broadcast para outros usuários
        socket.to(documentId).emit('title-change', {
          title,
          userId: socket.id,
          username: socket.username
        });
      }
    );
  });

  // Atualização de posição do cursor (requer autenticação)
  socket.on('cursor-position', (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId, position, selection } = data;
    console.log('Received cursor position from user:', socket.username, 'documentId:', documentId, 'position:', position);

    // Verificar se o usuário tem acesso ao documento
    db.get(
      `SELECT d.id 
       FROM documents d 
       LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
       WHERE d.id = ? AND (d.owner_id = ? OR d.is_public = 1 OR dp.permission_type IS NOT NULL)`,
      [socket.userId, documentId, socket.userId],
      (err, row) => {
        if (err || !row) {
          console.log('Access denied or error for cursor position:', socket.username, documentId, err);
          return; // Silenciosamente ignorar se não tem acesso
        }

        console.log('Broadcasting cursor position from', socket.username, 'to document room:', documentId);

        // Verificar quantos usuários estão na sala
        const roomUsers = io.sockets.adapter.rooms.get(documentId);
        console.log('Users in room:', roomUsers ? roomUsers.size : 0);

        // Broadcast posição do cursor para outros usuários no mesmo documento
        const cursorData = {
          userId: socket.userId, // Usar o ID real do usuário, não o ID do socket
          username: socket.username,
          position,
          selection,
          timestamp: Date.now()
        };

        console.log('Emitting cursor data:', cursorData);
        socket.to(documentId).emit('cursor-position', cursorData);
      }
    );
  });

  // Alterar visibilidade do documento
  socket.on('toggle-document-visibility', (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId, isPublic } = data;

    // Verificar se o usuário é o proprietário do documento
    db.get(
      "SELECT owner_id FROM documents WHERE id = ?",
      [documentId],
      (err, row) => {
        if (err) {
          socket.emit('document-error', { error: err.message });
          return;
        }

        if (!row) {
          socket.emit('document-error', { error: 'Documento não encontrado' });
          return;
        }

        if (row.owner_id !== socket.userId) {
          socket.emit('document-error', { error: 'Você não tem permissão para alterar este documento' });
          return;
        }

        // Atualizar visibilidade
        db.run(
          "UPDATE documents SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [isPublic ? 1 : 0, documentId],
          function (err) {
            if (err) {
              socket.emit('document-error', { error: err.message });
              return;
            }
            console.log(`Document ${documentId} visibility changed to ${isPublic ? 'public' : 'private'} by user ${socket.userId}`);            // Notificar o cliente
            socket.emit('document-visibility-updated', {
              documentId,
              isPublic,
              message: `Documento alterado para ${isPublic ? 'público' : 'privado'}`
            });

            // Sempre atualizar lista para todos os usuários
            // Quando se torna público: todos precisam ver o novo documento público
            // Quando se torna privado: todos precisam remover o documento da lista de públicos
            broadcastDocumentListUpdateToAll();
          }
        );
      }
    );
  });

  // Compartilhar documento com outro usuário  
  socket.on('share-document', (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId, email, permissionType } = data;

    // Verificar se o usuário é o dono do documento
    db.get(
      "SELECT owner_id FROM documents WHERE id = ? AND owner_id = ?",
      [documentId, socket.userId],
      (err, doc) => {
        if (err || !doc) {
          socket.emit('document-error', { error: 'Apenas o dono pode compartilhar o documento' });
          return;
        }
        // Buscar o usuário pelo email
        db.get(
          "SELECT id, username, email FROM users WHERE email = ?",
          [email],
          (err, user) => {
            if (err) {
              console.error('Erro na query de usuário:', err);
              socket.emit('document-error', { error: 'Erro interno do servidor' });
              return;
            }

            if (!user) {
              console.log(`Tentativa de compartilhar com email não encontrado: ${email}`);
              socket.emit('document-error', { error: 'Usuário com este email não encontrado' });
              return;
            }

            if (user.id === socket.userId) {
              socket.emit('document-error', { error: 'Você não pode compartilhar com você mesmo' });
              return;
            }

            // Adicionar ou atualizar permissão
            db.run(
              `INSERT OR REPLACE INTO document_permissions 
               (document_id, user_id, permission_type, granted_by) 
               VALUES (?, ?, ?, ?)`,
              [documentId, user.id, permissionType, socket.userId],
              function (err) {
                if (err) {
                  socket.emit('document-error', { error: 'Erro ao compartilhar documento' });
                  return;
                }

                console.log(`Document ${documentId} shared with user ${user.email} (${user.username}) - ${permissionType} permission`);
                socket.emit('document-shared', {
                  message: `Documento compartilhado com ${user.email}`,
                  email: user.email,
                  username: user.username,
                  permissionType
                });

                // Atualizar lista de documentos do usuário que recebeu o compartilhamento
                broadcastDocumentListUpdate(user.id);
              }
            );
          }
        );
      }
    );
  });

  // Remover compartilhamento  
  socket.on('unshare-document', (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId, email } = data;

    // Verificar se o usuário é o dono do documento
    db.get(
      "SELECT owner_id FROM documents WHERE id = ? AND owner_id = ?",
      [documentId, socket.userId],
      (err, doc) => {
        if (err || !doc) {
          socket.emit('document-error', { error: 'Apenas o dono pode remover compartilhamentos' });
          return;
        }

        // Buscar o usuário pelo email
        db.get(
          "SELECT id, username, email FROM users WHERE email = ?",
          [email],
          (err, user) => {
            if (err || !user) {
              socket.emit('document-error', { error: 'Usuário com este email não encontrado' });
              return;
            }

            // Remover permissão
            db.run(
              "DELETE FROM document_permissions WHERE document_id = ? AND user_id = ?",
              [documentId, user.id],
              function (err) {
                if (err) {
                  socket.emit('document-error', { error: 'Erro ao remover compartilhamento' });
                  return;
                }

                console.log(`Document ${documentId} unshared from user ${user.email} (${user.username})`);
                socket.emit('document-unshared', {
                  message: `Compartilhamento removido de ${user.email}`,
                  email: user.email,
                  username: user.username
                });

                // Atualizar lista de documentos do usuário que perdeu o compartilhamento
                broadcastDocumentListUpdate(user.id);
              }
            );
          }
        );
      }
    );
  });

  // Listar compartilhamentos de um documento
  socket.on('get-document-shares', (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId } = data;

    // Verificar se o usuário é o dono do documento
    db.get(
      "SELECT owner_id FROM documents WHERE id = ? AND owner_id = ?",
      [documentId, socket.userId],
      (err, doc) => {
        if (err || !doc) {
          socket.emit('document-error', { error: 'Apenas o dono pode ver compartilhamentos' });
          return;
        }
        // Buscar compartilhamentos
        db.all(
          `SELECT dp.permission_type, dp.granted_at, u.username, u.email 
           FROM document_permissions dp 
           JOIN users u ON dp.user_id = u.id 
           WHERE dp.document_id = ?
           ORDER BY dp.granted_at DESC`,
          [documentId],
          (err, shares) => {
            if (err) {
              socket.emit('document-error', { error: 'Erro ao buscar compartilhamentos' });
              return;
            }

            socket.emit('document-shares', { shares });
          }
        );
      }
    );
  });

  // Deletar documento
  socket.on('delete-document', (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId } = data;

    if (!documentId) {
      socket.emit('document-error', { error: 'ID do documento é obrigatório' });
      return;
    }

    // Verificar se o usuário é o dono do documento
    db.get(
      "SELECT id, title, owner_id FROM documents WHERE id = ? AND owner_id = ?",
      [documentId, socket.userId],
      (err, doc) => {
        if (err) {
          console.error('Erro ao verificar dono do documento:', err);
          socket.emit('document-error', { error: 'Erro interno do servidor' });
          return;
        }

        if (!doc) {
          socket.emit('document-error', { error: 'Documento não encontrado ou sem permissão para deletar' });
          return;
        }

        // Começar transação para deletar documento e todas as referências
        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          // 1. Deletar todas as permissões do documento
          db.run(
            "DELETE FROM document_permissions WHERE document_id = ?",
            [documentId],
            function (err) {
              if (err) {
                console.error('Erro ao deletar permissões:', err);
                db.run("ROLLBACK");
                socket.emit('document-error', { error: 'Erro ao deletar documento' });
                return;
              }

              // 2. Deletar todas as operações do documento
              db.run(
                "DELETE FROM document_operations WHERE document_id = ?",
                [documentId],
                function (err) {
                  if (err) {
                    console.error('Erro ao deletar operações:', err);
                    db.run("ROLLBACK");
                    socket.emit('document-error', { error: 'Erro ao deletar documento' });
                    return;
                  }

                  // 3. Deletar o documento
                  db.run(
                    "DELETE FROM documents WHERE id = ?",
                    [documentId],
                    function (err) {
                      if (err) {
                        console.error('Erro ao deletar documento:', err);
                        db.run("ROLLBACK");
                        socket.emit('document-error', { error: 'Erro ao deletar documento' });
                        return;
                      }

                      // Commit da transação
                      db.run("COMMIT");

                      console.log(`Documento ${documentId} deletado com sucesso`);

                      // Notificar todos os usuários sobre a deleção
                      io.emit('document-deleted', {
                        documentId: documentId,
                        title: doc.title
                      });

                      // Remover usuários conectados deste documento
                      if (documentUsers.has(documentId)) {
                        const users = documentUsers.get(documentId);
                        users.forEach(socketId => {
                          const userSocket = io.sockets.sockets.get(socketId);
                          if (userSocket) {
                            userSocket.leave(documentId);
                          }
                        });
                        documentUsers.delete(documentId);
                      }

                      // Atualizar lista de documentos para todos os usuários
                      broadcastDocumentListUpdateToAll();
                    }
                  );
                }
              );
            }
          );
        });
      }
    );
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remover usuário do mapa de conectados
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }

    // Remover usuário de todos os documentos
    for (const [documentId, users] of documentUsers.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        // Notificar outros usuários
        socket.to(documentId).emit('user-left', { userId: socket.id });

        // Remover cursor do usuário que saiu
        socket.to(documentId).emit('cursor-removed', { userId: socket.id });
        // Enviar lista atualizada
        if (users.size > 0) {
          const usersInDocument = Array.from(users);
          const usersWithNames = usersInDocument.map(socketId => {
            const userSocket = io.sockets.sockets.get(socketId);
            return {
              id: socketId,
              username: userSocket ? userSocket.username : 'Usuário desconhecido'
            };
          });

          io.to(documentId).emit('users-update', {
            users: usersWithNames,
            count: usersWithNames.length
          });
        } else {
          documentUsers.delete(documentId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  db.close();
  server.close();
  process.exit(0);
});
