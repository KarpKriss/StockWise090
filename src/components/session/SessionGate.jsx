import { AlertTriangle, Laptop, PauseCircle, PlayCircle, ShieldAlert, Smartphone } from "lucide-react";
import { useSession } from "../../core/session/AppSession";
import PageShell from "../layout/PageShell";
import Button from "../ui/Button";

function formatSessionDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function detectDeviceLabel(device) {
  const source = String(device || "").toLowerCase();

  if (!source) {
    return "Nieznane urzadzenie";
  }

  if (source.includes("android") || source.includes("iphone") || source.includes("mobile")) {
    return "Urzadzenie mobilne";
  }

  return "Komputer / przegladarka";
}

export default function SessionGate({ children }) {
  const {
    pendingSession,
    sessionConflict,
    resumeSession,
    discardSession,
    resolveConflict,
    logoutAfterConflict,
  } = useSession();

  if (pendingSession) {
    const isPaused = String(pendingSession.status || "").toLowerCase() === "paused";
    const DeviceIcon = detectDeviceLabel(pendingSession.device) === "Urzadzenie mobilne" ? Smartphone : Laptop;

    return (
      <PageShell
        compact
        title={isPaused ? "Masz wstrzymana sesje" : "Wykryto niedokonczona sesje"}
        subtitle="Mozesz bezpiecznie wznowic poprzednia prace albo zamknac stara sesje i zaczac od nowa."
        icon={isPaused ? <PauseCircle size={26} /> : <AlertTriangle size={26} />}
      >
        <div className="app-card process-stage-card">
          <div className="process-stage-header">
            <div className="process-stage-header__icon">
              <DeviceIcon size={22} />
            </div>
            <div className="process-stage-header__text">
              <h2>{isPaused ? "Sesja oczekuje na wznowienie" : "Ostatnia sesja nie zostala zamknieta"}</h2>
              <p>
                Zanim rozpoczniesz nowa prace, wybierz co chcesz zrobic z poprzednia sesja.
              </p>
            </div>
          </div>

          <div className="process-meta-grid">
            <div className="process-meta-item">
              <div className="process-meta-item__label">Status</div>
              <div className="process-meta-item__value">{isPaused ? "Wstrzymana" : "Niedokonczona"}</div>
            </div>
            <div className="process-meta-item">
              <div className="process-meta-item__label">Rozpoczeta</div>
              <div className="process-meta-item__value">{formatSessionDate(pendingSession.created_at)}</div>
            </div>
            <div className="process-meta-item">
              <div className="process-meta-item__label">Urzadzenie</div>
              <div className="process-meta-item__value">{detectDeviceLabel(pendingSession.device)}</div>
            </div>
          </div>

          {pendingSession.device ? (
            <div className="process-section-card">
              <h3 className="process-section-card__title">Szczegoly techniczne</h3>
              <p className="process-panel__subtitle" style={{ margin: 0 }}>
                {pendingSession.device}
              </p>
            </div>
          ) : null}

          <div className="process-actions">
            <Button size="lg" onClick={resumeSession}>
              <PlayCircle size={16} />
              Wznow sesje
            </Button>
            <Button variant="secondary" size="lg" onClick={discardSession}>
              Zamknij i rozpocznij nowa
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (sessionConflict) {
    return (
      <PageShell
        compact
        title="Sesja aktywna na innym urzadzeniu"
        subtitle="Wykryto, ze to konto jest aktualnie uzywane w innym miejscu. Wybierz bezpieczna akcje."
        icon={<ShieldAlert size={26} />}
      >
        <div className="app-card process-stage-card">
          <div className="process-stage-header">
            <div className="process-stage-header__icon">
              <ShieldAlert size={22} />
            </div>
            <div className="process-stage-header__text">
              <h2>Potwierdz dalsze dzialanie</h2>
              <p>
                Mozesz przejac sesje na tym urzadzeniu albo wylogowac sie, aby nie ryzykowac konfliktu danych.
              </p>
            </div>
          </div>

          <div className="process-actions">
            <Button size="lg" onClick={resolveConflict}>
              Przejmij sesje
            </Button>
            <Button variant="secondary" size="lg" onClick={logoutAfterConflict}>
              Wyloguj
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return children;
}
