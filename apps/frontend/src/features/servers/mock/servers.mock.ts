import type { UserServer } from "../api/servers.api";

export interface PreviewServer extends UserServer {
  game: string;
  version: string;
  players: number;
  maxPlayers: number;
  image: string;
}

// Preview data used only for frontend development.
// These records do not exist in the database.
export const previewServers: PreviewServer[] = [
  {
    id: 10001,
    name: "Minecraft Survival",
    status: "online",
    game: "Minecraft",
    version: "1.21.4",
    players: 12,
    maxPlayers: 100,
    image: "/images/games/minecraft.png",
  },
  {
    id: 10002,
    name: "FiveM Roleplay",
    status: "maintenance",
    game: "FiveM",
    version: "v1.0.0",
    players: 24,
    maxPlayers: 128,
    image: "/images/games/fivem.png",
  },
  {
    id: 10003,
    name: "CS2 Competitive",
    status: "offline",
    game: "Counter-Strike 2",
    version: "1.40.6.0",
    players: 5,
    maxPlayers: 64,
    image: "/images/games/cs2.png",
  },
  {
    id: 10004,
    name: "Rust Community",
    status: "maintenance",
    game: "Rust",
    version: "1995",
    players: 18,
    maxPlayers: 100,
    image: "/images/games/rust.png",
  },
  {
    id: 10005,
    name: "ARK Survival",
    status: "online",
    game: "ARK: Survival Evolved",
    version: "358.25",
    players: 32,
    maxPlayers: 70,
    image: "/images/games/ark.png",
  },
  {
    id: 10006,
    name: "Valheim Server",
    status: "offline",
    game: "Valheim",
    version: "0.218.16",
    players: 6,
    maxPlayers: 32,
    image: "/images/games/valheim.png",
  },
];
