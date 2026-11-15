import { useId, useState } from 'react';
import { Info } from 'lucide-react';

export const PermissionInfo = ({ label, description }: { label: string; description: string }) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex shrink-0" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined}
        aria-expanded={open} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
        className="rounded-full p-1 text-text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <Info size={16} aria-hidden="true" />
      </button>
      {open && <span id={id} role="tooltip"
        className="absolute right-0 top-full z-30 mt-2 w-64 max-w-[75vw] rounded-xl border border-border-subtle bg-surface p-3 text-left text-sm font-normal text-text-primary shadow-xl">
        {description}
      </span>}
    </span>
  );
};
