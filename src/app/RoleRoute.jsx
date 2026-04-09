import { Navigate } from 'react-router-dom';
import { useAuth } from '../core/auth/AuthContext';
import { hasPermission, getHomeRoute } from '../core/config/roles';

export default function RoleRoute({ children, permission }) {
  const { user, loading } = useAuth();

  // 🔄 czekamy aż auth się załaduje
  if (loading) {
    return <div>Loading...</div>;
  }

  // 🔒 brak usera → login
  if (!user || user.status !== 'active') {
  return <Navigate to="/login" />;
}

  // 🔒 brak roli → blokada (błąd danych)
  if (!user.role) {
    console.error('Brak roli użytkownika');
    return <Navigate to="/login" />;
  }

  const normalizedRole = user.role.toLowerCase();
console.log('ROLE CHECK:', {
  role: normalizedRole,
  permission,
  hasAccess: hasPermission(normalizedRole, permission),
});
  // 🔒 brak uprawnień
  if (!hasPermission(normalizedRole, permission)) {
  return <Navigate to={getHomeRoute(normalizedRole)} />;
}

  return children;
}
