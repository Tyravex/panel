import type { InputHTMLAttributes } from 'react';

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: string;
};

export const AuthInput = ({
    id,
    label,
    hint,
    className = '',
    ...props
}: AuthInputProps) => {
    return (
        <div>
            <label
                htmlFor={id}
                className="mb-2 block text-sm font-medium text-text-primary"
            >
                {label}
            </label>

            <input
                id={id}
                className={`w-full rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3 text-text-primary outline-none transition placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
                {...props}
            />

            {hint && (
                <p className="mt-2 text-xs text-text-secondary">
                    {hint}
                </p>
            )}
        </div>
    );
};