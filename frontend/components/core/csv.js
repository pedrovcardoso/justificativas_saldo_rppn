function parseCSV(csvString) {
    if (!csvString || typeof csvString !== "string") return [];

    const lines = csvString.split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length < 2) return [];

    const headers = lines[0].split(";").map(h => h.replace(/^"|"$/g, "").trim());

    return lines.slice(1).map(line => {
        const values = line.split(";").map(v => v.replace(/^"|"$/g, "").trim());
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i] ?? null;
        });
        return obj;
    });
}

function getColumns(data) {
    if (!data.length) return [];
    return Object.keys(data[0]);
}

function formatMoeda(value) {
    const num = parseFloat(String(value).replace(",", "."));
    if (isNaN(num)) return value;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
