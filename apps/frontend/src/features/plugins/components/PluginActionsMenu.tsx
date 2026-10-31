import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
    Ellipsis,
    Eye,
    Power,
    PowerOff,
    Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { PluginRecord } from '../api/pluginsApi';

interface PluginActionsMenuProps {
    plugin: PluginRecord;
    disabled?: boolean;
    onToggle: (plugin: PluginRecord) => void;
    onUninstall: (plugin: PluginRecord) => void;
}

interface MenuPosition {
    top: number;
    left: number;
}

const MENU_WIDTH = 208;
const MENU_GAP = 6;
const VIEWPORT_PADDING = 12;

export const PluginActionsMenu = ({
    plugin,
    disabled = false,
    onToggle,
    onUninstall,
}: PluginActionsMenuProps) => {
    const { t } = useTranslation();

    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<MenuPosition>({
        top: 0,
        left: 0,
    });

    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const firstItemRef = useRef<HTMLAnchorElement>(null);

    const canToggle =
        plugin.status === 'INSTALLED' ||
        plugin.status === 'DISABLED';

    const canUninstall =
        plugin.status === 'INSTALLED' ||
        plugin.status === 'DISABLED' ||
        plugin.status === 'FAILED';

    const isEnabled = plugin.status === 'INSTALLED';

    const updatePosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const menuHeight =
            menuRef.current?.offsetHeight ?? 150;

        const left = Math.max(
            VIEWPORT_PADDING,
            Math.min(
                rect.right - MENU_WIDTH,
                window.innerWidth -
                MENU_WIDTH -
                VIEWPORT_PADDING,
            ),
        );

        const spaceBelow =
            window.innerHeight - rect.bottom;

        const shouldOpenAbove =
            spaceBelow < menuHeight + MENU_GAP &&
            rect.top > menuHeight + MENU_GAP;

        const top = shouldOpenAbove
            ? rect.top - menuHeight - MENU_GAP
            : rect.bottom + MENU_GAP;

        setPosition({
            left,
            top: Math.max(VIEWPORT_PADDING, top),
        });
    };

    useLayoutEffect(() => {
        if (!open) return;

        updatePosition();
        firstItemRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;

            if (
                !triggerRef.current?.contains(target) &&
                !menuRef.current?.contains(target)
            ) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        const handleViewportChange = () => {
            updatePosition();
        };

        document.addEventListener(
            'pointerdown',
            handlePointerDown,
        );
        document.addEventListener(
            'keydown',
            handleKeyDown,
        );

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener(
            'scroll',
            handleViewportChange,
            true,
        );

        return () => {
            document.removeEventListener(
                'pointerdown',
                handlePointerDown,
            );
            document.removeEventListener(
                'keydown',
                handleKeyDown,
            );

            window.removeEventListener(
                'resize',
                handleViewportChange,
                true,
            );
        };
    }, [open]);

    useEffect(() => {
        if (disabled) {
            setOpen(false);
        }
    }, [disabled]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={t('adminPlugins.actions.open')}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled}
                onClick={() => setOpen((value) => !value)}
                className={[
                    'inline-flex h-9 w-9 items-center justify-center',
                    'rounded-lg border border-transparent',
                    'text-text-secondary transition-colors',
                    'hover:border-white/10 hover:bg-white/[0.06]',
                    'hover:text-text-primary',
                    'focus-visible:outline focus-visible:outline-2',
                    'focus-visible:outline-offset-2 focus-visible:outline-primary',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    open
                        ? 'border-white/10 bg-white/[0.08] text-text-primary'
                        : '',
                ].join(' ')}
            >
                <Ellipsis size={19} aria-hidden="true" />
            </button>

            {open &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        aria-label={t('adminPlugins.actions.open')}
                        style={{
                            position: 'fixed',
                            top: position.top,
                            left: position.left,
                            width: MENU_WIDTH,
                            zIndex: 1000,
                        }}
                        className={[
                            'rounded-xl border border-white/10',
                            'bg-[#171b26] p-1.5 shadow-2xl',
                            'ring-1 ring-black/20',
                        ].join(' ')}
                    >
                        <Link
                            ref={firstItemRef}
                            role="menuitem"
                            to={`/admin/plugins/${encodeURIComponent(plugin.id)}`}
                            onClick={() => setOpen(false)}
                            className={[
                                'flex items-center gap-3 rounded-lg',
                                'px-3 py-2.5 text-sm',
                                'text-text-primary transition-colors',
                                'hover:bg-white/[0.07]',
                                'focus:bg-white/[0.07] focus:outline-none',
                            ].join(' ')}
                        >
                            <Eye
                                size={16}
                                className="text-text-secondary"
                                aria-hidden="true"
                            />
                            {t('adminPlugins.actions.details')}
                        </Link>

                        <div
                            role="separator"
                            className="my-1 h-px bg-white/10"
                        />

                        <button
                            type="button"
                            role="menuitem"
                            disabled={!canToggle || disabled}
                            onClick={() => {
                                setOpen(false);
                                onToggle(plugin);
                            }}
                            className={[
                                'flex w-full items-center gap-3 rounded-lg',
                                'px-3 py-2.5 text-left text-sm',
                                'transition-colors',
                                'hover:bg-white/[0.07]',
                                'focus:bg-white/[0.07] focus:outline-none',
                                'disabled:cursor-not-allowed',
                                'disabled:opacity-40',
                                isEnabled
                                    ? 'text-amber-300'
                                    : 'text-emerald-300',
                            ].join(' ')}
                        >
                            {isEnabled ? (
                                <PowerOff
                                    size={16}
                                    aria-hidden="true"
                                />
                            ) : (
                                <Power
                                    size={16}
                                    aria-hidden="true"
                                />
                            )}

                            {t(
                                isEnabled
                                    ? 'adminPlugins.actions.disable'
                                    : 'adminPlugins.actions.enable',
                            )}
                        </button>

                        <div
                            role="separator"
                            className="my-1 h-px bg-white/10"
                        />

                        <button
                            type="button"
                            role="menuitem"
                            disabled={!canUninstall || disabled}
                            onClick={() => {
                                setOpen(false);
                                onUninstall(plugin);
                            }}
                            className={[
                                'flex w-full items-center gap-3 rounded-lg',
                                'px-3 py-2.5 text-left text-sm',
                                'text-red-400 transition-colors',
                                'hover:bg-red-500/10',
                                'focus:bg-red-500/10 focus:outline-none',
                                'disabled:cursor-not-allowed',
                                'disabled:opacity-40',
                            ].join(' ')}
                        >
                            <Trash2
                                size={16}
                                aria-hidden="true"
                            />
                            {t('adminPlugins.actions.uninstall')}
                        </button>
                    </div>,
                    document.body,
                )}
        </>
    );
};