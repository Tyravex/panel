import { Outlet } from "react-router-dom";
import { TyravexLogo } from "@/pages/auth/LoginPage";

export const AuthLayout = () => (
  <div className="min-h-screen flex items-center justify-between bg-[#0f172a] text-white px-16">
    <div className="flex flex-col justify-center">
      <TyravexLogo />
    </div>
    <Outlet />
  </div>
);