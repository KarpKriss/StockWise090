import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, Upload } from "lucide-react";
import PageShell from "../layout/PageShell";
import { useAppPreferences } from "../../core/preferences/AppPreferences";

export default function DataTablePanelModern({
  title,
  columns = [],
  data = [],
  extraActions = null,
  onImport,
  onExport,
  onSearchChange,
  onSortChange,
  onLocationChange,
  locationsList = [],
  locationValue = "all",
  onSkuChange,
  skuList = [],
  skuValue = "all",
  searchPlaceholder,
  onDelete,
  onEdit,
  renderActions,
  onAdd,
  addLabel = "",
  pageSize = 25,
  page = null,
  totalCount = null,
  onPageChange = null,
  hasNextPage = null,
}) {
  const { t } = useAppPreferences();
  const [searchValue, setSearchValue] = useState("");
  const [internalPage, setInternalPage] = useState(1);
  const showActions = Boolean(onDelete || onEdit || renderActions);
  const isServerPagination = typeof onPageChange === "function" && typeof page === "number";

  useEffect(() => {
    if (!isServerPagination) {
      setInternalPage(1);
    }
  }, [data, searchValue, isServerPagination]);

  const currentPage = isServerPagination ? page : internalPage;
  const hasKnownTotal = isServerPagination ? typeof totalCount === "number" : true;
  const resolvedTotalCount = hasKnownTotal ? (isServerPagination ? totalCount || 0 : data.length) : null;
  const totalPages = hasKnownTotal ? Math.max(1, Math.ceil((resolvedTotalCount || 0) / pageSize)) : null;

  const pagedData = useMemo(() => {
    if (isServerPagination) return data;

    const from = (currentPage - 1) * pageSize;
    return data.slice(from, from + pageSize);
  }, [currentPage, data, isServerPagination, pageSize]);

  function goToPage(nextPage) {
    const maxPage = totalPages || nextPage;
    const safePage = Math.min(Math.max(1, nextPage), maxPage);

    if (isServerPagination) {
      onPageChange(safePage);
      return;
    }

    setInternalPage(safePage);
  }

  function handleSearchSubmit() {
    if (onSearchChange) {
      onSearchChange(searchValue.trim());
    }

    if (!isServerPagination) {
      setInternalPage(1);
    }
  }

  return (
    <PageShell
      title={title}
      subtitle={t("dataTable.subtitle")}
      backTo={-1}
      actions={
        <>
          {extraActions}
          {onAdd ? (
            <button className="app-button app-button--primary" onClick={onAdd}>
              <Plus size={16} />
              {addLabel || t("common.add")}
            </button>
          ) : null}
        </>
      }
    >
      <div className="app-card">
        <div className="products-toolbar">
          <div className="search-group data-table-search-group" style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--app-text-soft)" }}
            />
            <input
              type="text"
              value={searchValue}
              className="app-input"
              placeholder={searchPlaceholder || t("dataTable.searchPlaceholder")}
              onChange={(event) => {
                setSearchValue(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearchSubmit();
                }
              }}
              style={{ paddingLeft: 40 }}
            />
            <button
              type="button"
              className="app-button app-button--secondary data-table-search-button"
              onClick={handleSearchSubmit}
              aria-label={t("dataTable.searchAria")}
            >
              <Search size={16} />
            </button>
          </div>

          {skuList.length > 0 ? (
            <select value={skuValue} onChange={(event) => onSkuChange && onSkuChange(event.target.value)}>
              <option value="all">{t("common.allSku")}</option>
              {skuList.map((sku) => (
                <option key={sku} value={sku}>
                  {sku}
                </option>
              ))}
            </select>
          ) : null}

          {locationsList.length > 0 ? (
            <select value={locationValue} onChange={(event) => onLocationChange && onLocationChange(event.target.value)}>
              <option value="all">{t("common.allLocations")}</option>
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
                {t("common.import")}
              </button>
            ) : null}

            {onExport ? (
              <button className="app-button app-button--secondary" onClick={onExport}>
                <Download size={16} />
                {t("common.export")}
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
              {showActions ? <th>{t("common.actions")}</th> : null}
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
                    {renderActions ? renderActions(row) : null}
                    {onDelete ? (
                      <button className="app-button app-button--secondary" onClick={() => onDelete(row)}>
                        {t("common.delete")}
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}

            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (showActions ? 1 : 0)} className="app-empty-state">
                  {t("common.noData")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="data-table-pagination">
          <div className="helper-note">
            {hasKnownTotal ? (
              <>
                {t("dataTable.shownRecords", { shown: pagedData.length, total: resolvedTotalCount })}
              </>
            ) : (
              <>
                {t("dataTable.shownPageRecords", { shown: pagedData.length })}
              </>
            )}
          </div>
          <div className="data-table-pagination__controls">
            <button
              type="button"
              className="app-button app-button--secondary"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              {t("common.previous")}
            </button>
            <div className="data-table-pagination__status">
              {hasKnownTotal
                ? t("dataTable.pageStatus", { current: currentPage, total: totalPages })
                : t("dataTable.pageStatusSimple", { current: currentPage })}
            </div>
            <button
              type="button"
              className="app-button app-button--secondary"
              disabled={hasKnownTotal ? currentPage >= totalPages : hasNextPage === false}
              onClick={() => goToPage(currentPage + 1)}
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
