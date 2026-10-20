type AuthSubmitButtonProps = {
    isSubmitting: boolean;
    label: string;
    submittingLabel: string;
};

export const AuthSubmitButton = ({
    isSubmitting,
    label,
    submittingLabel,
}: AuthSubmitButtonProps) => {
    return (
        <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
        >
            {isSubmitting ? submittingLabel : label}
        </button>
    );
};