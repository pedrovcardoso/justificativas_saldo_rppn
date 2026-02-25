const API_URLS = {
    auth: "https://default4c86fd71d0164231a16057311d68b9.51.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6268733c89d34beab95650687b639b00/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ASdpJccB3BlVWq_VnabESl91OirL3FRe6Uxy5L6dgT4",
    saveJustificativa: "https://default4c86fd71d0164231a16057311d68b9.51.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/0339340250294a70816277b8caec377b/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=LgZyWNXrffi1WjtYAETFQ9P3GGY12sNfB07_kEjCW5I",
    getData: "https://default4c86fd71d0164231a16057311d68b9.51.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/4ed1dbc6dd1649fa957c1a7c2e0a2c1a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=N9lHULFnjKfbzt2X5wSSTZJ6TNxtbNxrRrseb69iPPA",
};

async function apiCall(url, body) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

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
        endpoint: "justificar",
        user, token, rppn, acao, justificativa,
    });
}

async function avaliarStatus(user, token, rppn, id, status, motivo_rejeição = "") {
    return apiCall(API_URLS.saveJustificativa, {
        endpoint: "avaliar_status",
        user, token, rppn, id, status, motivo_rejeição,
    });
}

async function getData(user, token) {
    return apiCall(API_URLS.getData, { endpoint: "get_data", user, token });
}

async function checkStatus(user, token, arr_rppn) {
    return apiCall(API_URLS.getData, { endpoint: "check_status", user, token, arr_rppn });
}

if (typeof module !== "undefined") {
    module.exports = { sendOtp, validateOtp, validateSession, logout, justificar, avaliarStatus, getData, checkStatus };
}