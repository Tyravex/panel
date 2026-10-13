import { NavLink } from "react-router-dom";

export const Sidebar = () => (
  <aside className="w-64 bg-[#0f172a] p-6 flex flex-col gap-4">
    <NavLink to="/dashboard" className="hover:text-cyan-400">Dashboard</NavLink>
    <NavLink to="/profile" className="hover:text-cyan-400">Profile</NavLink>
    <NavLink to="/settings" className="hover:text-cyan-400">Settings</NavLink>
  </aside>
);