import {
  ActivitySquare,
  AlertTriangle,
  CheckCircle2,
  Database,
  OctagonAlert,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  Users,
  Waypoints,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/layout/PageShell";
import { fetchSystemStatus } from "../../core/api/systemStatusApi";

function getSeverityMeta(severity) {
  switch (String(severity || "").toLowerCase()) {
    case "critical":
    case "danger":
    case "error":
      return {
        tone: "critical",
        label: "Krytyczne",
        icon: <OctagonAlert size={18} />,
      };
    case "warning":
    case "warn":
      return {
        tone: "warning",
        label: "Uwaga",
        icon: <AlertTriangle size={18} />,
      };
    default:
      return {
        tone: "healthy",
        label: "OK",
        icon: <CheckCircle2 size={18} />,
      };
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatMetric(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("pl-PL").format(number);
}

function HealthMetricCard({ icon, label, value, hint, tone = "neutral" }) {
  return (
    <div className={`system-status-metric system-status-metric--${tone}`}>
      <div className="system-status-metric__icon">{icon}</div>
      <div>
        <div className="system-status-metric__label">{label}</div>
        <div className="system-status-metric__value">{value}</div>
        {hint ? <div className="system-status-metric__hint">{hint}</div> : null}
      </div>
    </div>
  );
}

function AlertRow({ item }) {
  const meta = getSeverityMeta(item.severity);

  return (
    <div className={`system-alert system-alert--${meta.tone}`}>
      <div className="system-alert__badge">{meta.icon}</div>
      <div className="system-alert__body">
        <div className="system-alert__header">
          <strong>{item.title || item.code || "Sygnał systemowy"}</strong>
          <span className={`system-alert__pill system-alert__pill--${meta.tone}`}>
            {meta.label}
          </span>
        </div>
        <div className="system-alert__meta">
          {item.category ? <span>{item.category}</span> : null}
          {item.value !== undefined && item.value !== null ? (
            <span>Wartosc: {String(item.value)}</span>
          ) : null}
        </div>
        <p>{item.description || "Brak dodatkowego opisu."}</p>
        {item.recommendation ? (
          <div className="system-alert__recommendation">{item.recommendation}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function SystemStatusModern() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

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
          setError(err.message || "Nie udalo sie pobrac statusu systemu");
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
  }, [refreshTick]);

  const summary = status?.summary || null;
  const alerts = Array.isArray(status?.alerts) ? status.alerts : [];

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

  const overallMeta = getSeverityMeta(summary?.overall_status);

  return (
    <PageShell
      title="Statusy"
      subtitle="Panel zdrowia systemu dla administratora. Widok wychwytuje sygnaly ostrzegawcze i miejsca, ktore moga zagrozic ciaglosci procesu."
      icon={<ActivitySquare size={26} />}
      backTo="/admin"
      backLabel="Powrot do ustawien"
      actions={
        <button
          type="button"
          className="app-button app-button--secondary app-button--md"
          onClick={() => setRefreshTick((value) => value + 1)}
        >
          <RefreshCw size={16} />
          Odswiez
        </button>
      }
    >
      {loading ? <div className="app-card">Pobieram panel zdrowia systemu...</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}

      {!loading && !error && summary ? (
        <>
          <div className={`system-status-hero system-status-hero--${overallMeta.tone}`}>
            <div>
              <div className="system-status-hero__eyebrow">Health monitor</div>
              <div className="system-status-hero__title-row">
                <div className={`system-status-hero__icon system-status-hero__icon--${overallMeta.tone}`}>
                  {overallMeta.icon}
                </div>
                <div>
                  <h2>{summary.overall_label || "Status systemu"}</h2>
                  <p>
                    Zrodlo danych: <strong>{status?.source === "rpc" ? "backend RPC" : "fallback"}</strong>
                    {" • "}Ostatnie odswiezenie: <strong>{formatDateTime(summary.generated_at)}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="system-status-hero__chips">
              <span className={`system-alert__pill system-alert__pill--${overallMeta.tone}`}>
                {overallMeta.label}
              </span>
              <span className="system-status-hero__chip">
                Baza: {String(summary.database_status || "unknown")}
              </span>
            </div>
          </div>

          <div className="system-status-grid">
            <HealthMetricCard
              icon={<Database size={20} />}
              label="Kontakt z baza"
              value={String(summary.database_status || "unknown")}
              hint="Jesli panel zwrocil dane z RPC, polaczenie z baza dziala."
              tone={String(summary.database_status || "").toLowerCase() === "connected" ? "healthy" : "warning"}
            />
            <HealthMetricCard
              icon={<Users size={20} />}
              label="Aktywni uzytkownicy"
              value={formatMetric(summary.active_users)}
              hint="Unikalni operatorzy z aktywna sesja."
            />
            <HealthMetricCard
              icon={<ActivitySquare size={20} />}
              label="Aktywne sesje"
              value={formatMetric(summary.active_sessions)}
              hint="Sesje aktywne w systemie."
              tone={Number(summary.stale_sessions || 0) > 0 ? "warning" : "neutral"}
            />
            <HealthMetricCard
              icon={<PauseCircle size={20} />}
              label="Sesje wstrzymane"
              value={formatMetric(summary.paused_sessions)}
              hint="Sesje odlozone, ale nadal otwarte."
              tone={Number(summary.paused_sessions || 0) >= 5 ? "warning" : "neutral"}
            />
            <HealthMetricCard
              icon={<Waypoints size={20} />}
              label="Lokalizacje w toku"
              value={formatMetric(summary.in_progress_locations)}
              hint="Lokalizacje aktualnie przypisane do operatorow."
              tone={Number(summary.stale_locations || 0) > 0 ? "warning" : "neutral"}
            />
            <HealthMetricCard
              icon={<ShieldAlert size={20} />}
              label="Otwarte problemy"
              value={formatMetric(summary.unresolved_issues)}
              hint="Zgloszenia problemow czekajace na reakcje."
              tone={
                Number(summary.unresolved_issues || 0) >= 5
                  ? "critical"
                  : Number(summary.unresolved_issues || 0) > 0
                    ? "warning"
                    : "healthy"
              }
            />
            <HealthMetricCard
              icon={<ActivitySquare size={20} />}
              label="Wpisy z ostatniej godziny"
              value={formatMetric(summary.recent_entries_1h)}
              hint="Przy aktywnych sesjach zero wpisow moze oznaczac problem operacyjny."
              tone={
                Number(summary.active_sessions || 0) > 0 && Number(summary.recent_entries_1h || 0) === 0
                  ? "warning"
                  : "neutral"
              }
            />
            <HealthMetricCard
              icon={<Users size={20} />}
              label="Konta zablokowane"
              value={formatMetric(summary.locked_accounts)}
              hint="Konta z aktywna blokada lub lock_until w przyszlosci."
              tone={Number(summary.locked_accounts || 0) > 0 ? "warning" : "healthy"}
            />
            <HealthMetricCard
              icon={<ShieldAlert size={20} />}
              label="Profile bez roli"
              value={formatMetric(summary.users_without_role)}
              hint="Brak roli moze powodowac nieprzewidywalne dostepy."
              tone={Number(summary.users_without_role || 0) > 0 ? "critical" : "healthy"}
            />
            <HealthMetricCard
              icon={<OctagonAlert size={20} />}
              label="Martwe sesje"
              value={formatMetric(summary.stale_sessions)}
              hint="Aktywne sesje bez swiezej aktywnosci."
              tone={Number(summary.stale_sessions || 0) >= 3 ? "critical" : Number(summary.stale_sessions || 0) > 0 ? "warning" : "healthy"}
            />
            <HealthMetricCard
              icon={<OctagonAlert size={20} />}
              label="Porzucone lokalizacje"
              value={formatMetric(summary.stale_locations)}
              hint="Lokalizacje in_progress bez zywej sesji lub z przeterminowanym lockiem."
              tone={Number(summary.stale_locations || 0) > 0 ? "critical" : "healthy"}
            />
          </div>

          <div className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>Alerty wymagajace uwagi</h3>
                <p>Pozycje ostrzegawcze sa oznaczone na zolto, a zagrozenia krytyczne na czerwono.</p>
              </div>
              <div className="system-status-section-summary">
                <span className="system-alert__pill system-alert__pill--critical">
                  Krytyczne: {groupedAlerts.critical.length}
                </span>
                <span className="system-alert__pill system-alert__pill--warning">
                  Ostrzezenia: {groupedAlerts.warning.length}
                </span>
              </div>
            </div>

            {groupedAlerts.critical.length || groupedAlerts.warning.length ? (
              <div className="system-alert-list">
                {groupedAlerts.critical.map((item) => (
                  <AlertRow key={item.code || item.title} item={item} />
                ))}
                {groupedAlerts.warning.map((item) => (
                  <AlertRow key={item.code || item.title} item={item} />
                ))}
              </div>
            ) : (
              <div className="app-empty-state">
                Brak otwartych alertow. System nie sygnalizuje na ten moment istotnych odchylen.
              </div>
            )}
          </div>

          <div className="app-card">
            <div className="system-status-section-header">
              <div>
                <h3>Wszystkie sygnaly systemowe</h3>
                <p>Pelna lista metryk kontrolnych i ich aktualnej interpretacji.</p>
              </div>
            </div>

            {alerts.length ? (
              <div className="system-alert-list system-alert-list--compact">
                {alerts.map((item) => (
                  <AlertRow key={`${item.code || item.title}-${item.severity}`} item={item} />
                ))}
              </div>
            ) : (
              <div className="app-empty-state">
                Backend nie zwrocil listy szczegolowych sygnalow. Widoczne sa tylko metryki zbiorcze.
              </div>
            )}
          </div>
        </>
      ) : null}

      {!loading && !error && !summary ? (
        <div className="app-card">
          <div className="app-empty-state">Brak danych statusowych do wyswietlenia.</div>
        </div>
      ) : null}
    </PageShell>
  );
}
