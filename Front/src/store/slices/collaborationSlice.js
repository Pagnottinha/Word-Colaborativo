import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connectedUsers: [],
  isConnected: false,
  currentRoom: null,
  cursors: {},
};

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    setConnected: (state, action) => {
      state.isConnected = action.payload;
    },    
    setCurrentRoom: (state, action) => {
      state.currentRoom = action.payload;
    },    
    setUsers: (state, action) => {
      console.log('Setting users in collaboration slice:', action.payload);
      // Filtrar elementos válidos apenas
      const validUsers = Array.isArray(action.payload) 
        ? action.payload.filter(user => user && (user.id || user.userId || user.username))
        : [];
      
      state.connectedUsers = validUsers;
      console.log('Updated connectedUsers:', JSON.stringify(state.connectedUsers));
      
      // Preserva apenas cursores de usuários ainda conectados
      const connectedUserIds = new Set(
        validUsers.map(user => user.id || user.userId)
      );
      
      // Filtrar cursores para manter apenas usuários ainda conectados
      const updatedCursors = {};
      Object.entries(state.cursors).forEach(([userId, cursor]) => {
        // Manter o cursor do usuário atual e de usuários conectados
        if (userId === 'currentUser' || connectedUserIds.has(userId)) {
          updatedCursors[userId] = cursor;
        }
      });
      
      state.cursors = updatedCursors;
    },  
    removeUser: (state, action) => {
      // Filtrar por ID de usuário
      state.connectedUsers = state.connectedUsers.filter(user => {
        if (!user || !action.payload) return false;
        
        if (typeof action.payload === 'object') {
          return user.id !== action.payload.id && user.userId !== action.payload.userId;
        } else {
          return user.id !== action.payload && user.userId !== action.payload;
        }
      });
      
      // Remover cursor do usuário que saiu
      if (typeof action.payload === 'object' && action.payload.userId) {
        delete state.cursors[action.payload.userId];
      } else if (action.payload) {
        delete state.cursors[action.payload];
      }
      
      console.log('After removing user, connected users:', JSON.stringify(state.connectedUsers));
    },    
    updateCursor: (state, action) => {
      const { userId, username, position, selection, timestamp } = action.payload;
      
      console.log('Updating cursor in Redux:', action.payload);
      
      if (!userId) {
        console.log('No userId provided for cursor update');
        return;
      }
      
      // Atualizar cursor apenas se tiver posição válida
      if (position !== undefined && position !== null) {
        state.cursors[userId] = { 
          userId, 
          username, 
          position, 
          selection, 
          timestamp,
          lastUpdate: Date.now()
        };
        console.log('Cursor updated for user:', userId, 'Total cursors:', Object.keys(state.cursors).length);
      } else {
        console.log('Invalid position for cursor update:', position);
      }
    },
    removeCursor: (state, action) => {
      if (action.payload) {
        delete state.cursors[action.payload];
      }
    },
    clearCollaboration: (state) => {
      state.connectedUsers = [];
      state.currentRoom = null;
      state.cursors = {};
    },
    cleanupStaleCursors: (state) => {
      const now = Date.now();
      const staleTimeout = 30000; // 30 segundos
      
      // Filtrar cursores antigos
      Object.entries(state.cursors).forEach(([userId, cursor]) => {
        // Não remover o próprio cursor
        if (userId !== 'currentUser' && now - cursor.lastUpdate > staleTimeout) {
          delete state.cursors[userId];
        }
      });
    }
  },
});

export const {
  setConnected,
  setCurrentRoom,
  setUsers,
  removeUser,
  updateCursor,
  removeCursor,
  clearCollaboration,
  cleanupStaleCursors,
} = collaborationSlice.actions;

export default collaborationSlice.reducer;
