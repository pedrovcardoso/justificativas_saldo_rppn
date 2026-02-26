const session = requireSession("../login/index.html");

let rawData = [];
let filteredData = [];
let columns = [];
let currentPage = 1;
let itemsPerPage = 25;

const PANEL_SELECT_IDS = ["filterUE", "filterPrograma", "filterElemento", "filterStatus"];

let descriptiveData = {
    unidades: [],
    programas: [],
    elementos: []
};

async function loadDescriptiveData() {
    try {
        const [u, p, e] = await Promise.all([
            fetch("../../assets/json/unidades.json").then(r => r.json()),
            fetch("../../assets/json/programas.json").then(r => r.json()),
            fetch("../../assets/json/elemento_item.json").then(r => r.json())
        ]);
        descriptiveData.unidades = u;
        descriptiveData.programas = p;
        descriptiveData.elementos = e;
    } catch (err) {
        console.error("Erro ao carregar dados descritivos:", err);
    }
}

function showState(name) {
    ["stateLoading", "stateTable", "stateEmpty"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("hidden", id !== name);
    });
    const pag = document.getElementById("paginationWrap");
    if (pag) pag.classList.toggle("hidden", name !== "stateTable");
}

async function init() {
    showState("stateLoading");
    await loadDescriptiveData();

    const res = await getData(session.user, session.token);
    if (!res.ok || !res.data?.success) {
        showState("stateEmpty");
        return;
    }

    const csvRaw = res.data?.data?.csv || "";
    rawData = parseCSV(csvRaw);
    enrichRows(rawData);

    if (rawData.length > 0) {
        columns = [
            "Unidade Executora - Nome",
            "RPPN - Referência",
            "Exercício de Emissão",
            "Programa - Descrição",
            "Elemento Item - Descrição",
            "Saldo Restos a Pagar Não Processado",
            "Status Justificativa"
        ].filter(c => Object.keys(rawData[0]).includes(c));
    }

    populateFilterOptions();
    applyFilters();
}

function enrichRows(rows) {
    rows.forEach(row => {
        const uoCode = String(row["Unidade Orçamentária - Código"] || "");
        const uo = descriptiveData.unidades.find(u => String(u.unidade_orcamentaria_codigo) === uoCode);
        const ueCode = String(row["Unidade Executora - Código"] || "");
        row["Unidade Executora - Nome"] = (uo && uo.unidades_executoras.find(u => String(u.codigo) === ueCode))?.nome || "N/A";

        const progCode = String(row["Programa - Código"] || "");
        let progDesc = "N/A";
        for (const entry of descriptiveData.programas) {
            const p = entry.programas.find(pr => String(pr.codigo) === progCode);
            if (p) { progDesc = p.descricao; break; }
        }
        row["Programa - Descrição"] = progDesc;

        const elemCode = String(row["Elemento Item Despesa - Código"] || "");
        let elemDesc = "N/A";
        for (const entry of descriptiveData.elementos) {
            const e = entry.itens.find(i => String(i.codigo) === elemCode);
            if (e) { elemDesc = e.descricao; break; }
        }
        row["Elemento Item - Descrição"] = elemDesc;
    });
}

function populateFilterOptions() {
    const sets = { filterUE: new Set(), filterPrograma: new Set(), filterElemento: new Set(), filterStatus: new Set() };
    rawData.forEach(row => {
        if (row["Unidade Executora - Nome"]) sets.filterUE.add(row["Unidade Executora - Nome"]);
        if (row["Programa - Descrição"]) sets.filterPrograma.add(row["Programa - Descrição"]);
        if (row["Elemento Item - Descrição"]) sets.filterElemento.add(row["Elemento Item - Descrição"]);
        if (row["Status Justificativa"]) sets.filterStatus.add(row["Status Justificativa"]);
    });

    Object.keys(sets).forEach(id => {
        setCustomSelectOptions(id, [...sets[id]].sort());
        onCustomSelectChange(id, () => applyFilters());
    });
}

function applyFilters() {
    const q = document.getElementById("searchInput").value.toLowerCase();
    const ue = getCustomSelectValues("filterUE");
    const pr = getCustomSelectValues("filterPrograma");
    const el = getCustomSelectValues("filterElemento");
    const st = getCustomSelectValues("filterStatus");

    filteredData = rawData.filter(row => {
        const matchesSearch = !q || columns.some(c => String(row[c] || "").toLowerCase().includes(q));
        const matchesUE = !ue.length || ue.includes(row["Unidade Executora - Nome"]);
        const matchesPR = !pr.length || pr.includes(row["Programa - Descrição"]);
        const matchesEL = !el.length || el.includes(row["Elemento Item - Descrição"]);
        const matchesST = !st.length || st.includes(row["Status Justificativa"]);
        return matchesSearch && matchesUE && matchesPR && matchesEL && matchesST;
    });

    currentPage = 1;
    renderTable();
    updateFilterCount(q || ue.length || pr.length || el.length || st.length);
}


function renderTable() {
    if (!filteredData.length) { showState("stateEmpty"); return; }
    showState("stateTable");

    const head = document.getElementById("tableHead");
    head.innerHTML = columns.map(c => `<th class="px-6 py-4 text-left text-[11px] font-bold text-slate-400 normal-case tracking-tight">${c}</th>`).join("");

    const body = document.getElementById("tableBody");
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredData.slice(start, start + itemsPerPage);

    body.innerHTML = pageData.map(row => `
        <tr class="hover:bg-slate-50 transition-colors">
            ${columns.map(c => {
        let val = row[c] || "";
        if (c.includes("Saldo")) val = formatMoeda(val);
        if (c.includes("Status")) {
            const status = val.toLowerCase();
            let cls = "bg-slate-100 text-slate-500";
            if (status.includes("pendente")) cls = "bg-amber-50 text-amber-700";
            else if (status.includes("mantido") || status.includes("aprovado")) cls = "bg-emerald-50 text-emerald-700";
            else if (status.includes("cancelado") || status.includes("rejeitado")) cls = "bg-rose-50 text-rose-700";
            val = `<span class="px-2 py-1 rounded-lg text-[10px] font-bold ${cls}">${val}</span>`;
        }
        return `<td class="px-6 py-4 text-[13px] text-slate-600 font-medium">${val}</td>`;
    }).join("")}
        </tr>
    `).join("");

    updatePagination();
}

function updatePagination() {
    const total = filteredData.length;
    const pages = Math.ceil(total / itemsPerPage) || 1;
    const start = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, total);

    document.getElementById("paginationInfo").textContent = `${start} — ${end} de ${total} registros`;
    document.getElementById("pageNumber").textContent = currentPage;
    document.getElementById("btnPrev").disabled = currentPage === 1;
    document.getElementById("btnNext").disabled = currentPage >= pages;
}

function changePage(delta) {
    currentPage += delta;
    renderTable();
}

function handleRowsPerPageChange() {
    itemsPerPage = parseInt(document.getElementById("rowsPerPage").value);
    currentPage = 1;
    renderTable();
}


function updateFilterCount(active) {
    const el = document.getElementById("filterResultCount");
    if (active) {
        el.textContent = `${filteredData.length} resultados encontrados`;
        el.classList.remove("opacity-0");
    } else {
        el.classList.add("opacity-0");
    }
}

function clearAllTableFilters() {
    document.getElementById("searchInput").value = "";
    PANEL_SELECT_IDS.forEach(id => clearCustomSelect(id));
    applyFilters();
}

function exportCSV() {
    if (!filteredData.length) return;
    const headers = columns.join(",");
    const rows = filteredData.map(row => columns.map(c => `"${row[c] || ""}"`).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_rppn_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function exportExcel() {
    if (!filteredData.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredData.map(row => {
        const n = {};
        columns.forEach(c => n[c] = row[c]);
        return n;
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio_rppn_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function filterTable() { applyFilters(); }

if (session) {
    Layout.ready.then(() => init());
}
