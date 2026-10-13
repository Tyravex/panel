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
  id: string;
  username: string;
  email: string;
  avatar?: String;

  language?: string;
  role?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role?: string;
}
