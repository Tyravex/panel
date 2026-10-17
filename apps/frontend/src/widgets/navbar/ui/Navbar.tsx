import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RefObject } from "react";

import { NotificationsDropdown } from "./NotificationsDropdown";
import { ProfileDropdown } from "./ProfileDropdown";

interface NavbarProps {
  onOpenMobileMenu: () => void;
  isMobileMenuOpen: boolean;
  mobileMenuTriggerRef: RefObject<HTMLButtonElement | null>;
}

export const Navbar = ({
  onOpenMobileMenu,
  isMobileMenuOpen,
  mobileMenuTriggerRef,
}: NavbarProps) => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface/95 backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {/* Mobile navigation trigger */}
          <button
            ref={mobileMenuTriggerRef}
            type="button"
            onClick={onOpenMobileMenu}
            aria-label={t("navigation.openMenu", {
              defaultValue: "Open navigation menu",
            })}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-sidebar"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-text-primary transition-colors hover:bg-white/10 lg:hidden"
          >
            <Menu size={22} aria-hidden="true" />
          </button>

          {/* Mobile branding */}
          <span className="truncate text-base font-bold tracking-tight text-text-primary lg:hidden">
            tyravex
          </span>

          {/* Desktop page heading */}
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-text-primary">
              {t("Navbar.Navigation.dashboard", {
                defaultValue: "Dashboard",
              })}
            </p>
            <p className="text-xs text-text-secondary">
              Tyravex Panel
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <NotificationsDropdown />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
};
