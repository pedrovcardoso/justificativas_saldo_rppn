const SESSION_KEYS = {
    user: "rppn_user",
    token: "rppn_token",
    role: "rppn_role",
    uo: "rppn_uo"
};

function saveSession(user, token, role, uo) {
    sessionStorage.setItem(SESSION_KEYS.user, user);
    sessionStorage.setItem(SESSION_KEYS.token, token);
    sessionStorage.setItem(SESSION_KEYS.role, role || "");
    sessionStorage.setItem(SESSION_KEYS.uo, uo || "");
}

function getSession() {
    const user = sessionStorage.getItem(SESSION_KEYS.user);
    const token = sessionStorage.getItem(SESSION_KEYS.token);
    if (!user || !token) return null;
    return {
        user,
        token,
        role: sessionStorage.getItem(SESSION_KEYS.role) || "",
        uo: sessionStorage.getItem(SESSION_KEYS.uo) || ""
    };
}

function clearSession() {
    Object.values(SESSION_KEYS).forEach(k => sessionStorage.removeItem(k));
}

function isAdmin() {
    const session = getSession();
    return session?.role?.toLowerCase() === "admin";
}

function requireSession(loginPath = "/frontend/pages/login/index.html") {
    const session = getSession();
    if (!session) {
        window.location.href = loginPath;
        return null;
    }
    return session;
}

function requireAdmin(redirectPath = "/frontend/pages/dashboard/index.html") {
    const session = requireSession();
    if (!session) return null;
    if (!isAdmin()) {
        window.location.href = redirectPath;
        return null;
    }
    return session;
}

async function doLogout(loginPath = "/frontend/pages/login/index.html") {
    const session = getSession();
    if (session) {
        try {
            await logout(session.user, session.token);
        } catch (_) { }
    }
    clearSession();
    window.location.href = loginPath;
}
