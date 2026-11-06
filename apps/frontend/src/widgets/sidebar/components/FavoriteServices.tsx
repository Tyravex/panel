import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Server } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getUserServices } from "@/features/services/api/services.api";

const storageKey = "tyravex.sidebar.favorite-service-ids";
function loadIds(): string[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(data) ? data.filter((v): v is string => typeof v === "string") : [];
  } catch { return []; }
}
export function FavoriteServices({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const [ids] = useState(loadIds);
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["services", "sidebar"], queryFn: getUserServices, staleTime: 30_000 });
  const favorites = useMemo(() => data.filter(service => ids.includes(service.id)), [data, ids]);
  const visible = showAll ? favorites : favorites.slice(0, 5);
  return (
    <section className="border-t border-border-subtle pt-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary hover:bg-white/5">
        <span className="flex-1">{t("sidebar.favorites.title")}</span>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open && <div className="space-y-1">
        {isLoading && <p className="px-3 py-2 text-xs text-text-secondary">{t("sidebar.favorites.loading")}</p>}
        {!isLoading && favorites.length === 0 && <p className="px-3 py-2 text-xs text-text-secondary">{t("sidebar.favorites.empty")}</p>}
        {visible.map(service => <NavLink key={service.id} to={`/services/${encodeURIComponent(service.id)}`}
          onClick={onNavigate} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Server size={17} /></span>
          <span className="min-w-0 flex-1 truncate">{service.name}</span>
        </NavLink>)}
        {favorites.length > 5 && <button type="button" onClick={() => setShowAll(v => !v)} className="px-3 py-2 text-xs text-primary">
          {showAll ? t("sidebar.favorites.showLess") : t("sidebar.favorites.showAll", { count: favorites.length })}
        </button>}
      </div>}
    </section>
  );
}
