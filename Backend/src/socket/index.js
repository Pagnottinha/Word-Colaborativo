import { setupAuthHandlers } from './authHandlers.js';
import { setupDocumentHandlers } from './documentHandlers.js';
import { setupCollaborationHandlers } from './collaborationHandlers.js';

/**
 * Configura todos os event handlers para um socket
 */
const setupSocketHandlers = (socket, io) => {
  console.log('New client connected:', socket.id);

  // Configurar handlers de autenticação
  setupAuthHandlers(socket, io);
  
  // Configurar handlers de documentos
  setupDocumentHandlers(socket, io);
  
  // Configurar handlers de colaboração
  setupCollaborationHandlers(socket, io);
};

export { setupSocketHandlers };
