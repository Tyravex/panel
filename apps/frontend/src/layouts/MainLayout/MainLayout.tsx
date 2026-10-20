import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router-dom";
import { X } from "lucide-react";

import { Sidebar } from "@/widgets/sidebar/Sidebar";
import { Navbar } from "@/widgets/navbar/ui/Navbar";
import { Footer } from "@/widgets/footer/Footer";

export const MainLayout = () => {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu when the route changes.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Manage keyboard focus and prevent background scrolling.
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const menu = mobileMenuRef.current;
    const trigger = menuTriggerRef.current;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusableElements = () =>
      Array.from(
        menu?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => element.getClientRects().length > 0);

    getFocusableElements()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const elements = getFocusableElements();

      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);

      // Restore focus only when the trigger is visible.
      if (trigger?.getClientRects().length) {
        trigger.focus();
      }
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            isMobileMenuOpen={isMobileMenuOpen}
            mobileMenuTriggerRef={menuTriggerRef}
          />

          <main
            id="main-content"
            className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8"
          >
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet />
            </div>
          </main>

          <Footer />
        </div>
      </div>

      {/* Mobile navigation dialog */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="presentation"
        >
          <button
            type="button"
            aria-label={t("layout.navigation.closeMenu")}
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/70"
          />

          <div
            ref={mobileMenuRef}
            id="mobile-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label={t("layout.navigation.menu")}
            className="absolute inset-y-0 left-0 w-64 max-w-[85vw] shadow-2xl"
          >
            <Sidebar
              mobile
              onNavigate={() => setIsMobileMenuOpen(false)}
            />

            <button
              type="button"
              aria-label={t("layout.navigation.closeMenu")}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};