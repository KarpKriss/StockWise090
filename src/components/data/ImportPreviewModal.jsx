import React, { useMemo } from "react";

function summarizeInvalidReasons(invalidRows) {
  const counts = new Map();

  invalidRows.forEach((row) => {
    (row.errors || []).forEach((reason) => {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

export default function ImportPreviewModal({
  title,
  intro,
  preview,
  columns,
  getRowKey,
  getRowValue,
  getInvalidLabel,
  onConfirm,
  onCancel,
  confirmLabel = "Importuj poprawne rekordy",
}) {
  const invalidReasonSummary = useMemo(
    () => summarizeInvalidReasons(preview.invalid || []),
    [preview.invalid]
  );
  const sampleRows = (preview.parsed || []).slice(0, 12);

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={{ margin: 0 }}>{title}</h2>
            {intro ? <p style={introStyle}>{intro}</p> : null}
          </div>
        </div>

        <div style={statsGridStyle}>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>Poprawne rekordy</div>
            <div style={statValueStyle}>{preview.valid?.length || 0}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>Bledne rekordy</div>
            <div style={statValueStyle}>{preview.invalid?.length || 0}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>Probka podgladu</div>
            <div style={statValueStyle}>{sampleRows.length}</div>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Probka rekordow do importu</h3>
          <div style={tableWrapStyle}>
            <table style={previewTableStyle}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} style={cellHeaderStyle}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, index) => (
                  <tr key={getRowKey ? getRowKey(row, index) : index}>
                    {columns.map((column) => (
                      <td key={column.key} style={cellStyle}>
                        {getRowValue ? getRowValue(row, column.key) : row[column.key] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {(preview.invalid?.length || 0) > 0 ? (
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Podsumowanie bledow</h3>
            <div style={errorSummaryListStyle}>
              {invalidReasonSummary.map((item) => (
                <div key={item.reason} style={errorSummaryItemStyle}>
                  <span style={errorSummaryReasonStyle}>{item.reason}</span>
                  <span style={errorSummaryCountStyle}>{item.count}</span>
                </div>
              ))}
            </div>

            <details style={detailsStyle}>
              <summary style={summaryStyle}>Pokaz szczegoly blednych rekordow</summary>
              <div style={detailsListStyle}>
                {(preview.invalid || []).map((row, index) => (
                  <div key={getRowKey ? `${getRowKey(row, index)}-invalid` : `invalid-${index}`} style={detailsItemStyle}>
                    <strong>{getInvalidLabel ? getInvalidLabel(row) : "Bledny rekord"}</strong>
                    <span style={detailsItemSeparatorStyle}> • </span>
                    <span>{(row.errors || []).join(", ")}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button disabled={(preview.valid?.length || 0) === 0} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button onClick={onCancel}>Anuluj</button>
        </div>
      </div>
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
  width: "min(920px, 92vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  padding: 24,
  borderRadius: 24,
};

const headerStyle = {
  marginBottom: 16,
};

const introStyle = {
  margin: "8px 0 0",
  color: "#6f7a96",
  lineHeight: 1.5,
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const statCardStyle = {
  padding: 16,
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(243,247,255,0.94))",
  border: "1px solid rgba(84, 98, 140, 0.1)",
};

const statLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6f7a96",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const statValueStyle = {
  marginTop: 8,
  fontSize: 30,
  fontWeight: 800,
  color: "#15244f",
};

const sectionStyle = {
  marginTop: 18,
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: 20,
  fontWeight: 800,
  color: "#15244f",
};

const tableWrapStyle = {
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(84, 98, 140, 0.1)",
  background: "rgba(245,248,255,0.7)",
};

const previewTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const cellHeaderStyle = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  color: "#6f7a96",
  borderBottom: "1px solid rgba(84, 98, 140, 0.12)",
  background: "rgba(255,255,255,0.86)",
};

const cellStyle = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(84, 98, 140, 0.08)",
  color: "#15244f",
};

const errorSummaryListStyle = {
  display: "grid",
  gap: 10,
};

const errorSummaryItemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "14px 16px",
  borderRadius: 16,
  background: "rgba(255, 247, 231, 0.82)",
  border: "1px solid rgba(255, 182, 72, 0.24)",
};

const errorSummaryReasonStyle = {
  fontWeight: 700,
  color: "#15244f",
};

const errorSummaryCountStyle = {
  minWidth: 36,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.85)",
  textAlign: "center",
  fontWeight: 800,
  color: "#a96e13",
};

const detailsStyle = {
  marginTop: 14,
  borderRadius: 16,
  background: "rgba(243,247,255,0.72)",
  border: "1px solid rgba(84, 98, 140, 0.1)",
  padding: 14,
};

const summaryStyle = {
  cursor: "pointer",
  fontWeight: 700,
  color: "#15244f",
};

const detailsListStyle = {
  marginTop: 12,
  display: "grid",
  gap: 8,
  maxHeight: 240,
  overflow: "auto",
};

const detailsItemStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.88)",
  color: "#15244f",
};

const detailsItemSeparatorStyle = {
  color: "#6f7a96",
};
