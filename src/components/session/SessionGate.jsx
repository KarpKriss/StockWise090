import { AlertTriangle, Laptop, PauseCircle, PlayCircle, ShieldAlert, Smartphone } from "lucide-react";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { useSession } from "../../core/session/AppSession";
import PageShell from "../layout/PageShell";
import Button from "../ui/Button";

function formatSessionDate(value, locale) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(locale);
}

function detectDeviceLabel(device, copy) {
  const source = String(device || "").toLowerCase();

  if (!source) {
    return copy.unknownDevice;
  }

  if (source.includes("android") || source.includes("iphone") || source.includes("mobile")) {
    return copy.mobileDevice;
  }

  return copy.desktopDevice;
}

export default function SessionGate({ children }) {
  const { language, locale } = useAppPreferences();
  const {
    pendingSession,
    sessionConflict,
    resumeSession,
    discardSession,
    resolveConflict,
    logoutAfterConflict,
  } = useSession();
  const copy = {
    pl: {
      unknownDevice: "Nieznane urzadzenie",
      mobileDevice: "Urzadzenie mobilne",
      desktopDevice: "Komputer / przegladarka",
      pausedTitle: "Masz wstrzymana sesje",
      pendingTitle: "Wykryto niedokonczona sesje",
      pendingSubtitle: "Mozesz bezpiecznie wznowic poprzednia prace albo zamknac stara sesje i zaczac od nowa.",
      pendingCardTitle: "Sesja oczekuje na wznowienie",
      unfinishedCardTitle: "Ostatnia sesja nie zostala zamknieta",
      pendingCardDesc: "Zanim rozpoczniesz nowa prace, wybierz co chcesz zrobic z poprzednia sesja.",
      statusLabel: "Status",
      startedLabel: "Rozpoczeta",
      deviceLabel: "Urzadzenie",
      pausedStatus: "Wstrzymana",
      unfinishedStatus: "Niedokonczona",
      technicalTitle: "Szczegoly techniczne",
      resume: "Wznow sesje",
      closeAndStart: "Zamknij i rozpocznij nowa",
      conflictTitle: "Sesja aktywna na innym urzadzeniu",
      conflictSubtitle: "Wykryto, ze to konto jest aktualnie uzywane w innym miejscu. Wybierz bezpieczna akcje.",
      conflictCardTitle: "Potwierdz dalsze dzialanie",
      conflictCardDesc: "Mozesz przejac sesje na tym urzadzeniu albo wylogowac sie, aby nie ryzykowac konfliktu danych.",
      takeOver: "Przejmij sesje",
      logout: "Wyloguj",
    },
    en: {
      unknownDevice: "Unknown device",
      mobileDevice: "Mobile device",
      desktopDevice: "Computer / browser",
      pausedTitle: "You have a paused session",
      pendingTitle: "An unfinished session was detected",
      pendingSubtitle: "You can safely resume the previous work or close the old session and start over.",
      pendingCardTitle: "Session waiting to be resumed",
      unfinishedCardTitle: "The previous session was not closed",
      pendingCardDesc: "Before you start new work, choose what you want to do with the previous session.",
      statusLabel: "Status",
      startedLabel: "Started",
      deviceLabel: "Device",
      pausedStatus: "Paused",
      unfinishedStatus: "Unfinished",
      technicalTitle: "Technical details",
      resume: "Resume session",
      closeAndStart: "Close and start new",
      conflictTitle: "Session active on another device",
      conflictSubtitle: "This account is currently used somewhere else. Choose a safe action.",
      conflictCardTitle: "Confirm how to continue",
      conflictCardDesc: "You can take over the session on this device or log out to avoid data conflicts.",
      takeOver: "Take over session",
      logout: "Log out",
    },
    de: {
      unknownDevice: "Unbekanntes Gerat",
      mobileDevice: "Mobiles Gerat",
      desktopDevice: "Computer / Browser",
      pausedTitle: "Du hast eine pausierte Sitzung",
      pendingTitle: "Eine unvollstandige Sitzung wurde erkannt",
      pendingSubtitle: "Du kannst die vorherige Arbeit sicher fortsetzen oder die alte Sitzung schliessen und neu starten.",
      pendingCardTitle: "Sitzung wartet auf Fortsetzung",
      unfinishedCardTitle: "Die vorherige Sitzung wurde nicht geschlossen",
      pendingCardDesc: "Bevor du eine neue Arbeit startest, wahle, was mit der vorherigen Sitzung geschehen soll.",
      statusLabel: "Status",
      startedLabel: "Gestartet",
      deviceLabel: "Gerat",
      pausedStatus: "Pausiert",
      unfinishedStatus: "Unvollstandig",
      technicalTitle: "Technische Details",
      resume: "Sitzung fortsetzen",
      closeAndStart: "Schliessen und neu starten",
      conflictTitle: "Sitzung auf anderem Gerat aktiv",
      conflictSubtitle: "Dieses Konto wird gerade an einem anderen Ort verwendet. Wahle eine sichere Aktion.",
      conflictCardTitle: "Weiteres Vorgehen bestatigen",
      conflictCardDesc: "Du kannst die Sitzung auf diesem Gerat ubernehmen oder dich abmelden, um Datenkonflikte zu vermeiden.",
      takeOver: "Sitzung ubernehmen",
      logout: "Abmelden",
    },
  }[language];

  if (pendingSession) {
    const isPaused = String(pendingSession.status || "").toLowerCase() === "paused";
    const DeviceIcon = detectDeviceLabel(pendingSession.device, copy) === copy.mobileDevice ? Smartphone : Laptop;

    return (
      <PageShell
        compact
        title={isPaused ? copy.pausedTitle : copy.pendingTitle}
        subtitle={copy.pendingSubtitle}
        icon={isPaused ? <PauseCircle size={26} /> : <AlertTriangle size={26} />}
      >
        <div className="app-card process-stage-card">
          <div className="process-stage-header">
            <div className="process-stage-header__icon">
              <DeviceIcon size={22} />
            </div>
            <div className="process-stage-header__text">
              <h2>{isPaused ? copy.pendingCardTitle : copy.unfinishedCardTitle}</h2>
              <p>{copy.pendingCardDesc}</p>
            </div>
          </div>

          <div className="process-meta-grid">
            <div className="process-meta-item">
              <div className="process-meta-item__label">{copy.statusLabel}</div>
              <div className="process-meta-item__value">{isPaused ? copy.pausedStatus : copy.unfinishedStatus}</div>
            </div>
            <div className="process-meta-item">
              <div className="process-meta-item__label">{copy.startedLabel}</div>
              <div className="process-meta-item__value">{formatSessionDate(pendingSession.created_at, locale)}</div>
            </div>
            <div className="process-meta-item">
              <div className="process-meta-item__label">{copy.deviceLabel}</div>
              <div className="process-meta-item__value">{detectDeviceLabel(pendingSession.device, copy)}</div>
            </div>
          </div>

          {pendingSession.device ? (
            <div className="process-section-card">
              <h3 className="process-section-card__title">{copy.technicalTitle}</h3>
              <p className="process-panel__subtitle" style={{ margin: 0 }}>
                {pendingSession.device}
              </p>
            </div>
          ) : null}

          <div className="process-actions">
            <Button size="lg" onClick={resumeSession}>
              <PlayCircle size={16} />
              {copy.resume}
            </Button>
            <Button variant="secondary" size="lg" onClick={discardSession}>
              {copy.closeAndStart}
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
        title={copy.conflictTitle}
        subtitle={copy.conflictSubtitle}
        icon={<ShieldAlert size={26} />}
      >
        <div className="app-card process-stage-card">
          <div className="process-stage-header">
            <div className="process-stage-header__icon">
              <ShieldAlert size={22} />
            </div>
            <div className="process-stage-header__text">
              <h2>{copy.conflictCardTitle}</h2>
              <p>{copy.conflictCardDesc}</p>
            </div>
          </div>

          <div className="process-actions">
            <Button size="lg" onClick={resolveConflict}>
              {copy.takeOver}
            </Button>
            <Button variant="secondary" size="lg" onClick={logoutAfterConflict}>
              {copy.logout}
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return children;
}
