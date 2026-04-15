import { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AppAuth';
import { useNavigate } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StockWiseLoader from '../../components/loaders/StockWiseLoader';

export default function LoginScreenModern() {
  const { login, user, loading: authLoading, availableSites } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    login: '',
    password: '',
    siteId: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/menu');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const input = document.getElementById('login-input');
    if (input) input.focus();
  }, []);

  useEffect(() => {
    if (availableSites.length === 1 && !form.siteId) {
      setForm((current) => ({
        ...current,
        siteId: availableSites[0].id,
      }));
    }
  }, [availableSites, form.siteId]);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

    setErrors({});
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.login) nextErrors.login = 'Wprowadz login';
    if (!form.password) nextErrors.password = 'Wprowadz haslo';
    if (availableSites.length > 0 && !form.siteId) nextErrors.siteId = 'Wybierz magazyn';

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    if (loading) {
      return;
    }

    event.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      const result = await login(form.login, form.password, form.siteId || null);

      if (!result?.success) {
        setErrors({ general: result?.message || 'Blad logowania' });
      }
    } catch (error) {
      console.error('LOGIN SCREEN ERROR:', error);
      setErrors({ general: 'Blad systemu' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand__mark">
            <Boxes size={28} />
          </div>
          <div>
            <h1 className="login-brand__title">StockWise</h1>
            <p className="login-brand__subtitle">
              Warehouse operations, calmer, cleaner, clearer.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {availableSites.length > 0 ? (
            <div className="app-field">
              <label className="app-field__label">Magazyn</label>
              <select
                name="siteId"
                value={form.siteId}
                onChange={handleChange}
                disabled={loading}
                className={`app-input ${errors.siteId ? 'is-error' : ''}`.trim()}
              >
                <option value="">Wybierz magazyn</option>
                {availableSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.label}
                  </option>
                ))}
              </select>
              {errors.siteId ? <span className="app-field__error">{errors.siteId}</span> : null}
            </div>
          ) : null}

          <Input
            id="login-input"
            type="text"
            name="login"
            label="Login"
            value={form.login}
            onChange={handleChange}
            placeholder="Wpisz login"
            error={errors.login}
            disabled={loading}
          />

          <Input
            type="password"
            name="password"
            label="Haslo"
            value={form.password}
            onChange={handleChange}
            placeholder="Wpisz haslo"
            error={errors.password}
            disabled={loading}
          />

          {errors.general ? <div className="login-error">{errors.general}</div> : null}

          <Button type="submit" loading={loading} loadingLabel="Logowanie..." disabled={loading} size="lg">
            Zaloguj sie
          </Button>
        </form>

        {loading ? (
          <div className="loaderOverlay">
            <StockWiseLoader />
          </div>
        ) : null}

        <p className="login-footer">StockWise v1.0</p>
      </div>
    </div>
  );
}
