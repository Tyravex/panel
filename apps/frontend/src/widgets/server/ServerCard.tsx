import { Server } from "@/entities/Server";

interface ServerCardProps {
  server: Server;
}

export const ServerCard = ({ server }: ServerCardProps) => (
  <div className="border border-white/10 p-4 rounded-xl bg-white/5 backdrop-blur hover:scale-105 transition-transform">
    <h2 className="text-xl font-bold">{server.name}</h2>
    <p>Status: {server.status}</p>
    <p>Players: {server.players}</p>
    <p>CPU: {server.cpu}%</p>
    <p>RAM: {server.ram}MB</p>
  </div>
);