import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../store/sessionStore';
import type { Role } from '../types';

/** Employee routes allow both roles; manager routes allow only managers. */
export function RoleGuard({ allow }: { allow: Role[] }) {
  const role = useSession((s) => s.role);
  if (!role) return <Navigate to="/" replace />;
  if (!allow.includes(role)) return <Navigate to="/orders" replace />;
  return <Outlet />;
}
