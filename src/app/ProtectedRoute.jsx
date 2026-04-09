import { Navigate } from 'react-router-dom';
import { useAuth } from '../core/auth/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  console.log('PROTECTED ROUTE:', { user, loading });

  // 🔄 czekamy aż auth się załaduje
  if (loading) {
    return <div>Loading...</div>;
  }

  // 🔒 brak usera → login
  if (!user || user.status !== 'active') {
  return <Navigate to="/login" />;
}

  return children;
}
