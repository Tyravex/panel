
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/api/axios";

type ServerDetails = {
  name: string;
  status: string;
  players: number;
  cpu: number;
  ram: number;
};

export const ServerDetailsPage = () => {
  const { id } = useParams<{ id: string }>();

  const { data: server, isLoading } = useQuery<ServerDetails>({
    queryKey: ["server", id],
    queryFn: async () => {
      const res = await api.get<ServerDetails>(`/servers/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  if (isLoading) return <div>Loading server...</div>;
  if (!server) return <div>Server not found</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">{server.name}</h1>
      <p>Status: {server.status}</p>
      <p>Players: {server.players}</p>
      <p>CPU: {server.cpu}%</p>
      <p>RAM: {server.ram}MB</p>
    </div>
  );
};
