import { api } from "@/shared/api/client";

export interface UserServer {
  id: number;
  name: string;
  status?: string | null;
  createdAt?: string;
}

export const getUserServers = async (): Promise<UserServer[]> => {
  const response = await api.get<UserServer[]>("/servers");

  return response.data;
};

export const getUserServer = async (
  serverId: number,
): Promise<UserServer> => {
  const response = await api.get<UserServer>(
    `/servers/${serverId}`,
  );

  return response.data;
};
