import React, { useEffect, useMemo, useState } from "react";
import { exportToCSV } from "../../utils/csvExport";
import { fetchCorrectionRows } from "../../core/api/dataSectionApi";

export default function CorrectionsPanel() {
  const [rows, setRows] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRows() {
      try {
        setLoading(true);
        setRows(await fetchCorrectionRows());
        setError("");
      } catch (err) {
        setError(err.message || "Błąd pobierania historii korekt");
      } finally {
        setLoading(false);
      }
    }

    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      const matchesUser = selectedUser === "all" || row.user_id === selectedUser;
      const matchesSearch =
        !search.trim() ||
        JSON.stringify(row.old_value || {}).toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(row.new_value || {}).toLowerCase().includes(search.toLowerCase()) ||
        String(row.reason || "").toLowerCase().includes(search.toLowerCase()) ||
        String(row.entry_id || "").toLowerCase().includes(search.toLowerCase());
      const matchesFrom = !dateFrom || (createdAt && createdAt >= new Date(`${dateFrom}T00:00:00`));
      const matchesTo = !dateTo || (createdAt && createdAt <= new Date(`${dateTo}T23:59:59`));

      return matchesUser && matchesSearch && matchesFrom && matchesTo;
    });
  }, [rows, selectedUser, search, dateFrom, dateTo]);

  if (loading) return <div>Ładowanie historii korekt...</div>;
  if (error) return <div>{error}</div>;

  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2>Historia korekt</h2>
        <button
          onClick={() =>
            exportToCSV({
              data: filteredRows.map((row) => ({
                ...row,
                old_value: JSON.stringify(row.old_value || {}),
                new_value: JSON.stringify(row.new_value || {}),
              })),
              columns: [
                { key: "created_at", label: "Data" },
                { key: "user_id", label: "Operator" },
                { key: "entry_id", label: "Entry ID" },
                { key: "reason", label: "Powód" },
                { key: "old_value", label: "Stara wartość" },
                { key: "new_value", label: "Nowa wartość" },
              ],
              fileName: "corrections.csv",
            })
          }
        >
          Eksportuj CSV
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
          <option value="all">Wszyscy operatorzy</option>
          {userIds.map((userId) => (
            <option key={userId} value={userId}>
              {userId}
            </option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <input
          type="text"
          placeholder="Szukaj w powodzie lub danych..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
      </div>

      <table width="100%" border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Data</th>
            <th>Operator</th>
            <th>Entry ID</th>
            <th>Powód</th>
            <th>Szczegóły</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.created_at).toLocaleString()}</td>
              <td>{row.user_id || "BRAK"}</td>
              <td>{row.entry_id || "BRAK"}</td>
              <td>{row.reason || "-"}</td>
              <td>
                <button onClick={() => setSelectedRow(row)}>Pokaż</button>
              </td>
            </tr>
          ))}
          {filteredRows.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center" }}>
                Brak korekt spełniających filtry
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedRow && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3>Szczegóły korekty</h3>
            <p>Operator: {selectedRow.user_id || "BRAK"}</p>
            <p>Data: {new Date(selectedRow.created_at).toLocaleString()}</p>
            <p>Powód: {selectedRow.reason || "-"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <h4>Stara wartość</h4>
                <pre style={preStyle}>{JSON.stringify(selectedRow.old_value || {}, null, 2)}</pre>
              </div>
              <div>
                <h4>Nowa wartość</h4>
                <pre style={preStyle}>{JSON.stringify(selectedRow.new_value || {}, null, 2)}</pre>
              </div>
            </div>
            <button onClick={() => setSelectedRow(null)}>Zamknij</button>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalStyle = {
  width: "min(980px, 92vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  padding: 24,
  borderRadius: 12,
};

const preStyle = {
  background: "#f5f5f5",
  padding: 12,
  maxHeight: 320,
  overflow: "auto",
};
