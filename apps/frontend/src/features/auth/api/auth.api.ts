import { api } from "@/app/api/axios";

export const loginApi = (data: { usernameOrEmail: string; password: string }) =>
  api.post("/auth/login", data, { withCredentials: true });

export const registerApi = (data: { username: string; email: string; password: string }) =>
  api.post("/auth/register", data, { withCredentials: true });

export const meApi = () => api.get("/auth/me", { withCredentials: true });