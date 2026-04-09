import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AppAuth';
import { useSession } from '../../core/session/AppSession';
import { hasPermission } from '../../core/config/roles';
import './menu.css';
import {
  Play,
  History,
  Database,
  BarChart3,
  Settings,
  Shield,
  User,
} from "lucide-react";

export default function MenuScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { endSession, session } = useSession();

  const role = user?.role?.toLowerCase();

  console.log('USER ROLE:', role);

  const handleLogout = async () => {
    if (session) {
      await endSession();
    }
    await logout();
  };
  const iconMap = {
    Proces: Play,
    Historia: History,
    Dane: Database,
    Statystyki: BarChart3,
    Ustawienia: Settings,
  };
  const roleIconMap = {
  user: Play,
  superuser: Shield,
  office: Database,
  manager: BarChart3,
  admin: Settings,
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
];

const filteredMenu = menuItems.filter((item) =>
  hasPermission(role, item.permission)
);
 const RoleIcon = roleIconMap[role] || User;
  return (
    <div className="menu-container">
    

<h1 className="menu-title">
  <RoleIcon size={28} className={`role-icon role-${role}`} />
  StockWise
</h1>

           <div className="menu-actions">
        {filteredMenu.map((item) => {
                  const Icon = iconMap[item.label];
                
                  return (
                    <button
                      key={item.label}
                      className={`menu-button role-${role}`}
                      onClick={() => navigate(item.path)}
                    >
                      <Icon size={18} className="menu-icon" />
                      {item.label}
                    </button>
                  );
                })}
                </div>

      <button className="btn-logout" onClick={handleLogout}>
        Wyloguj
      </button>
    </div>
  );
}
