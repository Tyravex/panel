import { useTranslation } from 'react-i18next';

type AuthHeaderProps = {
    title: string;
    description: string;
};

export const AuthHeader = ({ title, description }: AuthHeaderProps) => {
    const { t } = useTranslation();

    return (
        <header className="mb-8">
            <p className="mb-2 text-sm font-semibold tracking-wider text-primary">
                {t('auth.brand')}
            </p>

            <h2 className="text-3xl font-bold tracking-tight">
                {title}
            </h2>

            <p className="mt-2 text-sm text-text-secondary">
                {description}
            </p>
        </header>
    );
};