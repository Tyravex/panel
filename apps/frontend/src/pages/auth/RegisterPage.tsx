import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerApi } from "@/features/auth/api/auth.api";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: any) => {
    e.preventDefault();
    try {
      await registerApi({ username, email, password });
      navigate("/login");
    } catch (err: any) {
      console.error("Registration error:", err);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 shadow-xl">
      <h2 className="text-xl mb-4">Register</h2>
      <form onSubmit={submit} className="space-y-4">
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="w-full rounded-lg bg-white/10 p-3 outline-none" />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg bg-white/10 p-3 outline-none" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg bg-white/10 p-3 outline-none" />
        <button className="w-full rounded-lg bg-white text-black p-3 font-semibold">Register</button>
      </form>
    </div>
  );
};