import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    pluginsApi,
    type PluginRecord,
} from '../api/pluginsApi';

interface PluginUninstallModalProps {
    plugin: PluginRecord | null;
    onClose: () => void;
    onChanged: () => void;
}

type UninstallErrorKey =
    | 'badRequest'
    | 'unauthorized'
    | 'forbidden'
    | 'notFound'
    | 'conflict'
    | 'generic';

const getErrorKey = (error: unknown): UninstallErrorKey => {
    if (!axios.isAxiosError(error)) {
        return 'generic';
    }

    switch (error.response?.status) {
        case 400:
            return 'badRequest';
        case 401:
            return 'unauthorized';
        case 403:
            return 'forbidden';
        case 404:
            return 'notFound';
        case 409:
            return 'conflict';
        default:
            return 'generic';
    }
};

export const PluginUninstallModal = ({
    plugin,
    onClose,
    onChanged,
}: PluginUninstallModalProps) => {
    const { t } = useTranslation();

    const [confirmation, setConfirmation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorKey, setErrorKey] =
        useState<UninstallErrorKey | null>(null);
    const [cleanupPending, setCleanupPending] =
        useState(false);

    useEffect(() => {
        setConfirmation('');
        setErrorKey(null);
        setCleanupPending(false);
    }, [plugin?.id]);

    useEffect(() => {
        if (!plugin || submitting || cleanupPending) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener(
                'keydown',
                handleEscape,
            );
        };
    }, [plugin, submitting, cleanupPending, onClose]);

    if (!plugin) {
        return null;
    }

    const confirmed = confirmation === plugin.id;

    const handleSubmit = async () => {
        if (!confirmed || submitting || cleanupPending) {
            return;
        }

        setSubmitting(true);
        setErrorKey(null);

        try {
            const result = await pluginsApi.uninstall(
                plugin.id,
                confirmation,
            );

            onChanged();

            if (result.cleanupPending) {
                setCleanupPending(true);
                return;
            }

            onClose();
        } catch (error) {
            setErrorKey(getErrorKey(error));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onMouseDown={(event) => {
                if (
                    event.target === event.currentTarget &&
                    !submitting
                ) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="plugin-uninstall-title"
                className="w-full max-w-md rounded-2xl border border-border-subtle bg-[#171b26] p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Trash2
                            size={22}
                            className="text-red-400"
                        />

                        <h2
                            id="plugin-uninstall-title"
                            className="text-xl font-semibold"
                        >
                            {t('adminPlugins.uninstall.title')}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        aria-label={t(
                            'adminPlugins.uninstall.close',
                        )}
                        className="rounded-lg p-1 text-text-secondary hover:bg-white/10 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="mt-4 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <AlertTriangle
                        size={20}
                        className="mt-0.5 shrink-0 text-amber-400"
                    />

                    <p className="text-sm text-amber-100">
                        {t(
                            'adminPlugins.uninstall.warning',
                        )}
                    </p>
                </div>

                <p className="mt-5 text-sm text-text-secondary">
                    {t(
                        'adminPlugins.uninstall.description',
                    )}
                </p>

                <p className="mt-2 break-all rounded-lg border border-border-subtle bg-black/20 px-3 py-2 font-mono text-sm">
                    {plugin.id}
                </p>

                {!cleanupPending && (
                    <>
                        <label
                            htmlFor="plugin-uninstall-confirmation"
                            className="mt-5 block text-sm font-medium"
                        >
                            {t(
                                'adminPlugins.uninstall.confirmLabel',
                            )}
                        </label>

                        <input
                            id="plugin-uninstall-confirmation"
                            type="text"
                            value={confirmation}
                            disabled={submitting}
                            onChange={(event) => {
                                setConfirmation(
                                    event.target.value,
                                );
                                setErrorKey(null);
                            }}
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            placeholder={t(
                                'adminPlugins.uninstall.confirmPlaceholder',
                            )}
                            className="mt-2 w-full rounded-xl border border-border-subtle bg-black/20 px-4 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
                        />
                    </>
                )}

                {errorKey && (
                    <div
                        role="alert"
                        className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                    >
                        {t(
                            `adminPlugins.uninstall.errors.${errorKey}`,
                        )}
                    </div>
                )}

                {cleanupPending && (
                    <div
                        role="status"
                        className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"
                    >
                        {t(
                            'adminPlugins.uninstall.cleanupPending',
                        )}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onClose}
                        className="rounded-xl border border-border-subtle px-4 py-2 text-sm disabled:opacity-50"
                    >
                        {t(
                            cleanupPending
                                ? 'adminPlugins.uninstall.close'
                                : 'adminPlugins.uninstall.cancel',
                        )}
                    </button>

                    {!cleanupPending && (
                        <button
                            type="button"
                            disabled={
                                submitting || !confirmed
                            }
                            onClick={() =>
                                void handleSubmit()
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting ? (
                                <Loader2
                                    size={16}
                                    className="animate-spin"
                                />
                            ) : (
                                <Trash2 size={16} />
                            )}

                            {t(
                                submitting
                                    ? 'adminPlugins.uninstall.processing'
                                    : 'adminPlugins.uninstall.confirm',
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};