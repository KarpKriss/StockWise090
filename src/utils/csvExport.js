export const exportToCSV = ({
  data = [],
  columns = [],
  fileName = "export.csv"
}) => {
  if (!data.length) {
    alert("Brak danych do eksportu");
    return;
  }

  // nagłówki
  const headers = columns.map(col => col.label);

  // mapowanie danych
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];

      // zabezpieczenie przed przecinkami i nullami
      if (value === null || value === undefined) return "";

      return `"${String(value).replace(/"/g, '""')}"`;
    })
  );

  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();

  window.URL.revokeObjectURL(url);
};
