import { useEffect, useState } from 'react';
import { getAdminUsers, type AdminUser } from '@/features/admin-users/api/admin-users.api';

type Props = {
    value: number | null;
    onChange: (value: number | null) => void;
    disabled?: boolean;
    currentOwner?: { id: number; username: string } | null;
};

const inputClass = 'w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3';
const selectClass = `${inputClass} bg-surface text-text-primary [color-scheme:dark] [&_option]:bg-[#151a27] [&_option]:text-white`;

export const ServiceOwnerPicker = ({ value, onChange, disabled = false, currentOwner }: Props) => {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [selected, setSelected] = useState<AdminUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);
            getAdminUsers(1, query.trim(), 'active', controller.signal)
                .then((response) => {
                    if (!controller.signal.aborted) {
                        setUsers(response.items.filter((user) => user.isActive));
                        setError('');
                    }
                })
                .catch(() => {
                    if (!controller.signal.aborted) setError('Nie udało się pobrać użytkowników. Wymagane uprawnienie user:read.');
                })
                .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        }, 250);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [query]);

    const chosen = users.find((user) => user.id === value) ?? (selected?.id === value ? selected : null);
    const fallback = value !== null && currentOwner?.id === value ? currentOwner.username : null;

    return (
        <div className="space-y-2">
            <input
                type="search"
                aria-label="Szukaj użytkownika po nazwie lub e-mailu"
                placeholder="Szukaj po nazwie lub e-mailu..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={disabled}
                className={inputClass}
            />
            <select
                aria-label="Wybierz właściciela usługi"
                value={value === null ? '' : String(value)}
                onChange={(event) => {
                    const next = event.target.value === '' ? null : Number(event.target.value);
                    setSelected(users.find((user) => user.id === next) ?? null);
                    onChange(next);
                }}
                disabled={disabled || loading || Boolean(error)}
                className={selectClass}
            >
                <option value="">Bez właściciela</option>
                {value !== null && !users.some((user) => user.id === value) && (
                    <option value={value}>{chosen ? `${chosen.username} — ${chosen.email}` : fallback ? `${fallback} (#${value})` : `Użytkownik #${value}`}</option>
                )}
                {users.map((user) => (
                    <option key={user.id} value={user.id}>
                        {user.username} — {user.email} (#{user.id})
                    </option>
                ))}
            </select>
            {loading && <p className="text-xs text-text-secondary">Ładowanie użytkowników...</p>}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {!loading && !error && users.length === 0 && <p className="text-xs text-text-secondary">Brak aktywnych użytkowników dla tego wyszukiwania.</p>}
            {value !== null && <p className="text-xs text-text-secondary">Wybrano: {chosen ? `${chosen.username} (${chosen.email})` : fallback ?? `#${value}`}</p>}
        </div>
    );
};
