export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar: string | null;
  language: string;

  // Global panel roles assigned to the user.
  roles: string[];

  // Effective global permissions from all assigned roles.
  permissions: string[];

  createdAt: string;
  updatedAt?: string;
}