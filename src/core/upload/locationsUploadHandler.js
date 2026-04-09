import { clearLocations, insertLocations } from "../api/adminApi";
import { validateLocations } from "../utils/validators";

export async function handleLocationsUpload(file) {
  const text = await file.text();

const rows = text
  .split("\n")
  .slice(1)
  .filter(line => line.trim() !== "") // usuwa puste linie
  .map(line => line.split(","))
  .map(([code, zone]) => ({
    code: code?.trim(),
    zone: zone?.trim(),
    status: "active"
  }));

  validateLocations(rows);

  // 🔥 FULL REPLACE
  await clearLocations();
  await insertLocations(rows);

  return rows.length;
}
