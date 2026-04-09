export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target.result;

      const lines = text.split("\n").filter(line => line.trim() !== "");

      const headers = lines[0]
  .split(",")
  .map(h => h.trim().toLowerCase());

      const data = lines.slice(1).map(line => {
        const values = line.split(",");

        const obj = {};

        headers.forEach((header, index) => {
          obj[header] = values[index]?.replace(/"/g, "").trim();
        });

        return obj;
      });

      resolve({
        headers,
        data
      });
    };

    reader.onerror = () => reject("Błąd odczytu pliku");

    reader.readAsText(file);
  });
};
