import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, Upload } from "lucide-react";
import PageShell from "../layout/PageShell";

export default function DataTablePanelModern({
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
  pageSize = 25,
  page = null,
  totalCount = null,
  onPageChange = null,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [internalPage, setInternalPage] = useState(1);
  const showActions = Boolean(onDelete || onEdit);
  const isServerPagination = typeof onPageChange === "function" && typeof page === "number";

  useEffect(() => {
    if (!isServerPagination) {
      setInternalPage(1);
    }
  }, [data, searchValue, isServerPagination]);

  const currentPage = isServerPagination ? page : internalPage;
  const resolvedTotalCount = isServerPagination ? totalCount || 0 : data.length;
  const totalPages = Math.max(1, Math.ceil((resolvedTotalCount || 0) / pageSize));

  const pagedData = useMemo(() => {
    if (isServerPagination) return data;

    const from = (currentPage - 1) * pageSize;
    return data.slice(from, from + pageSize);
  }, [currentPage, data, isServerPagination, pageSize]);

  function goToPage(nextPage) {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);

    if (isServerPagination) {
      onPageChange(safePage);
      return;
    }

    setInternalPage(safePage);
  }

  return (
    <PageShell
      title={title}
      subtitle="Jednolity widok roboczy do filtrowania, przegladu i utrzymania danych."
      backTo={-1}
      actions={
        onAdd ? (
          <button className="app-button app-button--primary" onClick={onAdd}>
            <Plus size={16} />
            {addLabel}
          </button>
        ) : null
      }
    >
      <div className="app-card">
        <div className="products-toolbar">
          <div className="search-group" style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--app-text-soft)" }}
            />
            <input
              type="text"
              value={searchValue}
              className="app-input"
              placeholder={searchPlaceholder || "Szukaj..."}
              onChange={(event) => {
                setSearchValue(event.target.value);
                onSearchChange && onSearchChange(event.target.value);
              }}
              style={{ paddingLeft: 40 }}
            />
          </div>

          {skuList.length > 0 ? (
            <select onChange={(event) => onSkuChange && onSkuChange(event.target.value)}>
              <option value="all">Wszystkie SKU</option>
              {skuList.map((sku) => (
                <option key={sku} value={sku}>
                  {sku}
                </option>
              ))}
            </select>
          ) : null}

          {locationsList.length > 0 ? (
            <select onChange={(event) => onLocationChange && onLocationChange(event.target.value)}>
              <option value="all">Wszystkie lokalizacje</option>
              {locationsList.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          ) : null}

          <div className="actions-group">
            {onImport ? (
              <button className="app-button app-button--secondary" onClick={onImport}>
                <Upload size={16} />
                Import
              </button>
            ) : null}

            {onExport ? (
              <button className="app-button app-button--secondary" onClick={onExport}>
                <Download size={16} />
                Eksport
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="app-card" style={{ overflowX: "auto" }}>
        <table className="app-table">
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
              {showActions ? <th>Akcje</th> : null}
            </tr>
          </thead>
          <tbody>
            {pagedData.map((row, index) => (
              <tr key={row.id || index}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.key === "price" && onEdit ? (
                      <input
                        type="number"
                        step="0.01"
                        className="app-input"
                        defaultValue={row.price}
                        onBlur={(event) => onEdit(row, Number(event.target.value))}
                        style={{ maxWidth: 120, textAlign: "right" }}
                      />
                    ) : (
                      row[column.key]
                    )}
                  </td>
                ))}
                {showActions ? (
                  <td>
                    {onDelete ? (
                      <button className="app-button app-button--secondary" onClick={() => onDelete(row)}>
                        Usun
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}

            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (showActions ? 1 : 0)} className="app-empty-state">
                  Brak danych
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="data-table-pagination">
          <div className="helper-note">
            Pokazywane: <strong>{pagedData.length}</strong> z <strong>{resolvedTotalCount}</strong> rekordow
          </div>
          <div className="data-table-pagination__controls">
            <button
              type="button"
              className="app-button app-button--secondary"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Poprzednia
            </button>
            <div className="data-table-pagination__status">
              Strona {currentPage} / {totalPages}
            </div>
            <button
              type="button"
              className="app-button app-button--secondary"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Nastepna
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
