
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

export type ServiceInstallJobStatus =
  | 'PENDING'
  | 'DISPATCHING'
  | 'QUEUED'
  | 'RUNNING';

export interface ActiveServiceInstallJob {
  id: string;
  type: 'INSTALL';
  status: ServiceInstallJobStatus;
  progress: number;
  createdAt: string;
}

export const getUserServices = async (): Promise<UserService[]> => {
  const response = await api.get<UserService[]>('/services');
  return response.data;
};

export const getUserService = async (
  serviceId: string,
): Promise<UserService> => {
  const response = await api.get<UserService>(
    `/services/${encodeURIComponent(serviceId)}`,
  );

  return response.data;
};

export const getActiveServiceInstallJob = async (
  serviceId: string,
): Promise<ActiveServiceInstallJob | null> => {
  const response = await api.get<ActiveServiceInstallJob | null>(
    `/services/${encodeURIComponent(serviceId)}/jobs/active`,
  );

  return response.data;
};

export const createServiceInstallJob = async (
  serviceId: string,
): Promise<{ id: string }> => {
  const response = await api.post<{ id: string }>(
    `/services/${encodeURIComponent(serviceId)}/jobs`,
    { type: 'INSTALL' },
  );

  return response.data;
};
