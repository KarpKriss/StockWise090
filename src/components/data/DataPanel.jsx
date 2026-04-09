import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

function DataPanel({
  title,
  columns = [],
  data = [],
  onImport,
  onExport,
  onSearchChange,
  onSortChange,
  onLocationChange,
  locationsList,
  onSkuChange,
  skuList,
  searchPlaceholder,
  onDelete,
  onEdit
}) {
  
  const navigate = useNavigate();
  const [selectedColumn, setSelectedColumn] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedSku, setSelectedSku] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  
  return (
    <div style={{ padding: "20px" }}>
      {/* 🔙 HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <button onClick={() => navigate(-1)}>←</button>

        <h2>{title}</h2>

        <button onClick={() => console.log("settings")}>⚙</button>
      </div>

      {/* 🔍 TOOLBAR */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <select
  onChange={(e) => {
    setSelectedSku(e.target.value);
   onSkuChange && onSkuChange(e.target.value);
  }}
>
  <option value="all">Wszystkie SKU</option>

  {(skuList || []).map(sku => (
    <option key={sku} value={sku}>
      {sku}
    </option>
  ))}
</select>
        {/* SELECT COLUMN */}
        <select
          value={selectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
        >
          <option value="all">Wszystkie</option>
          {columns.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
      {locationsList && (
  <select
    onChange={(e) => {
      setSelectedLocation(e.target.value);
      onLocationChange && onLocationChange(e.target.value);
    }}
  >
    <option value="all">Wszystkie lokalizacje</option>

    {(locationsList || []).map(loc => (
      <option key={loc} value={loc}>
        {loc}
      </option>
    ))}
  </select>
)}
        {/* SEARCH */}
        <input
  type="text"
 placeholder={searchPlaceholder || "Szukaj..."}
  value={searchValue}
  onChange={(e) => {
    setSearchValue(e.target.value);
    onSearchChange && onSearchChange(e.target.value);
  }}
  style={{ flex: 1 }}
/>

        {/* ACTIONS */}
        <button onClick={onImport}>Importuj</button>
        <button onClick={onExport}>Eksportuj</button>
      </div>

      {/* 📊 TABLE */}
      <table width="100%" border="1" cellPadding="8" style={{ marginTop: "10px" }}>
        <thead>
       <tr>
  {columns.map((col) => (
    <th
      key={col.key}
      onClick={() => onSortChange && onSortChange(col.key)}
      style={{ cursor: "pointer" }}
    >
      {col.label}
    </th>
  ))}
  <th style={{ width: "120px", textAlign: "center" }}>Akcje</th>
</tr>
        </thead>

        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {columns.map((col) => (
  <td key={col.key}>
    {col.key === "price" ? (
      <input
        defaultValue={row.price}
        style={{ width: "80px", textAlign: "right" }}
        onBlur={(e) =>
          onEdit && onEdit(row, Number(e.target.value))
        }
      />
    ) : (
      row[col.key]
    )}
  </td>
))}

<td style={{ textAlign: "center" }}>
  <button onClick={() => onDelete && onDelete(row)}>
    Usuń
  </button>
</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataPanel;
