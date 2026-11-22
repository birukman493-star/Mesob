import axios from 'axios';

// Base URL defaults to the port defined in the server .env (PORT=4001)
// You can override with REACT_APP_API_URL env variable if needed.
const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:4001';

const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mesob_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
