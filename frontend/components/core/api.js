const API_BASE = "http://localhost:3000/api";

const API_URLS = {
    auth: `${API_BASE}/auth`,
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
    return apiCall(API_URLS.auth, { endpoint: "send_otp", user });
}

async function validateOtp(user, otp_code) {
    return apiCall(API_URLS.auth, { endpoint: "validate_otp", user, otp_code });
}

async function validateSession(user, token) {
    return apiCall(API_URLS.auth, { endpoint: "validate_session", user, token });
}

async function logout(user, token) {
    return apiCall(API_URLS.auth, { endpoint: "logout", user, token });
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

// Admin APIs
async function getUsers(user, token) {
    return apiCall(`${API_URLS.adminUsers}?user=${encodeURIComponent(user)}&token=${encodeURIComponent(token)}`, null, "GET");
}

async function createUser(user, token, payload) {
    return apiCall(API_URLS.adminUsers, { ...payload, user, token, action: "create" });
}

async function updateUser(user, token, payload) {
    return apiCall(API_URLS.adminUsers, { ...payload, user, token, action: "update" });
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