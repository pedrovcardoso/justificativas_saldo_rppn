const SESSION_KEYS = {
    user: "rppn_user",
    token: "rppn_token",
    role: "rppn_role",
};

function saveSession(user, token, role) {
    sessionStorage.setItem(SESSION_KEYS.user, user);
    sessionStorage.setItem(SESSION_KEYS.token, token);
    sessionStorage.setItem(SESSION_KEYS.role, role || "");
}

function getSession() {
    const user = sessionStorage.getItem(SESSION_KEYS.user);
    const token = sessionStorage.getItem(SESSION_KEYS.token);
    if (!user || !token) return null;
    return {
        user,
        token,
        role: sessionStorage.getItem(SESSION_KEYS.role) || "",
    };
}

function clearSession() {
    Object.values(SESSION_KEYS).forEach(k => sessionStorage.removeItem(k));
}

function requireSession(loginPath = "../../pages/login/index.html") {
    const session = getSession();
    if (!session) {
        window.location.href = loginPath;
        return null;
    }
    return session;
}

async function doLogout(loginPath = "../../pages/login/index.html") {
    const session = getSession();
    if (session) {
        try {
            await logout(session.user, session.token);
        } catch (_) { }
    }
    clearSession();
    window.location.href = loginPath;
}
