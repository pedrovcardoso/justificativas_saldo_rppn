const session = requireSession("../login/index.html");
let allLegislacoes = [];

const iconMap = {
    "Lei": "bx-book-content",
    "Lei Complementar": "bx-file-text",
    "Decreto": "bx-notepad",
    "Resolução": "bx-spreadsheet",
    "Portaria": "bx-detail",
    "Portaria Conjunta": "bx-detail",
    "Instrução Normativa": "bx-file-blank"
};

function normalize(text) {
    if (!text) return "";
    return text.toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ç/g, "c");
}

async function init() {
    try {
        const res = await fetch("../../assets/json/legislacao.json");
        allLegislacoes = await res.json();

        setupFilters();
        renderLeg(allLegislacoes);
    } catch (e) {
        console.error("Erro ao carregar legislação:", e);
        document.getElementById("legGrid").innerHTML = `<p class="text-[#D61A21] font-bold">Erro ao carregar dados oficiais.</p>`;
    }
}

function setupFilters() {
    const tipos = [...new Set(allLegislacoes.map(l => l.tipo))];
    const esferas = [...new Set(allLegislacoes.map(l => l.esfera))];
    const status = [...new Set(allLegislacoes.map(l => l.status))];
    const anos = [...new Set(allLegislacoes.map(l => l.ano))].sort((a, b) => b - a);

    setCustomSelectOptions("filterTipo", tipos);
    setCustomSelectOptions("filterEsfera", esferas);
    setCustomSelectOptions("filterStatus", status);
    setCustomSelectOptions("filterAno", anos);

    onCustomSelectChange("filterTipo", () => filterLeg());
    onCustomSelectChange("filterEsfera", () => filterLeg());
    onCustomSelectChange("filterStatus", () => filterLeg());
    onCustomSelectChange("filterAno", () => filterLeg());
}

function highlight(text, query) {
    if (!query) return text;
    const cleanQuery = normalize(query).trim();
    if (!cleanQuery) return text;

    const parts = cleanQuery.split(/\s+/).filter(p => p.length >= 2);
    if (!parts.length) return text;

    let result = text;

    // We want to match normalized but keep original. 
    // This is tricky with regex replace. A simple way is to use a regex that matches the chars.
    // However, since we want highlight even if one result, let's just use a case-insensitive match on the original for now, 
    // or a more complex approach if required.

    parts.forEach(p => {
        const re = new RegExp(`(${p})`, "gi");
        // Note: Simple highlight lacks accent-insensitive matching on the TARGET text.
        // For true accent-insensitive highlight, we'd need a much more complex function.
        // User asked for regex to substitute accents in search, which I've done in normalize.
        result = result.replace(re, `<mark class="bg-[#FED73A]/80 text-[#003D5D] px-0.5 rounded-sm font-bold">$1</mark>`);
    });
    return result;
}

function renderLeg(items) {
    const grid = document.getElementById("legGrid");
    const empty = document.getElementById("legEmpty");
    const query = document.getElementById("searchLeg").value;
    grid.innerHTML = "";

    if (!items.length) {
        empty.classList.remove("hidden");
        return;
    }

    empty.classList.add("hidden");
    items.forEach(l => {
        const icon = iconMap[l.tipo] || "bx-file";
        const statusColor = l.status === "Vigente" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100";
        const tagsHtml = l.tags.map(t => `<span class="px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-bold rounded-lg border border-slate-100 tracking-tight">${t}</span>`).join("");

        grid.insertAdjacentHTML("beforeend", `
        <div class="bg-white rounded-[1.5rem] border-2 border-slate-200 p-6 flex flex-col h-full group shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:border-[#003D5D]">
            <div class="flex justify-between items-start mb-5">
                <div class="w-12 h-12 bg-slate-50 border-2 border-slate-100 text-[#003D5D] rounded-xl flex items-center justify-center transition-all group-hover:bg-[#FED73A] group-hover:border-[#FED73A]">
                    <i class='bx ${icon} text-xl'></i>
                </div>
                <div class="flex flex-col items-end gap-1.5">
                    <span class="px-2.5 py-0.5 border-2 ${statusColor} text-[9px] font-bold tracking-wider rounded-full">${l.status}</span>
                    <span class="text-[10px] font-bold text-slate-400 italic">${l.esfera}</span>
                </div>
            </div>
            
            <h3 class="text-lg font-black text-[#003D5D] mb-3 leading-tight group-hover:text-[#FCAE00] transition-colors">
                ${highlight(l.titulo, query)}
            </h3>
            
            <p class="text-[13px] text-slate-500 mb-5 flex-1 leading-relaxed font-medium">
                ${highlight(l.ementa, query)}
            </p>

            <div class="flex flex-wrap gap-1.5 mb-6">
                ${tagsHtml}
            </div>

            <a href="${l.url}" target="_blank" rel="noopener"
                class="bg-[#003D5D] transition-all hover:bg-[#002d45] inline-flex items-center justify-center gap-2 self-start px-6 py-3 text-white text-[10px] font-bold rounded-xl shadow-lg shadow-[#003D5D]/10">
                <i class='bx bx-link-external text-base'></i> Acessar Documento
            </a>
        </div>
    `);
    });
}

function filterLeg() {
    const q = normalize(document.getElementById("searchLeg").value).trim();

    const selTipos = getCustomSelectValues("filterTipo");
    const selEsferas = getCustomSelectValues("filterEsfera");
    const selStatus = getCustomSelectValues("filterStatus");
    const selAnos = getCustomSelectValues("filterAno");

    const filtered = allLegislacoes.filter(l => {
        const matchesQuery = !q ||
            normalize(l.titulo).includes(q) ||
            normalize(l.ementa).includes(q) ||
            l.tags.some(t => normalize(t).includes(q));

        const matchesTipo = selTipos.length === 0 || selTipos.includes(l.tipo);
        const matchesEsfera = selEsferas.length === 0 || selEsferas.includes(l.esfera);
        const matchesStatus = selStatus.length === 0 || selStatus.includes(l.status);
        const matchesAno = selAnos.length === 0 || selAnos.includes(l.ano);

        return matchesQuery && matchesTipo && matchesEsfera && matchesStatus && matchesAno;
    });

    renderLeg(filtered);

    const countEl = document.getElementById("resultCount");
    if (countEl) {
        countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}`;
        countEl.classList.add("opacity-100");
        countEl.classList.remove("opacity-0");
    }
}

function toggleAdvanced() {
    const adv = document.getElementById("advancedFilters");
    const icon = document.getElementById("advIcon");
    const btn = document.getElementById("btnFiltersToggle");

    const isOpen = !adv.classList.contains("hidden");

    if (!isOpen) {
        adv.classList.remove("hidden");
        icon.classList.add("rotate-180");
        btn.classList.add("bg-primary-soft", "text-primary", "border-primary");
        btn.classList.remove("bg-slate-50", "text-slate-500", "border-slate-100");
    } else {
        adv.classList.add("hidden");
        icon.classList.remove("rotate-180");
        btn.classList.remove("bg-primary-soft", "text-primary", "border-primary");
        btn.classList.add("bg-slate-50", "text-slate-500", "border-slate-100");
    }
}

function clearAllFilters() {
    document.getElementById("searchLeg").value = "";
    clearCustomSelect("filterTipo");
    clearCustomSelect("filterEsfera");
    clearCustomSelect("filterStatus");
    clearCustomSelect("filterAno");
    filterLeg();
}

if (session) {
    if (typeof Layout !== 'undefined' && Layout.ready) {
        Layout.ready.then(() => init());
    } else {
        window.addEventListener('load', () => {
            if (typeof Layout !== 'undefined' && Layout.ready) {
                Layout.ready.then(() => init());
            } else {
                init();
            }
        });
    }
}
