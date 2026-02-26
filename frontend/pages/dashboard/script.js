const session = requireSession("../login/index.html");

let allRows = [];
let filteredRows = [];
let columns = [];
let currentRppn = "";
let currentPage = 1;
let itemsPerPage = parseInt(localStorage.getItem("rppn_items_per_page")) || 10;
const CACHE_KEY = "rppn_data_cache";

window.addEventListener('tableFiltersChanged', () => {
    if (typeof filterTable === 'function') filterTable();
});
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

    allRows = parseCSV(csvRaw);

    enrichRows(allRows);

    filteredRows = [...allRows];
    const saldoKey = "Saldo Restos a Pagar Não Processado";
    filteredRows.sort((a, b) => {
        const valA = parseFloat(String(a[saldoKey] || "0").replace(",", "."));
        const valB = parseFloat(String(b[saldoKey] || "0").replace(",", "."));
        return valB - valA;
    });

    if (allRows.length > 0) {
        const available = Object.keys(allRows[0]);
        const preferred = [
            "Unidade Orçamentária - Código",
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
        columns = preferred.filter(p => available.includes(p));
        available.forEach(a => { if (!columns.includes(a)) columns.push(a); });
    } else {
        columns = [];
    }

    if (!allRows.length) {
        showState("stateEmpty");
        updateCards([]);
        return;
    }

    currentPage = 1;
    buildTableHeader();
    filterTable();
    updateCards(allRows);
    populateFilterOptions();
    showState("stateTable");
}

function populateFilterOptions() {
    const ueSet = new Set();
    const programaSet = new Set();
    const elementoSet = new Set();
    const statusSet = new Set();

    allRows.forEach(row => {
        if (row["Unidade Executora - Nome"]) ueSet.add(row["Unidade Executora - Nome"]);
        if (row["Programa - Descrição"]) programaSet.add(row["Programa - Descrição"]);
        if (row["Elemento Item - Descrição"]) elementoSet.add(row["Elemento Item - Descrição"]);

        const statusCol = columns.find(c => /status/i.test(c));
        if (statusCol && row[statusCol]) statusSet.add(row[statusCol]);
    });

    const fillSelect = (id, set) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        [...set].sort().forEach(val => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
    };

    fillSelect("filterUE", ueSet);
    fillSelect("filterPrograma", programaSet);
    fillSelect("filterElemento", elementoSet);
    fillSelect("filterStatus", statusSet);

    if (typeof createCustomSelect !== 'undefined') {
        ["filterUE", "filterPrograma", "filterElemento", "filterStatus"].forEach(id => {
            if (document.getElementById(id)) {
                createCustomSelect(id);
                onCustomSelectChange(id, () => filterTable());
            }
        });
    }
}

function clearAllTableFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("filterSaldoMin").value = "0.01";
    document.getElementById("filterSaldoMax").value = "";

    if (typeof clearCustomSelect !== 'undefined') {
        ["filterUE", "filterPrograma", "filterElemento", "filterStatus"].forEach(id => {
            if (document.getElementById(id)) clearCustomSelect(id);
        });
    }

    window.dispatchEvent(new Event('clearAllFilters'));

    filterTable();
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
        const ano = row["Exercício de Emissão"] || row["Ano"];
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

        const elemCode = String(row["Elemento Item - Código"] || "");
        let elemDesc = "N/A";
        const yearEntryElem = descriptiveData.elementos.find(p => String(p.ano) === String(ano));
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
    });
}

function updateCards(rows) {
    const total = rows.length;
    const statusCol = columns.find(c => /status/i.test(c)) || "";
    const pendentes = statusCol ? rows.filter(r => /pendente/i.test(r[statusCol] || "")).length : 0;
    const finalizados = statusCol ? rows.filter(r => /mantido|cancelado|aprovado|rejeitado/i.test(r[statusCol] || "")).length : 0;

    document.getElementById("cardTotal").textContent = total;
    document.getElementById("cardPendentes").textContent = pendentes;
    document.getElementById("cardFinalizados").textContent = finalizados;
}

function buildTableHeader() {
    const tr = document.getElementById("tableHead");
    tr.innerHTML = "";
    columns.forEach(col => {
        const th = document.createElement("th");
        const isHidden = col === "Unidade Orçamentária - Código" || col === "Unidade Orçamentária - Nome";
        th.className = "px-6 py-3 text-left text-[11px] font-bold text-slate-400 normal-case [letter-spacing:normal] tracking-tight whitespace-nowrap relative group";
        if (isHidden) th.style.display = "none";

        th.innerHTML = `
            <span class="table-span-header cursor-pointer">${col}</span>
            <button class="table-filter-trigger ml-2 opacity-0 group-hover:opacity-100 transition-opacity" data-key="${col}">
                <i class="bx bx-filter filter-icon"></i>
            </button>
        `;
        tr.appendChild(th);
    });
    const thAcao = document.createElement("th");
    thAcao.className = "px-6 py-3 text-right text-[11px] font-bold text-slate-400 normal-case [letter-spacing:normal]";
    thAcao.textContent = "Opções";
    tr.appendChild(thAcao);
}

function renderCurrentPage() {
    const start = (currentPage - 1) * itemsPerPage;
    const rowsToDisplay = filteredRows.slice(start, start + itemsPerPage);
    renderRows(rowsToDisplay);
    updatePaginationUI();
    afterTableRender();
}

function renderRows(rows) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

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

    const statusCol = columns.find(c => /status/i.test(c)) || "";
    const currencyCols = ["Saldo Restos a Pagar Não Processado", "Valor Inscrito Não Processado", "Valor Pago Não Processado", "Valor Cancelado Não Processado"];

    rows.forEach(row => {
        const rppnId = getRppnId(row);
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors group cursor-pointer";
        tr.onclick = () => openModal(rppnId, row);

        columns.forEach(col => {
            const td = document.createElement("td");
            const isHidden = col === "Unidade Orçamentária - Código" || col === "Unidade Orçamentária - Nome";
            td.className = "px-6 py-3 text-[13px] text-slate-600 font-medium overflow-hidden";
            if (isHidden) td.style.display = "none";
            td.setAttribute("data-key", col);
            td.setAttribute("data-value", row[col] ?? "");

            const contentSpan = document.createElement("span");
            contentSpan.className = "line-clamp-1 truncate block w-full";

            if (col === statusCol && row[col]) {
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
    const totalItems = filteredRows.length;
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
    const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
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

function filterTable() {
    const q = document.getElementById("searchInput").value.toLowerCase();

    const getVals = id => typeof getCustomSelectValues !== 'undefined' ? getCustomSelectValues(id) : [];
    const ueFilters = getVals("filterUE");
    const programaFilters = getVals("filterPrograma");
    const elementoFilters = getVals("filterElemento");
    const statusFilters = getVals("filterStatus");

    const minSaldo = parseFloat(document.getElementById("filterSaldoMin").value) || 0;
    const maxSaldo = parseFloat(document.getElementById("filterSaldoMax").value) || Infinity;

    const saldoKey = "Saldo Restos a Pagar Não Processado";
    const statusCol = columns.find(c => /status/i.test(c)) || "";

    const tableColFilters = typeof window.getActiveTableFilters === 'function' ? window.getActiveTableFilters() : {};

    filteredRows = allRows.filter(row => {
        const matchesSearch = !q || columns.some(c => String(row[c] ?? "").toLowerCase().includes(q));

        const matchesUE = ueFilters.length === 0 || ueFilters.includes(row["Unidade Executora - Nome"]);
        const matchesProg = programaFilters.length === 0 || programaFilters.includes(row["Programa - Descrição"]);
        const matchesElem = elementoFilters.length === 0 || elementoFilters.includes(row["Elemento Item - Descrição"]);

        const statusVal = row[statusCol] || "";
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(statusVal);

        const valSaldo = parseFloat(String(row[saldoKey] || "0").replace(",", "."));
        const matchesSaldo = valSaldo >= minSaldo && valSaldo <= maxSaldo;

        let matchesColFilters = true;
        for (const colKey in tableColFilters) {
            const reqVals = tableColFilters[colKey];
            if (reqVals && reqVals.length > 0) {
                const cellValue = String(row[colKey] ?? '');
                const cellValuesList = cellValue.split('||');
                const isMatchFound = cellValuesList.some(val => reqVals.includes(val));
                if (!isMatchFound) {
                    matchesColFilters = false;
                    break;
                }
            }
        }

        return matchesSearch && matchesUE && matchesProg && matchesElem && matchesStatus && matchesSaldo && matchesColFilters;
    });

    currentPage = 1;

    const hasActiveFilters = q || ueFilters.length > 0 || programaFilters.length > 0 || elementoFilters.length > 0 || statusFilters.length > 0 || document.getElementById("filterSaldoMin").value !== "0.01" || document.getElementById("filterSaldoMax").value !== "";

    const countLabel = document.getElementById("filterResultCount");
    if (countLabel) {
        if (hasActiveFilters) {
            countLabel.classList.remove("opacity-0");
            countLabel.textContent = `${filteredRows.length} ${filteredRows.length === 1 ? 'valor encontrado' : 'valores encontrados'} nessa configuração`;
        } else {
            countLabel.classList.add("opacity-0");
        }
    }

    updateCards(filteredRows);

    if (!filteredRows.length) { showState("stateEmpty"); return; }
    showState("stateTable");
    renderCurrentPage();
}

function toggleFilterPanel() {
    const panel = document.getElementById("filterPanel");
    const btn = document.getElementById("btnFiltersToggle");
    panel.classList.toggle("hidden");
    const isOpen = !panel.classList.contains("hidden");

    if (isOpen) {
        btn.classList.remove("bg-slate-50", "text-slate-500", "border-slate-100");
        btn.classList.add("bg-[#003D5D]", "text-white", "border-[#003D5D]");
    } else {
        btn.classList.add("bg-slate-50", "text-slate-500", "border-slate-100");
        btn.classList.remove("bg-[#003D5D]", "text-white", "border-[#003D5D]");
    }
}

function openModal(rppn, row) {
    currentRppn = rppn;
    if (!row) {
        const rppnCol = columns.find(c => /rppn|empenho|id/i.test(c)) || columns[0];
        row = allRows.find(r => r[rppnCol] === rppn);
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
            { label: "Inscrito", value: formatMoeda(row["Valor Inscrito Não Processado"]) },
            { label: "Pago", value: formatMoeda(row["Valor Pago Não Processado"]) },
            { label: "Cancelado", value: formatMoeda(row["Valor Cancelado Não Processado"]) }
        ];

        showDetails.forEach(d => {
            const div = document.createElement("div");
            div.className = d.highlight ? "col-span-2 mt-2 p-4 bg-[#003D5D]/5 rounded-2xl border-2 border-[#003D5D]/10" : "flex flex-col gap-1";
            div.innerHTML = `
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">${d.label}</span>
                <span class="${d.highlight ? 'text-lg font-black text-[#003D5D]' : 'text-[12px] font-bold text-slate-600'}">${d.value}</span>
            `;
            detailsWrap.appendChild(div);
        });
    }

    document.querySelectorAll("input[name=modalAcao]").forEach(r => r.checked = false);
    document.getElementById("justAreaWrap").classList.add("hidden");
    document.getElementById("justText").value = "";
    document.getElementById("modalAlert").classList.add("hidden");
    document.getElementById("btnConfirmar").disabled = false;
    document.getElementById("btnConfirmar").textContent = "Registrar Decisão";
    document.getElementById("modalJust").classList.remove("hidden");
}

function closeModal() { document.getElementById("modalJust").classList.add("hidden"); }

function clearAllTableFilters() {
    document.getElementById("searchInput").value = "";
    if (typeof clearCustomSelect !== 'undefined') {
        clearCustomSelect("filterUO");
        clearCustomSelect("filterUE");
    }
    window.dispatchEvent(new CustomEvent("clearAllFilters"));
    filterTable();
}

window.addEventListener('tableFiltersChanged', () => {
    const q = document.getElementById("searchInput").value;
    const clearBtn = document.getElementById("btnClearFilters");
    clearBtn.classList.remove("hidden");
});

function onAcaoChange() {
    const acao = document.querySelector("input[name=modalAcao]:checked")?.value;
    document.getElementById("justAreaWrap").classList.toggle("hidden", acao !== "manter");
}

function showModalAlert(msg, type = "error") {
    const el = document.getElementById("modalAlert");
    el.className = `mt-6 px-6 py-4 rounded-2xl text-[11px] font-bold normal-case [letter-spacing:normal] ${type === "error" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`;
    el.textContent = msg;
    el.classList.remove("hidden");
}

async function handleConfirm() {
    const acao = document.querySelector("input[name=modalAcao]:checked")?.value;
    if (!acao) { showModalAlert("Selecione uma option para continuar."); return; }

    const just = document.getElementById("justText").value.trim();
    if (acao === "manter" && !just) { showModalAlert("Campo obrigatório: justificativa técnica para manutenção."); return; }

    const btn = document.getElementById("btnConfirmar");
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Processando…`;

    const res = await justificar(session.user, session.token, currentRppn, acao, just);

    if (res.ok && res.data?.success) {
        closeModal();
        await loadData();
    } else {
        btn.disabled = false;
        btn.textContent = "Registrar Decisão";
        showModalAlert(res.data?.error || "Erro na comunicação com o servidor.");
    }
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

async function afterTableRender() {
    const globalValues = {};
    columns.forEach(col => {
        const values = new Set();
        allRows.forEach(row => {
            const val = row[col];
            if (val) String(val).split('||').forEach(v => v && values.add(v));
        });
        globalValues[col] = [...values];
    });

    setTimeout(() => {
        initializeTableFilters("stateTable", { globalValues });
        initializeTableResizing("stateTable");
        initializeTableReordering("stateTable");
        initializeColumnVisibility("stateTable", "btnColumns");
    }, 50);
}
