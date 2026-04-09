import React from "react";
import { useState } from "react";
import { useSession } from "../../core/session/SessionContext";

function ProcessStart() {
  const { startSession } = useSession();
  const [selectedType, setSelectedType] = useState(null);
  
  return (
    <div className="process-start-container">
  <div className="screen-title">Wybierz tryb pracy</div>

  <div
  className={`card selectable ${selectedType === "empty" ? "active" : ""}`}
  onClick={() => setSelectedType("empty")}
>
  <div className="card-title">Inwentaryzuj puste</div>
  <div className="card-desc">
    Sprawdzanie pustych lokalizacji i zgłaszanie nadwyżek
  </div>
</div>

 <div
  className={`card selectable ${selectedType === "manual" ? "active" : ""}`}
  onClick={() => setSelectedType("manual")}
>
  <div className="card-title">Inwentaryzacja ręczna</div>
  <div className="card-desc">
    Ręczne wprowadzanie braków i nadwyżek
  </div>
</div>

  {selectedType && (
    <button
  className="btn-primary large full"
  disabled={!selectedType}
  onClick={() => startSession(selectedType)}
>
  Rozpocznij pracę
</button>
  )}
</div>
  );
}

export default ProcessStart;
