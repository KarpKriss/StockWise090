import { Navigate } from 'react-router-dom';
import { useAuth } from '../core/auth/AppAuth';
import { getHomeRoute } from '../core/config/roles';

export default function RoleRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  const route = getHomeRoute(user.role);

  return <Navigate to={route} replace />;
}
