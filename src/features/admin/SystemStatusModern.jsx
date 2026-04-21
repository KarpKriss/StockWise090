import {
  ActivitySquare,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Lock,
  OctagonAlert,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Waypoints,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import PageShell from "../../components/layout/PageShell";
import { fetchSystemStatus, fetchSystemStatusDetails } from "../../core/api/systemStatusApi";
import { useAppPreferences } from "../../core/preferences/AppPreferences";

function getSeverityMeta(severity, copy) {
  switch (String(severity || "").toLowerCase()) {
    case "critical":
    case "danger":
    case "error":
      return {
        tone: "critical",
        label: copy.severityCritical,
        icon: <OctagonAlert size={18} />,
      };
    case "warning":
    case "warn":
      return {
        tone: "warning",
        label: copy.severityWarning,
        icon: <AlertTriangle size={18} />,
      };
    default:
      return {
        tone: "healthy",
        label: copy.severityOk,
        icon: <CheckCircle2 size={18} />,
      };
  }
}

function formatDateTime(value, locale) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatMetric(value, locale) {
  const number = Number(value || 0);
  return new Intl.NumberFormat(locale).format(number);
}

function HealthMetricCard({ icon, label, value, hint, tone = "neutral", onClick = null }) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`system-status-metric system-status-metric--${tone}${onClick ? " system-status-metric--interactive" : ""}`}
      onClick={onClick || undefined}
    >
      <div className="system-status-metric__icon">{icon}</div>
      <div>
        <div className="system-status-metric__label">{label}</div>
        <div className="system-status-metric__value">{value}</div>
        {hint ? <div className="system-status-metric__hint">{hint}</div> : null}
      </div>
    </Tag>
  );
}

function getProcessTone(status) {
  return String(status || "").toLowerCase() === "connected" ? "healthy" : "warning";
}

function AlertRow({ item, copy }) {
  const meta = getSeverityMeta(item.severity, copy);

  return (
    <div className={`system-alert system-alert--${meta.tone}`}>
      <div className="system-alert__badge">{meta.icon}</div>
      <div className="system-alert__body">
        <div className="system-alert__header">
          <strong>{item.title || item.code || copy.systemSignal}</strong>
          <span className={`system-alert__pill system-alert__pill--${meta.tone}`}>
            {meta.label}
          </span>
        </div>
        <div className="system-alert__meta">
          {item.category ? <span>{item.category}</span> : null}
          {item.value !== undefined && item.value !== null ? (
            <span>{copy.valueLabel}: {String(item.value)}</span>
          ) : null}
        </div>
        <p>{item.description || copy.noAdditionalDescription}</p>
        {item.recommendation ? (
          <div className="system-alert__recommendation">{item.recommendation}</div>
        ) : null}
      </div>
    </div>
  );
}

function DetailStat({ label, value }) {
  return (
    <div className="system-status-detail-stat">
      <div className="system-status-detail-stat__label">{label}</div>
      <div className="system-status-detail-stat__value">{value ?? "-"}</div>
    </div>
  );
}

export default function SystemStatusModern() {
  const { language, locale } = useAppPreferences();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [detailModal, setDetailModal] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const copy = {
    pl: {
      severityCritical: "Krytyczne",
      severityWarning: "Uwaga",
      severityOk: "OK",
      systemSignal: "Sygnal systemowy",
      valueLabel: "Wartosc",
      noAdditionalDescription: "Brak dodatkowego opisu.",
      loadError: "Nie udalo sie pobrac statusu systemu",
      title: "Statusy",
      subtitle: "Panel zdrowia systemu dla administratora. Widok wychwytuje sygnaly ostrzegawcze i miejsca, ktore moga zagrozic ciaglosci procesu.",
      backLabel: "Powrot do ustawien",
      refresh: "Odswiez",
      loading: "Pobieram panel zdrowia systemu...",
      healthMonitor: "Health monitor",
      systemStatus: "Status systemu",
      dataSource: "Zrodlo danych",
      rpc: "backend RPC",
      fallback: "fallback",
      lastRefresh: "Ostatnie odswiezenie",
      database: "Baza",
      unknown: "unknown",
      dbContact: "Kontakt z baza",
      dbHint: "Jesli panel zwrocil dane z RPC, polaczenie z baza dziala.",
      apiStatus: "Status API",
      apiHint: "Stan backendu administratorskiego i kluczowych wywolan RPC.",
      appVersion: "Wersja aplikacji",
      appVersionHint: "Wersja frontendowego buildu zgodna z package.json.",
      userCount: "Liczba uzytkownikow",
      userCountHint: "Liczba kont widocznych w panelu administracyjnym.",
      activeUsers: "Aktywni uzytkownicy",
      activeUsersHint: "Unikalni operatorzy z aktywna sesja.",
      activeSessions: "Aktywne sesje",
      activeSessionsHint: "Sesje aktywne w systemie.",
      pausedSessions: "Sesje wstrzymane",
      pausedSessionsHint: "Sesje odlozone, ale nadal otwarte.",
      locationsInProgress: "Lokalizacje w toku",
      locationsInProgressHint: "Lokalizacje aktualnie przypisane do operatorow.",
      openProblems: "Otwarte problemy",
      openProblemsHint: "Zgloszenia problemow czekajace na reakcje.",
      entriesLastHour: "Wpisy z ostatniej godziny",
      entriesLastHourHint: "Przy aktywnych sesjach zero wpisow moze oznaczac problem operacyjny.",
      lockedAccounts: "Konta zablokowane",
      lockedAccountsHint: "Konta z aktywna blokada lub lock_until w przyszlosci.",
      usersWithoutRole: "Profile bez roli",
      usersWithoutRoleHint: "Brak roli moze powodowac nieprzewidywalne dostepy.",
      staleSessions: "Martwe sesje",
      staleSessionsHint: "Aktywne sesje bez swiezej aktywnosci.",
      staleLocations: "Porzucone lokalizacje",
      staleLocationsHint: "Lokalizacje in_progress bez zywej sesji lub z przeterminowanym lockiem.",
      processStatusTitle: "Status procesow systemowych",
      processStatusDesc: "Techniczne zdrowie backendu administratorskiego, RPC i logowania sygnalow pomocniczych.",
      noProcessData: "Brak szczegolowych danych o procesach systemowych.",
      attentionAlertsTitle: "Alerty wymagajace uwagi",
      attentionAlertsDesc: "Pozycje ostrzegawcze sa oznaczone na zolto, a zagrozenia krytyczne na czerwono.",
      criticalCount: "Krytyczne",
      warningCount: "Ostrzezenia",
      noOpenAlerts: "Brak otwartych alertow. System nie sygnalizuje na ten moment istotnych odchylen.",
      allSignalsTitle: "Wszystkie sygnaly systemowe",
      allSignalsDesc: "Pelna lista metryk kontrolnych i ich aktualnej interpretacji.",
      noSignals: "Backend nie zwrocil listy szczegolowych sygnalow. Widoczne sa tylko metryki zbiorcze.",
      importStatusTitle: "Status importow danych",
      importStatusDesc: "Ostatnie importy produktow, stocku, cen i mapy magazynu widoczne dla administratora.",
      time: "Czas",
      importType: "Typ importu",
      userId: "User ID",
      noImports: "Brak ostatnich importow danych.",
      errorLogTitle: "Log bledow systemu",
      errorLogDesc: "Ostatnie bledy aplikacyjne i fetch failures widoczne bez przechodzenia do osobnej zakladki logow.",
      area: "Obszar",
      message: "Komunikat",
      user: "Uzytkownik",
      noErrorLogs: "Brak zarejestrowanych bledow aplikacyjnych.",
      noStatusData: "Brak danych statusowych do wyswietlenia.",
      detailsTitle: "Szczegoly wskaznika",
      detailsHint: "Kliknij kafel, aby zobaczyc szczegoly operacyjne.",
      detailsEmpty: "Brak szczegolowych rekordow dla tego wskaznika.",
      detailsLoadError: "Nie udalo sie pobrac szczegolow wskaznika.",
      close: "Zamknij",
      location: "Lokalizacja",
      zone: "Strefa",
      status: "Status",
      operator: "Operator",
      operatorEmail: "Email operatora",
      openedFor: "Otwarte od",
      lastSignal: "Ostatnia aktywnosc",
      session: "Sesja",
      problem: "Problem",
      note: "Notatka",
      sourceProcess: "Proces",
      quantity: "Ilosc",
      type: "Typ",
      lockUntil: "Blokada do",
      sessionsCount: "Liczba sesji",
    },
    en: {
      severityCritical: "Critical",
      severityWarning: "Warning",
      severityOk: "OK",
      systemSignal: "System signal",
      valueLabel: "Value",
      noAdditionalDescription: "No additional description.",
      loadError: "Failed to load system status",
      title: "Statuses",
      subtitle: "System health panel for administrators. This view highlights warning signals and places that may threaten process continuity.",
      backLabel: "Back to settings",
      refresh: "Refresh",
      loading: "Loading system health panel...",
      healthMonitor: "Health monitor",
      systemStatus: "System status",
      dataSource: "Data source",
      rpc: "backend RPC",
      fallback: "fallback",
      lastRefresh: "Last refresh",
      database: "Database",
      unknown: "unknown",
      dbContact: "Database contact",
      dbHint: "If the panel returned RPC data, the database connection works.",
      apiStatus: "API status",
      apiHint: "State of the admin backend and key RPC calls.",
      appVersion: "App version",
      appVersionHint: "Frontend build version aligned with package.json.",
      userCount: "User count",
      userCountHint: "Number of accounts visible in the admin panel.",
      activeUsers: "Active users",
      activeUsersHint: "Unique operators with an active session.",
      activeSessions: "Active sessions",
      activeSessionsHint: "Sessions currently active in the system.",
      pausedSessions: "Paused sessions",
      pausedSessionsHint: "Sessions set aside but still open.",
      locationsInProgress: "Locations in progress",
      locationsInProgressHint: "Locations currently assigned to operators.",
      openProblems: "Open problems",
      openProblemsHint: "Problem reports waiting for action.",
      entriesLastHour: "Entries in the last hour",
      entriesLastHourHint: "With active sessions, zero entries may indicate an operational issue.",
      lockedAccounts: "Locked accounts",
      lockedAccountsHint: "Accounts with active lock or lock_until in the future.",
      usersWithoutRole: "Profiles without role",
      usersWithoutRoleHint: "Missing role may cause unpredictable access.",
      staleSessions: "Stale sessions",
      staleSessionsHint: "Active sessions without recent activity.",
      staleLocations: "Abandoned locations",
      staleLocationsHint: "In-progress locations without a live session or with an expired lock.",
      processStatusTitle: "System process status",
      processStatusDesc: "Technical health of the admin backend, RPC, and auxiliary signal logging.",
      noProcessData: "No detailed system process data available.",
      attentionAlertsTitle: "Alerts that need attention",
      attentionAlertsDesc: "Warning items are highlighted in yellow, while critical threats are shown in red.",
      criticalCount: "Critical",
      warningCount: "Warnings",
      noOpenAlerts: "No open alerts. The system is not signaling major deviations at the moment.",
      allSignalsTitle: "All system signals",
      allSignalsDesc: "Complete list of control metrics and their current interpretation.",
      noSignals: "Backend did not return detailed signal list. Only aggregate metrics are visible.",
      importStatusTitle: "Data import status",
      importStatusDesc: "Latest product, stock, price, and warehouse map imports visible to the administrator.",
      time: "Time",
      importType: "Import type",
      userId: "User ID",
      noImports: "No recent data imports.",
      errorLogTitle: "System error log",
      errorLogDesc: "Latest application errors and fetch failures without switching to a separate logs tab.",
      area: "Area",
      message: "Message",
      user: "User",
      noErrorLogs: "No application errors recorded.",
      noStatusData: "No status data to display.",
      detailsTitle: "Metric details",
      detailsHint: "Click a card to open the operational details.",
      detailsEmpty: "No detailed records for this metric.",
      detailsLoadError: "Could not load metric details.",
      close: "Close",
      location: "Location",
      zone: "Zone",
      status: "Status",
      operator: "Operator",
      operatorEmail: "Operator email",
      openedFor: "Open for",
      lastSignal: "Last activity",
      session: "Session",
      problem: "Problem",
      note: "Note",
      sourceProcess: "Process",
      quantity: "Quantity",
      type: "Type",
      lockUntil: "Locked until",
      sessionsCount: "Sessions count",
    },
    de: {
      severityCritical: "Kritisch",
      severityWarning: "Warnung",
      severityOk: "OK",
      systemSignal: "Systemsignal",
      valueLabel: "Wert",
      noAdditionalDescription: "Keine zusaetzliche Beschreibung.",
      loadError: "Systemstatus konnte nicht geladen werden",
      title: "Status",
      subtitle: "Systemgesundheits-Panel fuer Administratoren. Diese Ansicht hebt Warnsignale und Bereiche hervor, die die Prozesskontinuitaet gefaehrden koennten.",
      backLabel: "Zurueck zu Einstellungen",
      refresh: "Aktualisieren",
      loading: "Systemgesundheits-Panel wird geladen...",
      healthMonitor: "Health monitor",
      systemStatus: "Systemstatus",
      dataSource: "Datenquelle",
      rpc: "Backend-RPC",
      fallback: "Fallback",
      lastRefresh: "Letzte Aktualisierung",
      database: "Datenbank",
      unknown: "unknown",
      dbContact: "Datenbankkontakt",
      dbHint: "Wenn das Panel RPC-Daten liefert, funktioniert die Datenbankverbindung.",
      apiStatus: "API-Status",
      apiHint: "Status des Admin-Backends und wichtiger RPC-Aufrufe.",
      appVersion: "App-Version",
      appVersionHint: "Frontend-Build-Version gemaess package.json.",
      userCount: "Benutzeranzahl",
      userCountHint: "Anzahl der im Admin-Panel sichtbaren Konten.",
      activeUsers: "Aktive Benutzer",
      activeUsersHint: "Eindeutige Operatoren mit aktiver Sitzung.",
      activeSessions: "Aktive Sitzungen",
      activeSessionsHint: "Derzeit aktive Sitzungen im System.",
      pausedSessions: "Pausierte Sitzungen",
      pausedSessionsHint: "Zurueckgestellte, aber noch offene Sitzungen.",
      locationsInProgress: "Lagerplaetze in Bearbeitung",
      locationsInProgressHint: "Lagerplaetze, die aktuell Operatoren zugewiesen sind.",
      openProblems: "Offene Probleme",
      openProblemsHint: "Problem-Meldungen, die auf Reaktion warten.",
      entriesLastHour: "Eintraege der letzten Stunde",
      entriesLastHourHint: "Bei aktiven Sitzungen koennen null Eintraege auf ein operatives Problem hindeuten.",
      lockedAccounts: "Gesperrte Konten",
      lockedAccountsHint: "Konten mit aktiver Sperre oder lock_until in der Zukunft.",
      usersWithoutRole: "Profile ohne Rolle",
      usersWithoutRoleHint: "Fehlende Rollen koennen unvorhersehbare Zugriffe verursachen.",
      staleSessions: "Verwaiste Sitzungen",
      staleSessionsHint: "Aktive Sitzungen ohne aktuelle Aktivitaet.",
      staleLocations: "Verlassene Lagerplaetze",
      staleLocationsHint: "In-Bearbeitung-Lagerplaetze ohne aktive Sitzung oder mit abgelaufenem Lock.",
      processStatusTitle: "Status der Systemprozesse",
      processStatusDesc: "Technische Gesundheit des Admin-Backends, RPC und der Hilfssignal-Protokollierung.",
      noProcessData: "Keine detaillierten Daten zu Systemprozessen vorhanden.",
      attentionAlertsTitle: "Warnungen mit Handlungsbedarf",
      attentionAlertsDesc: "Warnungen sind gelb markiert, kritische Risiken rot.",
      criticalCount: "Kritisch",
      warningCount: "Warnungen",
      noOpenAlerts: "Keine offenen Warnungen. Das System meldet derzeit keine wesentlichen Abweichungen.",
      allSignalsTitle: "Alle Systemsignale",
      allSignalsDesc: "Vollstaendige Liste der Kontrollmetriken und ihrer aktuellen Interpretation.",
      noSignals: "Das Backend hat keine detaillierte Signalliste geliefert. Sichtbar sind nur aggregierte Kennzahlen.",
      importStatusTitle: "Status der Datenimporte",
      importStatusDesc: "Letzte Importe von Produkten, Bestand, Preisen und Lagerplan fuer Administratoren.",
      time: "Zeit",
      importType: "Importtyp",
      userId: "User-ID",
      noImports: "Keine aktuellen Datenimporte.",
      errorLogTitle: "Systemfehlerprotokoll",
      errorLogDesc: "Neueste Anwendungsfehler und Fetch-Fehler ohne Wechsel in einen separaten Log-Tab.",
      area: "Bereich",
      message: "Meldung",
      user: "Benutzer",
      noErrorLogs: "Keine Anwendungsfehler protokolliert.",
      noStatusData: "Keine Statusdaten zur Anzeige vorhanden.",
      detailsTitle: "Kennzahl-Details",
      detailsHint: "Klicke auf eine Kachel, um die operativen Details zu sehen.",
      detailsEmpty: "Keine Detaildatensatze fuer diese Kennzahl vorhanden.",
      detailsLoadError: "Kennzahl-Details konnten nicht geladen werden.",
      close: "Schliessen",
      location: "Lokation",
      zone: "Zone",
      status: "Status",
      operator: "Operator",
      operatorEmail: "Operator-E-Mail",
      openedFor: "Geoffnet seit",
      lastSignal: "Letzte Aktivitat",
      session: "Sitzung",
      problem: "Problem",
      note: "Notiz",
      sourceProcess: "Prozess",
      quantity: "Menge",
      type: "Typ",
      lockUntil: "Gesperrt bis",
      sessionsCount: "Sitzungsanzahl",
    },
  }[language];

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        setLoading(true);
        const result = await fetchSystemStatus();
        if (!cancelled) {
          setStatus(result);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || copy.loadError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, copy.loadError]);

  const summary = status?.summary || null;
  const alerts = Array.isArray(status?.alerts) ? status.alerts : [];
  const importLogs = Array.isArray(status?.importLogs) ? status.importLogs : [];
  const errorLogs = Array.isArray(status?.errorLogs) ? status.errorLogs : [];
  const processStatuses = Array.isArray(status?.processStatuses) ? status.processStatuses : [];

  const groupedAlerts = useMemo(() => {
    const critical = alerts.filter((item) =>
      ["critical", "danger", "error"].includes(String(item.severity || "").toLowerCase()),
    );
    const warning = alerts.filter((item) =>
      ["warning", "warn"].includes(String(item.severity || "").toLowerCase()),
    );
    const healthy = alerts.filter(
      (item) =>
        !["critical", "danger", "error", "warning", "warn"].includes(
          String(item.severity || "").toLowerCase(),
        ),
    );

    return { critical, warning, healthy };
  }, [alerts]);

  const overallMeta = getSeverityMeta(summary?.overall_status, copy);

  const detailMetricTitles = {
    active_users: copy.activeUsers,
    active_sessions: copy.activeSessions,
    paused_sessions: copy.pausedSessions,
    locations_in_progress: copy.locationsInProgress,
    open_problems: copy.openProblems,
    entries_last_hour: copy.entriesLastHour,
    locked_accounts: copy.lockedAccounts,
    stale_sessions: copy.staleSessions,
    stale_locations: copy.staleLocations,
  };

  async function openDetail(metricKey) {
    try {
      setDetailLoading(true);
      setDetailError("");
      const details = await fetchSystemStatusDetails(metricKey);
      setDetailModal({
        metricKey,
        title: detailMetricTitles[metricKey] || copy.detailsTitle,
        rows: details?.rows || [],
      });
    } catch (err) {
      setDetailError(err.message || copy.detailsLoadError);
      setDetailModal({
        metricKey,
        title: detailMetricTitles[metricKey] || copy.detailsTitle,
        rows: [],
      });
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetailModal() {
    if (detailLoading) return;
    setDetailModal(null);
    setDetailError("");
  }

  function renderDetailCard(row) {
    switch (detailModal?.metricKey) {
      case "locations_in_progress":
      case "stale_locations":
        return (
          <div key={row.id} className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{row.location_code}</h3>
                <p>{copy.zone}: {row.zone || "-"}</p>
              </div>
              <span className="system-alert__pill system-alert__pill--warning">{row.status || "-"}</span>
            </div>
            <div className="system-status-grid">
              <DetailStat label={copy.operator} value={row.operator_name} />
              <DetailStat label={copy.operatorEmail} value={row.operator_email} />
              <DetailStat label={copy.session} value={row.session_status} />
              <DetailStat label={copy.openedFor} value={row.minutes_open != null ? `${row.minutes_open} min` : "-"} />
              <DetailStat label={copy.lastSignal} value={row.minutes_since_signal != null ? `${row.minutes_since_signal} min` : "-"} />
            </div>
          </div>
        );
      case "active_sessions":
      case "paused_sessions":
      case "stale_sessions":
        return (
          <div key={row.id} className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{row.operator_name}</h3>
                <p>{row.operator_email}</p>
              </div>
              <span className="system-alert__pill system-alert__pill--warning">{row.status || "-"}</span>
            </div>
            <div className="system-status-grid">
              <DetailStat label={copy.openedFor} value={row.minutes_open != null ? `${row.minutes_open} min` : "-"} />
              <DetailStat label={copy.lastSignal} value={row.minutes_since_signal != null ? `${row.minutes_since_signal} min` : "-"} />
              <DetailStat label={copy.time} value={formatDateTime(row.started_at, locale)} />
            </div>
          </div>
        );
      case "open_problems":
        return (
          <div key={row.id} className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{row.location_code}</h3>
                <p>{copy.zone}: {row.zone || "-"}</p>
              </div>
              <span className="system-alert__pill system-alert__pill--critical">{row.status || "-"}</span>
            </div>
            <div className="system-status-grid">
              <DetailStat label={copy.problem} value={row.issue_type} />
              <DetailStat label={copy.sourceProcess} value={row.source_process} />
              <DetailStat label={copy.operatorEmail} value={row.operator_email} />
              <DetailStat label={copy.time} value={formatDateTime(row.created_at, locale)} />
            </div>
            {row.note ? <div className="system-alert__recommendation">{row.note}</div> : null}
          </div>
        );
      case "entries_last_hour":
        return (
          <div key={row.id} className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{row.location}</h3>
                <p>{row.operator_name} • {row.operator_email}</p>
              </div>
              <span className="system-alert__pill system-alert__pill--healthy">{row.type || "-"}</span>
            </div>
            <div className="system-status-grid">
              <DetailStat label="SKU" value={row.sku} />
              <DetailStat label="EAN" value={row.ean} />
              <DetailStat label="LOT" value={row.lot} />
              <DetailStat label={copy.quantity} value={row.quantity} />
              <DetailStat label={copy.time} value={formatDateTime(row.timestamp, locale)} />
              <DetailStat label={copy.session} value={row.session_id} />
            </div>
          </div>
        );
      case "active_users":
        return (
          <div key={row.id} className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{row.operator_name}</h3>
                <p>{row.operator_email}</p>
              </div>
            </div>
            <div className="system-status-grid">
              <DetailStat label={copy.sessionsCount} value={row.active_sessions} />
              <DetailStat label={copy.lastSignal} value={formatDateTime(row.last_activity, locale)} />
            </div>
          </div>
        );
      case "locked_accounts":
        return (
          <div key={row.user_id} className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{row.name || row.email || "-"}</h3>
                <p>{row.email || "-"}</p>
              </div>
              <span className="system-alert__pill system-alert__pill--critical">{row.role || "-"}</span>
            </div>
            <div className="system-status-grid">
              <DetailStat label={copy.lockUntil} value={formatDateTime(row.lock_until, locale)} />
              <DetailStat label="Failed attempts" value={row.failed_attempts ?? "-"} />
              <DetailStat label="Login attempts" value={row.login_attempts ?? "-"} />
            </div>
          </div>
        );
      default:
        return (
          <div key={row.id || JSON.stringify(row)} className="app-card">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(row, null, 2)}</pre>
          </div>
        );
    }
  }

  return (
    <PageShell
      title={copy.title}
      subtitle={copy.subtitle}
      icon={<ActivitySquare size={26} />}
      backTo="/admin"
      backLabel={copy.backLabel}
      actions={
        <button
          type="button"
          className="app-button app-button--secondary app-button--md"
          onClick={() => setRefreshTick((value) => value + 1)}
        >
          <RefreshCw size={16} />
          {copy.refresh}
        </button>
      }
    >
      {loading ? <div className="app-card">{copy.loading}</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}

      {!loading && !error && summary ? (
        <>
          <div className={`system-status-hero system-status-hero--${overallMeta.tone}`}>
            <div>
              <div className="system-status-hero__eyebrow">{copy.healthMonitor}</div>
              <div className="system-status-hero__title-row">
                <div className={`system-status-hero__icon system-status-hero__icon--${overallMeta.tone}`}>
                  {overallMeta.icon}
                </div>
                <div>
                  <h2>{summary.overall_label || copy.systemStatus}</h2>
                  <p>
                    {copy.dataSource}: <strong>{status?.source === "rpc" ? copy.rpc : copy.fallback}</strong>
                    {" • "}{copy.lastRefresh}: <strong>{formatDateTime(summary.generated_at, locale)}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="system-status-hero__chips">
              <span className={`system-alert__pill system-alert__pill--${overallMeta.tone}`}>
                {overallMeta.label}
              </span>
              <span className="system-status-hero__chip">
                {copy.database}: {String(summary.database_status || copy.unknown)}
              </span>
            </div>
          </div>

          <div className="system-status-grid">
            <HealthMetricCard
              icon={<Database size={20} />}
              label={copy.dbContact}
              value={String(summary.database_status || copy.unknown)}
              hint={copy.dbHint}
              tone={String(summary.database_status || "").toLowerCase() === "connected" ? "healthy" : "warning"}
            />
            <HealthMetricCard
              icon={<ShieldCheck size={20} />}
              label={copy.apiStatus}
              value={String(summary.api_status || copy.unknown)}
              hint={copy.apiHint}
              tone={String(summary.api_status || "").toLowerCase() === "connected" ? "healthy" : "warning"}
            />
            <HealthMetricCard
              icon={<ActivitySquare size={20} />}
              label={copy.appVersion}
              value={String(summary.app_version || "-")}
              hint={copy.appVersionHint}
              tone="neutral"
            />
            <HealthMetricCard
              icon={<Users size={20} />}
              label={copy.userCount}
              value={formatMetric(summary.total_users, locale)}
              hint={copy.userCountHint}
              tone="neutral"
            />
            <HealthMetricCard
              icon={<Users size={20} />}
              label={copy.activeUsers}
              value={formatMetric(summary.active_users, locale)}
              hint={copy.activeUsersHint}
              onClick={() => openDetail("active_users")}
            />
            <HealthMetricCard
              icon={<ActivitySquare size={20} />}
              label={copy.activeSessions}
              value={formatMetric(summary.active_sessions, locale)}
              hint={copy.activeSessionsHint}
              tone={Number(summary.stale_sessions || 0) > 0 ? "warning" : "neutral"}
              onClick={() => openDetail("active_sessions")}
            />
            <HealthMetricCard
              icon={<PauseCircle size={20} />}
              label={copy.pausedSessions}
              value={formatMetric(summary.paused_sessions, locale)}
              hint={copy.pausedSessionsHint}
              tone={Number(summary.paused_sessions || 0) >= 5 ? "warning" : "neutral"}
              onClick={() => openDetail("paused_sessions")}
            />
            <HealthMetricCard
              icon={<Waypoints size={20} />}
              label={copy.locationsInProgress}
              value={formatMetric(summary.in_progress_locations, locale)}
              hint={copy.locationsInProgressHint}
              tone={Number(summary.stale_locations || 0) > 0 ? "warning" : "neutral"}
              onClick={() => openDetail("locations_in_progress")}
            />
            <HealthMetricCard
              icon={<ShieldAlert size={20} />}
              label={copy.openProblems}
              value={formatMetric(summary.unresolved_issues, locale)}
              hint={copy.openProblemsHint}
              tone={
                Number(summary.unresolved_issues || 0) >= 5
                  ? "critical"
                  : Number(summary.unresolved_issues || 0) > 0
                  ? "warning"
                    : "healthy"
              }
              onClick={() => openDetail("open_problems")}
            />
            <HealthMetricCard
              icon={<ActivitySquare size={20} />}
              label={copy.entriesLastHour}
              value={formatMetric(summary.recent_entries_1h, locale)}
              hint={copy.entriesLastHourHint}
              tone={
                Number(summary.active_sessions || 0) > 0 && Number(summary.recent_entries_1h || 0) === 0
                  ? "warning"
                  : "neutral"
              }
              onClick={() => openDetail("entries_last_hour")}
            />
            <HealthMetricCard
              icon={<Lock size={20} />}
              label={copy.lockedAccounts}
              value={formatMetric(summary.locked_accounts, locale)}
              hint={copy.lockedAccountsHint}
              tone={Number(summary.locked_accounts || 0) > 0 ? "warning" : "healthy"}
              onClick={() => openDetail("locked_accounts")}
            />
            <HealthMetricCard
              icon={<ShieldAlert size={20} />}
              label={copy.usersWithoutRole}
              value={formatMetric(summary.users_without_role, locale)}
              hint={copy.usersWithoutRoleHint}
              tone={Number(summary.users_without_role || 0) > 0 ? "critical" : "healthy"}
            />
            <HealthMetricCard
              icon={<OctagonAlert size={20} />}
              label={copy.staleSessions}
              value={formatMetric(summary.stale_sessions, locale)}
              hint={copy.staleSessionsHint}
              tone={Number(summary.stale_sessions || 0) >= 3 ? "critical" : Number(summary.stale_sessions || 0) > 0 ? "warning" : "healthy"}
              onClick={() => openDetail("stale_sessions")}
            />
            <HealthMetricCard
              icon={<OctagonAlert size={20} />}
              label={copy.staleLocations}
              value={formatMetric(summary.stale_locations, locale)}
              hint={copy.staleLocationsHint}
              tone={Number(summary.stale_locations || 0) > 0 ? "critical" : "healthy"}
              onClick={() => openDetail("stale_locations")}
            />
          </div>

          <div className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{copy.processStatusTitle}</h3>
                <p>{copy.processStatusDesc}</p>
              </div>
            </div>

            {processStatuses.length ? (
              <div className="system-status-grid">
                {processStatuses.map((item) => (
                  <HealthMetricCard
                    key={item.code}
                    icon={
                      getProcessTone(item.status) === "healthy" ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <AlertTriangle size={20} />
                      )
                    }
                    label={item.label}
                    value={String(item.status || copy.unknown)}
                    hint={item.description}
                    tone={getProcessTone(item.status)}
                  />
                ))}
              </div>
            ) : (
              <div className="app-empty-state">
                {copy.noProcessData}
              </div>
            )}
          </div>

          <div className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{copy.attentionAlertsTitle}</h3>
                <p>{copy.attentionAlertsDesc}</p>
              </div>
              <div className="system-status-section-summary">
                <span className="system-alert__pill system-alert__pill--critical">
                  {copy.criticalCount}: {groupedAlerts.critical.length}
                </span>
                <span className="system-alert__pill system-alert__pill--warning">
                  {copy.warningCount}: {groupedAlerts.warning.length}
                </span>
              </div>
            </div>

            {groupedAlerts.critical.length || groupedAlerts.warning.length ? (
              <div className="system-alert-list">
                {groupedAlerts.critical.map((item) => (
                  <AlertRow key={item.code || item.title} item={item} copy={copy} />
                ))}
                {groupedAlerts.warning.map((item) => (
                  <AlertRow key={item.code || item.title} item={item} copy={copy} />
                ))}
              </div>
            ) : (
              <div className="app-empty-state">
                {copy.noOpenAlerts}
              </div>
            )}
          </div>

          <div className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{copy.allSignalsTitle}</h3>
                <p>{copy.allSignalsDesc}</p>
              </div>
            </div>

            {alerts.length ? (
              <div className="system-alert-list system-alert-list--compact">
                {alerts.map((item) => (
                  <AlertRow key={`${item.code || item.title}-${item.severity}`} item={item} copy={copy} />
                ))}
              </div>
            ) : (
              <div className="app-empty-state">
                {copy.noSignals}
              </div>
            )}
          </div>

          <div className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{copy.importStatusTitle}</h3>
                <p>{copy.importStatusDesc}</p>
              </div>
            </div>

            {importLogs.length ? (
              <div className="dashboard-table-scroll">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>{copy.time}</th>
                      <th>{copy.importType}</th>
                      <th>{copy.userId}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importLogs.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateTime(row.created_at, locale)}</td>
                        <td>
                          <span className="history-status-chip">
                            <Download size={14} style={{ marginRight: 6 }} />
                            {row.type || "-"}
                          </span>
                        </td>
                        <td>{row.user_id || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="app-empty-state">{copy.noImports}</div>
            )}
          </div>

          <div className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>{copy.errorLogTitle}</h3>
                <p>{copy.errorLogDesc}</p>
              </div>
            </div>

            {errorLogs.length ? (
              <div className="dashboard-table-scroll">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>{copy.time}</th>
                      <th>{copy.area}</th>
                      <th>{copy.message}</th>
                      <th>{copy.user}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorLogs.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateTime(row.timestamp, locale)}</td>
                        <td>{row.entity || "-"}</td>
                        <td>{row.message || "-"}</td>
                        <td>{row.userName || row.userEmail || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="app-empty-state">{copy.noErrorLogs}</div>
            )}
          </div>
        </>
      ) : null}

      {!loading && !error && !summary ? (
        <div className="app-card">
          <div className="app-empty-state">{copy.noStatusData}</div>
        </div>
      ) : null}

      {detailModal ? (
        <div className="history-modal-overlay" onClick={closeDetailModal}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>
                  {detailModal.title}
                </h2>
                <p className="process-panel__subtitle">{copy.detailsHint}</p>
              </div>
              <Button variant="secondary" onClick={closeDetailModal} disabled={detailLoading}>
                {copy.close}
              </Button>
            </div>

            {detailError ? <div className="input-error-text">{detailError}</div> : null}

            {detailLoading ? (
              <div className="app-card">{copy.loading}</div>
            ) : detailModal.rows.length ? (
              <div className="system-alert-list">
                {detailModal.rows.map((row) => renderDetailCard(row))}
              </div>
            ) : (
              <div className="app-empty-state">{copy.detailsEmpty}</div>
            )}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
