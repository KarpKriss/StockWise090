import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Eye, FileWarning, Search } from "lucide-react";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import { exportToCSV } from "../../utils/csvExport";
import { fetchCorrectionRowsWithProblems } from "../../core/api/correctionRowsApi";
import { useAuth } from "../../core/auth/AppAuth";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getMappedExportColumns } from "../../core/utils/importExportMapping";

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function buildChangeRows(row) {
  const before = row.old_value || {};
  const after = row.new_value || {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return keys.map((key) => ({
    key,
    before: before[key],
    after: after[key],
  }));
}

export default function CorrectionsPanelModern() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState(null);

  useEffect(() => {
    async function loadRows() {
      try {
        setLoading(true);
        setRows(await fetchCorrectionRowsWithProblems());
        setError("");
      } catch (err) {
        setError(err.message || "Blad pobierania historii korekt");
      } finally {
        setLoading(false);
      }
    }

    loadRows();
  }, []);

  useEffect(() => {
    async function loadMapping() {
      try {
        setMapping(await fetchImportExportMapping(user?.site_id || null));
      } catch (err) {
        console.error("CORRECTIONS MAPPING LOAD ERROR:", err);
      }
    }

    loadMapping();
  }, [user?.site_id]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      const matchesUser = selectedUser === "all" || row.user_id === selectedUser;
      const loweredSearch = search.trim().toLowerCase();
      const matchesSearch =
        !loweredSearch ||
        JSON.stringify(row.old_value || {}).toLowerCase().includes(loweredSearch) ||
        JSON.stringify(row.new_value || {}).toLowerCase().includes(loweredSearch) ||
        String(row.reason || "").toLowerCase().includes(loweredSearch) ||
        String(row.comment || "").toLowerCase().includes(loweredSearch) ||
        String(row.entry_id || "").toLowerCase().includes(loweredSearch);
      const matchesFrom = !dateFrom || (createdAt && createdAt >= new Date(`${dateFrom}T00:00:00`));
      const matchesTo = !dateTo || (createdAt && createdAt <= new Date(`${dateTo}T23:59:59`));

      return matchesUser && matchesSearch && matchesFrom && matchesTo;
    });
  }, [rows, selectedUser, search, dateFrom, dateTo]);

  const userOptions = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      if (row.user_id && !map.has(row.user_id)) {
        map.set(row.user_id, row.user_name || row.user_email || row.user_id);
      }
    });

    return [...map.entries()];
  }, [rows]);

  const exportRows = filteredRows.map((row) => ({
    created_at: formatDate(row.created_at),
    user_id: row.user_id || "",
    operator: row.user_name || row.user_email || row.user_id || "",
    entry_id: row.entry_id || "",
    reason: row.reason || "",
    comment: row.comment || "",
    old_value: JSON.stringify(row.old_value || {}),
    new_value: JSON.stringify(row.new_value || {}),
  }));

  return (
    <PageShell
      title="Historia korekt"
      subtitle="Pelna historia zmian operacji z before / after, powodem i komentarzem korekty."
      icon={<FileWarning size={26} />}
      backTo="/data"
      backLabel="Powrot do danych"
      actions={
        <Button
          variant="secondary"
          onClick={() =>
            exportToCSV({
              data: exportRows,
              columns: getMappedExportColumns("corrections", mapping),
              fileName: "correction-log.csv",
            })
          }
        >
          <Download size={16} />
          Eksport correction log
        </Button>
      }
    >
      <div className="app-card history-toolbar-card">
        <div className="history-toolbar-row">
          <div className="app-field">
            <label className="app-field__label">Operator</label>
            <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              <option value="all">Wszyscy operatorzy</option>
              {userOptions.map(([userId, label]) => (
                <option key={userId} value={userId}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="history-toolbar-row">
          <div className="app-field">
            <label className="app-field__label">Od dnia</label>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>

          <div className="app-field">
            <label className="app-field__label">Do dnia</label>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>

          <div className="app-field history-toolbar-row__search">
            <label className="app-field__label">Szukaj</label>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--app-text-soft)" }} />
              <input
                style={{ paddingLeft: 40 }}
                type="text"
                placeholder="Powod, komentarz, entry id, before / after"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="app-card">Ladowanie historii korekt...</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}

      {!loading && !error ? (
        <div className="app-card">
          <div className="app-module-panel__header" style={{ marginBottom: 14 }}>
            <div>
              <h2 className="process-panel__title" style={{ fontSize: 24 }}>Zmiany operacji</h2>
              <p className="process-panel__subtitle">{filteredRows.length} rekordow po zastosowaniu aktywnych filtrow.</p>
            </div>
            <span className="history-status-chip">
              <CalendarDays size={14} style={{ marginRight: 6 }} />
              Audit trail korekt
            </span>
          </div>

          <div className="dashboard-table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Kto zmienil</th>
                  <th>Entry ID</th>
                  <th>Powod</th>
                  <th>Komentarz</th>
                  <th>Szczegoly</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>{row.user_name || row.user_email || row.user_id || "BRAK"}</td>
                    <td>{row.entry_id || "BRAK"}</td>
                    <td>{row.reason || "-"}</td>
                    <td>{row.comment || "-"}</td>
                    <td>
                      <Button variant="secondary" size="md" onClick={() => setSelectedRow(row)}>
                        <Eye size={16} />
                        Pokaz
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="app-empty-state">Brak korekt spelniajacych filtry.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {selectedRow ? (
        <div className="history-modal-overlay" onClick={() => setSelectedRow(null)}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>Szczegoly korekty</h2>
                <p className="process-panel__subtitle">{formatDate(selectedRow.created_at)} - {selectedRow.user_name || selectedRow.user_id || "BRAK"}</p>
              </div>
              <Button variant="secondary" onClick={() => setSelectedRow(null)}>Zamknij</Button>
            </div>

            <div className="process-meta-grid" style={{ marginBottom: 18 }}>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Kto zmienil</div>
                <div className="process-meta-item__value">{selectedRow.user_name || selectedRow.user_email || selectedRow.user_id || "BRAK"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Powod</div>
                <div className="process-meta-item__value">{selectedRow.reason || "-"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Komentarz</div>
                <div className="process-meta-item__value">{selectedRow.comment || "-"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Entry ID</div>
                <div className="process-meta-item__value">{selectedRow.entry_id || "-"}</div>
              </div>
            </div>

            <div className="process-section-card">
              <h3 className="process-section-card__title">Porownanie przed / po</h3>
              <div className="dashboard-table-scroll">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Pole</th>
                      <th>Przed</th>
                      <th>Po</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildChangeRows(selectedRow).map((change) => (
                      <tr key={change.key}>
                        <td>{change.key}</td>
                        <td>{formatValue(change.before)}</td>
                        <td>{formatValue(change.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
