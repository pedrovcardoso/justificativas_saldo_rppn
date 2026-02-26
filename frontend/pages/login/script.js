(async function () {
    const s = getSession();
    if (s) {
        try {
            const res = await validateSession(s.user, s.token);
            if (res.ok && res.data?.success) {
                const { token, role, uo } = res.data.data;
                saveSession(s.user, token, role, uo);
                window.location.href = "../dashboard/index.html";
            } else {
                clearSession();
            }
        } catch (e) { }
    }
})();

let currentUser = "";

function showAlert(msg, type = "error") {
    const el = document.getElementById("alert");
    el.className = `mb-8 px-6 py-4 rounded-2xl text-[11px] font-bold no-uppercase border-2 ${type === "error"
        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        }`;
    el.textContent = msg;
    el.classList.remove("hidden");
}

function hideAlert() { document.getElementById("alert").classList.add("hidden"); }

function setLoading(btnId, loading, originalText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = `<i class='bx bx-loader-alt spinner animate-spin inline-block text-2xl'></i>`;
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleSendOtp() {
    hideAlert();
    const user = document.getElementById("inputEmail").value.trim();
    if (!user) { showAlert("E-mail corporativo é obrigatório"); return; }

    setLoading("btnSendOtp", true, "Solicitar Código");
    const res = await sendOtp(user);
    setLoading("btnSendOtp", false, "Solicitar Código de Acesso");

    if (res.ok && res.data?.success) {
        currentUser = user;
        document.getElementById("otpDesc").textContent = `Enviamos o código para ${user}. Verifique sua caixa de entrada.`;
        document.getElementById("stepEmail").classList.add("hidden");
        document.getElementById("stepOtp").classList.remove("hidden");
        setTimeout(() => {
            const firstOtpField = document.querySelector(".otp-field");
            if (firstOtpField) firstOtpField.focus();
        }, 100);
    } else {
        showAlert(res.data?.error || "Erro na solicitação do código");
    }
}

async function handleValidateOtp() {
    hideAlert();
    const inputs = document.querySelectorAll(".otp-field");
    const otp = Array.from(inputs).map(i => i.value).join("");
    if (otp.length < 6) { showAlert("Código de segurança incompleto"); return; }

    setLoading("btnValidateOtp", true, "Validar Acesso");
    const res = await validateOtp(currentUser, otp);
    setLoading("btnValidateOtp", false, "Entrar no Sistema");

    if (res.ok && res.data?.success) {
        const { token, role, uo } = res.data.data;
        saveSession(currentUser, token, role, uo);
        window.location.href = "../dashboard/index.html";
    } else {
        showAlert(res.data?.error || "Código de segurança inválido");
    }
}

async function handleResend() {
    hideAlert();
    document.querySelectorAll(".otp-field").forEach(i => i.value = "");
    setLoading("btnResend", true, "");
    const res = await sendOtp(currentUser);
    setLoading("btnResend", false, "Reenviar chave");
    if (res.ok && res.data?.success) showAlert("Novo código enviado com sucesso", "success");
    else showAlert("Erro no reenvio do código");
}

function goBackToEmail() {
    hideAlert();
    document.querySelectorAll(".otp-field").forEach(i => i.value = "");
    document.getElementById("stepOtp").classList.add("hidden");
    document.getElementById("stepEmail").classList.remove("hidden");
}

document.querySelectorAll(".otp-field").forEach((field, index, all) => {
    field.addEventListener("input", (e) => {
        const val = e.target.value;
        if (val.length === 1 && index < all.length - 1) {
            all[index + 1].focus();
        }

        const fullValue = Array.from(all).map(i => i.value).join("");
        if (fullValue.length === 6) {
            handleValidateOtp();
        }
    });

    field.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !field.value && index > 0) {
            all[index - 1].focus();
        }
    });

    field.addEventListener("paste", (e) => {
        const data = e.clipboardData.getData("text").trim();
        if (data.length === 6 && /^\d+$/.test(data)) {
            data.split("").forEach((char, i) => {
                if (all[i]) all[i].value = char;
            });
            handleValidateOtp();
        }
        e.preventDefault();
    });
});

document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const stepOtp = document.getElementById("stepOtp");
    if (stepOtp && !stepOtp.classList.contains("hidden")) handleValidateOtp();
    else handleSendOtp();
});
