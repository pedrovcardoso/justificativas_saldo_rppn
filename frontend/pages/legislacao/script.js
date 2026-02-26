const session = requireSession("../login/index.html");
let allLegislacoes = [];

async function init() {
    try {
        const res = await fetch("../../assets/json/legislacao.json");
        allLegislacoes = await res.json();
        renderLeg(allLegislacoes);
    } catch (e) {
        console.error("Erro ao carregar legislação:", e);
        document.getElementById("legGrid").innerHTML = `<p class="text-[#D61A21] font-bold">Erro ao carregar dados oficiais.</p>`;
    }
}

async function handleLogout() { await doLogout("../login/index.html"); }

function renderLeg(items) {
    const grid = document.getElementById("legGrid");
    const empty = document.getElementById("legEmpty");
    grid.innerHTML = "";

    if (!items.length) {
        empty.classList.remove("hidden");
        return;
    }

    empty.classList.add("hidden");
    items.forEach(l => {
        grid.insertAdjacentHTML("beforeend", `
        <div class="bg-white rounded-[2rem] border-2 border-slate-200 p-8 flex flex-col h-full group shadow-sm transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-2 hover:shadow-[0_25px_50px_-12px_rgba(0,61,93,0.1)] hover:border-[#003D5D]">
            <div class="w-14 h-14 bg-slate-50 border-2 border-slate-100 text-[#003D5D] rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:bg-[#FED73A] group-hover:text-[#003D5D] group-hover:border-[#FED73A]">
                <i class='bx ${l.icone} text-2xl'></i>
            </div>
            <h3 class="text-xl font-bold text-[#003D5D] mb-4 leading-tight group-hover:text-[#FCAE00] transition-colors normal-case [letter-spacing:normal]">
                ${l.titulo}
            </h3>
            <p class="text-sm text-slate-500 mb-8 flex-1 leading-relaxed font-medium normal-case [letter-spacing:normal]">${l.descricao}</p>
            <a href="${l.url}" target="_blank" rel="noopener"
                class="bg-[#003D5D] transition-all duration-300 ease-in-out hover:bg-[#002d45] hover:shadow-[0_10px_15px_-3px_rgba(0,61,93,0.2)] inline-flex items-center justify-center gap-3 self-start px-8 py-3.5 text-white text-[11px] font-bold normal-case [letter-spacing:normal] rounded-xl shadow-lg shadow-black/5">
                <i class='bx bx-link-external text-lg'></i> Acessar Documento
            </a>
        </div>
    `);
    });
}

function filterLeg() {
    const q = document.getElementById("searchLeg").value.toLowerCase();
    renderLeg(allLegislacoes.filter(l => l.titulo.toLowerCase().includes(q) || l.descricao.toLowerCase().includes(q)));
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
