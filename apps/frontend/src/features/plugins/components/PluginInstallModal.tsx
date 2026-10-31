import axios from 'axios';
import {
    CheckCircle2,
    FileArchive,
    Loader2,
    Upload,
    X,
} from 'lucide-react';
import {
    useEffect,
    useId,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

import { pluginsApi } from '../api/pluginsApi';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

interface PluginInstallModalProps {
    open: boolean;
    onClose: () => void;
    onInstalled: () => void;
}

function getErrorKey(error: unknown): string {
    if (!axios.isAxiosError(error)) {
        return 'adminPlugins.install.errors.generic';
    }

    switch (error.response?.status) {
        case 400:
            return 'adminPlugins.install.errors.invalid';
        case 401:
            return 'adminPlugins.install.errors.unauthorized';
        case 403:
            return 'adminPlugins.install.errors.forbidden';
        case 409:
            return 'adminPlugins.install.errors.conflict';
        case 413:
            return 'adminPlugins.install.errors.tooLarge';
        case 415:
            return 'adminPlugins.install.errors.unsupported';
        default:
            return 'adminPlugins.install.errors.generic';
    }
}

export const PluginInstallModal = ({
    open,
    onClose,
    onInstalled,
}: PluginInstallModalProps) => {
    const { t } = useTranslation();
    const titleId = useId();
    const descriptionId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [installing, setInstalling] = useState(false);
    const [errorKey, setErrorKey] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !installing) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, installing, onClose]);

    if (!open) {
        return null;
    }

    const close = () => {
        if (installing) {
            return;
        }

        setFile(null);
        setErrorKey(null);
        setSuccessId(null);
        onClose();
    };

    const handleFileChange = (
        event: ChangeEvent<HTMLInputElement>,
    ) => {
        const selected = event.target.files?.[0] ?? null;

        setFile(null);
        setErrorKey(null);
        setSuccessId(null);

        if (!selected) {
            return;
        }

        if (!selected.name.toLowerCase().endsWith('.zip')) {
            setErrorKey('adminPlugins.install.errors.selectZip');
        } else if (selected.size === 0) {
            setErrorKey('adminPlugins.install.errors.empty');
        } else if (selected.size > MAX_UPLOAD_BYTES) {
            setErrorKey('adminPlugins.install.errors.tooLarge');
        } else {
            setFile(selected);
            return;
        }

        event.target.value = '';
    };

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!file || installing) {
            return;
        }

        setInstalling(true);
        setErrorKey(null);
        setSuccessId(null);

        try {
            const result = await pluginsApi.install(file);

            setSuccessId(result.id);
            setFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            onInstalled();
        } catch (error: unknown) {
            setErrorKey(getErrorKey(error));
        } finally {
            setInstalling(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    close();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="w-full max-w-lg rounded-2xl border border-white/10 bg-background p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2
                            id={titleId}
                            className="text-xl font-semibold"
                        >
                            {t('adminPlugins.install.title')}
                        </h2>

                        <p
                            id={descriptionId}
                            className="mt-2 text-sm text-text-secondary"
                        >
                            {t('adminPlugins.install.description')}
                        </p>
                    </div>

                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={close}
                        disabled={installing}
                        aria-label={t('adminPlugins.install.close')}
                        className="rounded-lg p-2 text-text-secondary hover:bg-white/5 disabled:opacity-50"
                    >
                        <X size={19} aria-hidden="true" />
                    </button>
                </div>

                <form
                    onSubmit={(event) => {
                        void handleSubmit(event);
                    }}
                    className="mt-6 space-y-5"
                >
                    <label className="block cursor-pointer rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-8 text-center transition-colors hover:border-primary/50">
                        <FileArchive
                            size={36}
                            className="mx-auto text-primary"
                            aria-hidden="true"
                        />

                        <span className="mt-3 block font-medium">
                            {t('adminPlugins.install.selectFile')}
                        </span>

                        <span className="mt-2 block text-sm text-text-secondary">
                            {t('adminPlugins.install.limit')}
                        </span>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip,application/zip"
                            disabled={installing}
                            onChange={handleFileChange}
                            aria-label={t('adminPlugins.install.selectFile')}
                            className="sr-only"
                        />
                    </label>

                    {file && (
                        <div className="flex items-center gap-3 rounded-xl border border-border-subtle p-3">
                            <FileArchive
                                size={20}
                                aria-hidden="true"
                            />

                            <span className="min-w-0 flex-1 truncate text-sm">
                                {file.name}
                            </span>

                            <span className="text-xs text-text-secondary">
                                {(file.size / 1024 / 1024).toFixed(2)} MiB
                            </span>
                        </div>
                    )}

                    {errorKey && (
                        <p
                            role="alert"
                            className="text-sm text-red-400"
                        >
                            {t(errorKey)}
                        </p>
                    )}

                    {successId && (
                        <p
                            role="status"
                            className="flex items-center gap-2 text-sm text-green-400"
                        >
                            <CheckCircle2
                                size={18}
                                aria-hidden="true"
                            />
                            {t('adminPlugins.install.success', {
                                id: successId,
                            })}
                        </p>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={close}
                            disabled={installing}
                            className="rounded-xl border border-border-subtle px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                            {t('adminPlugins.install.cancel')}
                        </button>

                        <button
                            type="submit"
                            disabled={!file || installing}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {installing ? (
                                <Loader2
                                    size={17}
                                    className="animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Upload
                                    size={17}
                                    aria-hidden="true"
                                />
                            )}

                            {t(
                                installing
                                    ? 'adminPlugins.install.installing'
                                    : 'adminPlugins.install.submit',
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};