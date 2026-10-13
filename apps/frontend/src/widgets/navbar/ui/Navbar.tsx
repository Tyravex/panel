import { ProfileDropdown } from "./ProfileDropdown";
import { NotificationsDropdown } from './NotificationsDropdown';
import { useTranslation } from "react-i18next";

export const Navbar = () => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-between items-center p-4 bg-[#0f1424]">
      <span className="text-sm text-gray-300">{t("Navbar.Navigation.dashboard")}</span>
      <div className="flex items-center gap-6">
        <NotificationsDropdown />
        <ProfileDropdown />
      </div>
    </div>
  );
};