import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AppAuth';
import { useSession } from '../../core/session/AppSession';
import { hasPermission } from '../../core/config/roles';
import PageShell from '../../components/layout/PageShell';
import './menu.css';
import './menu-modern.css';
import {
  Play,
  History,
  Database,
  BarChart3,
  Settings,
  Shield,
  User,
  Crown,
  Briefcase,
  ClipboardList,
  UserCog,
} from "lucide-react";

export default function MenuScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { endSession, session } = useSession();

  const role = user?.role?.toLowerCase();
  const displayName = user?.name || user?.email?.split('@')[0] || 'Operator';
  const roleLabelMap = {
    user: 'Operator',
    superuser: 'Superuser',
    office: 'Office',
    manager: 'Manager',
    admin: 'Administrator',
  };

  console.log('USER ROLE:', role);

  const handleLogout = async () => {
    try {
      if (session) {
        await endSession();
      }
    } catch (error) {
      console.error("END SESSION ON LOGOUT ERROR:", error);
    } finally {
      await logout();
    }
  };
  const iconMap = {
    Proces: Play,
    Historia: History,
    Dane: Database,
    Statystyki: BarChart3,
    Ustawienia: Settings,
  };
  const roleIconMap = {
    user: ClipboardList,
    superuser: Shield,
    office: Briefcase,
    manager: UserCog,
    admin: Crown,
  };
  const menuItems = [
    {
      label: 'Proces',
      path: '/process',
      permission: 'process',
    },
    {
      label: 'Historia',
      path: '/history',
      permission: 'history',
    },
    {
      label: 'Dane',
      path: '/data',
      permission: 'data',
    },
    {
      label: 'Statystyki',
      path: '/dashboard',
      permission: 'dashboard',
    },
    {
      label: 'Ustawienia',
      path: '/admin',
      permission: 'admin',
    },
  ];

  const filteredMenu = menuItems.filter((item) =>
    hasPermission(role, item.permission)
  );
  const RoleIcon = roleIconMap[role] || User;
  return (
    <PageShell
      title={`Czesc, ${displayName}`}
      subtitle="Wybierz obszar pracy i przejdz od razu do potrzebnego modulu."
      subtitle="Wybierz obszar pracy i wejdz do aktualnego modułu bez szukania po systemie."
      {...{ subtitle: "Wybierz obszar pracy i przejdz od razu do potrzebnego modulu." }}
      icon={<RoleIcon size={26} className={`role-icon role-${role}`} />}
      actions={
        <>
          <button className="app-button app-button--secondary" onClick={() => navigate('/process')}>
            Szybki start
          </button>
          <button className="app-button app-button--primary" onClick={handleLogout}>
            Wyloguj
          </button>
        </>
      }
      compact
    >
      <div className="menu-summary">
        <div className="menu-summary__avatar">
          <div className={`menu-summary__avatar-portrait role-${role}`}>
            <RoleIcon size={28} />
          </div>
        </div>
        <div>
          <div className="menu-summary__welcome">Twoj panel roboczy</div>
          <div className="menu-summary__name">{displayName}</div>
          <div className="menu-summary__role">
            Rola: <strong>{roleLabelMap[role] || role || 'Brak'}</strong>
          </div>
        </div>
      </div>

      <div className="menu-grid">
        {filteredMenu.map((item) => {
          const Icon = iconMap[item.label];

          return (
            <button
              key={item.label}
              className={`menu-card role-${role}`}
              onClick={() => navigate(item.path)}
            >
              <div className="menu-card__icon">
                <Icon size={22} />
              </div>
              <div className="menu-card__content">
                <div className="menu-card__title">{item.label}</div>
                <div className="menu-card__desc">
                  {item.label === 'Proces' && 'Operacje terenowe, skanowanie i sesje pracy'}
                  {item.label === 'Historia' && 'Wyniki inwentaryzacji i przeglad operacji'}
                  {item.label === 'Dane' && 'Referencje, importy i historia zmian'}
                  {item.label === 'Statystyki' && 'Metryki, tempo pracy i dane finansowe'}
                  {item.label === 'Ustawienia' && 'Panel administracyjny, konfiguracja i statusy'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}
