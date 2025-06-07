const documentService = require('../services/documentService');

/**
 * Broadcast da lista de documentos para um usuário específico
 */
const broadcastDocumentListUpdate = async (userId) => {
  console.log(`🔄 Broadcasting document list update to user: ${userId}`);
  const userSocket = documentService.getConnectedUser(userId);
  if (userSocket) {
    try {
      const documents = await documentService.getDocumentsList(userId);
      console.log(`📤 Broadcasting to user ${userId}: ${documents.ownDocuments.length} own, ${documents.sharedDocuments.length} shared, ${documents.publicDocuments.length} public`);
      userSocket.emit('documents-list', documents);
    } catch (error) {
      console.error(`❌ Error broadcasting document list update to user ${userId}:`, error);
    }
  } else {
    console.warn(`⚠️ User socket not found for user ${userId}`);
  }
};

/**
 * Broadcast da lista de documentos para todos os usuários conectados
 */
const broadcastDocumentListUpdateToAll = () => {
  console.log('🌐 Broadcasting document list update to all connected users');
  const connectedUsers = documentService.getAllConnectedUsers();
  console.log(`👥 Total connected users: ${connectedUsers.size}`);
  
  connectedUsers.forEach((socket, userId) => {
    console.log(`🔄 Updating list for user: ${userId}`);
    broadcastDocumentListUpdate(userId);
  });
};

/**
 * Broadcast de atualização de documento para um usuário específico
 */
const broadcastDocumentUpdate = async (documentId, userId) => {
  const userSocket = documentService.getConnectedUser(userId);
  if (userSocket) {
    try {
      const document = await documentService.getDocument(documentId, userId);
      console.log(`Broadcasting document update to user ${userId}: ${documentId}`);
      userSocket.emit('document-updated', { document });
    } catch (error) {
      console.error('Error broadcasting document update:', error);
    }
  }
};

module.exports = {
  broadcastDocumentListUpdate,
  broadcastDocumentListUpdateToAll,
  broadcastDocumentUpdate
};
