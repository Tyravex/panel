import { Server } from "@/entities/Server";

interface Props {
  server: Server;
}

const ServerCard = ({ server }: Props) => (
  <div className="bg-[#111827] p-4 rounded-xl border border-white/10">
    <h3 className="font-bold">{server.name}</h3>
    <p>Status: {server.status}</p>
    <p>Players: {server.players}</p>
    <p>CPU: {server.cpu}%</p>
    <p>RAM: {server.ram}%</p>
  </div>
);

export default ServerCard;