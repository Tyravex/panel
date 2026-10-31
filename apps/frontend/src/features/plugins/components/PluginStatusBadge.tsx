import {
    CheckCircle2,
    CircleMinus,
    LoaderCircle,
    RefreshCw,
    XCircle,
    Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { PluginStatus } from '../api/pluginsApi';

interface PluginStatusBadgeProps {
    status: PluginStatus;
}

const statusConfig = {
    INSTALLED: {
        icon: CheckCircle2,
        className:
            'border-green-500/30 bg-green-500/10 text-green-400',
        animated: false,
    },
    DISABLED: {
        icon: CircleMinus,
        className:
            'border-slate-500/30 bg-slate-500/10 text-slate-400',
        animated: false,
    },
    INSTALLING: {
        icon: LoaderCircle,
        className:
            'border-blue-500/30 bg-blue-500/10 text-blue-400',
        animated: true,
    },
    UNINSTALLING: {
        icon: Loader2,
        className:
            'border-amber-500/30 bg-amber-500/10 text-amber-400',
        animated: true,
    },
    UPDATING: {
        icon: RefreshCw,
        className:
            'border-violet-500/30 bg-violet-500/10 text-violet-400',
        animated: true,
    },
    FAILED: {
        icon: XCircle,
        className:
            'border-red-500/30 bg-red-500/10 text-red-400',
        animated: false,
    },
} as const;

export const PluginStatusBadge = ({
    status,
}: PluginStatusBadgeProps) => {
    const { t } = useTranslation();
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
        >
            <Icon
                size={14}
                aria-hidden="true"
                className={
                    config.animated
                        ? 'animate-spin'
                        : undefined
                }
            />

            {t(`adminPlugins.statuses.${status}`)}
        </span>
    );
};
