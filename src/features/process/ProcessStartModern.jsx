import { Boxes, ScanSearch, Workflow } from "lucide-react";
import { useState } from "react";
import PageShell from "../../components/layout/PageShell";
import { useSession } from "../../core/session/AppSession";
import "../menu/menu-modern.css";

export default function ProcessStartModern() {
  const { startSession } = useSession();
  const [selectedType, setSelectedType] = useState(null);

  return (
    <PageShell
      title="Wybierz tryb pracy"
      subtitle="Rozpocznij proces, ktory najlepiej odpowiada Twojemu zadaniu na hali."
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
            Inwentaryzuj puste
          </div>
          <div className="card-desc">
            Kontrola pustych lokalizacji, potwierdzenia, nadwyzki i zgloszenia problemow.
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
            Inwentaryzacja reczna
          </div>
          <div className="card-desc">
            Reczne skanowanie lokalizacji, SKU, LOT i zapisy brakow oraz nadwyzek.
          </div>
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="app-button app-button--primary app-button--lg"
          disabled={!selectedType}
          onClick={() => startSession(selectedType)}
        >
          Rozpocznij prace
        </button>
      </div>
    </PageShell>
  );
}
