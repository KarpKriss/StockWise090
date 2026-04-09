import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../core/auth/AuthContext';
import { SessionProvider } from '../core/session/SessionContext';
import AppRoutes from './routes';
import SessionGate from '../components/session/SessionGate';


function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <BrowserRouter>
          <SessionGate>
            <AppRoutes />
          </SessionGate>
        </BrowserRouter>
      </SessionProvider>
    </AuthProvider>
  );
}

export default App;
