import documentService from '../services/documentService.js';

/**
 * Configura os event handlers de colaboração em tempo real para um socket
 */
const setupCollaborationHandlers = (socket, io) => {
    // Mudanças de texto em tempo real
  socket.on('text-change', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId, content } = data;
    
    console.log(`📝 Text change received from user ${socket.userId} (${socket.username}) for document ${documentId}, content length: ${content?.length || 0}`);
    
    try {
      // Verificar se o usuário tem permissão para editar
      const document = await documentService.getDocument(documentId, socket.userId);
      
      if (!document.can_edit) {
        console.log(`❌ User ${socket.userId} cannot edit document ${documentId}`);
        socket.emit('document-error', { error: 'Você não tem permissão para editar este documento' });
        return;
      }

      // Atualizar conteúdo no store em memória
      documentService.setDocumentInMemory(documentId, content);

      // Broadcast para outros usuários no mesmo documento
      socket.to(documentId).emit('text-change', { content, userId: socket.userId });

      // Salvar no banco periodicamente (debounce seria ideal aqui)
      await documentService.updateDocument(documentId, { content }, socket.userId);
      
      console.log(`✅ Document ${documentId} content updated and saved to database`);

    } catch (error) {
      console.error('Error handling text change:', error);
      socket.emit('document-error', { error: 'Erro ao salvar alterações' });
    }
  });

  // Mudanças de título
  socket.on('title-change', async (data) => {
    if (!socket.userId) {
      socket.emit('auth-error', { error: 'Usuário não autenticado' });
      return;
    }

    const { documentId, title } = data;
    
    try {
      // Verificar se o usuário tem permissão para editar
      const document = await documentService.getDocument(documentId, socket.userId);
      
      if (!document.can_edit) {
        socket.emit('document-error', { error: 'Você não tem permissão para editar este documento' });
        return;
      }

      // Broadcast para outros usuários no mesmo documento
      socket.to(documentId).emit('title-change', { title, userId: socket.userId });

      // Salvar no banco
      await documentService.updateDocument(documentId, { title }, socket.userId);

    } catch (error) {
      console.error('Error handling title change:', error);
      socket.emit('document-error', { error: 'Erro ao salvar título' });
    }
  });  // Posição do cursor
  socket.on('cursor-position', (data) => {
    if (!socket.userId) return;

    const { documentId, position, selection } = data;
    
    // Broadcast para outros usuários no mesmo documento
    socket.to(documentId).emit('cursor-position', {
      userId: socket.userId,
      username: socket.username,
      position,
      selection
    });
  });

  // Sair de um documento
  socket.on('leave-document', (data) => {
    if (!socket.userId) return;

    const { documentId } = data;
    
    // Remover usuário do documento
    documentService.removeUserFromDocument(documentId, socket.userId);
    
    // Sair da sala do socket
    socket.leave(documentId);
    
    // Notificar outros usuários
    socket.to(documentId).emit('user-left', {
      userId: socket.userId,
      username: socket.username
    });

    // Enviar lista atualizada de usuários
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
  });
};

export { setupCollaborationHandlers };
