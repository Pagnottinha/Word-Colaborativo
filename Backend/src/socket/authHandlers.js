import { verifySocketToken } from '../middleware/auth.js';
import documentService from '../services/documentService.js';
import authService from '../services/authService.js';

/**
 * Configura os event handlers de autenticação para um socket
 */
const setupAuthHandlers = (socket, io) => {
  // Autenticação via WebSocket
  socket.on('authenticate', async (data) => {
    const { token } = data;
    
    try {
      const decoded = verifySocketToken(token);
      if (!decoded) {
        socket.emit('auth-error', { error: 'Token inválido' });
        return;
      }

      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.email = decoded.email;

      // Adicionar usuário aos usuários conectados
      documentService.addConnectedUser(decoded.id, socket);

      console.log(`✅ User authenticated via WebSocket: ${decoded.username} (${decoded.id})`);
      
      socket.emit('authenticated', {
        user: {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email
        }
      });

    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth-error', { error: 'Erro de autenticação' });
    }
  });

  // Handler para desconexão
  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`);
      
      // Remover usuário dos usuários conectados
      documentService.removeConnectedUser(socket.userId);
      
      // Remover usuário de todos os documentos que estava editando
      const allDocuments = documentService.getAllConnectedUsers();
      allDocuments.forEach((_, documentId) => {
        documentService.removeUserFromDocument(documentId, socket.userId);
      });
    }
  });
};

export { setupAuthHandlers };
