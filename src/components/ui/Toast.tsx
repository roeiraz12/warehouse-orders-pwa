import { useEffect } from 'react';
import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
}

export const useToast = create<ToastState>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));

export function ToastHost() {
  const { message, clear } = useToast();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clear, 3000);
    return () => clearTimeout(t);
  }, [message, clear]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div className="rounded-2xl bg-ok px-6 py-4 text-xl font-bold text-white shadow-xl">✓ {message}</div>
    </div>
  );
}
