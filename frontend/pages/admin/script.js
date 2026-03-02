const session = requireAdmin("../dashboard/index.html");

let legData = [];
let editingLegIndex = null;
let editingNotifId = null;

async function init() {
    await Layout.ready;
    switchTab("estatisticas");
    loadLegislacao();
    loadUsers();
    loadStats();
}

function switchTab(tab) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle("bg-[#003D5D]", isActive);
        btn.classList.toggle("text-white", isActive);
        btn.classList.toggle("shadow-lg", isActive);
        btn.classList.toggle("shadow-[#003D5D]/20", isActive);
        btn.classList.toggle("text-slate-500", !isActive);
        btn.classList.toggle("hover:bg-slate-100", !isActive);
    });
    document.getElementById(`tab-${tab}`)?.classList.remove("hidden");
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
    } else {
        showModalAlert("userModalAlert", res.data?.error || "Erro ao salvar usuário.");
    }
}

async function loadStats() {
    const loading = document.getElementById("statsStateLoading");
    const content = document.getElementById("statsContent");

    const res = await getData(session.user, session.token);
    loading.classList.add("hidden");

    if (!res.ok || !res.data?.success) {
        content.classList.remove("hidden");
        return;
    }

    const statusRes = await checkStatus(session.user, session.token);
    const statuses = statusRes.data?.data?.status || [];

    const latestMap = {};
    statuses.forEach(s => {
        if (!latestMap[s.rppn] || new Date(s.data_criacao) > new Date(latestMap[s.rppn].data_criacao)) {
            latestMap[s.rppn] = s;
        }
    });
    const latest = Object.values(latestMap);

    const total = latest.length;
    const pendentes = latest.filter(s => !s.status || s.status.toLowerCase() === "pendente").length;
    const emAnalise = latest.filter(s => s.status?.toLowerCase() === "em análise" || (s.acao && (!s.status || s.status.toLowerCase() === "pendente"))).length;
    const concluidos = latest.filter(s => s.status?.toLowerCase() === "aceito").length;

    document.getElementById("statTotal").textContent = total;
    document.getElementById("statPendentes").textContent = pendentes;
    document.getElementById("statEmAnalise").textContent = emAnalise;
    document.getElementById("statConcluidos").textContent = concluidos;

    const bars = [
        { label: "Pendentes", value: pendentes, total, color: "bg-amber-400" },
        { label: "Em Análise", value: emAnalise, total, color: "bg-orange-400" },
        { label: "Concluídos", value: concluidos, total, color: "bg-emerald-400" },
    ];

    document.getElementById("statsBarChart").innerHTML = bars.map(b => {
        const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
        return `
        <div>
            <div class="flex justify-between mb-2">
                <span class="text-[12px] font-bold text-slate-600">${b.label}</span>
                <span class="text-[12px] font-black text-slate-800">${b.value} <span class="text-slate-400 font-medium">(${pct}%)</span></span>
            </div>
            <div class="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div class="${b.color} h-full rounded-full transition-all duration-700" style="width: ${pct}%"></div>
            </div>
        </div>`;
    }).join("");

    content.classList.remove("hidden");
}

async function loadLegislacao() {
    try {
        const res = await fetch("../../assets/json/legislacao.json");
        legData = await res.json();
        renderLegTable();
    } catch (e) {
        console.error("Erro ao carregar legislação:", e);
    }
}

function renderLegTable() {
    const tbody = document.getElementById("legTableBody");
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
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
    showToast("Legislação salva localmente. Lembre-se de atualizar o arquivo JSON no servidor.");
}

function deleteLeg(index) {
    if (!confirm("Confirmar exclusão deste normativo?")) return;
    legData.splice(index, 1);
    renderLegTable();
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

async function handleSaveNotif() {
    const titulo = document.getElementById("notifFieldTitulo").value.trim();
    const mensagem = document.getElementById("notifFieldMensagem").value.trim();
    if (!titulo || !mensagem) { showModalAlert("notifModalAlert", "Título e mensagem são obrigatórios."); return; }

    const payload = {
        id: editingNotifId,
        titulo,
        mensagem,
        tipo: document.getElementById("notifFieldTipo").value,
        ativo: document.getElementById("notifFieldAtivo").checked
    };

    const btn = document.getElementById("btnSaveNotif");
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt animate-spin mr-2'></i> Salvando…`;

    const res = editingNotifId
        ? await updateNotification(session.user, session.token, payload)
        : await createNotification(session.user, session.token, payload);

    btn.disabled = false;
    btn.textContent = "Salvar Notificação";
    showModalAlert("notifModalAlert", res.data?.error || "API não implementada ainda. Formulário validado com sucesso.", "info");
}

function showModalAlert(id, msg, type = "error") {
    const el = document.getElementById(id);
    el.className = `mt-4 px-5 py-4 rounded-2xl text-[11px] font-bold border-2 ${type === "error" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-amber-50 text-amber-700 border-amber-100"}`;
    el.textContent = msg;
    el.classList.remove("hidden");
}

function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[12px] font-bold px-6 py-4 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
