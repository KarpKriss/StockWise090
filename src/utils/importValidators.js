export const validateImportData = ({
  data = [],
  requiredFields = [],
  uniqueField = null
}) => {
  const errors = [];
  const validData = [];
  const seen = new Set();

  data.forEach((row, index) => {
    let isValid = true;

    // 🔴 wymagane pola
    requiredFields.forEach(field => {
      if (!row[field] || row[field].trim() === "") {
        errors.push({
          row: index + 1,
          error: `Brak pola ${field}`
        });
        isValid = false;
      }
    });

    // 🔴 duplikaty
    if (uniqueField) {
      const value = row[uniqueField];

      if (seen.has(value)) {
        errors.push({
          row: index + 1,
          error: `Duplikat ${uniqueField}: ${value}`
        });
        isValid = false;
      } else {
        seen.add(value);
      }
    }

    if (isValid) {
      validData.push(row);
    }
  });

  return {
    validData,
    errors
  };
};
