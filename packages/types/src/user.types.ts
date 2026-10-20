export interface AuthLoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  user: UserDTO;
}

export interface UserDTO {
  id: number;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;

  language?: string;

  // Global panel roles loaded from the database.
  roles: string[];

  // Combined permissions from all assigned global roles.
  permissions: string[];

  createdAt: Date;
  updatedAt?: Date;
}

export interface JWTPayload {
  sub: string | number;
  email?: string;
  // Distinguishes access tokens from refresh tokens.
  tokenType?: 'access' | 'refresh';
  // Server-side session identifier.
  sid?: string;
}