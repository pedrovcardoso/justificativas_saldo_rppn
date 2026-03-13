const API_BASE = "http://localhost:3000/api";
let AUTH_FLOW_URL = null;

async function getAuthUrl() {
    if (AUTH_FLOW_URL) return AUTH_FLOW_URL;
    try {
        const res = await fetch(`${API_BASE}/config`);
        const data = await res.json();
        if (data.success && data.data.AUTH_FLOW_URL) {
            AUTH_FLOW_URL = data.data.AUTH_FLOW_URL;
            return AUTH_FLOW_URL;
        }
    } catch (e) {
        console.error("Erro ao carregar configuração:", e);
    }
    return null;
}

const API_URLS = {
    saveJustificativa: `${API_BASE}/justificativas/justificar`,
    avaliarStatus: `${API_BASE}/justificativas/avaliar_status`,
    getData: `${API_BASE}/data/get_data`,
    checkStatus: `${API_BASE}/data/check_status`,
    adminUsers: `${API_BASE}/admin/users`,
    adminNotif: `${API_BASE}/admin/notifications`,
    adminLeg: `${API_BASE}/admin/legislacao`,
    adminImport: `${API_BASE}/admin/import_csv`,
    adminTiposJustificativa: `${API_BASE}/admin/tipos_justificativa`,
    userNotif: `${API_BASE}/user/notifications`,
    userNotifRead: `${API_BASE}/user/notifications/mark-read`,
};

async function apiCall(url, body, method = "POST", isFormData = false) {
    try {
        const options = {
            method: method,
        };

        if (method !== "GET" && method !== "HEAD" && body) {
            options.body = isFormData ? body : JSON.stringify(body);
            if (!isFormData) {
                options.headers = { "Content-Type": "application/json" };
            }
        }

        const response = await fetch(url, options);

        let data = {};
        try {
            data = await response.json();
        } catch (_) { }

        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error(error);
        return { ok: false, status: 0, data: { success: false, error: "Erro de conexão." } };
    }
}

async function sendOtp(user) {
    const url = await getAuthUrl();
    return apiCall(url, { endpoint: "send_otp", user });
}

async function validateOtp(user, otp_code) {
    const url = await getAuthUrl();
    return apiCall(url, { endpoint: "validate_otp", user, otp_code });
}

async function validateSession(user, token) {
    const url = await getAuthUrl();
    return apiCall(url, { endpoint: "validate_session", user, token });
}

async function logout(user, token) {
    const url = await getAuthUrl();
    return apiCall(url, { endpoint: "logout", user, token });
}

async function justificar(user, token, rppn, acao, justificativa) {
    return apiCall(API_URLS.saveJustificativa, {
        user, token, acao, justificativa,
        dados: [{ rppn }]
    });
}

async function justificarLote(user, token, acao, justificativa, dados) {
    return apiCall(API_URLS.saveJustificativa, {
        user, token, acao, justificativa, dados
    });
}

async function avaliarStatus(user, token, rppn, id, status, motivo_rejeicao = "") {
    return apiCall(API_URLS.avaliarStatus, {
        user, token, status,
        motivo_rejeicao,
        dados: [{ rppn, id }]
    });
}

async function getData(user, token) {
    return apiCall(API_URLS.getData, { user, token });
}

async function checkStatus(user, token) {
    return apiCall(API_URLS.checkStatus, { user, token });
}

async function getUsers(user, token) {
    const url = await getAuthUrl();
    const res = await apiCall(url, { endpoint: 'get_users', user, token });
    return res;
}

async function createUser(user, token, payload) {
    const url = await getAuthUrl();
    return apiCall(url, { ...payload, user, token, endpoint: 'create_user' });
}

async function updateUser(user, token, payload) {
    const url = await getAuthUrl();
    return apiCall(url, { ...payload, user, token, endpoint: 'update_user' });
}

async function getNotifications(user, token) {
    return apiCall(`${API_URLS.adminNotif}?user=${encodeURIComponent(user)}&token=${encodeURIComponent(token)}`, null, "GET");
}

async function createNotification(user, token, payload) {
    return apiCall(API_URLS.adminNotif, { ...payload, user, token });
}

async function updateNotification(user, token, payload) {
    return apiCall(API_URLS.adminNotif, { ...payload, user, token }, "PUT");
}

async function deleteNotification(user, token, id) {
    return apiCall(API_URLS.adminNotif, { user, token, id }, "DELETE");
}

async function getLegislacao(user, token) {
    return apiCall(`${API_URLS.adminLeg}?user=${encodeURIComponent(user)}&token=${encodeURIComponent(token)}`, null, "GET");
}

async function saveLegislacao(user, token, items) {
    return apiCall(API_URLS.adminLeg, { user, token, items });
}

async function importCSV(user, token, file) {
    const formData = new FormData();
    formData.append("user", user);
    formData.append("token", token);
    formData.append("file", file);
    return apiCall(API_URLS.adminImport, formData, "POST", true);
}

async function getUserNotifications(user) {
    return apiCall(`${API_URLS.userNotif}?user=${encodeURIComponent(user)}`, null, "GET");
}

async function markAllNotificationsAsRead(user) {
    return apiCall(API_URLS.userNotifRead, { user });
}

async function getTiposJustificativa(user, token) {
    return apiCall(`${API_URLS.adminTiposJustificativa}?user=${encodeURIComponent(user)}&token=${encodeURIComponent(token)}`, null, "GET");
}

async function saveTipoJustificativa(user, token, payload) {
    return apiCall(API_URLS.adminTiposJustificativa, { ...payload, user, token });
}

async function deleteTipoJustificativa(user, token, id) {
    return apiCall(`${API_URLS.adminTiposJustificativa}/${id}?user=${encodeURIComponent(user)}&token=${encodeURIComponent(token)}`, null, "DELETE");
}

if (typeof module !== "undefined") {
    module.exports = {
        sendOtp, validateOtp, validateSession, logout,
        justificar, justificarLote, avaliarStatus,
        getData, checkStatus,
        getUsers, createUser, updateUser,
        getNotifications, createNotification, updateNotification, deleteNotification,
        getLegislacao, saveLegislacao, importCSV,
        getUserNotifications, markAllNotificationsAsRead,
        getTiposJustificativa, saveTipoJustificativa, deleteTipoJustificativa
    };
}