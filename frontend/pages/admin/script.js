const session = requireAdmin("../dashboard/index.html");

let legData = [];
let editingLegIndex = null;
let editingNotifId = null;

const loadedTabs = new Set();

async function init() {
    await Layout.ready;
    switchTab("estatisticas");
}

function switchTab(tab) {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabContents.forEach(el => el.classList.add("hidden"));

    tabBtns.forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        const indicator = btn.querySelector(".active-indicator");

        btn.classList.remove("text-[#003D5D]");
        btn.classList.add("text-slate-400");
        if (indicator) indicator.classList.remove("scale-x-100");
        if (indicator) indicator.classList.add("scale-x-0");

        if (isActive) {
            btn.classList.remove("text-slate-400");
            btn.classList.add("text-[#003D5D]");
            if (indicator) {
                indicator.classList.remove("scale-x-0");
                indicator.classList.add("scale-x-100");
            }
        }
    });

    const targetContent = document.getElementById(`tab-${tab}`);
    if (targetContent) {
        targetContent.classList.remove("hidden");
        targetContent.classList.add("animate-in", "fade-in", "slide-in-from-bottom-2", "duration-500");
    }

    if (!loadedTabs.has(tab)) {
        loadedTabs.add(tab);
        const loaders = {
            "estatisticas": loadStats,
            "usuarios": loadUsers,
            "legislacao": loadLegislacao,
            "notificacoes": loadNotifications,
            "tipos_justificativa": loadTiposJustificativa
        };
        if (loaders[tab]) loaders[tab]();
    }
}

async function loadUsers() {
    const res = await getUsers(session.user, session.token);
    const loading = document.getElementById("usersStateLoading");
    const notImpl = document.getElementById("usersStateNotImpl");
    const table = document.getElementById("usersTable");

    if (loading) loading.classList.add("hidden");

    if (!res.ok) {
        notImpl.classList.remove("hidden");
        notImpl.classList.add("flex");
        return;
    }

    const users = res.data?.data || [];
    const tbody = document.getElementById("usersTableBody");
    table.classList.remove("hidden");

    tbody.innerHTML = users.map(u => `
        <tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 text-[13px] font-bold text-slate-700">${u.username}</td>
            <td class="px-6 py-4">
                <span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 ${u.role === 'admin' ? 'badge-color-sky' : 'badge-color-slate'}">${u.role}</span>
            </td>
            <td class="px-6 py-4 text-[13px] text-slate-500 font-medium">${u.uo || '—'}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="openUserModal(${JSON.stringify(u).replace(/"/g, '&quot;')})"
                    class="text-[10px] font-black text-slate-400 hover:text-[#003D5D] transition-colors opacity-0 group-hover:opacity-100 px-4 py-2 rounded-xl border-2 border-transparent hover:border-slate-200 hover:bg-white">
                    <i class='bx bx-edit-alt mr-1'></i>Editar
                </button>
            </td>
        </tr>
    `).join("");
}

function openUserModal(user = null) {
    document.getElementById("userModalTitle").textContent = user ? "Editar Usuário" : "Novo Usuário";
    document.getElementById("userFieldUsername").value = user?.username || "";
    document.getElementById("userFieldUO").value = user?.uo || "";
    const role = user?.role || "user";
    document.querySelectorAll("input[name=userRole]").forEach(r => r.checked = r.value === role);
    document.getElementById("userModalAlert").classList.add("hidden");
    document.getElementById("modalUser").classList.remove("hidden");
}

function closeUserModal() { document.getElementById("modalUser").classList.add("hidden"); }

async function handleSaveUser() {
    const username = document.getElementById("userFieldUsername").value.trim();
    const uo = document.getElementById("userFieldUO").value.trim();
    const role = document.querySelector("input[name=userRole]:checked")?.value || "user";

    if (!username) { showModalAlert("userModalAlert", "Username é obrigatório."); return; }

    const btn = document.getElementById("btnSaveUser");
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Salvando…`;

    const res = await createUser(session.user, session.token, { username, role, uo });
    btn.disabled = false;
    btn.textContent = "Salvar Usuário";

    if (res.ok && res.data?.success) {
        closeUserModal();
        loadUsers();
        showToast("Usuário salvo com sucesso!", "success");
    } else {
        showModalAlert("userModalAlert", res.data?.error || "Erro ao salvar usuário.");
    }
}

let statsRawData = [];
let statsFilteredData = [];
let statsDescriptiveData = { unidades: [], programas: [], elementos: [] };
let chartsMap = {};

const STATS_PANEL_SELECT_IDS = [
    "statFilterUO", "statFilterUE", "statFilterAno", "statFilterPrograma",
    "statFilterElemento", "statFilterFuncao", "statFilterSubfuncao",
    "statFilterProcedencia", "statFilterProjetoAtividade", "statFilterStatus",
    "statFilterDecisao", "statFilterDocumento", "statFilterSubprojeto",
    "statFilterNaturezaItem", "statFilterCategoriaEconomica", "statFilterGrupoDespesa",
    "statFilterModalidadeAplicacao", "statFilterElementoDespesa", "statFilterItemDespesa",
    "statFilterFonteRecurso"
];

async function loadStats() {
    const loading = document.getElementById("statsStateLoading");
    const content = document.getElementById("statsContent");
    const headerActions = document.getElementById("statsHeaderActions");

    if (loading) loading.classList.remove("hidden");
    if (content) content.classList.add("hidden");
    if (headerActions) headerActions.classList.add("hidden");

    const sidebar = document.getElementById("statsFiltersSidebar");
    if (sidebar) sidebar.classList.add("hidden");

    ['statFilterSaldoMin', 'statFilterSaldoMax'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => applyStatsFilters());
    });

    try {
        const [u, p, e] = await Promise.all([
            fetch("../../assets/json/unidades.json").then(r => r.json()),
            fetch("../../assets/json/programas.json").then(r => r.json()),
            fetch("../../assets/json/elemento_item.json").then(r => r.json())
        ]);
        statsDescriptiveData.unidades = u;
        statsDescriptiveData.programas = p;
        statsDescriptiveData.elementos = e;
    } catch (err) {
        console.error("Erro ao carregar dados descritivos para stats:", err);
    }

    const res = await getData(session.user, session.token);
    if (!res.ok || !res.data?.success) {
        if (loading) loading.classList.add("hidden");
        return;
    }

    let raw = res.data?.data?.rows || [];

    if (typeof ColumnMapper !== "undefined") {
        raw = await ColumnMapper.mapRows(raw);
    }

    let statuses = [];
    const statusRes = await checkStatus(session.user, session.token);
    if (statusRes.ok && statusRes.data?.success) {
        const data = statusRes.data.data;
        statuses = Array.isArray(data) ? data : (data?.rows || data?.status || []);
    }

    enrichStatsRows(raw, statuses);
    statsRawData = raw;

    STATS_PANEL_SELECT_IDS.forEach(id => {
        if (typeof renderSkeletonSelect === "function") renderSkeletonSelect(id);
    });

    populateStatsFilterOptions();
    renderStatsCheckboxFilters();

    if (loading) loading.classList.add("hidden");
    if (content) content.classList.remove("hidden");
    if (headerActions) headerActions.classList.remove("hidden");

    applyStatsFilters();
}

function renderStatsCheckboxFilters() {
    const decisaoWrapper = document.getElementById("statCheckboxDecisao");
    const statusWrapper = document.getElementById("statCheckboxStatus");
    if (!decisaoWrapper || !statusWrapper) return;

    const decisaoOptions = ["Pendente", "Aceito", "Recusado"];
    const statusOptions = ["Pendente", "Em Análise", "Concluído", "Ajuste Solicitado"];

    decisaoWrapper.innerHTML = decisaoOptions.map(opt => `
        <label class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group">
            <input type="checkbox" data-group="Decisao" value="${opt}" onchange="applyStatsFilters()" 
                class="w-4 h-4 rounded border-2 border-slate-200 text-[#003D5D] focus:ring-[#003D5D]/20 transition-all cursor-pointer">
            <span class="text-[12px] font-bold text-slate-600 group-hover:text-[#003D5D]">${opt}</span>
        </label>
    `).join("");

    statusWrapper.innerHTML = statusOptions.map(opt => `
        <label class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group">
            <input type="checkbox" data-group="Status" value="${opt}" onchange="applyStatsFilters()" 
                class="w-4 h-4 rounded border-2 border-slate-200 text-[#003D5D] focus:ring-[#003D5D]/20 transition-all cursor-pointer">
            <span class="text-[12px] font-bold text-slate-600 group-hover:text-[#003D5D]">${opt}</span>
        </label>
    `).join("");
}

function getStatCheckboxValues(group) {
    const checks = document.querySelectorAll(`input[data-group="${group}"]:checked`);
    return Array.from(checks).map(c => c.value);
}

function toggleStatsMoreFilters() {
    const content = document.getElementById("statMoreFiltersContent");
    const icon = document.getElementById("statIconMoreFilters");
    if (!content || !icon) return;

    const isHidden = content.classList.contains("hidden");
    content.classList.toggle("hidden", !isHidden);
    icon.classList.toggle("rotate-180", isHidden);
}

function enrichStatsRows(rows, statusData = []) {
    const sData = Array.isArray(statusData) ? statusData : [];

    const latestMap = {};
    sData.forEach(s => {
        const doc = String(s.documento || s.rppn || "");
        if (doc && (!latestMap[doc] || new Date(s.data_criacao) > new Date(latestMap[doc].data_criacao))) {
            latestMap[doc] = s;
        }
    });

    rows.forEach(row => {
        const doc = String(row.documento || row["Documento Restos a Pagar"] || "");
        const update = latestMap[doc];

        row["Status Justificativa"] = update ? (update.status || "Pendente") : "Pendente";
        row["Decisao"] = update ? (update.decisao || "Pendente") : "Pendente";

        const uoCode = String(row.uo_codigo || row["Unidade Orçamentária - Código"] || "").trim();
        const uo = statsDescriptiveData.unidades.find(u => String(u.unidade_orcamentaria_codigo).trim() === uoCode);
        const ueCode = String(row.ue_codigo || row["Unidade Executora - Código"] || "").trim();

        row["UO_Concatenada"] = `${uoCode} - ${uo?.unidade_orcamentaria_nome || 'N/A'}`;
        const ue = uo?.unidades_executoras?.find(u => String(u.codigo).trim() === ueCode);
        row["UE_Concatenada"] = `${ueCode} - ${ue?.nome || 'N/A'}`;

        row.uo_codigo = row["UO_Concatenada"];
        row.ue_codigo = row["UE_Concatenada"];

        const progCode = String(row.programa || row["Programa - Código"] || "");
        let progDesc = "N/A";
        for (const entry of statsDescriptiveData.programas) {
            const p = entry.programas.find(pr => String(pr.codigo) === progCode);
            if (p) { progDesc = p.descricao; break; }
        }
        row["Programa - Descrição"] = progDesc;

        const elemCode = String(row.elemento_item || row["Elemento Item Despesa - Código"] || "");
        let elemDesc = "N/A";
        for (const entry of statsDescriptiveData.elementos) {
            const e = entry.itens.find(i => String(i.codigo) === elemCode);
            if (e) { elemDesc = e.descricao; break; }
        }
        row["Elemento Item - Descrição"] = elemDesc;

        row.saldoNum = 0;
        if (typeof parseMoeda === "function") {
            row.saldoNum = parseMoeda(row.saldo_rppn || row["Saldo Restos a Pagar Não Processado"]);
        } else {
            const str = String(row.saldo_rppn || row["Saldo Restos a Pagar Não Processado"] || "0").replace(/\./g, '').replace(',', '.');
            row.saldoNum = parseFloat(str) || 0;
        }
    });
}

function populateStatsFilterOptions() {
    const sets = {};
    STATS_PANEL_SELECT_IDS.forEach(id => sets[id] = new Set());

    statsRawData.forEach(row => {
        if (row["UO_Concatenada"]) sets.statFilterUO.add(row["UO_Concatenada"]);
        if (row["UE_Concatenada"]) sets.statFilterUE.add(row["UE_Concatenada"]);
        if (row.ano_origem || row["Ano Origem Restos a Pagar"]) sets.statFilterAno.add(String(row.ano_origem || row["Ano Origem Restos a Pagar"]));
        if (row["Programa - Descrição"]) sets.statFilterPrograma.add(row["Programa - Descrição"]);
        if (row["Elemento Item - Descrição"]) sets.statFilterElemento.add(row["Elemento Item - Descrição"]);

        const fn = row.funcao || row["Função - Código"];
        if (fn) sets.statFilterFuncao.add(String(fn));

        const sf = row.subfuncao || row["Subfunção - Código"];
        if (sf) sets.statFilterSubfuncao.add(String(sf));

        const pc = row.procedencia || row["Procedência - Código"];
        if (pc) sets.statFilterProcedencia.add(String(pc));

        const pa = row.projeto_atividade || row["Projeto_Atividade - Código"];
        if (pa) sets.statFilterProjetoAtividade.add(String(pa));

        if (row["Status Justificativa"]) sets.statFilterStatus.add(row["Status Justificativa"]);
        if (row["Decisao"]) sets.statFilterDecisao.add(row["Decisao"]);

        if (row.documento) sets.statFilterDocumento.add(String(row.documento));
        if (row.subprojeto) sets.statFilterSubprojeto.add(String(row.subprojeto));
        if (row.natureza_item) sets.statFilterNaturezaItem.add(String(row.natureza_item));
        if (row.categoria_economica) sets.statFilterCategoriaEconomica.add(String(row.categoria_economica));
        if (row.grupo_despesa) sets.statFilterGrupoDespesa.add(String(row.grupo_despesa));
        if (row.modalidade_aplicacao) sets.statFilterModalidadeAplicacao.add(String(row.modalidade_aplicacao));
        if (row.elemento_despesa) sets.statFilterElementoDespesa.add(String(row.elemento_despesa));
        if (row.item_despesa) sets.statFilterItemDespesa.add(String(row.item_despesa));
        if (row.fonte_recurso) sets.statFilterFonteRecurso.add(String(row.fonte_recurso));
    });

    Object.keys(sets).forEach(id => {
        if (typeof setCustomSelectOptions === "function") {
            setCustomSelectOptions(id, [...sets[id]].sort());
            onCustomSelectChange(id, () => applyStatsFilters());
        }
    });
}

function getStatFilterVals(id) {
    if (typeof getCustomSelectValues === "function") return getCustomSelectValues(id);
    return [];
}

function applyStatsFilters() {
    const f = {
        uo: getStatFilterVals("statFilterUO"),
        ue: getStatFilterVals("statFilterUE"),
        an: getStatFilterVals("statFilterAno"),
        pr: getStatFilterVals("statFilterPrograma"),
        el: getStatFilterVals("statFilterElemento"),
        fn: getStatFilterVals("statFilterFuncao"),
        sf: getStatFilterVals("statFilterSubfuncao"),
        pc: getStatFilterVals("statFilterProcedencia"),
        pa: getStatFilterVals("statFilterProjetoAtividade"),
        st: getStatFilterVals("statFilterStatus"),
        cbDec: getStatCheckboxValues("Decisao"),
        cbSta: getStatCheckboxValues("Status"),
        sMin: parseFloat(document.getElementById('statFilterSaldoMin')?.value),
        sMax: parseFloat(document.getElementById('statFilterSaldoMax')?.value),

        doc: getStatFilterVals("statFilterDocumento"),
        spr: getStatFilterVals("statFilterSubprojeto"),
        nat: getStatFilterVals("statFilterNaturezaItem"),
        cat: getStatFilterVals("statFilterCategoriaEconomica"),
        grp: getStatFilterVals("statFilterGrupoDespesa"),
        mod: getStatFilterVals("statFilterModalidadeAplicacao"),
        edp: getStatFilterVals("statFilterElementoDespesa"),
        itd: getStatFilterVals("statFilterItemDespesa"),
        fnt: getStatFilterVals("statFilterFonteRecurso")
    };

    statsFilteredData = statsRawData.filter(row => {
        const matchesUO = !f.uo.length || f.uo.includes(row["UO_Concatenada"]);
        const matchesUE = !f.ue.length || f.ue.includes(row["UE_Concatenada"]);
        const matchesAN = !f.an.length || f.an.includes(String(row.ano_origem || row["Ano Origem Restos a Pagar"]));
        const matchesPR = !f.pr.length || f.pr.includes(row["Programa - Descrição"]);
        const matchesEL = !f.el.length || f.el.includes(row["Elemento Item - Descrição"]);
        const matchesFN = !f.fn.length || f.fn.includes(String(row.funcao || row["Função - Código"]));
        const matchesSF = !f.sf.length || f.sf.includes(String(row.subfuncao || row["Subfunção - Código"]));
        const matchesPC = !f.pc.length || f.pc.includes(String(row.procedencia || row["Procedência - Código"]));
        const matchesPA = !f.pa.length || f.pa.includes(String(row.projeto_atividade || row["Projeto_Atividade - Código"]));
        const matchesST = !f.st.length || f.st.includes(row["Status Justificativa"]);

        const matchesCbDec = !f.cbDec.length || f.cbDec.includes(row["Decisao"]);
        const matchesCbSta = !f.cbSta.length || f.cbSta.includes(row["Status Justificativa"]);

        const matchesSMin = isNaN(f.sMin) || row.saldoNum >= f.sMin;
        const matchesSMax = isNaN(f.sMax) || row.saldoNum <= f.sMax;

        const matchesDoc = !f.doc.length || f.doc.includes(String(row.documento));
        const matchesSpr = !f.spr.length || f.spr.includes(String(row.subprojeto));
        const matchesNat = !f.nat.length || f.nat.includes(String(row.natureza_item));
        const matchesCat = !f.cat.length || f.cat.includes(String(row.categoria_economica));
        const matchesGrp = !f.grp.length || f.grp.includes(String(row.grupo_despesa));
        const matchesMod = !f.mod.length || f.mod.includes(String(row.modalidade_aplicacao));
        const matchesEdp = !f.edp.length || f.edp.includes(String(row.elemento_despesa));
        const matchesItd = !f.itd.length || f.itd.includes(String(row.item_despesa));
        const matchesFnt = !f.fnt.length || f.fnt.includes(String(row.fonte_recurso));

        return matchesUO && matchesUE && matchesAN && matchesPR && matchesEL &&
            matchesFN && matchesSF && matchesPC && matchesPA && matchesST &&
            matchesCbDec && matchesCbSta && matchesSMin && matchesSMax &&
            matchesDoc && matchesSpr && matchesNat && matchesCat && matchesGrp &&
            matchesMod && matchesEdp && matchesItd && matchesFnt;
    });

    renderStatsCards();
    renderStatsCharts();
}

function toggleStatsFilters() {
    const sidebar = document.getElementById("statsFiltersSidebar");
    const btn = document.getElementById("btnOpenStatsFilters");
    if (!sidebar || !btn) return;

    const isOpening = sidebar.classList.contains("hidden");
    sidebar.classList.toggle("hidden", !isOpening);
    btn.classList.toggle("hidden", isOpening);
}

function clearStatsFilters() {
    STATS_PANEL_SELECT_IDS.forEach(id => {
        if (typeof clearCustomSelect === "function") clearCustomSelect(id);
    });

    document.querySelectorAll('input[data-group]').forEach(c => c.checked = false);

    ['statFilterSaldoMin', 'statFilterSaldoMax'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    applyStatsFilters();
}

function renderStatsCards() {
    if (!statsFilteredData) return;

    const total = statsFilteredData.length;
    let volume = 0;
    let volumeInscrito = 0;
    let volumePago = 0;
    let volumeCancelado = 0;
    let anosAcumulados = 0;
    let pendentes = 0;
    let analise = 0;
    let concluidos = 0;

    const anoAtual = new Date().getFullYear();

    statsFilteredData.forEach(row => {
        const saldo = parseFloat(row.saldo_rppn) || 0;
        const inscrito = parseFloat(row.valor_inscrito) || 0;
        const pago = parseFloat(row.valor_pago) || 0;
        const cancelado = parseFloat(row.valor_cancelado) || 0;

        volume += saldo;
        volumeInscrito += inscrito;
        volumePago += pago;
        volumeCancelado += cancelado;

        const anoOrigem = parseInt(row.ano_origem || row["Ano Origem Restos a Pagar"]) || anoAtual;
        const idade = Math.max(0, anoAtual - anoOrigem);
        anosAcumulados += idade;

        const st = String(row["Status Justificativa"]).toLowerCase();
        if (st === "pendente") pendentes++;
        else if (st === "rejeitado") pendentes++;
        else if (st === "aceito") concluidos++;
        else analise++;
    });

    const idadeMedia = total > 0 ? (anosAcumulados / total).toFixed(1) : "0";
    const analisePct = total > 0 ? Math.round((analise / total) * 100) : 0;
    const concluidosPct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    const ticketMedio = total > 0 ? (volume / total) : 0;

    const safeSetText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    safeSetText("statCardTotal", total.toLocaleString('pt-BR'));
    safeSetText("statCardPendentes", pendentes.toLocaleString('pt-BR'));
    safeSetText("statCardAnalise", analise.toLocaleString('pt-BR'));
    safeSetText("statCardAnalisePct", `${analisePct}%`);
    safeSetText("statCardConcluidos", concluidos.toLocaleString('pt-BR'));
    safeSetText("statCardConcluidosPct", `${concluidosPct}%`);

    let volFormat = "R$ 0,00";
    let inscFormat = "R$ 0,00";
    let pagoFormat = "R$ 0,00";
    let cancFormat = "R$ 0,00";
    let ticketFormat = "R$ 0,00";

    const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

    volFormat = fmt.format(volume);
    inscFormat = fmt.format(volumeInscrito);
    pagoFormat = fmt.format(volumePago);
    cancFormat = fmt.format(volumeCancelado);
    ticketFormat = fmt.format(ticketMedio);

    safeSetText("statCardInscrito", inscFormat);
    safeSetText("statCardPago", pagoFormat);
    safeSetText("statCardCancelado", cancFormat);

    const volEl = document.getElementById("statCardVolume");
    if (volEl) {
        volEl.textContent = volFormat;
        volEl.title = volFormat;
    }

    const volRepEl = document.getElementById("statCardVolumeRep");
    if (volRepEl) {
        volRepEl.textContent = volFormat;
        volRepEl.title = volFormat;
    }

    const ticketEl = document.getElementById("statCardValorMedio");
    if (ticketEl) ticketEl.textContent = ticketFormat;

    const idadeEl = document.getElementById("statCardIdade");
    if (idadeEl) {
        idadeEl.innerHTML = `${idadeMedia} <span class="text-[12px] font-bold text-amber-600/50 uppercase">anos</span>`;
    }
}

function safeRenderApexChart(elementId, options) {
    if (!window.ApexCharts) return;
    const el = document.getElementById(elementId);
    if (!el) return;

    if (chartsMap[elementId]) {
        chartsMap[elementId].updateOptions(options, true);
    } else {
        chartsMap[elementId] = new ApexCharts(el, options);
        chartsMap[elementId].render();
    }
}

function getApexGlobalOptions() {
    return {
        fontFamily: 'Inter, sans-serif',
        chart: {
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: { enabled: true, dynamicAnimation: { speed: 350 } }
        },
        colors: ['#003D5D', '#FCAE00', '#D61A21', '#10B981', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B'],
        tooltip: { theme: 'light' }
    };
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
}

function renderStatsCharts() {
    if (!window.ApexCharts || statsFilteredData.length === 0) return;

    renderParetoChart();
    renderAnoEvolucaoChart();
    renderAgingChart();
    renderBubbleChart();
}

function renderAnoEvolucaoChart() {
    const anoMap = {};
    statsFilteredData.forEach(row => {
        const ano = row.ano_origem || row["Ano Origem Restos a Pagar"] || "Desconhecido";
        if (!anoMap[ano]) anoMap[ano] = { qty: 0, val: 0 };
        anoMap[ano].qty += 1;
        anoMap[ano].val += row.saldoNum;
    });
    const anosSorted = Object.keys(anoMap).sort();

    safeRenderApexChart("chartAnoLine", {
        ...getApexGlobalOptions(),
        series: [{ name: 'Saldo R$', type: 'column', data: anosSorted.map(a => anoMap[a].val) },
        { name: 'Registros', type: 'line', data: anosSorted.map(a => anoMap[a].qty) }],
        chart: { height: 320, type: 'line', ...getApexGlobalOptions().chart },
        stroke: { width: [0, 4] },
        labels: anosSorted,
        yaxis: [{
            labels: { formatter: (val) => "R$ " + formatBRL(val).replace("R$", "").trim() }
        }, {
            opposite: true,
            labels: { formatter: (val) => Math.round(val) }
        }],
        tooltip: {
            shared: true,
            intersect: false,
            y: [{ formatter: val => formatBRL(val) }, { formatter: val => val + " registros" }]
        }
    });
}

function renderParetoChart() {
    const colId = document.getElementById("statParetoColumnSelector")?.value || "UO_Concatenada";
    const dataMap = {};
    let totalGlobal = 0;

    statsFilteredData.forEach(row => {
        const val = String(row[colId] || "N/A");
        dataMap[val] = (dataMap[val] || 0) + row.saldoNum;
        totalGlobal += row.saldoNum;
    });

    const sorted = Object.entries(dataMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    if (sorted.length === 0) return;

    let acc = 0;
    let thresholdIdx = -1;
    const paretoAccumulated = sorted.map((item, idx) => {
        acc += item[1];
        const pct = (acc / totalGlobal) * 100;
        if (thresholdIdx === -1 && pct >= 80) thresholdIdx = idx;
        return pct;
    });

    const labels = sorted.map(i => i[0].length > 20 ? i[0].substring(0, 17) + '...' : i[0]);

    const annotations = { points: [] };
    if (thresholdIdx !== -1) {
        annotations.points.push({
            x: labels[thresholdIdx],
            y: paretoAccumulated[thresholdIdx],
            yAxisIndex: 1,
            marker: {
                size: 8,
                fillColor: '#D61A21',
                strokeColor: '#fff',
                strokeWidth: 3,
                shape: "circle"
            }
        });
    }

    safeRenderApexChart("chartParetoDynamic", {
        ...getApexGlobalOptions(),
        series: [
            { name: 'Saldo (R$)', type: 'column', data: sorted.map(i => i[1]) },
            { name: '% Acumulada', type: 'line', data: paretoAccumulated }
        ],
        chart: { height: 320, type: 'line', ...getApexGlobalOptions().chart },
        stroke: { width: [0, 3], curve: 'smooth' },
        labels: labels,
        colors: ['#003D5D', '#D61A21'],
        annotations: annotations,
        xaxis: {
            labels: { rotate: -45, style: { fontSize: '10px' } }
        },
        yaxis: [
            { labels: { formatter: val => "R$ " + (val / 1000000).toFixed(1) + "M" } },
            { opposite: true, max: 100, labels: { formatter: val => val.toFixed(0) + "%" } }
        ],
        tooltip: {
            shared: true,
            intersect: false,
            y: [{ formatter: val => formatBRL(val) }, { formatter: val => val.toFixed(1) + "%" }]
        }
    });
}

function renderAgingChart() {
    const anoAtual = new Date().getFullYear();
    const ageBands = { "Até 1 ano": 0, "2 a 3 anos": 0, "4 a 5 anos": 0, "Mais de 5 anos": 0 };

    statsFilteredData.forEach(row => {
        const anoOrigem = parseInt(row.ano_origem || row["Ano Origem Restos a Pagar"]) || anoAtual;
        const idade = Math.max(0, anoAtual - anoOrigem);

        let band = "";
        if (idade <= 1) band = "Até 1 ano";
        else if (idade <= 3) band = "2 a 3 anos";
        else if (idade <= 5) band = "4 a 5 anos";
        else band = "Mais de 5 anos";

        ageBands[band] += row.saldoNum;
    });

    safeRenderApexChart("chartAgingVolume", {
        ...getApexGlobalOptions(),
        series: [{ name: 'Volume Financeiro', data: Object.values(ageBands) }],
        chart: { type: 'bar', height: 320, ...getApexGlobalOptions().chart },
        plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        dataLabels: { enabled: false },
        xaxis: {
            categories: Object.keys(ageBands),
            labels: { formatter: val => "R$ " + (val / 1000000).toFixed(1) + "M" }
        },
        colors: ['#FCAE00'],
        tooltip: { y: { formatter: val => formatBRL(val) } }
    });
}

function renderBubbleChart() {
    const colId = document.getElementById("statBubbleColumnSelector")?.value || "Programa - Descrição";
    const bubbleMap = {};
    const anoAtual = new Date().getFullYear();

    statsFilteredData.forEach(row => {
        const key = String(row[colId] || "Desconhecido");
        if (!bubbleMap[key]) bubbleMap[key] = { saldo: 0, count: 0, sumIdades: 0 };

        const anoOrigem = parseInt(row.ano_origem || row["Ano Origem Restos a Pagar"]) || anoAtual;
        const idade = Math.max(0, anoAtual - anoOrigem);

        bubbleMap[key].saldo += row.saldoNum;
        bubbleMap[key].count += 1;
        bubbleMap[key].sumIdades += idade;
    });

    const categories = Object.entries(bubbleMap)
        .filter(item => item[1].count > 0 && item[1].saldo > 0)
        .map(item => {
            const idadeMedia = item[1].sumIdades / item[1].count;
            return {
                name: item[0],
                data: [[idadeMedia, item[1].saldo, item[1].count]]
            };
        });

    safeRenderApexChart("chartRiscoBubble", {
        ...getApexGlobalOptions(),
        series: categories,
        chart: { type: 'bubble', height: 320, ...getApexGlobalOptions().chart },
        dataLabels: { enabled: false },
        xaxis: { title: { text: "Idade Média (Anos)" }, min: 0, tickAmount: 5 },
        yaxis: {
            title: { text: "Volume Financeiro (R$)" },
            labels: { formatter: val => "R$ " + (val / 1000000).toFixed(1) + "M" }
        },
        tooltip: {
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
                const name = w.globals.initialSeries[seriesIndex].name;
                return '<div class="px-4 py-3 bg-white border outline-none shadow-lg rounded-xl">' +
                    '<span class="font-black text-[12px] text-[#003D5D] block mb-2 max-w-[200px] truncate" title="' + name + '">' + name + '</span>' +
                    '<div class="text-[11px] font-medium text-slate-500 space-y-1">' +
                    '<div><b>Idade Média:</b> ' + data[0].toFixed(1) + ' anos</div>' +
                    '<div><b>Saldo:</b> ' + formatBRL(data[1]) + '</div>' +
                    '<div><b>Cadastros:</b> ' + data[2] + '</div>' +
                    '</div></div>';
            }
        },
        legend: { show: false }
    });
}

async function loadLegislacao() {
    const loading = document.getElementById("legStateLoading");
    const table = document.getElementById("legTable");
    const empty = document.getElementById("legEmpty");

    if (loading) loading.classList.remove("hidden");
    if (table) table.classList.add("hidden");
    if (empty) empty.classList.add("hidden");

    try {
        const res = await getLegislacao(session.user, session.token);
        if (res.ok && res.data) {
            const arr = res.data.data || [];
            legData = arr.map(l => {
                let tags = l.tags;
                if (typeof tags === 'string') {
                    try { tags = JSON.parse(tags); } catch (e) { tags = []; }
                }
                return { ...l, tags: tags || [] };
            });
        }
    } catch (e) {
        console.error("Erro ao carregar legislação:", e);
    } finally {
        if (loading) loading.classList.add("hidden");
        renderLegTable();
    }
}

function renderLegTable() {
    const tbody = document.getElementById("legTableBody");
    const table = document.getElementById("legTable");
    const empty = document.getElementById("legEmpty");

    if (!legData || legData.length === 0) {
        if (table) table.classList.add("hidden");
        if (empty) empty.classList.remove("hidden");
        return;
    }

    if (table) table.classList.remove("hidden");
    if (empty) empty.classList.add("hidden");

    tbody.innerHTML = legData.map((item, i) => {
        const statusColor = item.status === "Vigente" ? "badge-color-emerald" : "badge-color-slate";
        return `
        <tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4">
                <span class="text-[13px] font-bold text-slate-700 block">${item.titulo}</span>
                <span class="text-[11px] text-slate-400 font-medium line-clamp-1">${item.ementa}</span>
            </td>
            <td class="px-6 py-4 text-[12px] text-slate-500 font-medium whitespace-nowrap">${item.tipo}</td>
            <td class="px-6 py-4 text-[12px] text-slate-500 font-medium">${item.esfera}</td>
            <td class="px-6 py-4">
                <span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 ${statusColor}">${item.status}</span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onclick="openLegModal(${i})"
                        class="text-[10px] font-black text-slate-400 hover:text-[#003D5D] transition-colors px-4 py-2 rounded-xl border-2 border-transparent hover:border-slate-200 hover:bg-white">
                        <i class='bx bx-edit-alt mr-1'></i>Editar
                    </button>
                    <button onclick="deleteLeg(${i})"
                        class="text-[10px] font-black text-slate-400 hover:text-[#D61A21] transition-colors px-4 py-2 rounded-xl border-2 border-transparent hover:border-rose-100 hover:bg-rose-50">
                        <i class='bx bx-trash mr-1'></i>Excluir
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function openLegModal(index = null) {
    editingLegIndex = index;
    const item = index !== null ? legData[index] : null;
    document.getElementById("legModalTitle").textContent = item ? "Editar Legislação" : "Nova Legislação";
    document.getElementById("legFieldTitulo").value = item?.titulo || "";
    document.getElementById("legFieldTipo").value = item?.tipo || "";
    document.getElementById("legFieldNumero").value = item?.numero || "";
    document.getElementById("legFieldAno").value = item?.ano || "";
    document.getElementById("legFieldEsfera").value = item?.esfera || "Federal";
    document.getElementById("legFieldStatus").value = item?.status || "Vigente";
    document.getElementById("legFieldEmenta").value = item?.ementa || "";
    document.getElementById("legFieldUrl").value = item?.url || "";
    document.getElementById("legFieldTags").value = item?.tags?.join(", ") || "";
    document.getElementById("legModalAlert").classList.add("hidden");
    document.getElementById("modalLeg").classList.remove("hidden");
}

function closeLegModal() { document.getElementById("modalLeg").classList.add("hidden"); }

function handleSaveLeg() {
    const titulo = document.getElementById("legFieldTitulo").value.trim();
    const tipo = document.getElementById("legFieldTipo").value.trim();
    if (!titulo || !tipo) { showModalAlert("legModalAlert", "Título e tipo são obrigatórios."); return; }

    const item = {
        titulo,
        tipo,
        numero: document.getElementById("legFieldNumero").value.trim(),
        ano: document.getElementById("legFieldAno").value.trim(),
        esfera: document.getElementById("legFieldEsfera").value,
        status: document.getElementById("legFieldStatus").value,
        ementa: document.getElementById("legFieldEmenta").value.trim(),
        url: document.getElementById("legFieldUrl").value.trim() || "#",
        tags: document.getElementById("legFieldTags").value.split(",").map(t => t.trim()).filter(Boolean)
    };

    if (editingLegIndex !== null) {
        legData[editingLegIndex] = item;
    } else {
        legData.push(item);
    }

    renderLegTable();
    closeLegModal();
    saveLegislacao(session.user, session.token, legData).then(res => {
        if (res.ok && res.data?.success !== false) {
            showToast("Legislação salva com sucesso!");
        } else {
            showToast("Erro ao salvar legislação na API: " + (res.data?.error || ""));
        }
    }).catch(e => {
        showToast("Erro ao conectar com API para salvar.");
    });
}

function openConfirmModal(msg, onConfirm) {
    document.getElementById("confirmModalMsg").textContent = msg;
    const btn = document.getElementById("btnConfirmAction");
    btn.disabled = false;
    btn.innerHTML = "Excluir";
    btn.onclick = onConfirm;
    document.getElementById("modalConfirm").classList.remove("hidden");
}

function closeConfirmModal() {
    document.getElementById("modalConfirm").classList.add("hidden");
}

function deleteLeg(index) {
    openConfirmModal("Confirmar exclusão deste normativo? Esta ação não pode ser desfeita.", async () => {
        const btn = document.getElementById("btnConfirmAction");
        btn.disabled = true;
        btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Excluindo…`;

        try {
            legData.splice(index, 1);
            const res = await saveLegislacao(session.user, session.token, legData);
            if (res.ok && res.data?.success !== false) {
                showToast("Legislação excluída com sucesso!", "success");
                renderLegTable();
                closeConfirmModal();
            } else {
                showToast("Erro ao salvar exclusão na API.", "error");
            }
        } catch (e) {
            showToast("Erro de conexão ao excluir.", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = "Excluir";
        }
    });
}

function openNotifModal(notif = null) {
    editingNotifId = notif?.id || null;
    document.getElementById("notifModalTitle").textContent = notif ? "Editar Notificação" : "Nova Notificação";
    document.getElementById("notifFieldTitulo").value = notif?.titulo || "";
    document.getElementById("notifFieldMensagem").value = notif?.mensagem || "";
    document.getElementById("notifFieldTipo").value = notif?.tipo || "info";
    document.getElementById("notifFieldAtivo").checked = notif?.ativo !== false;
    document.getElementById("notifModalAlert").classList.add("hidden");
    document.getElementById("modalNotif").classList.remove("hidden");
}

function closeNotifModal() { document.getElementById("modalNotif").classList.add("hidden"); }

async function loadNotifications() {
    const loading = document.getElementById("notifStateLoading");
    const table = document.getElementById("notifTable");
    const empty = document.getElementById("notifEmpty");

    if (loading) loading.classList.remove("hidden");
    if (table) table.classList.add("hidden");
    if (empty) empty.classList.add("hidden");

    try {
        const res = await getNotifications(session.user, session.token);
        if (res.ok) {
            const notifications = res.data.data || [];
            renderNotifTable(notifications);
        }
    } catch (e) {
        console.error("Erro ao carregar notificações:", e);
    } finally {
        if (loading) loading.classList.add("hidden");
    }
}

function renderNotifTable(notifications) {
    const tbody = document.getElementById("notifTableBody");
    const table = document.getElementById("notifTable");
    const empty = document.getElementById("notifEmpty");

    if (!notifications || notifications.length === 0) {
        table.classList.add("hidden");
        empty.classList.remove("hidden");
        return;
    }

    table.classList.remove("hidden");
    empty.classList.add("hidden");

    tbody.innerHTML = notifications.map(n => `
        <tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4">
                <span class="text-[13px] font-bold text-slate-700 block">${n.titulo}</span>
                <span class="text-[11px] text-slate-400 font-medium line-clamp-1">${n.mensagem}</span>
            </td>
            <td class="px-6 py-4">
                <span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 ${n.tipo === 'urgente' ? 'badge-color-rose' : n.tipo === 'aviso' ? 'badge-color-amber' : 'badge-color-sky'}">${n.tipo}</span>
            </td>
            <td class="px-6 py-4">
                <span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 ${n.ativo ? 'badge-color-emerald' : 'badge-color-slate'}">${n.ativo ? 'Ativo' : 'Inativo'}</span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onclick='openNotifModal(${JSON.stringify(n).replace(/'/g, "&apos;")})'
                        class="text-[10px] font-black text-slate-400 hover:text-[#003D5D] transition-colors px-4 py-2 rounded-xl border-2 border-transparent hover:border-slate-200 hover:bg-white">
                        <i class='bx bx-edit-alt mr-1'></i>Editar
                    </button>
                    <button onclick="deleteNotif(${n.id})"
                        class="text-[10px] font-black text-slate-400 hover:text-[#D61A21] transition-colors px-4 py-2 rounded-xl border-2 border-transparent hover:border-rose-100 hover:bg-rose-50">
                        <i class='bx bx-trash mr-1'></i>Excluir
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

async function handleSaveNotif() {
    const titulo = document.getElementById("notifFieldTitulo").value.trim();
    const mensagem = document.getElementById("notifFieldMensagem").value.trim();
    if (!titulo || !mensagem) { showModalAlert("notifModalAlert", "Título e mensagem são obrigatórios."); return; }

    const payload = {
        id: editingNotifId,
        titulo,
        mensagem,
        tipo: document.getElementById("notifFieldTipo").value,
        ativo: document.getElementById("notifFieldAtivo").checked ? 1 : 0
    };

    const btn = document.getElementById("btnSaveNotif");
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Salvando…`;

    try {
        const res = editingNotifId
            ? await updateNotification(session.user, session.token, payload)
            : await createNotification(session.user, session.token, payload);

        if (res.ok && res.data?.success !== false) {
            closeNotifModal();
            loadNotifications();
            showToast("Notificação salva com sucesso!", "success");
        } else {
            showModalAlert("notifModalAlert", res.data?.error || "Erro ao salvar notificação.");
        }
    } catch (e) {
        showModalAlert("notifModalAlert", "Erro de conexão com o servidor.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar Notificação";
    }
}

function deleteNotif(id) {
    openConfirmModal("Deseja realmente excluir esta notificação? Esta ação é irreversível.", async () => {
        const btn = document.getElementById("btnConfirmAction");
        btn.disabled = true;
        btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Excluindo…`;

        try {
            const res = await deleteNotification(session.user, session.token, id);
            if (res.ok) {
                showToast("Notificação excluída com sucesso.", "success");
                loadNotifications();
                closeConfirmModal();
            } else {
                showToast("Erro ao excluir notificação: " + (res.data?.error || ""), "error");
            }
        } catch (e) {
            showToast("Erro de conexão ao excluir.", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = "Excluir";
        }
    });
}

function showModalAlert(id, msg, type = "error") {
    const el = document.getElementById(id);
    el.className = `mt-4 px-5 py-4 rounded-2xl text-[11px] font-bold border-2 ${type === "error" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-amber-50 text-amber-700 border-amber-100"}`;
    el.textContent = msg;
    el.classList.remove("hidden");
}

let tiposData = [];
let editingTipoId = null;
let camposBuilder = [];

async function loadTiposJustificativa() {
    const loading = document.getElementById("tiposStateLoading");
    const table = document.getElementById("tiposTable");
    const empty = document.getElementById("tiposEmpty");

    if (loading) loading.classList.remove("hidden");
    if (table) table.classList.add("hidden");
    if (empty) empty.classList.add("hidden");

    try {
        const res = await getTiposJustificativa(session.user, session.token);
        tiposData = (res.ok && res.data?.data) ? res.data.data : [];
    } catch (e) {
        tiposData = [];
    } finally {
        if (loading) loading.classList.add("hidden");
        renderTiposTable();
    }
}

function renderTiposTable() {
    const tbody = document.getElementById("tiposTableBody");
    const table = document.getElementById("tiposTable");
    const empty = document.getElementById("tiposEmpty");

    if (!tiposData.length) {
        if (table) table.classList.add("hidden");
        if (empty) empty.classList.remove("hidden");
        return;
    }

    if (table) table.classList.remove("hidden");
    if (empty) empty.classList.add("hidden");

    tbody.innerHTML = tiposData.map((t, i) => {
        const statusCls = t.ativo ? "badge-color-emerald" : "badge-color-slate";
        return `
        <tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 text-[13px] font-bold text-slate-700">${t.nome}</td>
            <td class="px-6 py-4 text-[12px] text-slate-500 font-medium">${t.campos.length} campo${t.campos.length !== 1 ? 's' : ''}</td>
            <td class="px-6 py-4">
                <span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 ${statusCls}">${t.ativo ? 'Ativo' : 'Inativo'}</span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onclick="openTipoModal(${i})"
                        class="text-[10px] font-black text-slate-400 hover:text-[#003D5D] transition-colors px-4 py-2 rounded-xl border-2 border-transparent hover:border-slate-200 hover:bg-white">
                        <i class='bx bx-edit-alt mr-1'></i>Editar
                    </button>
                    <button onclick="deleteTipo(${t.id})"
                        class="text-[10px] font-black text-slate-400 hover:text-[#D61A21] transition-colors px-4 py-2 rounded-xl border-2 border-transparent hover:border-rose-100 hover:bg-rose-50">
                        <i class='bx bx-trash mr-1'></i>Excluir
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function openTipoModal(index = null) {
    editingTipoId = null;
    camposBuilder = [];
    const item = index !== null ? tiposData[index] : null;
    document.getElementById("tipoModalTitle").textContent = item ? "Editar Tipo" : "Novo Tipo de Justificativa";
    document.getElementById("tipoFieldNome").value = item?.nome || "";
    document.getElementById("tipoFieldAtivo").checked = item ? item.ativo : true;
    document.getElementById("tipoModalAlert").classList.add("hidden");

    if (item) {
        editingTipoId = item.id;
        camposBuilder = JSON.parse(JSON.stringify(item.campos));
    }

    renderCamposList();
    document.getElementById("modalTipo").classList.remove("hidden");
}

function closeTipoModal() {
    document.getElementById("modalTipo").classList.add("hidden");
}

function addCampoRow() {
    camposBuilder.push({ id: `campo_${Date.now()}`, label: "", tipo: "texto", obrigatorio: false });
    renderCamposList();
}

function removeCampoRow(index) {
    camposBuilder.splice(index, 1);
    renderCamposList();
}

function onCampoTipoChange(index) {
    const tipoEl = document.getElementById(`campo_tipo_${index}`);
    camposBuilder[index].tipo = tipoEl.value;
    camposBuilder[index] = { id: camposBuilder[index].id, label: camposBuilder[index].label, tipo: camposBuilder[index].tipo, obrigatorio: camposBuilder[index].obrigatorio };
    renderCamposList();
}

function renderCamposList() {
    const list = document.getElementById("camposList");
    const emptyMsg = document.getElementById("camposEmptyMsg");

    if (!camposBuilder.length) {
        list.innerHTML = "";
        emptyMsg.classList.remove("hidden");
        return;
    }

    emptyMsg.classList.add("hidden");
    const inputCls = "w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-[12px] font-medium text-slate-700 focus:bg-white focus:border-[#003D5D] outline-none transition-all";

    list.innerHTML = camposBuilder.map((c, i) => {
        const validacoesCls = "grid grid-cols-2 gap-2 mt-3";

        let validacoesHtml = "";

        if (c.tipo === "texto") {
            validacoesHtml = `
            <div class="${validacoesCls}">
                <div><label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Regex (opcional)</label>
                    <input type="text" placeholder="Ex: ^\\d{7}$" value="${c.regex || ""}" oninput="camposBuilder[${i}].regex = this.value"
                        class="${inputCls}"></div>
                <div><label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Máx. caracteres</label>
                    <input type="number" placeholder="Ex: 200" value="${c.maxChars || ""}" oninput="camposBuilder[${i}].maxChars = this.value ? +this.value : undefined"
                        class="${inputCls}"></div>
                <div><label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Mín. caracteres</label>
                    <input type="number" placeholder="Ex: 3" value="${c.minChars || ""}" oninput="camposBuilder[${i}].minChars = this.value ? +this.value : undefined"
                        class="${inputCls}"></div>
            </div>`;
        } else if (c.tipo === "numero") {
            validacoesHtml = `
            <div class="${validacoesCls}">
                <div><label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Mínimo</label>
                    <input type="number" placeholder="Ex: 1" value="${c.min ?? ""}" oninput="camposBuilder[${i}].min = this.value !== '' ? +this.value : undefined"
                        class="${inputCls}"></div>
                <div><label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Máximo</label>
                    <input type="number" placeholder="Ex: 9999" value="${c.max ?? ""}" oninput="camposBuilder[${i}].max = this.value !== '' ? +this.value : undefined"
                        class="${inputCls}"></div>
            </div>`;
        } else if (c.tipo === "data") {
            validacoesHtml = `
            <div class="${validacoesCls}">
                <div><label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Data mínima</label>
                    <input type="date" value="${c.minData || ""}" oninput="camposBuilder[${i}].minData = this.value || undefined"
                        class="${inputCls}"></div>
                <div><label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Data máxima</label>
                    <input type="date" value="${c.maxData || ""}" oninput="camposBuilder[${i}].maxData = this.value || undefined"
                        class="${inputCls}"></div>
            </div>`;
        } else if (c.tipo === "select") {
            const opcoesVal = (c.opcoes || []).join(", ");
            validacoesHtml = `
            <div class="mt-3">
                <label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Opções (separadas por vírgula)</label>
                <input type="text" placeholder="Ex: Opção A, Opção B, Opção C" value="${opcoesVal}"
                    oninput="camposBuilder[${i}].opcoes = this.value.split(',').map(s => s.trim()).filter(Boolean)"
                    class="${inputCls} w-full">
            </div>`;
        }

        return `
        <div class="bg-slate-50/80 border-2 border-slate-100 rounded-2xl p-4">
            <div class="flex items-center gap-3 mb-1">
                <div class="flex-1 grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Label do campo</label>
                        <input type="text" id="campo_label_${i}" placeholder="Ex: Empresa Contratada" value="${c.label || ""}"
                            oninput="camposBuilder[${i}].label = this.value"
                            class="${inputCls}">
                    </div>
                    <div>
                        <label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Tipo</label>
                        <select id="campo_tipo_${i}" onchange="onCampoTipoChange(${i})"
                            class="${inputCls} cursor-pointer">
                            <option value="texto" ${c.tipo === 'texto' ? 'selected' : ''}>Texto</option>
                            <option value="numero" ${c.tipo === 'numero' ? 'selected' : ''}>Número</option>
                            <option value="data" ${c.tipo === 'data' ? 'selected' : ''}>Data</option>
                            <option value="select" ${c.tipo === 'select' ? 'selected' : ''}>Seleção</option>
                        </select>
                    </div>
                </div>
                <button onclick="removeCampoRow(${i})" class="shrink-0 mt-4 w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-400 hover:bg-rose-100 rounded-xl transition-all">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
            <label class="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" ${c.obrigatorio ? 'checked' : ''} onchange="camposBuilder[${i}].obrigatorio = this.checked"
                    class="w-3.5 h-3.5 rounded border-2 border-slate-300 text-[#003D5D] cursor-pointer">
                <span class="text-[10px] font-bold text-slate-500">Campo obrigatório</span>
            </label>
            ${validacoesHtml}
        </div>`;
    }).join("");
}

async function handleSaveTipo() {
    const nome = document.getElementById("tipoFieldNome").value.trim();
    if (!nome) { showModalAlert("tipoModalAlert", "Nome é obrigatório."); return; }
    if (!camposBuilder.length) { showModalAlert("tipoModalAlert", "Adicione pelo menos um campo."); return; }

    const invalidCampo = camposBuilder.find(c => !c.label.trim());
    if (invalidCampo) { showModalAlert("tipoModalAlert", "Todos os campos devem ter um label."); return; }

    const payload = {
        id: editingTipoId || undefined,
        nome,
        campos: camposBuilder.map(c => {
            const base = { id: c.id, label: c.label.trim(), tipo: c.tipo, obrigatorio: !!c.obrigatorio };
            if (c.tipo === "texto") {
                if (c.regex) base.regex = c.regex;
                if (c.minChars) base.minChars = c.minChars;
                if (c.maxChars) base.maxChars = c.maxChars;
            } else if (c.tipo === "numero") {
                if (c.min !== undefined) base.min = c.min;
                if (c.max !== undefined) base.max = c.max;
            } else if (c.tipo === "data") {
                if (c.minData) base.minData = c.minData;
                if (c.maxData) base.maxData = c.maxData;
            } else if (c.tipo === "select") {
                base.opcoes = c.opcoes || [];
            }
            return base;
        }),
        ativo: document.getElementById("tipoFieldAtivo").checked
    };

    const btn = document.getElementById("btnSaveTipo");
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Salvando…`;

    try {
        const res = await saveTipoJustificativa(session.user, session.token, payload);
        if (res.ok && res.data?.success !== false) {
            closeTipoModal();
            loadedTabs.delete("tipos_justificativa");
            loadTiposJustificativa();
            showToast("Tipo salvo com sucesso!", "success");
        } else {
            showModalAlert("tipoModalAlert", res.data?.error || "Erro ao salvar tipo.");
        }
    } catch (e) {
        showModalAlert("tipoModalAlert", "Erro de conexão com o servidor.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar Tipo";
    }
}

function deleteTipo(id) {
    openConfirmModal("Confirmar exclusão deste tipo de justificativa?", async () => {
        const btn = document.getElementById("btnConfirmAction");
        btn.disabled = true;
        btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Excluindo…`;
        try {
            const res = await deleteTipoJustificativa(session.user, session.token, id);
            if (res.ok && res.data?.success !== false) {
                showToast("Tipo excluído com sucesso.", "success");
                loadedTabs.delete("tipos_justificativa");
                loadTiposJustificativa();
                closeConfirmModal();
            } else {
                showToast("Erro ao excluir tipo: " + (res.data?.error || ""), "error");
            }
        } catch (e) {
            showToast("Erro de conexão ao excluir.", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = "Excluir";
        }
    });
}



function handleFileSelect(event) {
    const file = event.target.files[0];
    const display = document.getElementById("fileNameDisplay");
    const btn = document.getElementById("btnImportCSV");

    if (file) {
        display.textContent = file.name;
        display.classList.remove("text-slate-400");
        display.classList.add("text-[#003D5D]");
        btn.disabled = false;
    } else {
        display.textContent = "Selecionar arquivo CSV";
        display.classList.add("text-slate-400");
        display.classList.remove("text-[#003D5D]");
        btn.disabled = true;
    }
}

async function handleImportCSV() {
    const fileInput = document.getElementById("csvFileInput");
    const file = fileInput.files[0];
    if (!file) return;

    const btn = document.getElementById("btnImportCSV");
    const alert = document.getElementById("importStatusAlert");

    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin text-lg'></i> Importando…`;
    alert.classList.add("hidden");

    const res = await importCSV(session.user, session.token, file);

    btn.disabled = false;
    btn.innerHTML = `<i class='bx bx-check-double text-lg'></i> Iniciar Importação`;

    if (res.ok && res.data?.success) {
        showToast(`Sucesso! ${res.data.data.count} registros importados.`, "success");
        fileInput.value = "";
        document.getElementById("fileNameDisplay").textContent = "Selecionar arquivo CSV";
        document.getElementById("fileNameDisplay").classList.add("text-slate-400");
        btn.disabled = true;
        loadStats();
    } else {
        showModalAlert("importStatusAlert", res.data?.error || "Erro ao importar arquivo.");
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
