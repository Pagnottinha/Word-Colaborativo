import { configureStore } from '@reduxjs/toolkit';
import documentReducer from './slices/documentSlice';
import documentsReducer from './slices/documentsSlice';
import collaborationReducer from './slices/collaborationSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    document: documentReducer,
    documents: documentsReducer,
    collaboration: collaborationReducer,
    auth: authReducer,
  },
});
