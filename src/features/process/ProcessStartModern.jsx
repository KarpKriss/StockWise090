import { Boxes, ScanSearch, Workflow } from "lucide-react";
import { useState } from "react";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { useSession } from "../../core/session/AppSession";
import "../menu/menu-modern.css";

export default function ProcessStartModern() {
  const { startSession } = useSession();
  const { t } = useAppPreferences();
  const [selectedType, setSelectedType] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    if (!selectedType || starting) {
      return;
    }

    try {
      setStarting(true);
      setError("");
      await startSession(selectedType);
    } catch (err) {
      setError(err?.message || t("processStart.startError") || "Could not start the process.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <PageShell
      title={t("processStart.title")}
      subtitle={t("processStart.subtitle")}
      icon={<Workflow size={26} />}
      backTo="/menu"
      compact
    >
      <div className="app-grid app-grid--cards">
        <button
          className={`card selectable ${selectedType === "empty" ? "active" : ""}`}
          onClick={() => setSelectedType("empty")}
        >
          <div className="menu-card__icon">
            <Boxes size={22} />
          </div>
          <div className="card-title" style={{ marginTop: 14 }}>
            {t("processStart.emptyTitle")}
          </div>
          <div className="card-desc">
            {t("processStart.emptyDesc")}
          </div>
        </button>

        <button
          className={`card selectable ${selectedType === "manual" ? "active" : ""}`}
          onClick={() => setSelectedType("manual")}
        >
          <div className="menu-card__icon">
            <ScanSearch size={22} />
          </div>
          <div className="card-title" style={{ marginTop: 14 }}>
            {t("processStart.manualTitle")}
          </div>
          <div className="card-desc">
            {t("processStart.manualDesc")}
          </div>
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          size="lg"
          loading={starting}
          loadingLabel={t("processStart.startLoading")}
          disabled={!selectedType || starting}
          onClick={handleStart}
        >
          {t("processStart.start")}
        </Button>
      </div>
      {error ? <div className="input-error-text">{error}</div> : null}
      <LoadingOverlay
        open={starting}
        fullscreen
        message={t("processStart.overlay")}
      />
    </PageShell>
  );
}
