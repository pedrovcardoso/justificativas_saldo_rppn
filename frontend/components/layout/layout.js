const Layout = {
    config: {
        path: "../../components/layout/"
    },

    ready: null,

    async init() {
        this.ready = new Promise(async (resolve) => {
            const originalContent = this.getOriginalContent();
            this.clearBody();

            const wrapper = document.createElement("div");
            wrapper.className = "flex min-h-screen bg-[#F6F6F6]";
            document.body.appendChild(wrapper);

            const asideHTML = await this.fetchComponent("aside.html");
            const headerHTML = await this.fetchComponent("header.html");

            wrapper.innerHTML = `
                ${asideHTML}
                <div class="flex-1 flex flex-col h-screen overflow-hidden bg-[#F6F6F6]">
                    ${headerHTML}
                    <main id="layoutMain" class="flex-1 overflow-y-auto">
                    </main>
                </div>
            `;

            const main = document.getElementById("layoutMain");
            if (originalContent) {
                const dashboardContent = originalContent.querySelector('main');
                if (dashboardContent) {
                    Array.from(dashboardContent.childNodes).forEach(node => main.appendChild(node));
                    main.className += " " + dashboardContent.className;
                } else {
                    main.appendChild(originalContent);
                }
            }

            const header = wrapper.querySelector("header");
            if (header && main) {
                const setMainHeight = () => {
                    const headerH = header.offsetHeight;
                    main.style.height = `calc(100vh - ${headerH}px)`;
                    main.style.maxHeight = `calc(100vh - ${headerH}px)`;
                };
                setMainHeight();
                setTimeout(setMainHeight, 50);
                window.addEventListener("resize", setMainHeight);
            }

            this.applySidebarState();

            setTimeout(() => {
                const aside = document.getElementById("layoutAside");
                if (aside) aside.classList.add("animate-transitions");
            }, 100);

            this.setActiveMenu();
            this.setupUserDisplay();
            this.setupNotifications();
            this.refreshSession();
            resolve();
        });
    },

    getOriginalContent() {
        const fragment = document.createDocumentFragment();
        const children = Array.from(document.body.childNodes);
        children.forEach(child => {
            if (child.tagName !== "SCRIPT" && child.tagName !== "LINK" && child.nodeName !== "#comment") {
                fragment.appendChild(child);
            }
        });
        return fragment;
    },

    clearBody() {
        const children = Array.from(document.body.childNodes);
        children.forEach(child => {
            if (child.tagName !== "SCRIPT" && child.tagName !== "LINK") {
                document.body.removeChild(child);
            }
        });
    },

    async fetchComponent(file) {
        try {
            const response = await fetch(this.config.path + file);
            return await response.text();
        } catch (e) {
            console.error(e);
            return "";
        }
    },

    setActiveMenu() {
        const path = window.location.pathname;
        const links = document.querySelectorAll(".nav-link");
        links.forEach(link => {
            const nav = link.getAttribute("data-nav");
            if (path.includes(nav)) {
                link.classList.add("active-premium");
            }
        });
    },

    toggleSidebar() {
        const aside = document.getElementById("layoutAside");
        const icon = document.getElementById("toggleIcon");
        const isCollapsed = aside.classList.toggle("collapsed");

        if (icon) {
            icon.className = isCollapsed ? 'bx bx-menu text-xl' : 'bx bx-menu-alt-left text-xl';
        }

        localStorage.setItem("sidebarCollapsed", isCollapsed);
    },

    applySidebarState() {
        const aside = document.getElementById("layoutAside");
        const icon = document.getElementById("toggleIcon");
        const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";

        if (isCollapsed && aside) {
            aside.classList.add("collapsed");
            if (icon) icon.className = 'bx bx-menu text-xl';
        }
    },

    logout() {
        const btnExpanded = document.getElementById("btnLogoutExpanded");
        const iconExpanded = document.getElementById("logoutIconExpanded");
        const loaderExpanded = document.getElementById("logoutLoaderExpanded");

        const btnCollapsed = document.getElementById("collapsedLogout");
        const iconCollapsed = document.getElementById("logoutIconCollapsed");
        const loaderCollapsed = document.getElementById("logoutLoaderCollapsed");

        const setLogoutLoading = (isLoading) => {
            if (btnExpanded) btnExpanded.disabled = isLoading;
            if (iconExpanded) iconExpanded.classList.toggle("hidden", isLoading);
            if (loaderExpanded) loaderExpanded.classList.toggle("hidden", !isLoading);

            if (btnCollapsed) btnCollapsed.disabled = isLoading;
            if (iconCollapsed) iconCollapsed.classList.toggle("hidden", isLoading);
            if (loaderCollapsed) loaderCollapsed.classList.toggle("hidden", !isLoading);
        };

        setLogoutLoading(true);

        if (typeof doLogout === 'function') {
            doLogout();
        } else {
            console.error("Logout function not found");
            sessionStorage.clear();
            setTimeout(() => {
                window.location.href = "../login/index.html";
            }, 500);
        }
    },

    setupUserDisplay() {
        const session = typeof getSession === 'function' ? getSession() : null;
        if (session) {
            const uEl = document.getElementById("sidebarUser");
            const rEl = document.getElementById("sidebarRole");
            const aEl = document.getElementById("userAvatar");
            const tEl = document.getElementById("userTooltip");

            if (uEl) uEl.textContent = session.user;

            if (rEl) {
                const adminRole = session.role?.toLowerCase() === "admin";
                rEl.textContent = adminRole ? "Administrador" : `UO - ${session.uo || "---"}`;
            }

            if (tEl) tEl.textContent = session.user;

            if (aEl) {
                aEl.innerHTML = `<i class='bx bx-user text-2xl text-[#003D5D]'></i>`;
            }

            const adminOnly = document.querySelectorAll("[data-admin-only]");
            const isAdmin = session.role?.toLowerCase() === "admin";
            adminOnly.forEach(el => el.classList.toggle("hidden", !isAdmin));
        }
    },

    async refreshSession() {
        const session = typeof getSession === 'function' ? getSession() : null;
        if (!session) return;

        try {
            if (typeof validateSession === 'function') {
                const res = await validateSession(session.user, session.token);
                if (res.ok && res.data?.success) {
                    const { token, role, uo } = res.data.data;
                    if (typeof saveSession === 'function') {
                        saveSession(session.user, token, role, uo);
                        this.setupUserDisplay();
                    }
                } else if (res.status === 401 || res.status === 404) {
                    if (typeof clearSession === 'function') clearSession();
                    window.location.href = "../login/index.html";
                }
            }
        } catch (e) {
            console.error("Background session validation failed:", e);
        }
    },

    async setupNotifications() {
        const session = typeof getSession === 'function' ? getSession() : null;
        if (!session) return;

        const btn = document.getElementById("notification-btn");
        const panel = document.getElementById("notification-panel");
        const list = document.getElementById("notification-list");
        const dot = document.getElementById("notification-dot");
        const markAllBtn = document.getElementById("mark-all-read-btn");

        if (!btn || !panel || !list) return;

        const updateNotifications = async () => {
            try {
                const res = await getUserNotifications(session.user);
                if (res.ok) {
                    const notifications = res.data.data || [];
                    const unreadCount = notifications.filter(n => !n.lida).length;

                    dot.classList.toggle("hidden", unreadCount === 0);

                    if (notifications.length === 0) {
                        list.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs italic">Nenhuma notificação encontrada</div>`;
                    } else {
                        list.innerHTML = notifications.map(n => `
                            <div class="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-default ${!n.lida ? 'bg-blue-50/30' : ''}">
                                <div class="flex items-start gap-3">
                                    <div class="w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.lida ? 'bg-[#D61A21]' : 'bg-slate-200'}"></div>
                                    <div class="flex-1">
                                        <p class="text-xs font-black text-[#003D5D] mb-1">${n.titulo}</p>
                                        <p class="text-[11px] text-slate-500 leading-relaxed">${n.mensagem}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } catch (e) {
                console.error("Notifications fetch failed:", e);
            }
        };

        btn.onclick = (e) => {
            e.stopPropagation();
            panel.classList.toggle("hidden");
            if (!panel.classList.contains("hidden")) {
                updateNotifications();
            }
        };

        markAllBtn.onclick = async (e) => {
            e.stopPropagation();
            const res = await markAllNotificationsAsRead(session.user);
            if (res.ok) {
                updateNotifications();
            }
        };

        document.addEventListener("click", (e) => {
            if (!panel.contains(e.target) && e.target !== btn) {
                panel.classList.add("hidden");
            }
        });

        updateNotifications();
        setInterval(updateNotifications, 5 * 60 * 1000);
    },

    setHeaderActions(html) { }
};

if (document.body) {
    Layout.init();
} else {
    document.addEventListener("DOMContentLoaded", () => Layout.init());
}
