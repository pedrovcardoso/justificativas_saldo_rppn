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
        // Classes de estado ativo (Premium)
        btn.classList.toggle("bg-[#003D5D]", isActive);
        btn.classList.toggle("text-white", isActive);
        btn.classList.toggle("shadow-xl", isActive);
        btn.classList.toggle("shadow-[#003D5D]/20", isActive);
        btn.classList.toggle("scale-105", isActive);

        // Classes de estado inativo
        btn.classList.toggle("text-slate-500", !isActive);
        btn.classList.toggle("hover:bg-white", !isActive);
    });

    const targetContent = document.getElementById(`tab-${tab}`);
    if (targetContent) {
        targetContent.classList.remove("hidden");
        targetContent.classList.add("animate-in", "fade-in", "slide-in-from-bottom-2", "duration-500");
    }

    // Lazy Load logic
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
        loadStats(); // Atualiza os cards
    } else {
        showModalAlert("importStatusAlert", res.data?.error || "Erro ao importar arquivo.");
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
