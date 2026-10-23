import { api } from '@/shared/api/client';

export interface ServiceCategory {
  key: string;
  name: string;
}

export interface UserService {
  id: string;
  name: string;
  userId: number | null;
  categoryId: string;
  category: ServiceCategory;
  serverId: number | null;
  server: { id: number; status: string } | null;
  installStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export const getUserServices = async (): Promise<UserService[]> => {
  const response = await api.get<UserService[]>('/services');
  return response.data;
};
