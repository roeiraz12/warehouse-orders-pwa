import { useEffect, useRef, type ReactNode } from 'react';
import { sheetClosed, sheetOpened } from '../../lib/backButton';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet on mobile: easy to reach with a thumb, hard to miss. The phone's back button closes it. */
export function Modal({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    sheetOpened(() => onCloseRef.current());
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      sheetClosed();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl outline-none"
      >
        <h2 className="mb-5 text-center text-2xl font-extrabold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
