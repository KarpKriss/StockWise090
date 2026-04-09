import { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StockWiseLoader from '../../components/loaders/StockWiseLoader';

export default function LoginScreen() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    login: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  /**
   * 🔍 DEBUG GLOBAL STATE
   */
  useEffect(() => {
    console.log('🔍 LOGIN STATE CHANGE:', { user, authLoading });
  }, [user, authLoading]);

  useEffect(() => {
  // 🔥 jeśli user zalogowany → wyjdź z login
  if (!authLoading && user) {
    console.warn('USER LOGGED → REDIRECT TO MENU');

    navigate('/menu');
  }
}, [user, authLoading]);

  /**
   * 🔥 FOCUS INPUT
   */
  useEffect(() => {
    console.log('🎯 FOCUS INPUT');
    const input = document.getElementById('login-input');
    if (input) input.focus();
  }, []);

  const handleChange = (e) => {
    console.log('⌨️ INPUT CHANGE:', e.target.name, e.target.value);

    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

    setErrors({});
  };

  const validate = () => {
    console.log('🧪 VALIDATE START');

    const newErrors = {};

    if (!form.login) newErrors.login = 'Wprowadź login';
    if (!form.password) newErrors.password = 'Wprowadź hasło';

    console.log('🧪 VALIDATE RESULT:', newErrors);

    return newErrors;
  };

  const handleSubmit = async (e) => {
    console.log('🔥 HANDLE SUBMIT START');
    if (loading) {
  console.log('⛔ SUBMIT ZABLOKOWANY – już trwa logowanie');
  return;
}

    e.preventDefault();

    console.log('📦 FORM DATA:', form);

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      console.log('❌ VALIDATION FAILED:', validationErrors);
      setErrors(validationErrors);
      return;
    }

    console.log('✅ VALIDATION PASSED');

    setLoading(true);
    console.log('⏳ LOADING TRUE');

    try {
      console.log('📡 CALLING  FUNCTION');

      const result = await login(form.login, form.password);

      console.log('📩 LOGIN RESULT:', result);

       if (!result?.success) {
        console.log('❌ LOGIN FAILED:', result);
        setLoading(false);
        setErrors({ general: result?.message || 'Błąd logowania' });
        return;
      }
      setLoading(false);
      
    } catch (err) {
      console.log('💥 LOGIN CRASH:', err);
      setLoading(false);
      setErrors({ general: 'Błąd systemu' });
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logo}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="24" height="24" rx="4" fill="currentColor" opacity="0.1"/>
                <rect x="8" y="8" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="18" y="8" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="8" y="18" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="18" y="18" width="6" height="6" rx="1" fill="currentColor"/>
              </svg>
            </div>
            <h1 style={styles.title}>StockWise</h1>
            <p style={styles.subtitle}>Zarządzanie zapasami</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <Input
              id="login-input"
              type="text"
              name="login"
              value={form.login}
              onChange={handleChange}
              placeholder="Login"
              error={errors.login}
              disabled={loading}
            />

            <Input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Hasło"
              error={errors.password}
              disabled={loading}
            />

            {errors.general && (
              <div style={styles.errorBox}>{errors.general}</div>
            )}

            <Button type="submit" loading={loading} disabled={loading}>
              Zaloguj się
            </Button>

            
          </form>

          {loading && (
                <div style={styles.loaderOverlay}>
                  <StockWiseLoader />
                </div>
              )}
        </div>

        <p style={styles.footer}>StockWise v1.0</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#f8f9fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },

  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },

  card: {
    width: '100%',
    maxWidth: '380px',
    padding: '48px 32px',
    borderRadius: '12px',
    background: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    position: 'relative',
  },

  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },

  logo: {
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '600',
    color: '#1f2937',
  },

  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  errorBox: {
    background: '#fef2f2',
    padding: '12px',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '13px',
    textAlign: 'center',
  },

  footer: {
    margin: 0,
    fontSize: '12px',
    color: '#9ca3af',
  },
  loaderOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(255,255,255,0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: '12px',
  zIndex: 10,
},
};
