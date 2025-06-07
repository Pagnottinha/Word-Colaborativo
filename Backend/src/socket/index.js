const { setupAuthHandlers } = require('./authHandlers');
const { setupDocumentHandlers } = require('./documentHandlers');
const { setupCollaborationHandlers } = require('./collaborationHandlers');

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

module.exports = {
  setupSocketHandlers
};
