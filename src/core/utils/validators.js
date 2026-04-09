export const validateLoginForm = ({ login, password }) => {
  const errors = {};

  if (!login || login.trim() === "") {
    errors.login = "Login jest wymagany";
  }

  if (!password || password.trim() === "") {
    errors.password = "Hasło jest wymagane";
  }

  return errors;
};

export function validateLocations(rows) {
  const required = ["code", "zone"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    for (const col of required) {
      if (!row[col]) {
        throw new Error(`Brak kolumny ${col} w wierszu ${i + 1}`);
      }
    }

    if (typeof row.code !== "string") {
      throw new Error(`Niepoprawny code w wierszu ${i + 1}`);
    }
  }

  const codes = rows.map(r => r.code);
  const unique = new Set(codes);

  if (codes.length !== unique.size) {
    throw new Error("Duplikaty lokalizacji w pliku");
  }

  return true;
}
