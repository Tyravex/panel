import { useEffect, useState } from 'react';
import axios from 'axios';
import { Power, PowerOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    pluginsApi,
    type PluginRecord,
} from '../api/pluginsApi';

interface PluginToggleModalProps {
    plugin: PluginRecord | null;
    onClose: () => void;
    onChanged: () => void;
}

const getErrorKey = (error: unknown): string => {
    if (!axios.isAxiosError(error)) {
        return 'generic';
    }

    switch (error.response?.status) {
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

export const PluginToggleModal = ({
    plugin,
    onClose,
    onChanged,
}: PluginToggleModalProps) => {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [errorKey, setErrorKey] = useState<string | null>(
        null,
    );

    const isEnabled = plugin?.status === 'INSTALLED';

    useEffect(() => {
        setErrorKey(null);
    }, [plugin?.id, plugin?.status]);

    useEffect(() => {
        if (!plugin || submitting) {
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
    }, [plugin, submitting, onClose]);

    if (!plugin) {
        return null;
    }

    const handleSubmit = async () => {
        if (submitting) {
            return;
        }

        setSubmitting(true);
        setErrorKey(null);

        try {
            if (isEnabled) {
                await pluginsApi.disable(plugin.id);
            } else {
                await pluginsApi.enable(plugin.id);
            }

            onChanged();
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
                aria-labelledby="plugin-toggle-title"
                className="w-full max-w-md rounded-2xl border border-border-subtle bg-[#171b26] p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {isEnabled ? (
                            <PowerOff
                                size={22}
                                className="text-amber-400"
                            />
                        ) : (
                            <Power
                                size={22}
                                className="text-green-400"
                            />
                        )}

                        <h2
                            id="plugin-toggle-title"
                            className="text-xl font-semibold"
                        >
                            {t(
                                isEnabled
                                    ? 'adminPlugins.toggle.disableTitle'
                                    : 'adminPlugins.toggle.enableTitle',
                            )}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        aria-label={t('adminPlugins.toggle.cancel')}
                        className="rounded-lg p-1 text-text-secondary hover:bg-white/10 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="mt-4 break-all text-sm font-medium">
                    {plugin.id}
                </p>

                <p className="mt-2 text-sm text-text-secondary">
                    {t(
                        isEnabled
                            ? 'adminPlugins.toggle.disableDescription'
                            : 'adminPlugins.toggle.enableDescription',
                    )}
                </p>

                {errorKey && (
                    <div
                        role="alert"
                        className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                    >
                        {t(`adminPlugins.toggle.errors.${errorKey}`)}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onClose}
                        className="rounded-xl border border-border-subtle px-4 py-2 text-sm disabled:opacity-50"
                    >
                        {t('adminPlugins.toggle.cancel')}
                    </button>

                    <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleSubmit()}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {submitting
                            ? t('adminPlugins.toggle.processing')
                            : t(
                                isEnabled
                                    ? 'adminPlugins.actions.disable'
                                    : 'adminPlugins.actions.enable',
                            )}
                    </button>
                </div>
            </div>
        </div>
    );
};