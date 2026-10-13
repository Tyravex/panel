import { Outlet } from "react-router-dom";
import { Sidebar } from "@/widgets/sidebar/Sidebar";
import { Navbar } from "@/widgets/navbar/ui/Navbar";

export const MainLayout = () => (
  <div className="flex min-h-screen bg-[#0b0f19] text-white">
    <Sidebar />

    <div className="flex flex-1 flex-col">
      <Navbar />

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  </div>
);