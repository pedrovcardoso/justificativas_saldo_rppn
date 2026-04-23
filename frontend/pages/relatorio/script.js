const session = requireSession("/frontend/pages/login/index.html");

let rawData = [];
let panelFilteredData = [];
let tableFilteredData = [];
let columns = [];
let currentPage = 1;
let itemsPerPage = 25;

const PANEL_SELECT_IDS = [
    "filterUO", "filterUE", "filterAno", "filterPrograma", "filterElemento",
    "filterFuncao", "filterSubfuncao", "filterProcedencia", "filterProjetoAtividade", "filterStatus"
];
const CHECKBOX_GROUPS = ["Decisao", "Status"];

let COLUMN_CONFIG = [];

const INITIAL_COLUMNS = [
    { key: "Saldo Restos a Pagar Não Processado", label: "Saldo Restos a Pagar Não Processado", visible: true },
    { key: "Unidade Orçamentária - Código", label: "UNIDADE ORÇAMENTARIA", visible: true },
    { key: "Unidade Executora - Código", label: "UNIDADE EXECUTORA", visible: true },
    { key: "Ano Origem Restos a Pagar", label: "ANO ORIGEM EMPENHO", visible: true },
    { key: "Documento Restos a Pagar", label: "NUMERO EMPENHO", visible: true },
    { key: "Função - Código", label: "FUNÇÃO", visible: true },
    { key: "Subfunção - Código", label: "SUBFUNÇÃO", visible: true },
    { key: "Grupo Despesa - Código", label: "GRUPO", visible: true },
    { key: "Modalidade Aplicação - Código", label: "MODALIDADE", visible: true },
    { key: "Elemento Despesa - Código", label: "ELEMENTO", visible: true },
    { key: "Item Despesa - Código", label: "ITEM", visible: true },
    { key: "Fonte Recurso - Código", label: "FONTE", visible: true },
    { key: "Procedência - Código", label: "PROCEDENCIA", visible: true },
    { key: "Projeto_Atividade - Código", label: "PROJETO ATIVIDADE", visible: true }
];

let descriptiveData = {
    unidades: [],
    programas: [],
    elementos: []
};

async function loadDescriptiveData() {
    try {
        const [u, p, e] = await Promise.all([
            fetch("/frontend/assets/json/unidades.json").then(r => r.json()),
            fetch("/frontend/assets/json/programas.json").then(r => r.json()),
            fetch("/frontend/assets/json/elemento_item.json").then(r => r.json())
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
    const rowsSelect = document.getElementById("rowsPerPage");
    if (rowsSelect) {
        rowsSelect.value = itemsPerPage;
    }

    PANEL_SELECT_IDS.forEach(id => renderSkeletonSelect(id));
    initSidebarResizer();

    const sideScroll = document.getElementById("sidebarScrollContainer");
    if (sideScroll) {
        sideScroll.addEventListener("scroll", () => {
            document.querySelectorAll('.custom-select-container.is-open').forEach(container => {
                const selectId = container.dataset.selectId;
                const toggleBtn = container.querySelector('.selection-area');
                if (toggleBtn) toggleBtn.click();
            });
        });
    }
    ['filterSaldoMin', 'filterSaldoMax'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => applyFilters());
    });

    showState("stateLoading");
    await loadDescriptiveData();

    const res = await getData(session.user, session.token);
    if (!res.ok || !res.data?.success) {
        showState("stateEmpty");
        return;
    }

    rawData = res.data?.data?.rows || [];
    rawData = await ColumnMapper.mapRows(rawData);
    const statusData = await fetchStatusUpdates();
    enrichRows(rawData, statusData);

    if (rawData.length > 0) {
        const allKeys = Object.keys(rawData[0]);

        COLUMN_CONFIG = INITIAL_COLUMNS.map(conf => ({ ...conf }));

        allKeys.forEach(key => {
            if (!COLUMN_CONFIG.some(c => c.key === key)) {
                COLUMN_CONFIG.push({
                    key,
                    label: key,
                    visible: false
                });
            }
        });

        columns = COLUMN_CONFIG
            .filter(conf => conf.visible)
            .map(conf => conf.key);
    }

    populateFilterOptions();
    renderCheckboxFilters();
    applyFilters();
}

async function fetchStatusUpdates() {
    try {
        const res = await checkStatus(session.user, session.token);
        const data = res.ok && res.data?.success ? res.data.data : [];
        const finalData = Array.isArray(data) ? data : (data?.rows || []);
        return Array.isArray(finalData) ? finalData : [];
    } catch (e) {
        console.error("Erro ao buscar status:", e);
        return [];
    }
}

function enrichRows(rows, statusData = []) {
    const sData = Array.isArray(statusData) ? statusData : [];
    rows.forEach(row => {
        const doc = String(row.documento || row["Documento Restos a Pagar"] || "");
        const update = sData.find(s => String(s.documento) === doc);

        row["Decisao"] = update ? (update.decisao || "Pendente") : "Pendente";
        row["Status Justificativa"] = update ? (update.status || "Pendente") : "Pendente";
        row["status_documento"] = row["Status Justificativa"];

        const uoCode = String(row.uo_codigo || row["Unidade Orçamentária - Código"] || "").trim();
        const uo = descriptiveData.unidades.find(u => String(u.unidade_orcamentaria_codigo).trim() === uoCode);
        const ueCode = String(row.ue_codigo || row["Unidade Executora - Código"] || "").trim();

        row["UO_Concatenada"] = `${uoCode} - ${uo?.unidade_orcamentaria_nome || 'N/A'}`;
        const ue = uo?.unidades_executoras?.find(u => String(u.codigo).trim() === ueCode);
        row["UE_Concatenada"] = `${ueCode} - ${ue?.nome || 'N/A'}`;
        row.uo_codigo = row["UO_Concatenada"];
        row.ue_codigo = row["UE_Concatenada"];
        row["Unidade Executora - Nome"] = ue?.nome || "N/A";

        const progCode = String(row.programa || row["Programa - Código"] || "");
        let progDesc = "N/A";
        for (const entry of descriptiveData.programas) {
            const p = entry.programas.find(pr => String(pr.codigo) === progCode);
            if (p) { progDesc = p.descricao; break; }
        }
        row["Programa - Descrição"] = progDesc;

        const elemCode = String(row.elemento_item || row["Elemento Item Despesa - Código"] || "");
        let elemDesc = "N/A";
        for (const entry of descriptiveData.elementos) {
            const e = entry.itens.find(i => String(i.codigo) === elemCode);
            if (e) { elemDesc = e.descricao; break; }
        }
        row["Elemento Item - Descrição"] = elemDesc;
    });
}

function populateFilterOptions() {
    const sets = {};
    PANEL_SELECT_IDS.forEach(id => sets[id] = new Set());

    rawData.forEach(row => {
        if (row["UO_Concatenada"]) sets.filterUO.add(row["UO_Concatenada"]);
        if (row["UE_Concatenada"]) sets.filterUE.add(row["UE_Concatenada"]);
        if (row.ano_origem) sets.filterAno.add(row.ano_origem);
        if (row["Programa - Descrição"]) sets.filterPrograma.add(row["Programa - Descrição"]);
        if (row["Elemento Item - Descrição"]) sets.filterElemento.add(row["Elemento Item - Descrição"]);
        if (row.funcao) sets.filterFuncao.add(row.funcao);
        if (row.subfuncao) sets.filterSubfuncao.add(row.subfuncao);
        if (row.procedencia) sets.filterProcedencia.add(row.procedencia);
        if (row.projeto_atividade) sets.filterProjetoAtividade.add(row.projeto_atividade);
        if (row["Status Justificativa"]) sets.filterStatus.add(row["Status Justificativa"]);
    });

    const moreContent = document.getElementById("moreFiltersContent");
    const labels = {
        filterPrograma: "Programa",
        filterElemento: "Elemento Item",
        filterFuncao: "Função",
        filterSubfuncao: "Subfunção",
        filterProcedencia: "Procedência",
        filterProjetoAtividade: "Projeto Atividade",
        filterStatus: "Status (Original)"
    };

    Object.keys(sets).forEach(id => {
        let el = document.getElementById(id);
        if (!el && moreContent && labels[id]) {
            const div = document.createElement("div");
            div.className = "space-y-2";
            div.innerHTML = `
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">${labels[id]}</label>
                <select id="${id}" multiple data-placeholder="Todos" class="hidden"></select>
            `;
            moreContent.appendChild(div);
            renderSkeletonSelect(id);
        }

        setCustomSelectOptions(id, [...sets[id]].sort());
        onCustomSelectChange(id, () => applyFilters());
    });

    const saldoSkel = document.getElementById('saldoSkeleton');
    const saldoInps = document.getElementById('saldoInputs');
    if (saldoSkel) saldoSkel.classList.add('hidden');
    if (saldoInps) saldoInps.classList.remove('hidden');
}

function applyFilters() {
    const f = {
        uo: getCustomSelectValues("filterUO"),
        ue: getCustomSelectValues("filterUE"),
        an: getCustomSelectValues("filterAno"),
        pr: getCustomSelectValues("filterPrograma"),
        el: getCustomSelectValues("filterElemento"),
        fn: getCustomSelectValues("filterFuncao"),
        sf: getCustomSelectValues("filterSubfuncao"),
        pc: getCustomSelectValues("filterProcedencia"),
        pa: getCustomSelectValues("filterProjetoAtividade"),
        st: getCustomSelectValues("filterStatus"),
        dec: getCheckboxValues("Decisao"),
        sta: getCheckboxValues("Status"),
        sMin: parseMoeda(document.getElementById('filterSaldoMin')?.value),
        sMax: parseMoeda(document.getElementById('filterSaldoMax')?.value)
    };

    panelFilteredData = rawData.filter(row => {
        const matchesUO = !f.uo.length || f.uo.includes(row["UO_Concatenada"]);
        const matchesUE = !f.ue.length || f.ue.includes(row["UE_Concatenada"]);
        const matchesAN = !f.an.length || f.an.includes(String(row.ano_origem));
        const matchesPR = !f.pr.length || f.pr.includes(row["Programa - Descrição"]);
        const matchesEL = !f.el.length || f.el.includes(row["Elemento Item - Descrição"]);
        const matchesFN = !f.fn.length || f.fn.includes(String(row.funcao));
        const matchesSF = !f.sf.length || f.sf.includes(String(row.subfuncao));
        const matchesPC = !f.pc.length || f.pc.includes(String(row.procedencia));
        const matchesPA = !f.pa.length || f.pa.includes(String(row.projeto_atividade));
        const matchesST = !f.st.length || f.st.includes(row["Status Justificativa"]);

        const matchesCbDecisao = !f.dec.length || f.dec.includes(row["Decisao"]);
        const matchesCbStatus = !f.sta.length || f.sta.includes(row["Status Justificativa"]);

        const saldo = parseMoeda(row.saldo_rppn);
        const matchesSMin = isNaN(f.sMin) || saldo >= f.sMin;
        const matchesSMax = isNaN(f.sMax) || saldo <= f.sMax;

        return matchesUO && matchesUE && matchesAN && matchesPR && matchesEL &&
            matchesFN && matchesSF && matchesPC && matchesPA && matchesST &&
            matchesCbDecisao && matchesCbStatus && matchesSMin && matchesSMax;
    });

    applyTableColumnFilters();
    updateFilterCount(Object.values(f).some(v => Array.isArray(v) ? v.length > 0 : !isNaN(v)));
}

function applyTableColumnFilters() {
    const tableColFilters = typeof window.getActiveTableFilters === 'function' ? window.getActiveTableFilters() : {};

    tableFilteredData = panelFilteredData.filter(row => {
        for (const colKey in tableColFilters) {
            if (colKey.endsWith('_range')) continue;

            const reqVals = tableColFilters[colKey];
            const range = tableColFilters[colKey + '_range'];
            const cellValueStr = String(row[colKey] ?? '');

            if (reqVals && reqVals.length > 0) {
                const cellValuesList = cellValueStr.split('||');
                const isMatchFound = cellValuesList.some(val => reqVals.includes(val));
                if (!isMatchFound) return false;
            }

            if (range) {
                const val = typeof parseMoeda === 'function' ? parseMoeda(cellValueStr) : parseFloat(cellValueStr);
                if (range.min !== '' && val < parseFloat(range.min)) return false;
                if (range.max !== '' && val > parseFloat(range.max)) return false;
            }
        }
        return true;
    });

    const sort = typeof window.getActiveTableSort === 'function' ? window.getActiveTableSort() : null;
    if (sort && sort.key && sort.direction) {
        window.sortDataArray(tableFilteredData, sort.key, sort.direction);
    }

    window._tableFilteredData = tableFilteredData;
    currentPage = 1;
    renderTable();
}

window.addEventListener('tableFiltersChanged', () => {
    applyTableColumnFilters();
});

window.addEventListener('columnConfigChanged', (e) => {
    if (e.detail && e.detail.config) {
        COLUMN_CONFIG = e.detail.config;
        columns = COLUMN_CONFIG.filter(c => c.visible).map(c => c.key);
        document.getElementById("tableHead").innerHTML = "";
        renderTable();
    }
});


function renderTable() {
    if (!tableFilteredData.length) { showState("stateEmpty"); return; }
    showState("stateTable");

    const head = document.getElementById("tableHead");
    if (head.innerHTML === "") {
        columns.forEach(colKey => {
            const conf = COLUMN_CONFIG.find(c => c.key === colKey) || { label: colKey };
            const th = document.createElement("th");
            th.className = "px-4 py-3 text-left text-[11px] font-bold text-slate-400 normal-case tracking-tight relative group min-w-0";

            th.style.width = "180px";
            th.style.minWidth = "50px";
            th.style.maxWidth = "400px";

            th.innerHTML = `
                <div class="flex items-center gap-1.5 min-w-0">
                    <i class='bx bx-grid-vertical table-drag-handle cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'></i>
                    <span class="table-span-header cursor-pointer truncate min-w-0">${conf.label}</span>
                    <span class="sort-indicator"></span>
                    <button class="table-filter-trigger shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" data-key="${colKey}">
                        <i class="bx bx-filter filter-icon"></i>
                    </button>
                </div>
            `;
            head.appendChild(th);
        });
    }

    const body = document.getElementById("tableBody");
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = tableFilteredData.slice(start, start + itemsPerPage);

    body.innerHTML = pageData.map(row => `
        <tr class="hover:bg-slate-50 transition-colors">
            ${columns.map(c => {
        let val = row[c] || "";
        const isCurrency = c.includes("Saldo") || c.includes("Valor");
        const isStatus = c.includes("Status");

        if (isCurrency) val = formatMoeda(val);

        let content = val;
        if (isStatus) {
            const status = String(val).toLowerCase();
            let cls = "bg-slate-100 text-slate-500";
            if (status.includes("pendente")) cls = "bg-amber-50 text-amber-700";
            else if (status.includes("mantido") || status.includes("aprovado")) cls = "bg-emerald-50 text-emerald-700";
            else if (status.includes("cancelado") || status.includes("rejeitado")) cls = "bg-rose-50 text-rose-700";
            content = `<span class="px-2 py-1 rounded-lg text-[10px] font-bold ${cls}">${val}</span>`;
        }

        return `
            <td class="px-4 py-3 text-[13px] text-slate-600 font-medium overflow-hidden min-w-0 ${isCurrency ? 'font-mono' : ''}">
                <span class="line-clamp-1 truncate block w-full" title="${val}">${content}</span>
            </td>
        `;
    }).join("")}
        </tr>
    `).join("");

    updatePagination();
    afterTableRender();
}

function updatePagination() {
    const total = tableFilteredData.length;
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
    if (el) {
        el.textContent = tableFilteredData.length;
    }
}

function clearAllTableFilters() {
    PANEL_SELECT_IDS.forEach(id => clearCustomSelect(id));
    clearCheckboxes();
    const sMin = document.getElementById('filterSaldoMin');
    const sMax = document.getElementById('filterSaldoMax');
    if (sMin) sMin.value = "";
    if (sMax) sMax.value = "";
    window.dispatchEvent(new Event('clearAllFilters'));
    applyFilters();
}

function exportCSV() {
    if (!tableFilteredData.length) return;
    const labels = columns.map(colKey => {
        const conf = COLUMN_CONFIG.find(c => c.key === colKey);
        return conf ? conf.label : colKey;
    });
    const headers = labels.join(",");
    const rows = tableFilteredData.map(row => columns.map(c => `"${row[c] || ""}"`).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_rppn_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function exportExcel() {
    if (!tableFilteredData.length) return;

    const data = tableFilteredData.map(row => {
        const n = {};
        columns.forEach(colKey => {
            const conf = COLUMN_CONFIG.find(c => c.key === colKey);
            const label = conf ? conf.label : colKey;
            n[label] = row[colKey];
        });
        return n;
    });

    const ws = XLSX.utils.json_to_sheet(data);

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!ws[address]) continue;
        ws[address].s = {
            fill: { fgColor: { rgb: "003D5D" } },
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center", vertical: "center" }
        };
    }

    ws['!autofilter'] = { ref: ws['!ref'] };
    ws['!views'] = [{ state: 'frozen', ySplit: 1 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio_rppn_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function filterTable() { applyFilters(); }

function toggleMoreFilters() {
    const content = document.getElementById("moreFiltersContent");
    const icon = document.getElementById("iconMoreFilters");
    const isHidden = content.classList.contains("hidden");

    content.classList.toggle("hidden");
    icon.classList.toggle("bx-chevron-down", !isHidden);
    icon.classList.toggle("bx-chevron-up", isHidden);
}

function initSidebarResizer() {
    const resizer = document.getElementById("sidebarResizer");
    const sidebar = document.getElementById("sidebarFilters");
    let isResizing = false;

    resizer.addEventListener("mousedown", (e) => {
        isResizing = true;
        document.body.style.cursor = "col-resize";
        document.body.classList.add("select-none");
    });

    document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;
        const offset = e.clientX - sidebar.getBoundingClientRect().left;
        const newWidth = Math.max(200, Math.min(600, offset));
        sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener("mouseup", () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = "default";
        document.body.classList.remove("select-none");
    });
}

function renderCheckboxFilters() {
    const groups = {
        Decisao: new Set(),
        Status: new Set()
    };

    rawData.forEach(row => {
        if (row["Decisao"]) groups.Decisao.add(row["Decisao"]);
        if (row["Status Justificativa"]) groups.Status.add(row["Status Justificativa"]);
    });

    Object.keys(groups).forEach(group => {
        const container = document.getElementById(`checkbox${group}`);
        if (!container) return;

        container.innerHTML = [...groups[group]].sort().map(val => `
            <label class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group">
                <input type="checkbox" value="${val}" onchange="applyFilters()"
                    class="w-5 h-5 rounded-lg border-2 border-slate-200 text-[#003D5D] focus:ring-[#003D5D]/20 transition-all cursor-pointer">
                <span class="text-[12px] font-medium text-slate-600 group-hover:text-[#003D5D] transition-colors">${val}</span>
            </label>
        `).join("");
    });
}

function getCheckboxValues(group) {
    const container = document.getElementById(`checkbox${group}`);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
}

function clearCheckboxes() {
    ["Decisao", "Status"].forEach(group => {
        const container = document.getElementById(`checkbox${group}`);
        if (container) {
            container.querySelectorAll('input').forEach(cb => cb.checked = false);
        }
    });
}

if (session) {
    Layout.ready.then(() => init());
}

function afterTableRender() {
    setTimeout(() => {
        initializeTableFilters("stateTable");
        initializeTableResizing("stateTable");
        initializeTableReordering("stateTable");
        initializeColumnRenaming("stateTable");
        initializeColumnVisibility("stateTable", "btnColumns", COLUMN_CONFIG);
    }, 50);
}
