
export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border-subtle bg-surface/50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-xs font-bold text-white"
          >
            T
          </span>

          <span className="text-sm font-semibold tracking-tight text-text-primary">
            Tyravex
          </span>
        </div>

        <p className="text-xs text-text-secondary">
          © {currentYear} Tyravex. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
