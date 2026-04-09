export function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export function formatNumber(value) {
  const numeric = Number(value);
  return Number.isNaN(numeric) ? "" : numeric.toLocaleString();
}
