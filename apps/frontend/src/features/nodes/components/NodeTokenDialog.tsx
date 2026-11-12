import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, KeyRound, X } from 'lucide-react';
import type { NodeCredentials } from '../api/nodesApi';
import {
    generateAgentApiToken,
    generateAgentConfig,
} from '../lib/generateAgentConfig';

interface NodeTokenDialogProps {
    credentials: NodeCredentials;
    onClose: () => void;
}

export const NodeTokenDialog = ({
    credentials,
    onClose,
}: NodeTokenDialogProps) => {
    const { t } = useTranslation();

    const [copied, setCopied] = useState(false);
    const [panelUrl, setPanelUrl] = useState('');
    const [configCopied, setConfigCopied] = useState(false);
    const [configError, setConfigError] = useState('');
    const [apiToken] = useState(() => generateAgentApiToken());

    const copyToken = async () => {
        try {
            await navigator.clipboard.writeText(credentials.token);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    const copyConfig = async () => {
        setConfigError('');
        setConfigCopied(false);

        try {
            const yaml = generateAgentConfig({
                panelUrl,
                nodeId: credentials.id,
                nodeToken: credentials.token,
                apiToken,
            });

            await navigator.clipboard.writeText(yaml);
            setConfigCopied(true);
        } catch (error) {
            setConfigError(
                error instanceof Error
                    ? error.message
                    : t('adminNodes.agentConfigError'),
            );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="node-token-title"
                className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <KeyRound
                            className="text-primary"
                            size={24}
                            aria-hidden="true"
                        />
                        <h2
                            id="node-token-title"
                            className="text-xl font-semibold"
                        >
                            {t('adminNodes.tokenTitle', {
                                name: credentials.name,
                            })}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('adminNodes.close')}
                        className="rounded-lg p-2 hover:bg-white/5"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="mt-4 text-sm text-amber-400">
                    {t('adminNodes.tokenWarning')}
                </p>

                <div className="mt-5 flex gap-2">
                    <input
                        aria-label={t('adminNodes.tokenLabel')}
                        type="text"
                        readOnly
                        value={credentials.token}
                        autoComplete="off"
                        spellCheck={false}
                        className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-transparent px-3 py-3 font-mono text-sm"
                    />

                    <button
                        type="button"
                        onClick={() => void copyToken()}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-white"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {t(copied ? 'adminNodes.copied' : 'adminNodes.copy')}
                    </button>
                </div>

                <div className="mt-6 border-t border-border-subtle pt-5">
                    <h3 className="text-base font-semibold">
                        {t('adminNodes.agentConfigTitle')}
                    </h3>

                    <p className="mt-2 text-sm text-foreground-muted">
                        {t('adminNodes.agentConfigDescription')}
                    </p>

                    <label
                        htmlFor="agent-panel-url"
                        className="mt-4 block text-sm font-medium"
                    >
                        {t('adminNodes.agentPanelUrlLabel')}
                    </label>

                    <input
                        id="agent-panel-url"
                        type="url"
                        value={panelUrl}
                        onChange={(event) => {
                            setPanelUrl(event.target.value);
                            setConfigCopied(false);
                            setConfigError('');
                        }}
                        placeholder="https://panel.example.com"
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-2 w-full rounded-xl border border-border-subtle bg-transparent px-3 py-3 font-mono text-sm"
                    />

                    {configError && (
                        <p
                            role="alert"
                            className="mt-3 text-sm text-red-400"
                        >
                            {configError}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={() => void copyConfig()}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-white"
                    >
                        {configCopied ? (
                            <Check size={18} />
                        ) : (
                            <Copy size={18} />
                        )}
                        {t(configCopied
                            ? 'adminNodes.agentConfigCopied'
                            : 'adminNodes.agentConfigCopy')}
                    </button>

                    <p className="mt-3 text-xs text-amber-400">
                        {t('adminNodes.agentConfigWarning')}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 w-full rounded-xl border border-border-subtle px-4 py-3 font-medium hover:bg-white/5"
                >
                    {t('adminNodes.closeToken')}
                </button>
            </section>
        </div>
    );
};
