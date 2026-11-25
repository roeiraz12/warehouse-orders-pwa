import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '../types';

interface SessionState {
  role: Role | null;
  setRole: (role: Role | null) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      setRole: (role) => set({ role }),
    }),
    {
      name: 'order-manager.session.v1',
      // v3: sorting options were removed (the list is always newest first) — keep only the role.
      version: 3,
      migrate: (old) => ({ role: (old as { role?: Role | null } | undefined)?.role ?? null }),
    },
  ),
);
