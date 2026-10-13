import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useUser } from "@/shared/store/user";
import { useLogout } from "@/features/auth/model/useLogout";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from './LanguageSwitcher';

export const ProfileDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const { user} = useUser();
    const { logout } = useLogout();
    const { t } = useTranslation();
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!ref.current) return;

            if (ref.current.contains(e.target as Node)) return;

            setIsOpen(false);
        };

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };

        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleEsc);

        return () => {
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, []);

    return (
        <div ref={ref} className="relative">
            {/* Avatar + dropdown trigger */}
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700"
            >
                <img
                    //src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || "User")}`}
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || "User")}`}
                    alt="User Avatar"
                    className="w-6 h-6 rounded-full"
                />
                <span>{user?.username}</span>
                <ChevronDown
                    className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-gray-800 text-white rounded shadow-lg z-50 flex flex-col gap-2 p-2"
                >
                    {/* PROFILE */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2f4a]">
                        <img
                            //src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || "User")}`}
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || "User")}`}
                            className="w-8 h-8 rounded-full"
                        />
                        <div>
                            <div className="text-sm font-medium">{user?.username}</div>
                            <div className="text-xs text-gray-400">{user?.email}</div>
                        </div>
                    </div>
                    {/* LANGUAGE */}
                    <LanguageSwitcher />
                    {/* SETTINGS */}
                    <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">{t("Navbar.ProfileDropdown.settings")}</div>
                        <div
                            onClick={() => navigate("/settings")}
                            className="p-2 hover:bg-[#2a2f4a] rounded cursor-pointer"
                        >
                            {t("Navbar.ProfileDropdown.settings")}
                        </div>

                    </div>

                    <button
                        onClick={logout}
                        className="p-2 hover:bg-[#2a2f4a] rounded cursor-pointer text-red-400"
                    >
                        {t("Navbar.ProfileDropdown.logout")}
                    </button>
                </motion.div>
            )}
        </div>
    );
};