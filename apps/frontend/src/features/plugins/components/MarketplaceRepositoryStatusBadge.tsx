import { CheckCircle2, CircleMinus } from 'lucide-react';

import type { MarketplaceRepositoryStatus } from '@shared/types';

interface Props {
    status: MarketplaceRepositoryStatus;
}

const statusConfig = {
    ENABLED: {
        icon: CheckCircle2,
        label: 'Enabled',
        className:
            'border-green-500/30 bg-green-500/10 text-green-400',
    },
    DISABLED: {
        icon: CircleMinus,
        label: 'Disabled',
        className:
            'border-slate-500/30 bg-slate-500/10 text-slate-400',
    },
} as const;

export const MarketplaceRepositoryStatusBadge = ({
    status,
}: Props) => {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
        >
            <Icon size={14} aria-hidden="true" />
            {config.label}
        </span>
    );
};