import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../core/auth/AppAuth";
import { useSession } from "../../core/session/AppSession";
import { hasPermission } from "../../core/config/roles";
import PageShell from "../../components/layout/PageShell";
import "./menu.css";
import "./menu-modern.css";
import {
  BarChart3,
  Briefcase,
  ClipboardList,
  Crown,
  Database,
  LocateFixed,
  History,
  Play,
  ScanLine,
  Settings,
  Shield,
  User,
  UserCog,
} from "lucide-react";
import Button from "../../components/ui/Button";

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

const roleLabelMap = {
  user: "Operator",
  superuser: "Superuser",
  office: "Office",
  manager: "Manager",
  admin: "Administrator",
};

const menuItems = [
  { label: "Proces", path: "/process", permission: "process" },
  { label: "Historia", path: "/history", permission: "history" },
  { label: "Dane", path: "/data", permission: "data" },
  { label: "Statystyki", path: "/dashboard", permission: "dashboard" },
  { label: "Ustawienia", path: "/admin", permission: "admin" },
];

export default function MenuScreenMain() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { endSession, session, startSession } = useSession();

  const role = user?.role?.toLowerCase();
  const displayName = user?.name || user?.email?.split("@")[0] || "Operator";
  const RoleIcon = roleIconMap[role] || User;
  const filteredMenu = menuItems.filter((item) => hasPermission(role, item.permission));
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartCode, setQuickStartCode] = useState("");
  const [quickStartSubmitting, setQuickStartSubmitting] = useState(false);
  const [quickStartError, setQuickStartError] = useState("");

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

  const handleQuickStart = async () => {
    try {
      setQuickStartSubmitting(true);
      setQuickStartError("");

      const normalizedCode = quickStartCode.trim().toUpperCase();

      if (!normalizedCode) {
        setQuickStartError("Zeskanuj lub wpisz lokalizacje, od ktorej chcesz zaczac.");
        return;
      }

      await startSession("empty");
      setQuickStartOpen(false);
      setQuickStartCode("");
      navigate("/process", {
        state: {
          quickStartCode: normalizedCode,
          quickStartMode: true,
        },
      });
    } catch (error) {
      console.error("QUICK START INIT ERROR:", error);
      setQuickStartError(error.message || "Nie udalo sie uruchomic szybkiego startu.");
    } finally {
      setQuickStartSubmitting(false);
    }
  };

  return (
    <PageShell
      title={`Czesc, ${displayName}`}
      subtitle="Wybierz obszar pracy i przejdz od razu do potrzebnego modulu."
      icon={<RoleIcon size={26} className={`role-icon role-${role}`} />}
      actions={
        <>
          <button className="app-button app-button--secondary" onClick={() => setQuickStartOpen(true)}>
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
            Rola: <strong>{roleLabelMap[role] || role || "Brak"}</strong>
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
                  {item.label === "Proces" && "Operacje terenowe, skanowanie i sesje pracy"}
                  {item.label === "Historia" && "Wyniki inwentaryzacji i przeglad operacji"}
                  {item.label === "Dane" && "Referencje, importy i historia zmian"}
                  {item.label === "Statystyki" && "Metryki, tempo pracy i dane finansowe"}
                  {item.label === "Ustawienia" && "Panel administracyjny, konfiguracja i statusy"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {quickStartOpen ? (
        <div className="history-modal-overlay" onClick={() => setQuickStartOpen(false)}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>
                  Szybki start gap inventory
                </h2>
                <p className="process-panel__subtitle">
                  Zeskanuj najblizsza lokalizacje, a system dobierze najlepszy kierunek rozpoczecia kontroli.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setQuickStartOpen(false)}>
                Zamknij
              </Button>
            </div>

            <div className="process-stage-header" style={{ marginBottom: 18 }}>
              <div className="process-stage-header__icon">
                <LocateFixed size={22} />
              </div>
              <div className="process-stage-header__text">
                <h2>Lokalizacja startowa</h2>
                <p>Moze to byc dowolna lokalizacja z mapy magazynu w poblizu miejsca, od ktorego operator chce ruszyc.</p>
              </div>
            </div>

            <div className="app-field">
              <label className="app-field__label">Skan lokalizacji</label>
              <div style={{ position: "relative" }}>
                <ScanLine
                  size={16}
                  style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--app-text-soft)" }}
                />
                <input
                  className="app-input"
                  placeholder="Np. A.01.001.D.3"
                  value={quickStartCode}
                  onChange={(event) => setQuickStartCode(event.target.value)}
                  style={{ paddingLeft: 40 }}
                  autoFocus
                />
              </div>
            </div>

            {quickStartError ? <div className="input-error-text">{quickStartError}</div> : null}

            <div className="process-actions" style={{ marginTop: 20 }}>
              <Button size="lg" loading={quickStartSubmitting} onClick={handleQuickStart}>
                Uruchom szybki start
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setQuickStartOpen(false)}>
                Anuluj
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
