import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  Eye,
  History,
  Lock,
  PencilLine,
  Search,
} from "lucide-react";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import { useAuth } from "../../core/auth/AppAuth";
import {
  fetchInventoryHistoryEntries,
  updateInventoryHistoryEntry,
} from "../../core/api/inventoryHistoryApi";
import { exportToCSV } from "../../utils/csvExport";

const PAGE_SIZE = 25;
const REASON_OPTIONS = [
  { value: "sku", label: "Bledny SKU" },
  { value: "location", label: "Bledna lokalizacja" },
  { value: "quantity", label: "Bledna ilosc" },
  { value: "lot", label: "Bledny LOT" },
  { value: "expiry", label: "Bledna data waznosci" },
  { value: "type", label: "Bledny typ operacji" },
  { value: "other", label: "Inny powod" },
];

const EDITABLE_TYPES = [
  { value: "surplus", label: "Nadwyzka" },
  { value: "shortage", label: "Brak" },
  { value: "checked_empty", label: "Pusta lokalizacja" },
  { value: "problem", label: "Problem" },
];

const INITIAL_FORM = {
  location: "",
  sku: "",
  ean: "",
  lot: "",
  expiry: "",
  quantity: "",
  type: "",
  reasonCode: "",
  comment: "",
};

function normalizeType(type) {
  const normalized = String(type || "").trim().toLowerCase();

  if (["nadwyzka", "nadwyzka", "surplus"].includes(normalized)) {
    return { label: "Nadwyzka", tone: "success", prefix: "+" };
  }

  if (["brak", "shortage"].includes(normalized)) {
    return { label: "Brak", tone: "danger", prefix: "-" };
  }

  if (normalized === "checked_empty") {
    return { label: "Pusta lokalizacja", tone: "neutral", prefix: "" };
  }

  if (normalized === "problem") {
    return { label: "Problem", tone: "warning", prefix: "" };
  }

  return { label: type || "Operacja", tone: "neutral", prefix: "" };
}

function normalizeTypeValue(type) {
  const normalized = String(type || "").trim().toLowerCase();

  if (["nadwyzka", "nadwyzka", "surplus"].includes(normalized)) {
    return "surplus";
  }

  if (["brak", "shortage"].includes(normalized)) {
    return "shortage";
  }

  return normalized || "surplus";
}

function normalizeApprovalStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized || normalized === "pending") {
    return { value: "pending", label: "Niezatwierdzona", tone: "warning" };
  }

  if (["approved", "confirmed", "closed"].includes(normalized)) {
    return { value: "approved", label: "Zatwierdzona", tone: "success" };
  }

  return { value: normalized, label: normalized, tone: "neutral" };
}

function buildEditForm(entry) {
  return {
    location: entry.location || "",
    sku: entry.sku || "",
    ean: entry.ean || "",
    lot: entry.lot || "",
    expiry: entry.expiry || entry.expiry_date || "",
    quantity: entry.quantity ?? "",
    type: normalizeTypeValue(entry.type),
    reasonCode: "",
    comment: "",
  };
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function canEditEntry(entry, user) {
  const role = String(user?.role || "").trim().toLowerCase();
  const approval = normalizeApprovalStatus(entry.approval_status).value;
  const isPrivileged = ["admin", "primeuser", "superuser"].includes(role);

  if (isPrivileged) {
    return true;
  }

  if (approval === "approved") {
    return false;
  }

  return entry.user_id === user?.id;
}

function buildExportRows(rows) {
  return rows.map((row) => ({
    timestamp: row.timestamp || row.created_at || "",
    session_id: row.session_id || "",
    location: row.location || "",
    sku: row.sku || "",
    ean: row.ean || "",
    lot: row.lot || "",
    expiry: row.expiry || row.expiry_date || "",
    type: row.type || "",
    quantity: row.quantity ?? "",
    operator: row.operatorName || row.operatorEmail || row.operator || row.user_id || "",
    approval_status: normalizeApprovalStatus(row.approval_status).label,
    correction_flag: row.correctionFlag || "NIE",
  }));
}

export default function InventoryHistoryModern() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState("desc");
  const [filters, setFilters] = useState({
    location: "",
    sku: "",
    operator: "",
    type: "all",
    sessionId: "",
    searchText: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  async function loadEntries(nextPage = page, nextFilters = filters, nextSort = sortDirection) {
    try {
      setLoading(true);
      const result = await fetchInventoryHistoryEntries({
        page: nextPage,
        pageSize: PAGE_SIZE,
        sortDirection: nextSort,
        filters: nextFilters,
      });

      setRows(result.rows || []);
      setTotalCount(result.totalCount || 0);
      setError("");
    } catch (fetchError) {
      console.error("HISTORY FETCH ERROR:", fetchError);
      setError(fetchError.message || "Blad pobierania historii operacji");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries(page, filters, sortDirection);
  }, [page, sortDirection]);

  function submitFilters() {
    setPage(1);
    loadEntries(1, filters, sortDirection);
  }

  function openEditor(entry) {
    setEditingEntry(entry);
    setEditForm(buildEditForm(entry));
    setError("");
  }

  function closeEditor() {
    setEditingEntry(null);
    setEditForm(INITIAL_FORM);
    setSaving(false);
  }

  async function handleSaveEdit() {
    if (!editingEntry?.id) {
      return;
    }

    if (!String(editForm.reasonCode || "").trim()) {
      setError("Wybierz powod korekty.");
      return;
    }

    const changes = {
      location: editForm.location || null,
      sku: editForm.sku || null,
      ean: editForm.ean || null,
      lot: editForm.lot || null,
      expiry: editForm.expiry || null,
      expiry_date: editForm.expiry || null,
      quantity: editForm.quantity === "" ? null : Number(editForm.quantity),
      type: editForm.type || null,
    };

    try {
      setSaving(true);
      await updateInventoryHistoryEntry({
        entryId: editingEntry.id,
        reasonCode: editForm.reasonCode,
        comment: editForm.comment.trim(),
        changes,
      });
      closeEditor();
      await loadEntries(page, filters, sortDirection);
    } catch (saveError) {
      setError(saveError.message || "Nie udalo sie zapisac zmian");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const exportRows = useMemo(() => buildExportRows(rows), [rows]);

  return (
    <PageShell
      title="Historia operacji"
      subtitle="Pelna lista operacji magazynowych z filtrowaniem, szczegolami i kontrola korekt."
      icon={<History size={26} />}
      backTo="/menu"
      actions={
        <Button
          variant="secondary"
          onClick={() =>
            exportToCSV({
              data: exportRows,
              columns: [
                { key: "timestamp", label: "Data" },
                { key: "session_id", label: "Session ID" },
                { key: "location", label: "Lokalizacja" },
                { key: "sku", label: "SKU" },
                { key: "ean", label: "EAN" },
                { key: "lot", label: "LOT" },
                { key: "expiry", label: "Expiry" },
                { key: "type", label: "Typ" },
                { key: "quantity", label: "Ilosc" },
                { key: "operator", label: "Operator" },
                { key: "approval_status", label: "Status" },
                { key: "correction_flag", label: "Correction flag" },
              ],
              fileName: "inventory-history.csv",
            })
          }
        >
          <Download size={16} />
          Eksport CSV
        </Button>
      }
    >
      <div className="app-card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <div className="app-field">
            <label className="app-field__label">Lokalizacja</label>
            <input className="app-input" value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))} />
          </div>
          <div className="app-field">
            <label className="app-field__label">SKU</label>
            <input className="app-input" value={filters.sku} onChange={(event) => setFilters((current) => ({ ...current, sku: event.target.value }))} />
          </div>
          <div className="app-field">
            <label className="app-field__label">Operator</label>
            <input className="app-input" value={filters.operator} onChange={(event) => setFilters((current) => ({ ...current, operator: event.target.value }))} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          <div className="app-field">
            <label className="app-field__label">Typ operacji</label>
            <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
              <option value="all">Wszystkie</option>
              <option value="shortage">Brak</option>
              <option value="surplus">Nadwyzka</option>
              <option value="problem">Problem</option>
              <option value="checked_empty">Pusta lokalizacja</option>
            </select>
          </div>
          <div className="app-field">
            <label className="app-field__label">Session ID</label>
            <input className="app-input" value={filters.sessionId} onChange={(event) => setFilters((current) => ({ ...current, sessionId: event.target.value }))} />
          </div>
          <div className="app-field" style={{ gridColumn: "span 2" }}>
            <label className="app-field__label">Wyszukiwanie tekstowe</label>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--app-text-soft)" }} />
              <input
                className="app-input"
                style={{ paddingLeft: 40 }}
                value={filters.searchText}
                placeholder="Lokalizacja, SKU, EAN, LOT, operator"
                onChange={(event) => setFilters((current) => ({ ...current, searchText: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitFilters();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div className="app-field" style={{ minWidth: 220 }}>
            <label className="app-field__label">Sortowanie po dacie</label>
            <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}>
              <option value="desc">Najnowsze najpierw</option>
              <option value="asc">Najstarsze najpierw</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" onClick={() => {
              const cleared = { location: "", sku: "", operator: "", type: "all", sessionId: "", searchText: "" };
              setFilters(cleared);
              setPage(1);
              loadEntries(1, cleared, sortDirection);
            }}>
              Wyczysc filtry
            </Button>
            <Button onClick={submitFilters}>Filtruj</Button>
          </div>
        </div>
      </div>

      {loading ? <div className="app-card">Ladowanie historii...</div> : null}
      {error ? <div className="app-card input-error-text">{error}</div> : null}

      {!loading && !error ? (
        <div className="app-card">
          <div className="app-module-panel__header" style={{ marginBottom: 14 }}>
            <div>
              <h2 className="process-panel__title" style={{ fontSize: 24 }}>Operacje magazynowe</h2>
              <p className="process-panel__subtitle">{totalCount} rekordow po zastosowaniu filtrow.</p>
            </div>
            <span className="history-status-chip">
              <CalendarClock size={14} style={{ marginRight: 6 }} />
              Historia paginowana
            </span>
          </div>

          <div className="dashboard-table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lokalizacja</th>
                  <th>SKU</th>
                  <th>Ilosc</th>
                  <th>Typ</th>
                  <th>Operator</th>
                  <th>Status</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const typeMeta = normalizeType(entry.type);
                  const approval = normalizeApprovalStatus(entry.approval_status);
                  const editable = canEditEntry(entry, user);

                  return (
                    <tr key={entry.id} className={entry.wasEdited ? "history-operation-row history-operation-row--edited" : "history-operation-row"}>
                      <td>{formatDate(entry.timestamp || entry.created_at)}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{entry.location || "-"}</div>
                        {entry.wasEdited ? (
                          <span className="history-status-chip history-status-chip--edited" style={{ marginTop: 6 }}>
                            <PencilLine size={14} style={{ marginRight: 6 }} />
                            Edytowano
                          </span>
                        ) : null}
                      </td>
                      <td>{entry.sku || "-"}</td>
                      <td>
                        {typeMeta.prefix}
                        {entry.quantity ?? 0}
                      </td>
                      <td>{typeMeta.label}</td>
                      <td>{entry.operatorName || entry.operatorEmail || entry.operator || entry.user_id || "BRAK"}</td>
                      <td>
                        <span className={`status-badge ${approval.tone === "success" ? "status-badge--active" : approval.tone === "warning" ? "status-badge--paused" : "status-badge--neutral"}`}>
                          {approval.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button variant="secondary" size="md" onClick={() => setSelectedEntry(entry)}>
                            <Eye size={16} />
                            Szczegoly
                          </Button>
                          <Button variant="secondary" size="md" disabled={!editable} onClick={() => openEditor(entry)}>
                            {approval.value === "approved" && !["admin", "primeuser", "superuser"].includes(String(user?.role || "").toLowerCase()) ? <Lock size={16} /> : <Edit3 size={16} />}
                            Edytuj
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="app-empty-state">Brak operacji spelniajacych filtry.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="data-table-pagination">
            <div className="helper-note">Pokazywane: <strong>{rows.length}</strong> z <strong>{totalCount}</strong> rekordow</div>
            <div className="data-table-pagination__controls">
              <button type="button" className="app-button app-button--secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Poprzednia</button>
              <div className="data-table-pagination__status">Strona {page} / {totalPages}</div>
              <button type="button" className="app-button app-button--secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Nastepna</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEntry ? (
        <div className="history-modal-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>Szczegoly operacji</h2>
                <p className="process-panel__subtitle">{selectedEntry.location || "-"} | {selectedEntry.id}</p>
              </div>
              <Button variant="secondary" onClick={() => setSelectedEntry(null)}>Zamknij</Button>
            </div>

            <div className="process-section-card">
              <div className="dashboard-table-scroll">
                <table className="app-table">
                  <tbody>
                    <tr><th>Lokalizacja</th><td>{selectedEntry.location || "-"}</td></tr>
                    <tr><th>SKU</th><td>{selectedEntry.sku || "-"}</td></tr>
                    <tr><th>EAN</th><td>{selectedEntry.ean || "-"}</td></tr>
                    <tr><th>LOT</th><td>{selectedEntry.lot || "-"}</td></tr>
                    <tr><th>Expiry</th><td>{selectedEntry.expiry || selectedEntry.expiry_date || "-"}</td></tr>
                    <tr><th>Typ</th><td>{normalizeType(selectedEntry.type).label}</td></tr>
                    <tr><th>Ilosc</th><td>{selectedEntry.quantity ?? 0}</td></tr>
                    <tr><th>Operator</th><td>{selectedEntry.operatorName || selectedEntry.operatorEmail || selectedEntry.operator || selectedEntry.user_id || "BRAK"}</td></tr>
                    <tr><th>User ID</th><td>{selectedEntry.user_id || "-"}</td></tr>
                    <tr><th>Timestamp</th><td>{formatDate(selectedEntry.timestamp || selectedEntry.created_at)}</td></tr>
                    <tr><th>Session ID</th><td>{selectedEntry.session_id || "-"}</td></tr>
                    <tr><th>Status operacji</th><td>{normalizeApprovalStatus(selectedEntry.approval_status).label}</td></tr>
                    <tr><th>Korekty</th><td>{selectedEntry.correctionCount || 0}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingEntry ? (
        <div className="history-modal-overlay" onClick={closeEditor}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>Formularz korekty</h2>
                <p className="process-panel__subtitle">{editingEntry.location || "-"} | {editingEntry.id}</p>
              </div>
              <Button variant="secondary" onClick={closeEditor}>Zamknij</Button>
            </div>

            <div className="history-modal__grid">
              <div className="app-field">
                <label className="app-field__label">Lokalizacja</label>
                <input className="app-input" value={editForm.location} onChange={(event) => setEditForm((current) => ({ ...current, location: event.target.value }))} />
              </div>
              <div className="app-field">
                <label className="app-field__label">SKU</label>
                <input className="app-input" value={editForm.sku} onChange={(event) => setEditForm((current) => ({ ...current, sku: event.target.value }))} />
              </div>
              <div className="app-field">
                <label className="app-field__label">EAN</label>
                <input className="app-input" value={editForm.ean} onChange={(event) => setEditForm((current) => ({ ...current, ean: event.target.value }))} />
              </div>
              <div className="app-field">
                <label className="app-field__label">LOT</label>
                <input className="app-input" value={editForm.lot} onChange={(event) => setEditForm((current) => ({ ...current, lot: event.target.value }))} />
              </div>
              <div className="app-field">
                <label className="app-field__label">Expiry date</label>
                <input className="app-input" type="date" value={editForm.expiry} onChange={(event) => setEditForm((current) => ({ ...current, expiry: event.target.value }))} />
              </div>
              <div className="app-field">
                <label className="app-field__label">Ilosc</label>
                <input className="app-input" type="number" min="0" value={editForm.quantity} onChange={(event) => setEditForm((current) => ({ ...current, quantity: event.target.value }))} />
              </div>
              <div className="app-field">
                <label className="app-field__label">Typ operacji</label>
                <select value={editForm.type} onChange={(event) => setEditForm((current) => ({ ...current, type: event.target.value }))}>
                  {EDITABLE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="app-field">
                <label className="app-field__label">Powod korekty</label>
                <select value={editForm.reasonCode} onChange={(event) => setEditForm((current) => ({ ...current, reasonCode: event.target.value }))}>
                  <option value="">Wybierz powod</option>
                  {REASON_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="app-field" style={{ marginTop: 18 }}>
              <label className="app-field__label">Komentarz korekty</label>
              <textarea
                className="app-input"
                value={editForm.comment}
                onChange={(event) => setEditForm((current) => ({ ...current, comment: event.target.value }))}
                placeholder="Dodatkowy komentarz do korekty"
                style={{ minHeight: 110 }}
              />
            </div>

            <div className="helper-note" style={{ marginTop: 8 }}>
              Powod korekty jest wymagany. Komentarz pozostaje opcjonalny, ale zapisuje sie w correction log.
            </div>

            <div className="process-actions" style={{ marginTop: 20 }}>
              <Button size="lg" loading={saving} onClick={handleSaveEdit}>
                <CheckCircle2 size={16} />
                Zapisz zmiany
              </Button>
              <Button variant="secondary" size="lg" onClick={closeEditor}>Anuluj</Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
