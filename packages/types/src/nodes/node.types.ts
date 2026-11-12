export type NodeStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';

export interface NodeRecord {
  id: string;
  name: string;
  status: NodeStatus;
  regionId: string | null;
  locationId: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}
