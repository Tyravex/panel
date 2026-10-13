import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useNotificationStore } from "@/features/notifications/model/notifications.store";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

export const NotificationsDropdown = () => {
  const { notifications } = useNotificationStore();
  const { markAsReadHandler } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatDate = (date: string | number) => {
    const d = typeof date === 'number' ? new Date(date) : new Date(Date.parse(date));
    return isNaN(d.getTime()) ? '-' : d.toLocaleString();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
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
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-1 rounded-full hover:bg-gray-700 transition"
      >
        <Bell className="w-6 h-6 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full px-1.5">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-gray-800 text-gray-200 shadow-lg rounded-xl border border-gray-700 z-50 flex flex-col"
          >
            {notifications.length === 0 && (
              <div className="p-3 text-gray-400 text-sm">
                {t("Navbar.Notifications.noNotifications")}
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={`${n.id}-${n.createdAt}`}
                onClick={() => markAsReadHandler(n.id)}
                className={`p-3 cursor-pointer border-b border-gray-700 last:border-b-0 hover:bg-gray-700 transition ${!n.read ? "bg-gray-700 font-medium" : ""
                  }`}
              >
                <p className="text-gray-200">{n.content}</p>
                <p className="text-xs text-gray-400">
                  {formatDate(n.createdAt)}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};