import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

type ServiceFeedbackProps = {
    kind: "loading" | "error" | "empty";
    title?: string;
    description?: string;
    loadingLabel?: string;
    retryLabel?: string;
    onRetry?: () => void;
    retrying?: boolean;
    children?: ReactNode;
};

export const ServiceFeedback = ({
    kind,
    title,
    description,
    loadingLabel,
    retryLabel,
    onRetry,
    retrying = false,
    children,
}: ServiceFeedbackProps) => {
    if (kind === "loading") {
        return (
            <section role="status" className="h-56 animate-pulse rounded-2xl border border-border-subtle bg-surface">
                <span className="sr-only">{loadingLabel}</span>
            </section>
        );
    }

    const isError = kind === "error";

    return (
        <section
            role={isError ? "alert" : "status"}
            className={`rounded-2xl border bg-surface p-6 sm:p-8 ${isError ? "border-red-500/30" : "border-border-subtle"
                }`}
        >
            {isError && <AlertCircle size={24} className="text-red-400" aria-hidden="true" />}
            {title && (
                <h2 className={`${isError ? "mt-3 " : ""}text-xl font-semibold text-text-primary`}>
                    {title}
                </h2>
            )}
            {description && (
                <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
            )}
            {children}
            {isError && onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={retrying}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary disabled:opacity-50"
                >
                    <RefreshCw size={16} className={retrying ? "animate-spin" : ""} aria-hidden="true" />
                    {retryLabel}
                </button>
            )}
        </section>
    );
};
