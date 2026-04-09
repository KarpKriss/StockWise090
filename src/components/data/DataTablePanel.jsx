import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function DataTablePanel({
  title,
  columns = [],
  data = [],
  onImport,
  onExport,
  onSearchChange,
  onSortChange,
  onLocationChange,
  locationsList = [],
  onSkuChange,
  skuList = [],
  searchPlaceholder,
  onDelete,
  onEdit,
  onAdd,
  addLabel = "Dodaj",
}) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const showActions = Boolean(onDelete || onEdit);

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 12,
        }}
      >
        <button onClick={() => navigate(-1)}>Powrót</button>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div>{onAdd && <button onClick={onAdd}>{addLabel}</button>}</div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {skuList.length > 0 && (
          <select onChange={(e) => onSkuChange && onSkuChange(e.target.value)}>
            <option value="all">Wszystkie SKU</option>
            {skuList.map((sku) => (
              <option key={sku} value={sku}>
                {sku}
              </option>
            ))}
          </select>
        )}

        {locationsList.length > 0 && (
          <select onChange={(e) => onLocationChange && onLocationChange(e.target.value)}>
            <option value="all">Wszystkie lokalizacje</option>
            {locationsList.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          value={searchValue}
          placeholder={searchPlaceholder || "Szukaj..."}
          onChange={(e) => {
            setSearchValue(e.target.value);
            onSearchChange && onSearchChange(e.target.value);
          }}
          style={{ flex: 1, minWidth: 220 }}
        />

        {onImport && <button onClick={onImport}>Importuj</button>}
        {onExport && <button onClick={onExport}>Eksportuj</button>}
      </div>

      <table width="100%" border="1" cellPadding="8">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => onSortChange && onSortChange(column.key)}
                style={{ cursor: onSortChange ? "pointer" : "default" }}
              >
                {column.label}
              </th>
            ))}
            {showActions && <th>Akcje</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.key === "price" && onEdit ? (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={row.price}
                      onBlur={(e) => onEdit(row, Number(e.target.value))}
                      style={{ width: 100, textAlign: "right" }}
                    />
                  ) : (
                    row[column.key]
                  )}
                </td>
              ))}
              {showActions && (
                <td>
                  {onDelete && <button onClick={() => onDelete(row)}>Usuń</button>}
                </td>
              )}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length + (showActions ? 1 : 0)} style={{ textAlign: "center" }}>
                Brak danych
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
