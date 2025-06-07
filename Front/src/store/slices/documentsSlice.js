import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  ownDocuments: [],
  sharedDocuments: [],
  publicDocuments: [],
  isLoading: true, // Começar carregando
  error: null,
};

const documentsSlice = createSlice({
  name: 'documents',
  initialState,  
  reducers: {    
    setDocuments: (state, action) => {
      const { ownDocuments = [], sharedDocuments = [], publicDocuments = [] } = action.payload;
      state.ownDocuments = ownDocuments;
      state.sharedDocuments = sharedDocuments;
      state.publicDocuments = publicDocuments;
      state.isLoading = false;
      state.error = null;
    },
    addDocument: (state, action) => {
      // Verificar se o documento já existe para evitar duplicatas
      const exists = state.ownDocuments.find(doc => doc.id === action.payload.id);
      if (!exists) {
        state.ownDocuments.unshift(action.payload); // Adicionar no início da lista
      }
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setDocuments,
  addDocument,
  setLoading,
  setError,
  clearError,
} = documentsSlice.actions;

export default documentsSlice.reducer;
