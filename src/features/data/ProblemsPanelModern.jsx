import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Eye, ShieldAlert, Unlock } from "lucide-react";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import { fetchProblemRows, resolveProblemCase } from "../../core/api/problemsApi";
import { exportToCSV } from "../../utils/csvExport";

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function sourceLabel(value) {
  if (value === "manual_inventory") return "Reczna inwentaryzacja";
  if (value === "empty_location") return "Kontrola pustych lokalizacji";
  return "Nieznany proces";
}

function sourceHint(value) {
  if (value === "manual_inventory") {
    return "Zgloszenie zostalo utworzone podczas recznej inwentaryzacji.";
  }
  if (value === "empty_location") {
    return "Zgloszenie zostalo utworzone podczas kontroli pustych lokalizacji.";
  }
  return "Dla tego wpisu nie udalo sie jednoznacznie ustalic procesu zrodlowego.";
}

export default function ProblemsPanelModern() {
  const [rows, setRows] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("open");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedRow, setSelectedRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadRows() {
    try {
      setLoading(true);
      setRows(await fetchProblemRows());
      setError("");
    } catch (err) {
      setError(err.message || "Blad pobierania problemow");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const status = String(row.status || "open").toLowerCase();
      const source = String(row.source_process || "").toLowerCase();
      const matchesStatus =
        selectedStatus === "all" ? true : selectedStatus === "open" ? status !== "resolved" : status === "resolved";
      const matchesSource = selectedSource === "all" || source === selectedSource;
      return matchesStatus && matchesSource;
    });
  }, [rows, selectedSource, selectedStatus]);

  const sources = [...new Set(rows.map((row) => row.source_process).filter(Boolean))];

  async function handleResolve(row) {
    try {
      setSubmitting(true);
      await resolveProblemCase({
        issueId: row.id,
        locationId: row.location_id,
        releaseNote: "Zwolnione z panelu Problemy",
      });
      await loadRows();
    } catch (err) {
      setError(err.message || "Nie udalo sie zwolnic problemu");
    } finally {
      setSubmitting(false);
    }
  }

  const exportRows = filteredRows.map((row) => ({
    ...row,
    source_process: sourceLabel(row.source_process),
    created_at: formatDate(row.created_at),
    resolved_at: formatDate(row.resolved_at),
  }));

  return (
    <PageShell
      title="Problemy"
      subtitle="Osobny rejestr zgloszen z procesow inwentaryzacji. Lokalizacje pozostaja zablokowane do czasu zwolnienia problemu."
      icon={<ShieldAlert size={26} />}
      backTo="/data"
      backLabel="Powrot do danych"
      actions={
        <Button
          variant="secondary"
          onClick={() =>
            exportToCSV({
              data: exportRows,
              columns: [
                { key: "created_at", label: "Data" },
                { key: "location_code", label: "Lokalizacja" },
                { key: "zone", label: "Strefa" },
                { key: "issue_type", label: "Typ problemu" },
                { key: "source_process", label: "Proces" },
                { key: "status", label: "Status" },
                { key: "note", label: "Komentarz" },
              ],
              fileName: "problems.csv",
            })
          }
        >
          <Download size={16} />
          Eksport CSV
        </Button>
      }
    >
      <div className="app-card history-toolbar-card">
        <div className="history-toolbar-row">
          <div className="app-field">
            <label className="app-field__label">Status</label>
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="open">Otwarte</option>
              <option value="resolved">Zwolnione</option>
              <option value="all">Wszystkie</option>
            </select>
          </div>

          <div className="app-field">
            <label className="app-field__label">Proces</label>
            <select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)}>
              <option value="all">Wszystkie procesy</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {sourceLabel(source)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? <div className="app-card">Ladowanie problemow...</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}

      {!loading && !error ? (
        <div className="app-card">
          <div className="app-module-panel__header" style={{ marginBottom: 14 }}>
            <div>
              <h2 className="process-panel__title" style={{ fontSize: 24 }}>Otwarte i zamkniete zgłoszenia</h2>
              <p className="process-panel__subtitle">
                {filteredRows.length} rekordow po zastosowaniu aktualnych filtrow.
              </p>
            </div>
            <span className="history-status-chip">
              <AlertTriangle size={14} style={{ marginRight: 6 }} />
              Panel problemow
            </span>
          </div>

          <div className="dashboard-table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lokalizacja</th>
                  <th>Strefa</th>
                  <th>Typ problemu</th>
                  <th>Proces</th>
                  <th>Status</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isResolved = String(row.status || "").toLowerCase() === "resolved";

                  return (
                    <tr key={row.id}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.location_code || "BRAK"}</td>
                      <td>{row.zone || "-"}</td>
                      <td>{row.issue_type || "-"}</td>
                      <td>{sourceLabel(row.source_process)}</td>
                      <td>
                        <span className={`status-badge ${isResolved ? "status-badge--active" : "status-badge--paused"}`}>
                          {isResolved ? "Zwolniony" : "Zablokowany"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button variant="secondary" size="md" onClick={() => setSelectedRow(row)}>
                            <Eye size={16} />
                            Szczegoly
                          </Button>
                          {!isResolved ? (
                            <Button variant="secondary" size="md" loading={submitting} onClick={() => handleResolve(row)}>
                              <Unlock size={16} />
                              Zwolnij
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="app-empty-state">
                      Brak problemow spelniajacych filtry.
                    </td>
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
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>
                  Szczegoly problemu
                </h2>
                <p className="process-panel__subtitle">
                  {formatDate(selectedRow.created_at)} - {sourceLabel(selectedRow.source_process)}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setSelectedRow(null)}>
                Zamknij
              </Button>
            </div>

            <div className="process-meta-grid" style={{ marginBottom: 18 }}>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Lokalizacja</div>
                <div className="process-meta-item__value">{selectedRow.location_code || "BRAK"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Status</div>
                <div className="process-meta-item__value">{selectedRow.status || "open"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Typ problemu</div>
                <div className="process-meta-item__value">{selectedRow.issue_type || "-"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Proces</div>
                <div className="process-meta-item__value">{sourceLabel(selectedRow.source_process)}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Operator</div>
                <div className="process-meta-item__value">{selectedRow.operator_email || selectedRow.user_id || "BRAK"}</div>
              </div>
            </div>

            <div className="process-section-card" style={{ marginBottom: 18 }}>
              <h3 className="process-section-card__title">Co oznacza proces?</h3>
              <p className="process-panel__subtitle" style={{ margin: 0 }}>
                {sourceHint(selectedRow.source_process)}
              </p>
            </div>

            <div className="process-section-card">
              <h3 className="process-section-card__title">Komentarz</h3>
              <pre className="history-modal__pre">{selectedRow.note || "Brak dodatkowego komentarza"}</pre>
            </div>

            {String(selectedRow.status || "").toLowerCase() !== "resolved" ? (
              <div className="process-actions" style={{ marginTop: 18 }}>
                <Button size="lg" loading={submitting} onClick={() => handleResolve(selectedRow)}>
                  <CheckCircle2 size={16} />
                  Zwolnij problem
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
