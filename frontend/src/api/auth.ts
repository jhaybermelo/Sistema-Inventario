import api from './client';
import type { User } from '../types';

export const login = async (username: string, password: string) => {
  const res = await api.post<{ access_token: string; token_type: string }>('/auth/login', {
    username,
    password,
  });
  return res.data;
};

export const getMe = async (): Promise<User> => {
  const res = await api.get<User>('/auth/me');
  return res.data;
};
