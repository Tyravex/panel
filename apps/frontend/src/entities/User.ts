export interface User {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  language: string;

  // Global panel roles assigned to the user.
  roles: string[];

  // Effective global permissions from all assigned roles.
  permissions: string[];

  createdAt: string;
  updatedAt?: string;
}