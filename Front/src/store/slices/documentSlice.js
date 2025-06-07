import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentDocument: null,
  content: '',
  title: '',
  isLoading: false,
  error: null,
};

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {    
    setCurrentDocument: (state, action) => {
      state.currentDocument = action.payload;
      state.content = action.payload?.content || '';
      state.title = action.payload?.title || '';
      state.error = null;
      // Log para debug
      console.log('Setting current document in Redux:', action.payload);
    },
    updateContent: (state, action) => {
      state.content = action.payload;
    },
    updateTitle: (state, action) => {
      state.title = action.payload;
    },    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearDocument: (state) => {
      state.currentDocument = null;
      state.content = '';
      state.title = '';
      state.error = null;
    },
  },
});

export const {
  setCurrentDocument,
  updateContent,
  updateTitle,
  setLoading,
  setError,
  clearDocument,
} = documentSlice.actions;

export default documentSlice.reducer;
