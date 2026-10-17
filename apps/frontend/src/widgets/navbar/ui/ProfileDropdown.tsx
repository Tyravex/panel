
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";

import { useUser } from "@/shared/store/user";
import { useLogout } from "@/features/auth/model/useLogout";

import { LanguageSwitcher } from "./LanguageSwitcher";

export const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const user = useUser((state) => state.user);
  const { logout } = useLogout();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeAndNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const initials = (user?.username || "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="profile-dropdown"
        aria-label={t("profile.menu", {
          defaultValue: "User menu",
        })}
        className="flex min-h-10 items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
          {initials}
        </span>

        <span className="hidden max-w-32 truncate text-sm font-medium text-text-primary sm:block">
          {user?.username || "User"}
        </span>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={[
            "hidden text-text-secondary transition-transform sm:block",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {isOpen && (
        <div
          id="profile-dropdown"
          className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-subtle bg-surface-elevated p-2 shadow-2xl"
        >
          {/* Account information */}
          <div className="flex items-center gap-3 border-b border-border-subtle px-3 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
              {initials}
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {user?.username || "User"}
              </p>
              <p className="truncate text-xs text-text-secondary">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Account navigation */}
          <div className="space-y-1 py-2">
            <button
              type="button"
              onClick={() => closeAndNavigate("/profile")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              <UserRound size={17} aria-hidden="true" />
              {t("sidebar.profile", {
                defaultValue: "Profile",
              })}
            </button>

            <button
              type="button"
              onClick={() => closeAndNavigate("/settings")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              <Settings size={17} aria-hidden="true" />
              {t("sidebar.settings", {
                defaultValue: "Settings",
              })}
            </button>
          </div>

          {/* Language selection */}
          <div className="border-t border-border-subtle px-2 py-3">
            <LanguageSwitcher />
          </div>

          {/* Logout */}
          <div className="border-t border-border-subtle pt-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
            >
              <LogOut size={17} aria-hidden="true" />
              {t("Navbar.ProfileDropdown.logout", {
                defaultValue: "Logout",
              })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
