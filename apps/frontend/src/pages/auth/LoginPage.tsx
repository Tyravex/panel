import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi, meApi } from "@/features/auth/api/auth.api";

export const TyravexLogo = () => (
  <div className="flex items-center gap-4">
    <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center text-2xl font-bold">T</div>
    <h1 className="text-6xl font-bold tracking-tight">tyravex</h1>
  </div>
);

export const LoginPage = () => {
  const navigate = useNavigate();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: any) => {
    e.preventDefault();
    try {
      await loginApi({ usernameOrEmail, password });
      await meApi();
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 shadow-xl">
      <h2 className="text-xl mb-4">Login</h2>
      <form onSubmit={submit} className="text-2xl font-semibold mb-6">
        <div className="space-y-4">
          <input placeholder="Username or email" value={usernameOrEmail} onChange={e => setUsernameOrEmail(e.target.value)} className="w-full rounded-lg bg-white/10 p-3 outline-none" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg bg-white/10 p-3 outline-none" />
          <button className="w-full rounded-lg bg-white text-black p-3 font-semibold">Login</button>
        </div>
      </form>
    </div>
  );
};