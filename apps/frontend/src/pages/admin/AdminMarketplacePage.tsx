import { Blocks } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MarketplaceRepositories } from '@/features/plugins/components/MarketplaceRepositories';

export const AdminMarketplacePage = () => {
    const { t } = useTranslation();

    return (
        <div className="space-y-7">
            <header>
                <p className="text-sm font-medium text-primary">
                    {t('sidebar.administration')}
                </p>

                <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
                    <Blocks aria-hidden="true" />
                    Marketplace
                </h1>

                <p className="mt-2 text-text-secondary">
                    Manage plugin repositories for Tyravex.
                </p>
            </header>

            <MarketplaceRepositories />
        </div>
    );
};