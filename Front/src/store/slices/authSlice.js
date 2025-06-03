import { createSlice } from '@reduxjs/toolkit';
import authService from '../../services/authService';

const initialState = {
  user: authService.getCurrentUser(),
  isAuthenticated: authService.isAuthenticated(),
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.error = null;
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.error = action.payload;
    },
    registerStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    registerSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.error = null;
    },
    registerFailure: (state, action) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.error = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    }
  }
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  registerStart,
  registerSuccess,
  registerFailure,
  logout,
  clearError,
  setUser
} = authSlice.actions;

// Async thunks
export const loginUser = (email, password) => async (dispatch) => {
  try {
    dispatch(loginStart());
    const response = await authService.login(email, password);
    dispatch(loginSuccess(response));
    return response;
  } catch (error) {
    dispatch(loginFailure(error.message));
    throw error;
  }
};

export const registerUser = (username, email, password) => async (dispatch) => {
  try {
    dispatch(registerStart());
    const response = await authService.register(username, email, password);
    dispatch(registerSuccess(response));
    return response;
  } catch (error) {
    dispatch(registerFailure(error.message));
    throw error;
  }
};

export const logoutUser = () => (dispatch) => {
  authService.logout();
  dispatch(logout());
};

export default authSlice.reducer;
