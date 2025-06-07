import { io } from 'socket.io-client';
import authService from './authService';

class SocketService {
  constructor() {
    this.socket = null;
    this.store = null;
    this.isAuthenticated = false;
    this.isAuthenticating = false;
    this.cursorUpdateQueue = [];
    this.cursorUpdateInProgress = false;
    this.lastCursorUpdateTime = 0;
  }

  connect(store) {
    this.store = store;
    this.socket = io('http://localhost:3001');
    
    this.socket.on('connect', () => {
      store.dispatch({ type: 'collaboration/setConnected', payload: true });
      
      // Autenticar automaticamente se houver token
      const token = authService.getToken();
      if (token) {
        this.authenticate(token);
      }
    });    
    
    this.socket.on('disconnect', () => {
      store.dispatch({ type: 'collaboration/setConnected', payload: false });
      this.isAuthenticated = false;
      this.isAuthenticating = false;
    });    
    
    this.socket.on('authenticated', (data) => {
      console.log('✅ Authentication successful:', data);
      this.isAuthenticated = true;
      this.isAuthenticating = false;
      store.dispatch({ type: 'auth/setUser', payload: data.user });
    });

    this.socket.on('auth-error', (data) => {
      console.error('Socket auth error:', data.error);
      this.isAuthenticated = false;
      this.isAuthenticating = false;
      authService.logout();
      store.dispatch({ type: 'auth/logout' });
    });    this.socket.on('document-data', (document) => {
      store.dispatch({ type: 'document/setCurrentDocument', payload: document });
    });

    this.socket.on('document-content', (data) => {
      console.log('📄 Received document content:', data);
      store.dispatch({ type: 'document/updateContent', payload: data.content });
      if (data.title) {
        store.dispatch({ type: 'document/updateTitle', payload: data.title });
      }
    });

    this.socket.on('text-change', (data) => {
      const { content } = data;
      store.dispatch({ type: 'document/updateContent', payload: content });
    });

    this.socket.on('title-change', (data) => {
      const { title } = data;
      store.dispatch({ type: 'document/updateTitle', payload: title });
    }); 
    
    this.socket.on('user-left', (data) => {
      console.log('User left:', data);
      store.dispatch({ 
        type: 'collaboration/removeUser', 
        payload: data.userId
      });
      // Also remove their cursor when they leave
      store.dispatch({
        type: 'collaboration/removeCursor',
        payload: data.userId
      });
    });
    
    this.socket.on('users-update', (data) => {
      console.log('Received users-update event:', data);
      
      // Garantir que temos um array de usuários completos
      const users = Array.isArray(data.users) ? data.users.map(user => {
        if (typeof user === 'string' || typeof user === 'number') {
          return {
            userId: user,
            username: user,
            joinedAt: Date.now()
          };
        }
        return user;
      }).filter(user => user && (user.userId || user.id || user.username)) : [];
      
      console.log('Dispatching users to Redux:', JSON.stringify(users));
      store.dispatch({ type: 'collaboration/setUsers', payload: users });
    });
    
    this.socket.on('cursor-position', (data) => {
      console.log('Received cursor position from another user:', data);
      console.log('Current user ID:', this.store?.getState()?.auth?.user?.id);
      console.log('Sender user ID:', data.userId);
      
      // Verificar se não é o próprio cursor
      const currentUserId = this.store?.getState()?.auth?.user?.id?.toString();
      if (data.userId && data.userId.toString() === currentUserId) {
        console.log('Ignoring cursor from self');
        return;
      }
      
      // Marcar com timestamp local para o gerenciamento de expiração
      const enhancedData = {
        ...data,
        lastUpdate: Date.now()
      };
      
      console.log('Dispatching cursor update to Redux:', enhancedData);
      store.dispatch({ 
        type: 'collaboration/updateCursor', 
        payload: enhancedData 
      });
    });    
    
    this.socket.on('cursor-removed', (data) => {      
        store.dispatch({ type: 'collaboration/removeCursor', payload: data.userId });
    });
    
    // Listener para quando outros usuários solicitam posições de cursor atuais
    this.socket.on('request-cursor-positions', () => {
      console.log('Received request for cursor positions');
      // Disparar evento personalizado que o DocumentEditor pode escutar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('requestCursorPosition'));
      }
    });
    
    // Listener para quando um novo usuário entra no documento
    this.socket.on('user-joined', (data) => {
      console.log('User joined document:', data);
      // Disparar evento para enviar posição atual do cursor
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('requestCursorPosition'));
      }
    });
    
    // Document management events
    this.socket.on('documents-list', (data) => {
      console.log('Received documents-list:', data);
      store.dispatch({ type: 'documents/setDocuments', payload: data });
    });
    
    // Eventos de compartilhamento
    this.socket.on('document-shared', (data) => {
      console.log('Document shared:', data);
      // Recarregar a lista de documentos para mostrar as novas permissões
      this.getDocuments();
      
      // Notificar o usuário sobre o compartilhamento bem-sucedido
      if (this.store) {
        this.store.dispatch({ 
          type: 'notifications/add', 
          payload: { 
            type: 'success', 
            message: `Documento compartilhado com ${data.username}`
          }
        });
      }
    });
    
    this.socket.on('document-unshared', (data) => {
      console.log('Document unshared:', data);
      // Recarregar a lista de documentos
      this.getDocuments();
      
      // Notificar o usuário sobre a remoção de compartilhamento
      if (this.store) {
        this.store.dispatch({ 
          type: 'notifications/add', 
          payload: { 
            type: 'success', 
            message: `Acesso removido para ${data.username}`
          }
        });
      }
    });
    
    this.socket.on('document-shares', (data) => {
      console.log('Document shares received:', data);
    });      this.socket.on('document-error', (data) => {
      console.error('Document error:', data.error);
      
      // Notificar o usuário sobre erro de documento
      if (this.store && data.error) {
        this.store.dispatch({ 
          type: 'notifications/add', 
          payload: { 
            type: 'error', 
            message: data.error
          }
        });
      }
      
      // Também atualizar o estado de erro do documento
      this.store.dispatch({ type: 'document/setError', payload: data.error });
    });

    this.socket.on('document-access-revoked', (data) => {
      console.warn('Document access revoked:', data);
      
      // Notificar o usuário que perdeu acesso
      if (this.store) {
        this.store.dispatch({ 
          type: 'notifications/add', 
          payload: { 
            type: 'warning', 
            message: data.message || 'Você perdeu acesso a este documento'
          }
        });
          // Limpar o documento atual se for o mesmo que perdeu acesso
        const currentDoc = this.store.getState().document.currentDocument;
        if (currentDoc && currentDoc.id === data.documentId) {
          this.store.dispatch({ type: 'document/clearDocument' });
          this.store.dispatch({ type: 'collaboration/clearCollaboration' });
          
          // Redirecionar para a lista de documentos
          if (typeof window !== 'undefined' && window.location) {
            window.location.href = '/documents';
          }
        }
      }
      
      // Recarregar a lista de documentos
      this.getDocuments();
    });

    this.socket.on('documents-error', (data) => {
      console.error('Documents error:', data.error);
      store.dispatch({ type: 'documents/setError', payload: data.error });
    });    
    
    this.socket.on('document-created', (data) => {
      store.dispatch({ type: 'documents/addDocument', payload: data.document });
      // Automaticamente mudar para o documento recém-criado
      store.dispatch({ type: 'document/setCurrentDocument', payload: data.document });
    });    this.socket.on('document-added', (data) => {
      store.dispatch({ type: 'documents/addDocument', payload: data.document });
    });    this.socket.on('document-deleted', (data) => {
      console.log('Document deleted:', data);
      // Recarregar a lista de documentos para remover o documento deletado
      this.getDocuments();
    });

    // Iniciar o intervalo para limpar cursores antigos
    this.startCursorCleanupInterval();

    return this.socket;
  }  
  
  /**
   * Inicia um intervalo para limpar cursores que não foram atualizados recentemente
   */
  startCursorCleanupInterval() {
    // Verificar cursores inativos a cada 30 segundos
    setInterval(() => {
      if (this.store) {
        const state = this.store.getState();
        const cursors = state.collaboration.cursors;
        const now = Date.now();
        const staleTimeout = 30000; // 30 segundos
        
        Object.entries(cursors).forEach(([userId, cursorData]) => {
          // Não remover o cursor do próprio usuário
          if (userId === 'currentUser') return;
          
          if (now - cursorData.lastUpdate > staleTimeout) {
            console.log('Removing stale cursor for user:', userId);
            this.store.dispatch({ 
              type: 'collaboration/removeCursor', 
              payload: userId 
            });
          }
        });
      }
    }, 10000);
  }
  
  // Autenticar com o servidor
  authenticate(token) {
    console.log('Attempting to authenticate with token:', token ? 'present' : 'missing');
    if (this.socket && !this.isAuthenticating) {
      this.isAuthenticating = true;
      console.log('Emitting authenticate event');
      this.socket.emit('authenticate', { token });
    } else {
      console.log('Cannot authenticate - socket:', !!this.socket, 'isAuthenticating:', this.isAuthenticating);
    }
  }  // Verificar se está autenticado antes de fazer operações
  ensureAuthenticated() {
    // Se já está autenticado, retornar true
    if (this.isAuthenticated) {
      return true;
    }
    
    // Se tem socket conectado e token, assumir que está autenticado
    // (isso resolve o problema de timing entre conexão e autenticação)
    if (this.socket && this.socket.connected && authService.getToken()) {
      return true;
    }
    
    if (!this.isAuthenticated && !this.isAuthenticating) {
      const token = authService.getToken();
      if (token) {
        this.authenticate(token);
        return false; // Indica que ainda não está autenticado
      } else {
        throw new Error('Usuário não autenticado');
      }
    }
    return this.isAuthenticated;
  }
  
  /**
   * Entra em uma sala de documento para edição colaborativa
   * @param {string} documentId ID do documento
   */
  joinDocument(documentId) {
    console.log('Attempting to join document:', documentId);
    console.log('Socket connected:', !!this.socket);
    console.log('Is authenticated:', this.isAuthenticated);
    
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    
    if (!this.isAuthenticated) {
      console.log('Not authenticated, attempting to authenticate...');
      const token = authService.getToken();
      if (token) {
        this.authenticate(token);
        // Agendar nova tentativa após autenticação
        setTimeout(() => this.joinDocument(documentId), 1000);
      } else {
        console.error('No token available for authentication');
      }
      return;
    }
    
    console.log('Emitting join-document event');
    this.socket.emit('join-document', documentId);
    this.store.dispatch({ type: 'collaboration/setCurrentRoom', payload: documentId });
  }
    /**
   * Sai de uma sala de documento
   * @param {string} documentId ID do documento
   */
  leaveDocument(documentId) {
    if (this.socket) {
      this.socket.emit('leave-document', { documentId });
      this.store.dispatch({ type: 'collaboration/clearCollaboration' });
    }
  }
  
  /**
   * Envia alterações de texto para o documento
   * @param {string} documentId ID do documento
   * @param {string} content Conteúdo atualizado
   * @param {object} operation Informações sobre a operação
   */  sendTextChange(documentId, content, operation) {
    if (this.socket && this.ensureAuthenticated()) {
      this.socket.emit('text-change', { documentId, content, operation });
    }
  }

  /**
   * Envia alterações de título para o documento
   * @param {string} documentId ID do documento
   * @param {string} title Título atualizado
   */
  sendTitleChange(documentId, title) {
    if (this.socket && this.ensureAuthenticated()) {
      this.socket.emit('title-change', { documentId, title });
    }
  }  
    /**
   * Envia a posição do cursor para colaboração em tempo real
   * @param {string} documentId ID do documento
   * @param {number} position Posição do cursor
   * @param {object} selection Informações sobre seleção (início e fim)
   */  sendCursorPosition(documentId, position, selection) {
    if (!this.socket || !this.ensureAuthenticated()) {
      return;
    }

    // Enviar imediatamente sem fila para melhor responsividade
    this.socket.emit('cursor-position', { documentId, position, selection });
    
    // Atualizar o cursor local para debugging e testes
    const currentUser = this.store?.getState()?.auth?.user;
    if (currentUser) {
      // Identificar explicitamente este cursor como currentUser para filtragem
      this.store.dispatch({ 
        type: 'collaboration/updateCursor', 
        payload: {
          userId: 'currentUser', // Usar 'currentUser' como identificador fixo do próprio usuário
          originalUserId: currentUser.id, // Guardar o ID original para referência
          username: currentUser.username || 'Você',
          position,
          selection,
          timestamp: Date.now(),
          lastUpdate: Date.now(),
          isCurrentUser: true
        }
      });
    }
  }
  
  /**
   * Processa a fila de atualizações de cursor
   */
  processCursorUpdateQueue() {
    if (this.cursorUpdateQueue.length === 0) {
      this.cursorUpdateInProgress = false;
      return;
    }
    
    this.cursorUpdateInProgress = true;
    const { documentId, position, selection } = this.cursorUpdateQueue[this.cursorUpdateQueue.length - 1];
    this.cursorUpdateQueue = [];
    
    if (this.socket && this.isAuthenticated) {
      console.log('Emitting cursor position:', { documentId, position, selection });
      this.socket.emit('cursor-position', { documentId, position, selection });
      
      // Atualizar o último tempo de envio
      this.lastCursorUpdateTime = Date.now();
        // Atualizar o cursor local para debugging e testes
      const currentUser = this.store?.getState()?.auth?.user;
      if (currentUser) {
        // Identificar explicitamente este cursor como currentUser para filtragem
        this.store.dispatch({ 
          type: 'collaboration/updateCursor', 
          payload: {
            userId: 'currentUser', // Usar 'currentUser' como identificador fixo do próprio usuário
            originalUserId: currentUser.id, // Guardar o ID original para referência
            username: currentUser.username || 'Você',
            position,
            selection,
            timestamp: Date.now(),
            lastUpdate: Date.now(),
            isCurrentUser: true
          }
        });
      }
    }
    
    // Agendar a próxima verificação
    setTimeout(() => this.processCursorUpdateQueue(), 100);
  }
  
  /**
   * Busca lista de documentos do usuário
   */
  getDocuments() {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    
    if (!this.isAuthenticated) {
      console.log('Not authenticated, attempting to authenticate...');
      const token = authService.getToken();
      if (token) {
        this.authenticate(token);
        // Agendar nova tentativa após autenticação
        setTimeout(() => this.getDocuments(), 1000);
      } else {
        console.error('No token available for authentication');
      }
      return;
    }
    
    console.log('Requesting documents via WebSocket');
    this.socket.emit('get-documents');
  }
  
  /**
   * Cria um novo documento
   * @param {string} title Título do documento
   * @param {string} content Conteúdo inicial
   * @param {boolean} isPublic Se o documento é público
   */
  createDocument(title, content = '', isPublic = false) {
    if (this.socket && this.ensureAuthenticated()) {
      this.socket.emit('create-document', { title, content, isPublic });
    }
  }
  /**
   * Compartilha um documento com outro usuário
   * @param {string} documentId ID do documento
   * @param {string} email Email do usuário para compartilhar
   * @param {string} permissionType Tipo de permissão ('read' ou 'write')
   */
  shareDocument(documentId, email, permissionType) {
    if (this.socket && this.ensureAuthenticated()) {
      this.socket.emit('share-document', {
        documentId,
        email,
        permissionType
      });
    }
  }
  
  /**
   * Remove o compartilhamento de um documento
   * @param {string} documentId ID do documento
   * @param {string} email Email do usuário para remover acesso
   */
  unshareDocument(documentId, email) {
    if (this.socket && this.ensureAuthenticated()) {
      this.socket.emit('unshare-document', {
        documentId,
        email
      });
    }
  }
  
  /**
   * Busca a lista de compartilhamentos para um documento
   * @param {string} documentId ID do documento
   */
  getDocumentShares(documentId) {
    if (this.socket && this.ensureAuthenticated()) {
      this.socket.emit('get-document-shares', {
        documentId
      });
    }
  }  /**
   * Deleta um documento
   * @param {string} documentId ID do documento a ser deletado
   */
  deleteDocument(documentId) {
    if (this.socket && this.ensureAuthenticated()) {
      this.socket.emit('delete-document', {
        documentId
      });
    }  }

  /**
   * Método genérico para emitir eventos
   */
  emit(event, data) {
    if (this.socket && this.isAuthenticated) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected or not authenticated for emit:', event);
    }
  }

  /**
   * Método genérico para ouvir eventos
   */
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Método genérico para remover listeners
   */
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Desconecta do servidor WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();
