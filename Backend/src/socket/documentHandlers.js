import documentService from '../services/documentService.js';
import { broadcastDocumentListUpdate, broadcastDocumentListUpdateToAll } from '../services/broadcastService.js';
import database from '../database/index.js';

/**
 * Configura os event handlers de documentos para um socket
 */
const setupDocumentHandlers = (socket, io) => {
  
  // Buscar lista de documentos
  socket.on('get-documents', async () => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      const documents = await documentService.getDocumentsList(socket.userId);
      socket.emit('documents-list', documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      socket.emit('document-error', { error: 'Erro ao buscar documentos' });
    }
  });

  // Criar novo documento
  socket.on('create-document', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      const { title, content = '', isPublic = false } = data;
      const document = await documentService.createDocument(title, content, socket.userId, isPublic);
      
      console.log(`Document created: ${document.id} by user ${socket.userId}`);
      
      socket.emit('document-created', { document });

      // Se o documento for público, notificar todos os usuários
      if (isPublic) {
        broadcastDocumentListUpdateToAll();
      } else {
        broadcastDocumentListUpdate(socket.userId);
      }
    } catch (error) {
      console.error('Error creating document:', error);
      socket.emit('document-error', { error: 'Erro ao criar documento' });
    }
  });

  // Buscar documento específico
  socket.on('get-document', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      const { documentId } = data;
      const document = await documentService.getDocument(documentId, socket.userId);
      
      // Adicionar usuário ao documento
      documentService.addUserToDocument(documentId, socket.userId);
      
      // Adicionar documento ao store em memória se não estiver
      if (!documentService.getDocumentFromMemory(documentId)) {
        documentService.setDocumentInMemory(documentId, document.content);
      }

      socket.join(documentId);
      socket.emit('document-data', document);

      // Notificar outros usuários sobre novo usuário no documento
      socket.to(documentId).emit('user-joined', {
        userId: socket.userId,
        username: socket.username
      });

      // Enviar lista atualizada de usuários no documento
      const documentUsers = Array.from(documentService.getDocumentUsers(documentId));
      const usersList = documentUsers.map(userId => {
        const userSocket = documentService.getConnectedUser(userId);
        return {
          userId,
          username: userSocket?.username || userId,
          joinedAt: Date.now()
        };
      });

      io.to(documentId).emit('users-update', { users: usersList });

    } catch (error) {
      console.error('Error fetching document:', error);
      socket.emit('document-error', { error: error.message });
    }
  });
  // Entrar em um documento para colaboração
  socket.on('join-document', async (documentId) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      console.log(`🚪 User ${socket.userId} (${socket.username}) joining document ${documentId}`);
      
      // Verificar se o usuário tem permissão para acessar o documento
      const document = await documentService.getDocument(documentId, socket.userId);
      
      if (!document) {
        socket.emit('document-error', { error: 'Documento não encontrado ou sem permissão' });
        return;
      }

      // Adicionar usuário ao documento
      documentService.addUserToDocument(documentId, socket.userId);
      
      // Entrar na sala do documento
      socket.join(documentId);
      
      console.log(`✅ User ${socket.userId} successfully joined document ${documentId}`);

      // IMPORTANTE: Enviar o conteúdo atual do documento para o usuário que acabou de entrar
      const currentContent = documentService.getDocumentFromMemory(documentId) || document.content || '';
      console.log(`📄 Sending current document content to user ${socket.userId}, content length: ${currentContent.length}`);
      socket.emit('document-content', {
        documentId,
        content: currentContent,
        title: document.title
      });

      // Notificar outros usuários sobre novo usuário no documento
      socket.to(documentId).emit('user-joined', {
        userId: socket.userId,
        username: socket.username
      });

      // Enviar lista atualizada de usuários no documento para todos
      const documentUsers = Array.from(documentService.getDocumentUsers(documentId));
      const usersList = documentUsers.map(userId => {
        const userSocket = documentService.getConnectedUser(userId);
        return {
          userId,
          username: userSocket?.username || userId,
          joinedAt: Date.now()
        };
      });

      console.log(`📊 Sending users update for document ${documentId}:`, usersList);
      io.to(documentId).emit('users-update', { users: usersList });

    } catch (error) {
      console.error('Error joining document:', error);
      socket.emit('document-error', { error: error.message });
    }
  });
  // Alterar visibilidade do documento
  socket.on('toggle-document-visibility', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      const { documentId, isPublic } = data;
      
      // Se está mudando para privado, precisamos desconectar usuários sem permissão
      if (!isPublic) {
        console.log(`🔒 Document ${documentId} changing to private - checking connected users`);
        
        // Obter usuários conectados ao documento
        const connectedUsers = Array.from(documentService.getDocumentUsers(documentId));
        console.log(`👥 Connected users in document ${documentId}:`, connectedUsers);
          // Para cada usuário conectado, verificar se ainda terá acesso após mudança para privado
        for (const userId of connectedUsers) {
          if (userId === socket.userId) continue; // Owner sempre tem acesso
          
          try {
            // Para verificar se o usuário ainda terá acesso quando o documento se tornar privado,
            // precisamos verificar se o usuário tem permissão explícita de compartilhamento
            const db = database.getDb();
            const hasExplicitPermission = await new Promise((resolve, reject) => {
              db.get(
                'SELECT permission_type FROM document_permissions WHERE document_id = ? AND user_id = ?',
                [documentId, userId],
                (err, row) => {
                  if (err) reject(err);
                  else resolve(!!row); // true se existe permissão explícita
                }
              );
            });
            
            // Se não tem permissão explícita, perderá acesso quando documento se tornar privado
            if (!hasExplicitPermission) {
              console.log(`🚫 User ${userId} will lose access to document ${documentId} - disconnecting`);
                // Encontrar o socket do usuário
              const userSocket = documentService.getConnectedUser(userId);
              if (userSocket) {
                console.log(`📡 Sending access revoked notification to user ${userId}`);
                
                // Notificar o usuário que perdeu acesso
                userSocket.emit('document-access-revoked', {
                  documentId,
                  message: 'Este documento foi alterado para privado e você não tem mais acesso'
                });
                
                // Remover da sala
                userSocket.leave(documentId);
                
                // Remover do documento
                documentService.removeUserFromDocument(documentId, userId);
                  // Notificar outros usuários que esse usuário saiu
                userSocket.to(documentId).emit('user-left', {
                  userId: userId,
                  username: userSocket.username || userId
                });
                
                console.log(`✅ User ${userId} disconnected from document ${documentId}`);
              } else {
                console.log(`⚠️ User socket not found for userId: ${userId}`);
              }
            }
          } catch (error) {
            console.error(`Error checking access for user ${userId}:`, error);
          }
        }
      }
      
      // Atualizar o documento
      await documentService.updateDocument(documentId, { is_public: isPublic }, socket.userId);
      
      console.log(`Document ${documentId} visibility changed to ${isPublic ? 'public' : 'private'} by user ${socket.userId}`);

      socket.emit('document-visibility-updated', {
        documentId,
        isPublic,
        message: `Documento alterado para ${isPublic ? 'público' : 'privado'}`
      });

      // Sempre atualizar lista para todos os usuários
      // Quando se torna público: todos precisam ver o novo documento público
      // Quando se torna privado: todos precisam remover o documento da lista de públicos
      broadcastDocumentListUpdateToAll();
      
      // Atualizar lista de usuários conectados após possíveis desconexões
      if (!isPublic) {
        const updatedUsers = Array.from(documentService.getDocumentUsers(documentId));
        const usersList = updatedUsers.map(userId => {
          const userSocket = documentService.getConnectedUser(userId);
          return {
            userId,
            username: userSocket?.username || userId,
            joinedAt: Date.now()
          };
        });
        
        console.log(`📊 Sending updated users list for document ${documentId}:`, usersList);
        io.to(documentId).emit('users-update', { users: usersList });
      }

    } catch (error) {
      console.error('Error toggling document visibility:', error);
      socket.emit('document-error', { error: error.message });
    }
  });
  // Deletar documento
  socket.on('delete-document', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      const { documentId } = data;
      
      // Primeiro, buscar o documento para verificar se é público
      const documentToDelete = await documentService.getDocument(documentId, socket.userId);
      const wasPublic = documentToDelete.is_public;
      
      const result = await documentService.deleteDocument(documentId, socket.userId);
      
      if (result.deleted) {
        console.log(`Document deleted: ${documentId} by user ${socket.userId} (was public: ${wasPublic})`);
        
        // Remover documento do store em memória
        documentService.removeDocumentFromMemory(documentId);
        
        // Notificar usuários no documento sobre a deleção
        socket.to(documentId).emit('document-deleted', { documentId });
        
        socket.emit('document-deleted', { documentId });
        
        // Se o documento era público, atualizar lista para todos os usuários
        // Se era privado, atualizar apenas para o proprietário
        if (wasPublic) {
          broadcastDocumentListUpdateToAll();
        } else {
          broadcastDocumentListUpdate(socket.userId);
        }
      } else {
        socket.emit('document-error', { error: 'Documento não encontrado' });
      }

    } catch (error) {
      console.error('Error deleting document:', error);
      socket.emit('document-error', { error: error.message });
    }
  });

  // Compartilhar documento
  socket.on('share-document', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      const { documentId, email, permissionType } = data;
      const result = await documentService.shareDocument(documentId, email, permissionType, socket.userId);
      
      console.log(`Document ${documentId} shared with ${result.username} by user ${socket.userId}`);
      
      socket.emit('document-shared', result);
      
      // Atualizar lista de documentos para o usuário que recebeu o compartilhamento
      broadcastDocumentListUpdate(result.targetUserId);
      
    } catch (error) {
      console.error('Error sharing document:', error);
      socket.emit('document-error', { error: error.message });
    }
  });

  // Remover compartilhamento
  socket.on('unshare-document', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      const { documentId, email } = data;
      const result = await documentService.unshareDocument(documentId, email, socket.userId);
      
      if (result.removed) {
        console.log(`Document ${documentId} unshared from ${result.username} by user ${socket.userId}`);
        
        socket.emit('document-unshared', result);
        
        // Atualizar lista de documentos para o usuário que perdeu o acesso
        broadcastDocumentListUpdate(result.targetUserId);
      } else {
        socket.emit('document-error', { error: 'Compartilhamento não encontrado' });
      }
      
    } catch (error) {
      console.error('Error unsharing document:', error);
      socket.emit('document-error', { error: error.message });
    }
  });

  // Buscar compartilhamentos de um documento
  socket.on('get-document-shares', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    try {
      const { documentId } = data;
      const result = await documentService.getDocumentShares(documentId, socket.userId);
      socket.emit('document-shares', result);
      
    } catch (error) {
      console.error('Error fetching document shares:', error);
      socket.emit('document-error', { error: error.message });
    }
  });
};

export { setupDocumentHandlers };
