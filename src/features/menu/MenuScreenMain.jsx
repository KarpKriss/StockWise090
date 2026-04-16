import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../core/auth/AppAuth";
import { useSession } from "../../core/session/AppSession";
import { hasPermission } from "../../core/config/roles";
import { DEFAULT_MANUAL_PROCESS_CONFIG } from "../../core/config/manualProcessConfig";
import { fetchManualProcessConfig } from "../../core/api/manualProcessApi";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import PageShell from "../../components/layout/PageShell";
import BarcodeScannerModal from "../../components/scanner/BarcodeScannerModal";
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
  const activeSite = useMemo(() => {
    const accessibleSites = Array.isArray(user?.accessible_sites) ? user.accessible_sites : [];
    const matchedSite = accessibleSites.find((site) => site?.id === user?.site_id);

    if (matchedSite) {
      return matchedSite;
    }

    return user?.site_id
      ? {
          id: user.site_id,
          code: user.site_id,
          name: null,
        }
      : null;
  }, [user?.accessible_sites, user?.site_id]);
  const activeSiteLabel = activeSite
    ? activeSite.name
      ? `${activeSite.name} (${activeSite.code || activeSite.id})`
      : activeSite.code || activeSite.id
    : "Brak przypisanego magazynu";
  const filteredMenu = menuItems.filter((item) => hasPermission(role, item.permission));
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartCode, setQuickStartCode] = useState("");
  const [quickStartSubmitting, setQuickStartSubmitting] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const [quickStartError, setQuickStartError] = useState("");
  const [scannerConfig, setScannerConfig] = useState(DEFAULT_MANUAL_PROCESS_CONFIG.scanning);
  const [quickStartScannerOpen, setQuickStartScannerOpen] = useState(false);

  const loginUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/login";
    }

    return `${window.location.origin}/login`;
  }, []);

  const loginQrUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(loginUrl)}`,
    [loginUrl]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadScannerConfig() {
      try {
        const processConfig = await fetchManualProcessConfig(user?.site_id);
        if (!cancelled) {
          setScannerConfig(processConfig?.scanning || DEFAULT_MANUAL_PROCESS_CONFIG.scanning);
        }
      } catch (error) {
        console.error("MENU SCANNER CONFIG LOAD ERROR:", error);
      }
    }

    if (user?.site_id) {
      loadScannerConfig();
    }

    return () => {
      cancelled = true;
    };
  }, [user?.site_id]);

  const handleLogout = async () => {
    if (logoutSubmitting) {
      return;
    }

    try {
      setLogoutSubmitting(true);
      if (session) {
        await endSession();
      }
    } catch (error) {
      console.error("END SESSION ON LOGOUT ERROR:", error);
    } finally {
      await logout();
      setLogoutSubmitting(false);
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
          <Button size="md" loading={logoutSubmitting} loadingLabel="Wylogowuje..." onClick={handleLogout}>
            Wyloguj
          </Button>
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
          <div className="menu-summary__site">
            <span className="menu-summary__site-label">Magazyn</span>
            <span className="menu-summary__site-pill">{activeSiteLabel}</span>
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

      <div className="app-card" style={{ marginTop: 20 }}>
        <div className="process-stage-header" style={{ marginBottom: 14 }}>
          <div className="process-stage-header__icon">
            <ScanLine size={22} />
          </div>
          <div className="process-stage-header__text">
            <h2>QR do logowania na telefonie</h2>
            <p>
              Zeskanuj ten kod z dowolnego komputera albo monitora, aby szybko otworzyc ekran logowania StockWise na telefonie operatora.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 220px) 1fr",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 14,
              display: "inline-flex",
              justifyContent: "center",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <img
              src={loginQrUrl}
              alt="QR do logowania StockWise"
              style={{ width: 220, height: 220, display: "block" }}
            />
          </div>

          <div>
            <div className="helper-note" style={{ marginBottom: 10 }}>
              Link do logowania:
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(148, 163, 184, 0.28)",
                background: "rgba(255,255,255,0.6)",
                wordBreak: "break-all",
                fontWeight: 600,
              }}
            >
              {loginUrl}
            </div>
            <div className="helper-note" style={{ marginTop: 10 }}>
              Jesli operator pracuje na innym urzadzeniu, wystarczy zeskanowac QR i zalogowac sie standardowo.
            </div>
          </div>
        </div>
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
              <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
                <div style={{ position: "relative", flex: 1 }}>
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
                {scannerConfig.enabled && scannerConfig.fields?.location?.enabled ? (
                  <button
                    type="button"
                    className="app-icon-button"
                    onClick={() => setQuickStartScannerOpen(true)}
                    aria-label="Otworz skaner lokalizacji dla szybkiego startu"
                    style={{ minWidth: 46, alignSelf: "stretch" }}
                  >
                    <ScanLine size={18} />
                  </button>
                ) : null}
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

      <BarcodeScannerModal
        open={quickStartScannerOpen}
        title="Skanuj lokalizacje startowa"
        description="Zeskanuj kod lokalizacji aparatem telefonu albo wgraj zdjecie, aby od razu uruchomic szybki start pustych lokalizacji."
        formats={scannerConfig.fields?.location?.formats || []}
        preferBackCamera={Boolean(scannerConfig.preferBackCamera)}
        autoCloseOnSuccess={Boolean(scannerConfig.autoCloseOnSuccess)}
        onDetected={(value) => setQuickStartCode(String(value || "").trim())}
        onClose={() => setQuickStartScannerOpen(false)}
      />
      <LoadingOverlay
        open={logoutSubmitting}
        fullscreen
        message="Zamykam sesje i wylogowuje operatora ze StockWise..."
      />
    </PageShell>
  );
}
