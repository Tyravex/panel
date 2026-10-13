import axios from 'axios';

// Axios instance used across the app
export const api = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  return config;
});