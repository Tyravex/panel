import type { ReactNode } from 'react';

type AuthCardProps = {
    children: ReactNode;
};

export const AuthCard = ({ children }: AuthCardProps) => {
    return (
        <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border-subtle bg-surface/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-8">
                {children}
            </div>
        </div>
    );
};