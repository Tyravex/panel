import { loginApi } from "../api/auth.api";
import { useAuthStore } from "@/app/store/auth.store";

export const useAuth = () => {
  const setUser = useAuthStore((state) => state.setUser);

  const handleLogin = async (data: any) => {
    const res = await loginApi(data);
    const token = res.data.access_token || res.data.accessToken;

    if (token) {
      localStorage.setItem("token", token);
    }

    setUser(res.data.user);
  };

  return { login: handleLogin };
};