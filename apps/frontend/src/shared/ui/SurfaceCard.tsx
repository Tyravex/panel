
import type { HTMLAttributes } from "react";

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "elevated";
};

export const SurfaceCard = ({
  variant = "default",
  className = "",
  children,
  ...props
}: SurfaceCardProps) => {
  const variants = {
    default: "bg-surface",
    elevated: "bg-surface-elevated",
  };

  return (
    <div
      className={[
        "rounded-2xl border border-border-subtle",
        "p-5 shadow-sm transition-colors",
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
};
