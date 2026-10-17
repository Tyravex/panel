// Demo-only filesystem entries. These are not stored on a server.
export type DemoFileEntry = {
  path: string;
  name: string;
  kind: "folder" | "file";
  size?: string;
  modified: string;
};

export const demoFileEntries: DemoFileEntry[] = [
  { path: "/plugins", name: "plugins", kind: "folder", modified: "2026-01-12" },
  { path: "/config", name: "config", kind: "folder", modified: "2026-01-12" },
  { path: "/logs", name: "logs", kind: "folder", modified: "2026-01-12" },
  { path: "/world", name: "world", kind: "folder", modified: "2026-01-12" },
  { path: "/server.properties", name: "server.properties", kind: "file", size: "1.2 KB", modified: "2026-01-12" },
  { path: "/eula.txt", name: "eula.txt", kind: "file", size: "9 B", modified: "2026-01-12" },
  { path: "/plugins/README.txt", name: "README.txt", kind: "file", size: "240 B", modified: "2026-01-12" },
  { path: "/config/settings.yml", name: "settings.yml", kind: "file", size: "850 B", modified: "2026-01-12" },
  { path: "/logs/latest.log", name: "latest.log", kind: "file", size: "2.4 KB", modified: "2026-01-12" },
];
