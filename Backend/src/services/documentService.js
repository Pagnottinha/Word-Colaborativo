import { v4 as uuidv4 } from 'uuid';
import database from '../database/index.js';

class DocumentService {
  constructor() {
    // Store de documentos em memória para operações em tempo real
    this.documentsStore = new Map();
    // Store para rastrear usuários por documento
    this.documentUsers = new Map();
    // Store para rastrear usuários conectados por userId
    this.connectedUsers = new Map();
  }

  async getDocumentsList(userId) {
    const db = database.getDb();
    
    console.log(`📋 Getting documents list for user: ${userId}`);

    return new Promise((resolve, reject) => {
      // Buscar documentos próprios
      db.all(
        "SELECT id, title, is_public, created_at, updated_at, owner_id, 'own' as type FROM documents WHERE owner_id = ? ORDER BY updated_at DESC",
        [userId],
        (err, ownDocuments) => {
          if (err) {
            console.error(`❌ Error fetching own documents for user ${userId}:`, err);
            reject(err);
            return;
          }
          
          console.log(`✅ Found ${ownDocuments?.length || 0} own documents for user ${userId}`);

          // Buscar documentos compartilhados
          db.all(
            `SELECT d.id, d.title, d.is_public, d.created_at, d.updated_at, d.owner_id, u.username as owner_username, dp.permission_type, dp.granted_at, 'shared' as type 
             FROM documents d 
             JOIN users u ON d.owner_id = u.id 
             JOIN document_permissions dp ON d.id = dp.document_id 
             WHERE dp.user_id = ? 
             ORDER BY d.updated_at DESC`,
            [userId],
            (err, sharedDocuments) => {
              if (err) {
                console.error(`❌ Error fetching shared documents for user ${userId}:`, err);
                sharedDocuments = [];
              }
              
              console.log(`✅ Found ${sharedDocuments?.length || 0} shared documents for user ${userId}`);

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
                [userId, ...sharedDocIds],
                (err, publicDocuments) => {
                  if (err) {
                    console.error(`❌ Error fetching public documents for user ${userId}:`, err);
                    publicDocuments = [];
                  }
                  
                  console.log(`✅ Found ${publicDocuments?.length || 0} public documents for user ${userId}`);

                  const result = {
                    ownDocuments: ownDocuments || [],
                    sharedDocuments: sharedDocuments || [],
                    publicDocuments: publicDocuments || []
                  };
                  
                  console.log(`📤 Returning documents for user ${userId}:`, {
                    own: result.ownDocuments.length,
                    shared: result.sharedDocuments.length,
                    public: result.publicDocuments.length
                  });

                  resolve(result);
                }
              );
            }
          );
        }
      );
    });
  }

  async createDocument(title, content, ownerId, isPublic = false) {
    const db = database.getDb();
    const documentId = uuidv4();

    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO documents (id, title, content, owner_id, is_public) VALUES (?, ?, ?, ?, ?)",
        [documentId, title, content, ownerId, isPublic ? 1 : 0],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: documentId,
              title,
              content,
              owner_id: ownerId,
              is_public: isPublic,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      );
    });
  }

  async getDocument(documentId, userId) {
    const db = database.getDb();

    return new Promise((resolve, reject) => {
      db.get(
        `SELECT d.*, u.username as owner_username, dp.permission_type 
         FROM documents d 
         LEFT JOIN users u ON d.owner_id = u.id 
         LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
         WHERE d.id = ? AND (d.owner_id = ? OR d.is_public = 1 OR dp.permission_type IS NOT NULL)`,
        [userId, documentId, userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            reject(new Error('Documento não encontrado ou acesso negado'));
          } else {
            resolve({
              id: row.id,
              title: row.title,
              content: row.content,
              owner_id: row.owner_id,
              owner_username: row.owner_username,
              is_public: row.is_public === 1,
              created_at: row.created_at,
              updated_at: row.updated_at,
              permission_type: row.permission_type,
              can_edit: row.owner_id === userId || row.permission_type === 'write'
            });
          }
        }
      );
    });
  }
  async updateDocument(documentId, updates, userId) {
    const db = database.getDb();

    console.log(`🔍 UpdateDocument called - DocumentId: ${documentId}, UserId: ${userId}, Updates:`, updates);

    return new Promise((resolve, reject) => {
      // Primeiro verificar permissões
      db.get(
        `SELECT d.owner_id, dp.permission_type 
         FROM documents d 
         LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
         WHERE d.id = ?`,
        [userId, documentId],
        (err, row) => {
          if (err) {
            console.error(`❌ Error checking permissions for document ${documentId}:`, err);
            reject(err);
            return;
          }

          if (!row) {
            console.error(`❌ Document ${documentId} not found`);
            reject(new Error('Documento não encontrado'));
            return;
          }

          const canEdit = row.owner_id === userId || row.permission_type === 'write';
          if (!canEdit) {
            console.error(`❌ User ${userId} cannot edit document ${documentId}`);
            reject(new Error('Você não tem permissão para editar este documento'));
            return;
          }

          console.log(`✅ User ${userId} has permission to edit document ${documentId}`);

          // Construir query de update dinamicamente
          const fields = [];
          const values = [];

          if (updates.title !== undefined) {
            fields.push('title = ?');
            values.push(updates.title);
            console.log(`📝 Will update title to: ${updates.title}`);
          }

          if (updates.content !== undefined) {
            fields.push('content = ?');
            values.push(updates.content);
            console.log(`📝 Will update content (${updates.content?.length || 0} characters)`);
          }

          if (updates.is_public !== undefined) {
            fields.push('is_public = ?');
            values.push(updates.is_public ? 1 : 0);
            console.log(`📝 Will update is_public to: ${updates.is_public}`);
          }

          fields.push('updated_at = CURRENT_TIMESTAMP');
          values.push(documentId);

          const query = `UPDATE documents SET ${fields.join(', ')} WHERE id = ?`;
          console.log(`🔄 Executing query: ${query}`);
          console.log(`🔄 With values:`, values);

          db.run(query, values, function (err) {
            if (err) {
              console.error(`❌ Database update failed for document ${documentId}:`, err);
              reject(err);
            } else {
              console.log(`✅ Database update successful for document ${documentId}. Changes: ${this.changes}`);
              
              // Verificar se realmente salvou
              db.get('SELECT content, updated_at FROM documents WHERE id = ?', [documentId], (err, verifyRow) => {
                if (err) {
                  console.error(`❌ Error verifying save for document ${documentId}:`, err);
                } else if (verifyRow) {
                  console.log(`🔍 Verification - Document ${documentId} content length in DB: ${verifyRow.content?.length || 0}, updated_at: ${verifyRow.updated_at}`);
                }
              });
              
              resolve({ documentId, changes: this.changes });
            }
          });
        }
      );
    });
  }

  async deleteDocument(documentId, userId) {
    const db = database.getDb();

    return new Promise((resolve, reject) => {
      // Verificar se o usuário é o proprietário
      db.get(
        "SELECT owner_id FROM documents WHERE id = ?",
        [documentId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            reject(new Error('Documento não encontrado'));
            return;
          }

          if (row.owner_id !== userId) {
            reject(new Error('Você não tem permissão para deletar este documento'));
            return;
          }

          // Deletar permissões primeiro
          db.run(
            "DELETE FROM document_permissions WHERE document_id = ?",
            [documentId],
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              // Deletar operações do documento
              db.run(
                "DELETE FROM document_operations WHERE document_id = ?",
                [documentId],
                (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  // Deletar o documento
                  db.run(
                    "DELETE FROM documents WHERE id = ?",
                    [documentId],
                    function (err) {
                      if (err) {
                        reject(err);
                      } else {
                        resolve({ documentId, deleted: this.changes > 0 });
                      }
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  }

  async shareDocument(documentId, targetEmail, permissionType, ownerId) {
    const db = database.getDb();

    return new Promise((resolve, reject) => {
      // Verificar se o usuário é o proprietário
      db.get(
        "SELECT owner_id FROM documents WHERE id = ?",
        [documentId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            reject(new Error('Documento não encontrado'));
            return;
          }

          if (row.owner_id !== ownerId) {
            reject(new Error('Você não tem permissão para compartilhar este documento'));
            return;
          }

          // Buscar usuário pelo email
          db.get(
            "SELECT id, username FROM users WHERE email = ?",
            [targetEmail],
            (err, targetUser) => {
              if (err) {
                reject(err);
                return;
              }

              if (!targetUser) {
                reject(new Error('Usuário não encontrado com este email'));
                return;
              }

              if (targetUser.id === ownerId) {
                reject(new Error('Você não pode compartilhar um documento consigo mesmo'));
                return;
              }

              // Inserir ou atualizar permissão
              db.run(
                `INSERT OR REPLACE INTO document_permissions 
                 (document_id, user_id, permission_type, granted_by) 
                 VALUES (?, ?, ?, ?)`,
                [documentId, targetUser.id, permissionType, ownerId],
                function (err) {
                  if (err) {
                    reject(err);
                  } else {
                    resolve({
                      documentId,
                      targetUserId: targetUser.id,
                      username: targetUser.username,
                      email: targetEmail,
                      permissionType
                    });
                  }
                }
              );
            }
          );
        }
      );
    });
  }

  async unshareDocument(documentId, targetEmail, ownerId) {
    const db = database.getDb();

    return new Promise((resolve, reject) => {
      // Verificar se o usuário é o proprietário
      db.get(
        "SELECT owner_id FROM documents WHERE id = ?",
        [documentId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            reject(new Error('Documento não encontrado'));
            return;
          }

          if (row.owner_id !== ownerId) {
            reject(new Error('Você não tem permissão para gerenciar este documento'));
            return;
          }

          // Buscar usuário pelo email
          db.get(
            "SELECT id, username FROM users WHERE email = ?",
            [targetEmail],
            (err, targetUser) => {
              if (err) {
                reject(err);
                return;
              }

              if (!targetUser) {
                reject(new Error('Usuário não encontrado com este email'));
                return;
              }

              // Remover permissão
              db.run(
                "DELETE FROM document_permissions WHERE document_id = ? AND user_id = ?",
                [documentId, targetUser.id],
                function (err) {
                  if (err) {
                    reject(err);
                  } else {
                    resolve({
                      documentId,
                      targetUserId: targetUser.id,
                      username: targetUser.username,
                      email: targetEmail,
                      removed: this.changes > 0
                    });
                  }
                }
              );
            }
          );
        }
      );
    });
  }

  async getDocumentShares(documentId, ownerId) {
    const db = database.getDb();

    return new Promise((resolve, reject) => {
      // Verificar se o usuário é o proprietário
      db.get(
        "SELECT owner_id FROM documents WHERE id = ?",
        [documentId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            reject(new Error('Documento não encontrado'));
            return;
          }

          if (row.owner_id !== ownerId) {
            reject(new Error('Você não tem permissão para ver os compartilhamentos deste documento'));
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
                reject(err);
              } else {
                resolve({ documentId, shares: shares || [] });
              }
            }
          );
        }
      );
    });
  }

  // Métodos para gerenciamento de usuários conectados
  addConnectedUser(userId, socket) {
    this.connectedUsers.set(userId, socket);
  }

  removeConnectedUser(userId) {
    this.connectedUsers.delete(userId);
  }

  getConnectedUser(userId) {
    return this.connectedUsers.get(userId);
  }

  getAllConnectedUsers() {
    return this.connectedUsers;
  }

  // Métodos para gerenciamento de usuários em documentos
  addUserToDocument(documentId, userId) {
    if (!this.documentUsers.has(documentId)) {
      this.documentUsers.set(documentId, new Set());
    }
    this.documentUsers.get(documentId).add(userId);
  }

  removeUserFromDocument(documentId, userId) {
    if (this.documentUsers.has(documentId)) {
      this.documentUsers.get(documentId).delete(userId);
      if (this.documentUsers.get(documentId).size === 0) {
        this.documentUsers.delete(documentId);
      }
    }
  }

  getDocumentUsers(documentId) {
    return this.documentUsers.get(documentId) || new Set();
  }

  // Métodos para store de documentos em memória
  setDocumentInMemory(documentId, content) {
    this.documentsStore.set(documentId, content);
  }

  getDocumentFromMemory(documentId) {
    return this.documentsStore.get(documentId);
  }

  removeDocumentFromMemory(documentId) {
    this.documentsStore.delete(documentId);
  }
}

const documentService = new DocumentService();
export default documentService;
