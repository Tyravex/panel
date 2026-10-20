import {
    useEffect,
    useId,
    useRef,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    busy?: boolean;
    destructive?: boolean;
};

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const ConfirmDialog = ({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
    onCancel,
    busy = false,
    destructive = false,
}: ConfirmDialogProps) => {
    const { t } = useTranslation();

    const titleId = useId();
    const descriptionId = useId();

    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const onCancelRef = useRef(onCancel);
    const busyRef = useRef(busy);

    useEffect(() => {
        onCancelRef.current = onCancel;
        busyRef.current = busy;
    }, [onCancel, busy]);

    useEffect(() => {
        if (!open) return;

        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        // Fokus początkowy na bezpiecznej akcji.
        cancelButtonRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();

                if (!busyRef.current) {
                    onCancelRef.current();
                }

                return;
            }

            if (event.key !== 'Tab') return;

            const dialog = dialogRef.current;
            if (!dialog) return;

            const focusable = Array.from(
                dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            ).filter((element) => {
                return (
                    element.getClientRects().length > 0 &&
                    !element.hasAttribute('disabled')
                );
            });

            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey) {
                if (active === first || !dialog.contains(active)) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (active === last || !dialog.contains(active)) {
                event.preventDefault();
                first.focus();
            }
        };

        // capture=true pomaga zatrzymać Tab przed obsługą przez inne elementy.
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            document.body.style.overflow = previousOverflow;

            const previous = previousFocusRef.current;

            if (previous?.isConnected) {
                previous.focus();
            }
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (
                    event.target === event.currentTarget &&
                    !busy
                ) {
                    onCancel();
                }
            }}
        >
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl outline-none"
            >
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className={
                                destructive
                                    ? 'rounded-xl bg-red-500/10 p-3 text-red-400'
                                    : 'rounded-xl bg-amber-500/10 p-3 text-amber-400'
                            }
                        >
                            <AlertTriangle size={22} aria-hidden="true" />
                        </div>

                        <h2
                            id={titleId}
                            className="text-xl font-semibold"
                        >
                            {title}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        aria-label={t('common.close')}
                        className="rounded-lg p-2 text-text-secondary transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div
                    id={descriptionId}
                    className="mb-7 text-sm leading-relaxed text-text-secondary"
                >
                    {description}
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        ref={cancelButtonRef}
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-xl border border-border-subtle px-5 py-2.5 font-medium transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
                    >
                        {t('common.cancel')}
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={
                            destructive
                                ? 'rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-40'
                                : 'rounded-xl bg-primary px-5 py-2.5 font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40'
                        }
                    >
                        {busy ? t('common.saving') : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};