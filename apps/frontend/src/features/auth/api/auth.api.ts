import { api } from '@/shared/api/client';

export const loginApi = (data: {
  usernameOrEmail: string;
  password: string;
}) => api.post('/auth/login', data);

export const registerApi = (data: {
  username: string;
  email: string;
  password: string;
}) => api.post('/auth/register', data);

export const meApi = () => api.get('/auth/me');