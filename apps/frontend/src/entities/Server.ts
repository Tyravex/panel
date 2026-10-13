export interface Server {
  id?: string;
  name: string;
  status: "online" | "offline";
  players: number;
  cpu: number;
  ram: number;
}