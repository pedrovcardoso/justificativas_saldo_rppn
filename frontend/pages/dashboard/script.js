const session = requireSession("../login/index.html");

let rawData = [];
let panelFilteredData = [];
let tableFilteredData = [];
let columns = [];
let currentRppn = "";
let currentPage = 1;
let itemsPerPage = parseInt(localStorage.getItem("rppn_items_per_page")) || 10;
if (![10, 25, 50].includes(itemsPerPage)) itemsPerPage = 10;
const CACHE_KEY = "rppn_data_cache";
const PANEL_SELECT_IDS = ["filterUE", "filterPrograma", "filterElemento", "filterDecisao", "filterAvaliacao", "filterStatusProcesso"];
let tableApiData = []; // Store API data for the current page
let statusHistory = []; // Store all status history
let selectedRppns = new Set(); // Track selected RPPNs for batch action

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

async function setupTitle() {
    if (!session || !session.uo) return;
    const uo = String(session.uo);
    try {
        const res = await fetch("../../assets/json/unidades.json");
        const unidades = await res.json();
        const unidade = unidades.find(u => String(u.unidade_orcamentaria_codigo) === uo);
        const nome = unidade ? unidade.unidade_orcamentaria_nome : "Unidade não identificada";
        document.getElementById("uoTitle").textContent = `UO ${uo} — ${nome}`;
    } catch (e) {
        console.error("Erro ao carregar unidades:", e);
        document.getElementById("uoTitle").textContent = `UO ${uo}`;
    }
}

function showState(name) {
    ["stateLoading", "stateError", "stateTable", "stateEmpty"].forEach(id => {
        const el = document.getElementById(id);
        el.classList.toggle("hidden", id !== name);
        if (id === name && id !== "stateTable") el.classList.add("flex");
        else el.classList.remove("flex");
    });
    document.getElementById("paginationWrap").classList.toggle("hidden", name !== "stateTable");
}

async function handleRefresh() {
    sessionStorage.removeItem(CACHE_KEY);
    await loadData();
}

async function loadData() {
    PANEL_SELECT_IDS.forEach(id => renderSkeletonSelect(id));
    showState("stateLoading");

    if (!descriptiveData.unidades.length) {
        await loadDescriptiveData();
    }

    const cached = sessionStorage.getItem(CACHE_KEY);
    let csvRaw = "";

    if (cached) {
        csvRaw = cached;
    } else {
        const res = await getData(session.user, session.token);
        if (!res.ok || !res.data?.success) {
            document.getElementById("stateErrorMsg").textContent = res.data?.error || "Falha técnica na extração dos dados.";
            showState("stateError");
            return;
        }
        csvRaw = res.data?.data?.csv || "";
        try {
            sessionStorage.setItem(CACHE_KEY, csvRaw);
        } catch (e) {
            console.warn("Dados muito grandes para o cache. Continuando em memória.");
        }
    }

    rawData = parseCSV(csvRaw);

    // Fetch all statuses once
    try {
        const statusRes = await checkStatus(session.user, session.token);
        if (statusRes.ok && statusRes.data?.success) {
            statusHistory = statusRes.data.data.status || [];
            const latestMap = {};
            statusHistory.forEach(s => {
                if (!latestMap[s.rppn] || new Date(s.data_criacao) > new Date(latestMap[s.rppn].data_criacao)) {
                    latestMap[s.rppn] = s;
                }
            });
            tableApiData = Object.values(latestMap);
        }
    } catch (e) {
        console.error("Erro ao carregar status iniciais:", e);
    }

    enrichRows(rawData);

    if (rawData.length > 0) {
        const available = Object.keys(rawData[0]);
        const preferred = [
            "Decisão",
            "Avaliação",
            "Status",
            "Unidade Orçamentária - Nome",
            "Unidade Executora - Código",
            "Unidade Executora - Nome",
            "RPPN - Referência",
            "Exercício de Emissão",
            "Programa - Código",
            "Programa - Descrição",
            "Elemento Item - Código",
            "Elemento Item - Descrição",
            "Saldo Restos a Pagar Não Processado",
            "Valor Inscrito Não Processado",
            "Valor Pago Não Processado",
            "Valor Cancelado Não Processado",
            "Status Justificativa"
        ];
        columns = preferred.filter(p => available.includes(p) || ["Decisão", "Avaliação", "Status"].includes(p));
        available.forEach(a => { if (!columns.includes(a)) columns.push(a); });
    } else {
        columns = [];
    }

    if (!rawData.length) {
        showState("stateEmpty");
        updateCards([]);
        return;
    }

    buildTableHeader();
    populateFilterOptions();
    reloadUI();
    showState("stateTable");
}

function populateFilterOptions() {
    const ueSet = new Set();
    const programaSet = new Set();
    const elementoSet = new Set();
    const decisaoSet = new Set();
    const avaliacaoSet = new Set();
    const statusProcessoSet = new Set();

    rawData.forEach(row => {
        if (row["Unidade Executora - Nome"]) ueSet.add(row["Unidade Executora - Nome"]);
        if (row["Programa - Descrição"]) programaSet.add(row["Programa - Descrição"]);
        if (row["Elemento Item - Descrição"]) elementoSet.add(row["Elemento Item - Descrição"]);

        const statusInfo = getRowStatusInfo(row);
        if (statusInfo.decisao) decisaoSet.add(statusInfo.decisao);
        if (statusInfo.avaliacao) avaliacaoSet.add(statusInfo.avaliacao);
        if (statusInfo.status) statusProcessoSet.add(statusInfo.status);
    });

    const fillSelect = (id, set) => {
        const select = document.getElementById(id);
        if (!select) return;
        const sorted = [...set].sort();
        if (typeof setCustomSelectOptions !== 'undefined') {
            setCustomSelectOptions(id, sorted);
        } else {
            select.innerHTML = '';
            sorted.forEach(val => {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = val;
                select.appendChild(opt);
            });
        }
    };

    fillSelect("filterUE", ueSet);
    fillSelect("filterPrograma", programaSet);
    fillSelect("filterElemento", elementoSet);

    // Virtual Columns - Hardcoded options
    fillSelect("filterDecisao", new Set(["Manter", "Cancelar", "(em branco)"]));
    fillSelect("filterAvaliacao", new Set(["Pendente", "Aceito", "Rejeitado", "(em branco)"]));
    fillSelect("filterStatusProcesso", new Set(["Pendente", "Em análise", "Concluído", "Retorno"]));

    if (typeof onCustomSelectChange !== 'undefined') {
        PANEL_SELECT_IDS.forEach(id => {
            if (document.getElementById(id)) {
                onCustomSelectChange(id, () => reloadUI());
            }
        });
    }
}

function reloadUI() {
    applyPanelFilters();
    applyTableColumnFilters();
    updateCards(panelFilteredData);

    if (!tableFilteredData.length) {
        showState("stateEmpty");
        return;
    }

    showState("stateTable");
    currentPage = 1;
    renderCurrentPage();
    updateFilterCountLabel();
}

function applyPanelFilters() {
    const q = (document.getElementById("searchInput")?.value || "").toLowerCase();

    const getVals = id => typeof getCustomSelectValues !== 'undefined' ? getCustomSelectValues(id) : [];
    const ueFilters = getVals("filterUE");
    const programaFilters = getVals("filterPrograma");
    const elementoFilters = getVals("filterElemento");
    const decisaoFilters = getVals("filterDecisao");
    const avaliacaoFilters = getVals("filterAvaliacao");
    const statusProcessoFilters = getVals("filterStatusProcesso");

    const minSaldo = parseFloat(document.getElementById("filterSaldoMin")?.value) || 0;
    const maxSaldo = parseFloat(document.getElementById("filterSaldoMax")?.value) || Infinity;

    const saldoKey = "Saldo Restos a Pagar Não Processado";

    panelFilteredData = rawData.filter(row => {
        const matchesSearch = !q || columns.some(c => String(row[c] ?? "").toLowerCase().includes(q));
        const matchesUE = ueFilters.length === 0 || ueFilters.includes(row["Unidade Executora - Nome"]);
        const matchesProg = programaFilters.length === 0 || programaFilters.includes(row["Programa - Descrição"]);
        const matchesElem = elementoFilters.length === 0 || elementoFilters.includes(row["Elemento Item - Descrição"]);

        const statusInfo = getRowStatusInfo(row);

        const checkFilter = (filterArr, val) => {
            if (filterArr.length === 0) return true;
            if (filterArr.includes(val)) return true;
            if (filterArr.includes("(em branco)") && (val === "" || val == null)) return true;
            return false;
        };

        const matchesDecisao = checkFilter(decisaoFilters, statusInfo.decisao);
        const matchesAvaliacao = checkFilter(avaliacaoFilters, statusInfo.avaliacao);
        const matchesStatusProcesso = checkFilter(statusProcessoFilters, statusInfo.status);

        const valSaldo = parseMoeda(row[saldoKey]) || 0;
        const matchesSaldo = valSaldo >= minSaldo && valSaldo <= maxSaldo;

        return matchesSearch && matchesUE && matchesProg && matchesElem && matchesSaldo && matchesDecisao && matchesAvaliacao && matchesStatusProcesso;
    });

    const saldoKeySort = "Saldo Restos a Pagar Não Processado";
    panelFilteredData.sort((a, b) => {
        const valA = parseMoeda(a[saldoKeySort]) || 0;
        const valB = parseMoeda(b[saldoKeySort]) || 0;
        return valB - valA;
    });
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


    window._tableFilteredData = tableFilteredData;

    const sort = typeof window.getActiveTableSort === 'function' ? window.getActiveTableSort() : null;
    if (sort && sort.key && sort.direction) {
        window.sortDataArray(tableFilteredData, sort.key, sort.direction);
    }
}

function updateFilterCountLabel() {
    const q = document.getElementById("searchInput")?.value || "";
    const getVals = id => typeof getCustomSelectValues !== 'undefined' ? getCustomSelectValues(id) : [];
    const hasActiveFilters =
        q ||
        getVals("filterUE").length > 0 ||
        getVals("filterPrograma").length > 0 ||
        getVals("filterElemento").length > 0 ||
        getVals("filterDecisao").length > 0 ||
        getVals("filterAvaliacao").length > 0 ||
        getVals("filterStatusProcesso").length > 0 ||
        (document.getElementById("filterSaldoMin")?.value || "") !== "0.01" ||
        (document.getElementById("filterSaldoMax")?.value || "") !== "";

    const countLabel = document.getElementById("filterResultCount");
    if (!countLabel) return;
    if (hasActiveFilters) {
        countLabel.classList.remove("opacity-0");
        countLabel.textContent = `${panelFilteredData.length} ${panelFilteredData.length === 1 ? 'valor encontrado' : 'valores encontrados'} nessa configuração`;
    } else {
        countLabel.classList.add("opacity-0");
    }
}

window.addEventListener('tableFiltersChanged', () => {
    applyTableColumnFilters();
    if (!tableFilteredData.length) {
        showState("stateEmpty");
        return;
    }
    showState("stateTable");
    renderCurrentPage();
});

function clearAllFilters() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    const saldoMin = document.getElementById("filterSaldoMin");
    if (saldoMin) saldoMin.value = "0.01";

    const saldoMax = document.getElementById("filterSaldoMax");
    if (saldoMax) saldoMax.value = "";

    if (typeof clearCustomSelect !== 'undefined') {
        PANEL_SELECT_IDS.forEach(id => {
            if (document.getElementById(id)) clearCustomSelect(id);
        });
    }

    window.dispatchEvent(new Event('clearAllFilters'));

    reloadUI();
}

function enrichRows(rows) {
    rows.forEach(row => {
        const uoCode = String(row["Unidade Orçamentária - Código"] || "");
        const uo = descriptiveData.unidades.find(u => String(u.unidade_orcamentaria_codigo) === uoCode);
        row["Unidade Orçamentária - Nome"] = uo ? uo.unidade_orcamentaria_nome : "N/A";
        const ueCode = String(row["Unidade Executora - Código"] || "");
        if (uo) {
            const ue = uo.unidades_executoras.find(u => String(u.codigo) === ueCode);
            row["Unidade Executora - Nome"] = ue ? ue.nome : "N/A";
        } else {
            row["Unidade Executora - Nome"] = "N/A";
        }

        const progCode = String(row["Programa - Código"] || "");
        let progDesc = "N/A";
        const ano = row["Ano Origem Restos a Pagar"];
        const yearEntry = descriptiveData.programas.find(p => String(p.ano) === String(ano));
        if (yearEntry) {
            const p = yearEntry.programas.find(pr => String(pr.codigo) === progCode);
            if (p) progDesc = p.descricao;
        } else {
            for (const entry of descriptiveData.programas) {
                const p = entry.programas.find(pr => String(pr.codigo) === progCode);
                if (p) { progDesc = p.descricao; break; }
            }
        }
        row["Programa - Descrição"] = progDesc;

        const elemCode = String(row["Elemento Item Despesa - Código"] || "");
        let elemDesc = "N/A";

        const anoRef = row["Ano Origem Restos a Pagar"];

        const yearEntryElem = descriptiveData.elementos.find(p => String(p.ano) === String(anoRef));
        if (yearEntryElem) {
            const e = yearEntryElem.itens.find(i => String(i.codigo) === elemCode);
            if (e) elemDesc = e.descricao;
        } else {
            for (const entry of descriptiveData.elementos) {
                const e = entry.itens.find(i => String(i.codigo) === elemCode);
                if (e) { elemDesc = e.descricao; break; }
            }
        }
        row["Elemento Item - Descrição"] = elemDesc;

        const info = getRowStatusInfo(row);
        row["Decisão"] = info.decisao;
        row["Avaliação"] = info.avaliacao;
        row["Status"] = info.status;
    });
}
function updateCards(rows) {
    const total = rows.length;
    const counts = { total, pendentes: 0, finalizados: 0 };

    rows.forEach(r => {
        const info = getRowStatusInfo(r);
        if (info.status === "Pendente" || info.status === "Em análise") counts.pendentes++;
        else if (info.status === "Concluído") counts.finalizados++;
    });

    document.getElementById("cardTotal").textContent = counts.total;
    document.getElementById("cardPendentes").textContent = counts.pendentes;
    document.getElementById("cardFinalizados").textContent = counts.finalizados;
}

function buildTableHeader() {
    const tr = document.getElementById("tableHead");
    tr.innerHTML = "";

    // Checkbox Column
    const thCheck = document.createElement("th");
    thCheck.className = "px-4 py-3 text-left w-12 sticky left-0 z-20 bg-slate-50/80 backdrop-blur-sm border-r-2 border-slate-100";
    thCheck.innerHTML = `
        <div class="flex items-center justify-center">
            <input type="checkbox" id="selectAllRppn" onchange="toggleSelectAll(this.checked)"
                class="w-4 h-4 rounded border-2 border-slate-300 text-[#003D5D] focus:ring-[#003D5D]/20 cursor-pointer">
        </div>
    `;
    tr.appendChild(thCheck);

    columns.forEach(col => {
        const th = document.createElement("th");
        const isHidden = col === "Unidade Orçamentária - Código" || col === "Unidade Orçamentária - Nome";
        th.className = "px-4 py-3 text-left text-[11px] font-bold text-slate-400 normal-case [letter-spacing:normal] tracking-tight relative group min-w-0";

        th.style.width = "180px";
        th.style.minWidth = "50px";
        th.style.maxWidth = "400px";

        if (isHidden) th.style.display = "none";

        th.innerHTML = `
            <div class="flex items-center gap-1.5 min-w-0">
                <i class='bx bx-grid-vertical table-drag-handle cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'></i>
                <span class="table-span-header cursor-pointer truncate min-w-0">${col}</span>
                <span class="sort-indicator"></span>
                <button class="table-filter-trigger shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" data-key="${col}">
                    <i class="bx bx-filter filter-icon"></i>
                </button>
            </div>
        `;

        tr.appendChild(th);
    });
    const thAcao = document.createElement("th");
    thAcao.className = "px-6 py-3 text-right text-[11px] font-bold text-slate-400 normal-case [letter-spacing:normal]";
    thAcao.textContent = "Opções";
    tr.appendChild(thAcao);
}

async function renderCurrentPage() {
    const start = (currentPage - 1) * itemsPerPage;
    const rowsToDisplay = tableFilteredData.slice(start, start + itemsPerPage);

    renderRows(rowsToDisplay);
    updatePaginationUI();
    afterTableRender();
}

function getRppnId(row) {
    return [
        row["Unidade Orçamentária - Código"],
        row["Unidade Executora - Código"],
        row["Ano Origem Restos a Pagar"],
        row["Documento Restos a Pagar"],
        row["Função - Código"],
        row["Subfunção - Código"],
        row["Programa - Código"],
        row["Projeto_Atividade - Código"],
        row["Subprojeto_Subatividade - Código"],
        row["Natureza_Item Despesa - Código Form"],
        row["Fonte Recurso - Código"],
        row["Procedência - Código"]
    ].map(v => String(v ?? '')).join('.');
}

function getRowStatusInfo(row) {
    const rppnId = getRppnId(row);
    const apiData = tableApiData.find(d => d.rppn === rppnId);

    // If no API data yet for the current page batch
    const isLoading = tableApiData.length === 0;

    const decisao = apiData?.acao ? (apiData.acao.charAt(0).toUpperCase() + apiData.acao.slice(1).toLowerCase()) : "";
    let avaliacao = apiData?.status ? (apiData.status.charAt(0).toUpperCase() + apiData.status.slice(1).toLowerCase()) : "";

    if (decisao && !avaliacao) avaliacao = "Pendente";

    let status = "Pendente";
    if (decisao) {
        if (!apiData?.status || apiData?.status?.toLowerCase() === "pendente") status = "Em análise";
        else if (apiData?.status?.toLowerCase() === "aceito") status = "Concluído";
        else if (apiData?.status?.toLowerCase() === "rejeitado") status = "Retorno";
    }

    return { decisao, avaliacao, status, isLoading, fullData: apiData };
}

function renderRows(rows) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";


    const statusCol = columns.find(c => /status/i.test(c)) || "";
    const currencyCols = ["Saldo Restos a Pagar Não Processado", "Valor Inscrito Não Processado", "Valor Pago Não Processado", "Valor Cancelado Não Processado"];

    rows.forEach(row => {
        const rppnId = getRppnId(row);
        const tr = document.createElement("tr");
        tr.className = `hover:bg-slate-50 transition-colors group cursor-pointer ${selectedRppns.has(rppnId) ? 'bg-blue-50/50' : ''}`;
        tr.onclick = (e) => {
            if (e.target.closest('input[type="checkbox"]')) return;
            openModal(rppnId, row);
        };

        // Checkbox Cell
        const tdCheck = document.createElement("td");
        tdCheck.className = "px-4 py-3 text-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r-2 border-slate-100 transition-colors";
        tdCheck.innerHTML = `
            <input type="checkbox" value="${rppnId}" onchange="toggleRppnSelection('${rppnId}', this.checked)"
                ${selectedRppns.has(rppnId) ? 'checked' : ''}
                class="row-checkbox w-4 h-4 rounded border-2 border-slate-300 text-[#003D5D] focus:ring-[#003D5D]/20 cursor-pointer">
        `;
        tr.appendChild(tdCheck);

        columns.forEach(col => {
            const td = document.createElement("td");
            const isHidden = col === "Unidade Orçamentária - Código" || col === "Unidade Orçamentária - Nome";
            td.className = "px-4 py-3 text-[13px] text-slate-600 font-medium overflow-hidden min-w-0";
            if (isHidden) td.style.display = "none";
            td.setAttribute("data-key", col);
            td.setAttribute("data-value", row[col] ?? "");

            const contentSpan = document.createElement("span");
            contentSpan.className = "line-clamp-1 truncate block w-full";

            const statusInfo = getRowStatusInfo(row);

            if (col === "Decisão" || col === "Avaliação" || col === "Status") {
                const sInfo = getRowStatusInfo(row);
                if (sInfo.isLoading) {
                    contentSpan.innerHTML = `<div class="skeleton-loading mx-auto"></div>`;
                } else {
                    let key = col.toLowerCase();
                    if (key === "decisão") key = "decisao";
                    if (key === "avaliação") key = "avaliacao";

                    const val = sInfo[key] || "";
                    let colorKey = "slate";
                    const lowerVal = val.toLowerCase();
                    if (lowerVal === "pendente") colorKey = "amber";
                    else if (lowerVal === "em análise") colorKey = "orange";
                    else if (lowerVal === "concluído" || lowerVal === "aceito") colorKey = "emerald";
                    else if (lowerVal === "retorno" || lowerVal === "rejeitado") colorKey = "rose";
                    else if (lowerVal === "manter") colorKey = "sky";
                    else if (lowerVal === "cancelar") colorKey = "rose";

                    contentSpan.innerHTML = val ? `
                        <span class="px-3 py-1.5 rounded-[0.75rem] text-[10px] font-bold uppercase inline-block border-2 badge-color-${colorKey}">
                            ${val}
                        </span>
                    ` : "—";
                }
                td.classList.add("text-center");
            } else if (col === statusCol && row[col]) {
                const val = row[col].toLowerCase();
                let cls = "bg-slate-100 text-slate-500 border-slate-200";
                if (val.includes("pendente")) cls = "bg-amber-50 text-amber-800 border-amber-200";
                else if (val.includes("mantido") || val.includes("aprovado")) cls = "bg-emerald-50 text-emerald-800 border-emerald-200";
                else if (val.includes("cancelado") || val.includes("rejeitado")) cls = "bg-rose-50 text-rose-800 border-rose-200";

                contentSpan.innerHTML = `<span class="px-3 py-1.5 rounded-[0.75rem] text-[10px] font-bold uppercase inline-block ${cls}">${row[col]}</span>`;
            } else if (currencyCols.includes(col)) {
                contentSpan.textContent = formatMoeda(row[col]);
                td.className += " font-mono";
            } else {
                contentSpan.textContent = row[col] ?? "";
            }
            td.appendChild(contentSpan);
            tr.appendChild(td);
        });

        const tdAcao = document.createElement("td");
        tdAcao.className = "px-6 py-3 text-right";
        const isPendente = statusCol ? /pendente/i.test(row[statusCol] || "") : true;
        if (isPendente) {
            const btn = document.createElement("button");
            btn.className = "bg-white border-2 border-slate-100 text-[#003D5D] font-bold text-[10px] normal-case [letter-spacing:normal] px-4 py-2 rounded-lg hover:bg-[#003D5D] hover:text-white hover:border-[#003D5D] transition-all opacity-0 group-hover:opacity-100 shadow-sm";
            btn.textContent = "Analisar";
            btn.onclick = (e) => { e.stopPropagation(); openModal(rppnId, row); };
            tdAcao.appendChild(btn);
        }
        tr.appendChild(tdAcao);
        tbody.appendChild(tr);
    });
}

function updatePaginationUI() {
    const totalItems = tableFilteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const start = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    document.getElementById("paginationInfo").textContent = `${start} — ${end} de ${totalItems} registros`;
    document.getElementById("pageInput").value = currentPage;
    document.getElementById("totalPagesLabel").textContent = `/ ${totalPages}`;
    document.getElementById("btnPrev").disabled = currentPage === 1;
    document.getElementById("btnNext").disabled = currentPage >= totalPages;

    document.getElementById("rowsPerPage").value = itemsPerPage;
}

function handleRowsPerPageChange() {
    itemsPerPage = parseInt(document.getElementById("rowsPerPage").value);
    localStorage.setItem("rppn_items_per_page", itemsPerPage);
    currentPage = 1;
    renderCurrentPage();
}

function goToPage(val) {
    const page = parseInt(val);
    const totalPages = Math.ceil(tableFilteredData.length / itemsPerPage) || 1;
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderCurrentPage();
    } else {
        document.getElementById("pageInput").value = currentPage;
    }
}

function changePage(delta) {
    currentPage += delta;
    renderCurrentPage();
    document.getElementById("stateTable").scrollTo({ top: 0, behavior: "smooth" });
}

function toggleFilterPanel() {
    const panel = document.getElementById("filterPanel");
    const btn = document.getElementById("btnFiltersToggle");
    panel.classList.toggle("hidden");
    const isOpen = !panel.classList.contains("hidden");

    if (isOpen) {
        btn.classList.remove("bg-slate-50", "text-slate-500", "border-slate-100");
        btn.classList.add("bg-primary-soft", "text-primary", "border-primary");
    } else {
        btn.classList.add("bg-slate-50", "text-slate-500", "border-slate-100");
        btn.classList.remove("bg-primary-soft", "text-primary", "border-primary");
    }
}

function openModal(rppn, row) {
    currentRppn = rppn;
    if (!row) {
        const rppnCol = columns.find(c => /rppn|empenho|id/i.test(c)) || columns[0];
        row = rawData.find(r => r[rppnCol] === rppn);
    }

    const labelEl = document.getElementById("modalRppnLabel");
    if (labelEl) labelEl.textContent = `ID Referência: ${rppn}`;

    const detailsWrap = document.getElementById("modalDetails");
    if (detailsWrap) detailsWrap.innerHTML = "";

    if (row) {
        const showDetails = [
            { label: "Unidade Orçamentária", value: `${row["Unidade Orçamentária - Nome"]} (${row["Unidade Orçamentária - Código"]})` },
            { label: "Unidade Executora", value: `${row["Unidade Executora - Nome"]} (${row["Unidade Executora - Código"]})` },
            { label: "Programa", value: `${row["Programa - Descrição"]} (${row["Programa - Código"]})` },
            { label: "Elemento Item", value: `${row["Elemento Item - Descrição"]} (${row["Elemento Item - Código"]})` },
            { label: "Saldo RPPN", value: formatMoeda(row["Saldo Restos a Pagar Não Processado"]), highlight: true },
            {
                label: "Valores",
                isRow: true,
                values: [
                    { label: "Inscrito", value: formatMoeda(row["Valor Inscrito Não Processado"]) },
                    { label: "Pago", value: formatMoeda(row["Valor Pago Não Processado"]) },
                    { label: "Cancelado", value: formatMoeda(row["Valor Cancelado Não Processado"]) }
                ]
            }
        ];

        showDetails.forEach(d => {
            const div = document.createElement("div");
            if (d.highlight) {
                div.className = "col-span-2 mt-2 p-4 bg-[#003D5D]/5 rounded-2xl border-2 border-[#003D5D]/10";
                div.innerHTML = `
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">${d.label}</span>
                    <span class="text-lg font-black text-[#003D5D]">${d.value}</span>
                `;
            } else if (d.isRow) {
                div.className = "col-span-2 grid grid-cols-3 gap-4 border-t-2 border-slate-50 pt-4 mt-2";
                div.innerHTML = d.values.map(v => `
                    <div class="flex flex-col gap-1">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">${v.label}</span>
                        <span class="text-[12px] font-bold text-slate-600">${v.value}</span>
                    </div>
                `).join('');
            } else {
                div.className = "flex flex-col gap-1";
                div.innerHTML = `
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">${d.label}</span>
                    <span class="text-[12px] font-bold text-slate-600">${d.value}</span>
                `;
            }
            detailsWrap.appendChild(div);
        });

        // History section logic
        const historySection = document.getElementById("historySection");
        const historyList = document.getElementById("historyList");
        const historyData = statusHistory
            .filter(s => s.rppn === rppn)
            .sort((a, b) => new Date(b.data_criacao) - new Date(a.data_criacao));

        if (historyData.length > 0) {
            historySection.classList.remove("hidden");
            historyList.innerHTML = historyData.map(h => {
                const dataCriacao = new Date(h.data_criacao).toLocaleString('pt-BR');
                const dataAvaliacao = h.data_avaliacao ? new Date(h.data_avaliacao).toLocaleString('pt-BR') : null;
                const statusLower = (h.status || 'pendente').toLowerCase();
                const acaoLower = (h.acao || '').toLowerCase();

                let badgeStatusCls = 'badge-color-amber';
                if (statusLower === 'aceito') badgeStatusCls = 'badge-color-emerald';
                else if (statusLower === 'rejeitado') badgeStatusCls = 'badge-color-rose';

                return `
                <div class="relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-slate-100 before:rounded-full">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                        <!-- Decision Block -->
                        <div class="bg-white p-5 rounded-[1.5rem] border-2 border-slate-200 shadow-sm relative">
                            <div class="absolute -left-[29px] top-6 w-3 h-3 rounded-full bg-white border-2 border-[#003D5D]"></div>
                            <div class="flex items-center justify-between mb-3">
                                <span class="px-2 py-0.5 bg-[#003D5D]/5 text-[#003D5D] text-[9px] font-black rounded-md uppercase tracking-wider">Decisão</span>
                                <span class="text-[9px] font-bold text-slate-400">${dataCriacao}</span>
                            </div>
                            <div class="flex items-center gap-2 mb-3">
                                <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border-2 badge-color-${acaoLower === 'manter' ? 'sky' : 'rose'}">
                                    ${h.acao}
                                </span>
                                <span class="text-[10px] font-black text-slate-700 truncate" title="${h.usuario_nome || 'Sistema'}">${h.usuario_nome || 'Sistema'}</span>
                            </div>
                            <div class="bg-slate-50 p-3 rounded-xl border-border">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Justificativa:</p>
                                <p class="text-[11px] font-medium text-slate-600 leading-relaxed italic line-clamp-2">"${h.justificativa || 'Sem justificativa.'}"</p>
                            </div>
                        </div>

                        <!-- Evaluation Block -->
                        <div class="bg-white p-5 rounded-[1.5rem] border-2 border-slate-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <div class="flex items-center justify-between mb-3">
                                    <span class="px-2 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-black rounded-md uppercase tracking-wider">Avaliação</span>
                                    <span class="text-[9px] font-bold text-slate-400">${dataAvaliacao || 'Aguardando'}</span>
                                </div>
                                <div class="flex items-center gap-2 mb-3">
                                    <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border-2 ${badgeStatusCls}">
                                        ${h.status || 'pendente'}
                                    </span>
                                    <span class="text-[10px] font-black text-slate-700 truncate" title="${h.user_avaliador || '—'}">${h.user_avaliador || '—'}</span>
                                </div>
                            </div>
                            ${h.motivo_rejeicao ? `
                            <div class="mt-2 p-3 bg-slate-50 rounded-xl border-border">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Motivo:</p>
                                <p class="text-[11px] font-bold text-slate-600 leading-relaxed line-clamp-2">${h.motivo_rejeicao}</p>
                            </div>
                            ` : `
                            <div class="mt-2 p-3 bg-slate-50/50 rounded-xl border-dashed border-border border-2 flex items-center justify-center py-2">
                                <span class="text-[9px] font-bold text-slate-300 italic">Sem observações</span>
                            </div>
                            `}
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            historySection.classList.add("hidden");
        }

        const statusInfo = getRowStatusInfo(row);
        const btnConfirmar = document.getElementById("btnConfirmar");
        const modalFooter = document.getElementById("modalFooter");
        const pendingView = document.getElementById("pendingView");
        const decisionControls = document.getElementById("decisionControls");
        const adminControls = document.getElementById("adminControls");
        const modalAlert = document.getElementById("modalAlert");

        const hasDecision = !!statusInfo.decisao;
        const adminMode = isAdmin() && hasDecision;

        adminControls.classList.add("hidden");
        decisionControls.classList.add("hidden");
        pendingView.classList.add("hidden");
        if (modalFooter) modalFooter.classList.remove("hidden");
        if (modalAlert) modalAlert.classList.add("hidden");

        if (adminMode) {
            adminControls.classList.remove("hidden");
            document.querySelectorAll("input[name=adminAcao]").forEach(r => r.checked = false);
            document.getElementById("adminRejectReasonWrap").classList.add("hidden");
            const reason = document.getElementById("adminRejectReason");
            if (reason) reason.value = "";
            btnConfirmar.textContent = "Salvar Avaliação";
            btnConfirmar.disabled = false;
            btnConfirmar.onclick = handleAdminConfirm;

            if (statusInfo.fullData?.justificativa) {
                pendingView.classList.remove("hidden");
                document.getElementById("pendingJustText").textContent = statusInfo.fullData.justificativa;
                const acaoLower = (statusInfo.fullData.acao || "").toLowerCase();
                const badgeAcao = document.getElementById("pendingBadgeAcao");
                const badgeStatus = document.getElementById("pendingBadgeStatus");
                badgeAcao.textContent = statusInfo.fullData.acao;
                badgeAcao.className = `px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 badge-color-${acaoLower === 'manter' ? 'sky' : 'rose'}`;
                badgeStatus.textContent = "Em Análise";
                badgeStatus.className = "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 bg-amber-100 text-amber-700 border-amber-200";
                pendingView.firstElementChild.className = "bg-amber-50 border-2 border-amber-100 rounded-[2rem] p-8 relative overflow-hidden";
            }
        } else if (statusInfo.fullData && (statusInfo.avaliacao.toLowerCase() === "pendente" || statusInfo.avaliacao.toLowerCase() === "aceito")) {
            if (modalFooter) modalFooter.classList.add("hidden");
            pendingView.classList.remove("hidden");
            document.getElementById("pendingJustText").textContent = statusInfo.fullData.justificativa || "Sem justificativa detalhada.";

            const badgeAcao = document.getElementById("pendingBadgeAcao");
            const badgeStatus = document.getElementById("pendingBadgeStatus");
            const iconWrap = pendingView.querySelector('.bx');
            const acaoLower = (statusInfo.fullData.acao || "").toLowerCase();

            badgeAcao.textContent = statusInfo.fullData.acao;
            badgeAcao.className = `px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 badge-color-${acaoLower === 'manter' ? 'sky' : 'rose'}`;

            const statusLower = statusInfo.avaliacao.toLowerCase();
            if (statusLower === "aceito") {
                badgeStatus.textContent = "Aceito";
                badgeStatus.className = "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 badge-color-emerald";
                pendingView.firstElementChild.className = "bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] p-8 relative overflow-hidden";
                if (iconWrap) iconWrap.className = 'bx bx-check-double text-6xl text-emerald-600';
            } else {
                badgeStatus.textContent = "Em Análise";
                badgeStatus.className = "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 bg-amber-100 text-amber-700 border-amber-200";
                pendingView.firstElementChild.className = "bg-amber-50 border-2 border-amber-100 rounded-[2rem] p-8 relative overflow-hidden";
                if (iconWrap) iconWrap.className = 'bx bx-time-five text-6xl text-amber-600';
            }
        } else {
            if (modalFooter) modalFooter.classList.remove("hidden");
            decisionControls.classList.remove("hidden");
            btnConfirmar.textContent = "Registrar Decisão";
            btnConfirmar.disabled = false;
            btnConfirmar.onclick = handleConfirm;
        }
    }

    document.querySelectorAll("input[name=modalAcao]").forEach(r => r.checked = false);
    document.getElementById("justAreaWrap").classList.add("hidden");
    document.getElementById("justText").value = "";
    document.getElementById("modalAlert").classList.add("hidden");
    document.getElementById("btnConfirmar").disabled = false;
    document.getElementById("modalJust").classList.remove("hidden");
}

function closeModal() { document.getElementById("modalJust").classList.add("hidden"); }

function onAcaoChange() {
    const acao = document.querySelector("input[name=modalAcao]:checked")?.value;
    document.getElementById("justAreaWrap").classList.toggle("hidden", acao !== "manter");
}

function onAdminAcaoChange() {
    const acao = document.querySelector("input[name=adminAcao]:checked")?.value;
    document.getElementById("adminRejectReasonWrap").classList.toggle("hidden", acao !== "rejeitado");
}

async function handleAdminConfirm() {
    const avaliacao = document.querySelector("input[name=adminAcao]:checked")?.value;
    if (!avaliacao) { showModalAlert("Selecione uma avaliação para continuar."); return; }

    const motivo = avaliacao === "rejeitado" ? document.getElementById("adminRejectReason").value.trim() : "";
    if (avaliacao === "rejeitado" && !motivo) { showModalAlert("Campo obrigatório: motivo da rejeição."); return; }

    const statusEntry = statusHistory.find(s => s.rppn === currentRppn && (s.status?.toLowerCase() === "pendente" || !s.status));
    const entryId = statusEntry?.id || statusHistory.filter(s => s.rppn === currentRppn).sort((a, b) => new Date(b.data_criacao) - new Date(a.data_criacao))[0]?.id;

    const btn = document.getElementById("btnConfirmar");
    const modalJust = document.getElementById("modalJust");
    const inputs = modalJust.querySelectorAll("input, textarea, button");

    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Processando…`;
    inputs.forEach(el => el.disabled = true);

    const res = await avaliarStatus(session.user, session.token, currentRppn, entryId, avaliacao, motivo);
    const result = Array.isArray(res.data) ? res.data[0] : res.data;
    const isSuccess = res.ok && result?.success;

    if (isSuccess) {
        document.getElementById("modalJust").classList.add("hidden");
        document.getElementById("modalSuccess").classList.remove("hidden");
    } else {
        btn.disabled = false;
        btn.textContent = "Salvar Avaliação";
        inputs.forEach(el => { if (el.id !== "btnConfirmar") el.disabled = false; });
        const errorMsg = result?.error || res.data?.error || "Erro na comunicação com o servidor.";
        showModalAlert(errorMsg);
    }
}

function showModalAlert(msg, type = "error") {
    const el = document.getElementById("modalAlert");
    el.className = `mt-6 px-6 py-4 rounded-2xl text-[11px] font-bold normal-case [letter-spacing:normal] ${type === "error" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`;
    el.textContent = msg;
    el.classList.remove("hidden");
}

async function handleConfirm() {
    const acao = document.querySelector("input[name=modalAcao]:checked")?.value;
    if (!acao) { showModalAlert("Selecione uma opção para continuar."); return; }

    const just = document.getElementById("justText").value.trim();
    if (acao === "manter" && !just) { showModalAlert("Campo obrigatório: justificativa técnica para manutenção."); return; }

    const btn = document.getElementById("btnConfirmar");
    const modalJust = document.getElementById("modalJust");
    const inputs = modalJust.querySelectorAll("input, textarea, button");

    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Processando…`;

    inputs.forEach(el => el.disabled = true);

    const res = await justificar(session.user, session.token, currentRppn, acao, just);
    const result = Array.isArray(res.data) ? res.data[0] : res.data;
    const isSuccess = res.ok && result?.success;

    if (isSuccess) {
        document.getElementById("modalJust").classList.add("hidden");
        document.getElementById("modalSuccess").classList.remove("hidden");
    } else {
        btn.disabled = false;
        btn.textContent = "Registrar Decisão";
        inputs.forEach(el => { if (el.id !== "btnConfirmar") el.disabled = false; });
        const errorMsg = result?.error || res.data?.error || "Erro na comunicação com o servidor.";
        showModalAlert(errorMsg);
        document.getElementById("modalAlert").scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function toggleRppnSelection(rppn, isSelected) {
    if (isSelected) selectedRppns.add(rppn);
    else selectedRppns.delete(rppn);
    updateBatchUI();
}

function toggleSelectAll(isSelected) {
    if (isSelected) {
        tableFilteredData.forEach(row => {
            selectedRppns.add(getRppnId(row));
        });
    } else {
        selectedRppns.clear();
    }
    renderCurrentPage();
    updateBatchUI();
}

function updateBatchUI() {
    const container = document.getElementById("batchActionContainer");
    const countLabel = document.getElementById("batchSelectCount");
    if (!container) return;

    if (selectedRppns.size > 0) {
        container.classList.remove("hidden");
        container.classList.add("flex");
        if (countLabel) countLabel.textContent = selectedRppns.size;
    } else {
        container.classList.add("hidden");
        container.classList.remove("flex");
        const selectAll = document.getElementById("selectAllRppn");
        if (selectAll) selectAll.checked = false;
    }
}

function openBatchModal() {
    if (selectedRppns.size === 0) return;

    const label = document.getElementById("batchSelectedLabel");
    label.textContent = `${selectedRppns.size} ${selectedRppns.size === 1 ? 'registro selecionado' : 'registros selecionados'}`;

    const list = document.getElementById("batchSelectionList");
    list.innerHTML = Array.from(selectedRppns).map(rppn => `
        <div class="flex items-center justify-between p-3 bg-slate-50 border-2 border-slate-100 rounded-xl">
            <span class="text-[11px] font-bold text-slate-700 truncate mr-4">${rppn}</span>
            <button onclick="toggleRppnSelection('${rppn}', false); openBatchModal();" class="text-rose-400 hover:text-rose-600 transition-colors">
                <i class='bx bx-trash text-lg'></i>
            </button>
        </div>
    `).join('');

    document.getElementById("batchJustText").value = "";
    document.getElementById("batchJustAreaWrap").classList.add("hidden");
    document.querySelectorAll("input[name=batchAcao]").forEach(r => r.checked = false);
    document.getElementById("modalBatch").classList.remove("hidden");
}

function onBatchAcaoChange() {
    const acao = document.querySelector("input[name=batchAcao]:checked")?.value;
    document.getElementById("batchJustAreaWrap").classList.toggle("hidden", acao !== "manter");
}

function closeBatchModal() {
    document.getElementById("modalBatch").classList.add("hidden");
}

async function handleBatchConfirm() {
    const acao = document.querySelector("input[name=batchAcao]:checked")?.value;
    const just = document.getElementById("batchJustText").value.trim();

    if (!acao) {
        alert("Por favor, selecione uma ação (Manter ou Cancelar).");
        return;
    }
    if (acao === "manter" && !just) {
        alert("Por favor, informe a justificativa para manter o saldo.");
        return;
    }

    const btn = document.getElementById("btnBatchConfirm");
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Processando…`;

    const dados = Array.from(selectedRppns).map(rppn => ({ rppn }));

    try {
        const res = await justificarLote(session.user, session.token, acao, just, dados);
        if (res.ok && Array.isArray(res.data)) {
            showBatchResults(res.data);
        } else {
            console.error("Resposta da API inválida:", res);
            alert(res.data?.error || "Ocorreu um erro ao processar a solicitação.");
        }
    } catch (err) {
        console.error("Erro no processamento em lote:", err);
        alert("Ocorreu um erro ao processar a solicitação.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Confirmar Registro em Massa";
    }
}

function showBatchResults(results) {
    closeBatchModal();
    const modal = document.getElementById("modalBatchResult");
    const summary = document.getElementById("batchResultSummary");
    const list = document.getElementById("batchResultList");

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;

    summary.innerHTML = `
        <div class="flex-1 flex flex-col items-center border-r-2 border-slate-100 pr-6">
            <span class="text-3xl font-black text-emerald-500">${successCount}</span>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sucessos</span>
        </div>
        <div class="flex-1 flex flex-col items-center">
            <span class="text-3xl font-black ${errorCount > 0 ? 'text-rose-500' : 'text-slate-300'}">${errorCount}</span>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Falhas</span>
        </div>
    `;

    list.innerHTML = results.map(res => `
        <div class="flex items-center gap-4 p-4 ${res.success ? 'bg-emerald-50/50' : 'bg-rose-50/50'} rounded-2xl border-2 ${res.success ? 'border-emerald-100' : 'border-rose-100'}">
            <div class="w-8 h-8 rounded-full flex items-center justify-center ${res.success ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}">
                <i class='bx ${res.success ? 'bx-check' : 'bx-x'} text-xl'></i>
            </div>
            <div class="flex-1">
                <p class="text-[11px] font-black text-slate-700">${res.data?.rppn || 'N/A'}</p>
                <p class="text-[10px] font-medium ${res.success ? 'text-emerald-700' : 'text-rose-700'}">${res.message || res.error || (res.success ? 'Sucesso' : 'Erro desconhecido')}</p>
            </div>
        </div>
    `).join('');

    modal.classList.remove("hidden");
    selectedRppns.clear();
    updateBatchUI();
}

function closeBatchResultModal() {
    document.getElementById("modalBatchResult").classList.add("hidden");
}

function handleReloadAfterSuccess() {
    location.reload();
}

if (session) {
    if (typeof Layout !== 'undefined' && Layout.ready) {
        Layout.ready.then(() => {
            const modal = document.getElementById("modalJust");
            if (modal) {
                modal.addEventListener("click", e => { if (e.target === e.currentTarget) closeModal(); });
            }
            setupTitle();
            loadData();
        });
    } else {
        window.addEventListener('load', () => {
            if (typeof Layout !== 'undefined' && Layout.ready) {
                Layout.ready.then(() => {
                    const modal = document.getElementById("modalJust");
                    if (modal) {
                        modal.addEventListener("click", e => { if (e.target === e.currentTarget) closeModal(); });
                    }
                    setupTitle();
                    loadData();
                });
            } else {
                setupTitle();
                loadData();
            }
        });
    }
}

function afterTableRender() {
    setTimeout(() => {
        initializeTableFilters("stateTable");
        initializeTableResizing("stateTable");
        initializeTableReordering("stateTable");
        initializeColumnVisibility("stateTable", "btnColumns");
    }, 50);
}

function filterTable() { reloadUI(); }
function clearAllTableFilters() { clearAllFilters(); }

