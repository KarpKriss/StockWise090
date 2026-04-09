import React from "react";
import { useNavigate } from "react-router-dom";

function DataMenu() {
  const navigate = useNavigate();

  return (
    <div className="data-menu-container">
      <div className="screen-title">Dane</div>

      <div
        className="card selectable"
        onClick={() => navigate("/data/products")}
      >
        <div className="card-title">Produkty</div>
        <div className="card-desc">
          Zarządzanie produktami i mapowaniem EAN
        </div>
      </div>

      <div
        className="card selectable"
        onClick={() => navigate("/data/stock")}
      >
        <div className="card-title">Stock</div>
        <div className="card-desc">
          Podgląd stanów magazynowych
        </div>
      </div>

      <div
        className="card selectable"
        onClick={() => navigate("/data/prices")}
      >
        <div className="card-title">Ceny</div>
        <div className="card-desc">
          Dane wartości produktów
        </div>
      </div>
      <div
  className="card selectable"
  onClick={() => navigate("/data/locations")}
>
  <div className="card-title">Mapa magazynu</div>
  <div className="card-desc">
    Struktura lokalizacji i stref magazynu
  </div>
</div>

      <div
        className="card selectable"
        onClick={() => navigate("/data/history")}
      >
        <div className="card-title">Historia korekt</div>
      <div className="card-desc">
        Podgląd zmian i korekt operacji
      </div>

      <div
        className="card selectable"
        onClick={() => navigate("/data/corrections")}
      >
        <div className="card-title">Correction log</div>
        <div className="card-desc">
          Historia zmian z filtrowaniem i eksportem CSV
        </div>
      </div>
    </div>
    </div>
    
  );
}

export default DataMenu;
