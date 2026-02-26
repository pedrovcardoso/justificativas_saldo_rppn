const session = requireSession("../login/index.html");

async function handleLogout() { await doLogout("../login/index.html"); }

function showReportState(name) {
    ["reportLoading", "reportError", "reportContent", "reportEmpty"].forEach(id => {
        const el = document.getElementById(id);
        el.classList.toggle("hidden", id !== name);
        if (id === name && (id === "reportLoading" || id === "reportError")) el.classList.add("flex");
        else el.classList.remove("flex");
    });
}

async function loadReport() {
    const raw = document.getElementById("rppnInput").value.trim();
    const arr_rppn = raw.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    if (!arr_rppn.length) { showReportState("reportEmpty"); return; }

    showReportState("reportLoading");
    const res = await checkStatus(session.user, session.token, arr_rppn);

    if (!res.ok || !res.data?.success) {
        document.getElementById("reportErrorMsg").textContent = res.data?.error || "Ocorreu um problema ao processar sua solicitação.";
        showReportState("reportError");
        return;
    }

    document.getElementById("reportPre").textContent = JSON.stringify(res.data?.data?.status ?? res.data?.data ?? {}, null, 2);
    showReportState("reportContent");
}

if (session && typeof Layout !== 'undefined' && Layout.ready) {
    Layout.ready.then(() => { });
}
