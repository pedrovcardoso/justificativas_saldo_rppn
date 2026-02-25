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
                // If the original content has the old dashboard layout structure (flex min-h-screen),
                // we should try to extract just the actual content to avoid nested layouts.
                const dashboardContent = originalContent.querySelector('main');
                if (dashboardContent) {
                    // Pull the children of the internal main directly
                    Array.from(dashboardContent.childNodes).forEach(node => main.appendChild(node));
                    // Also copy classes from the internal main (like padding p-8)
                    main.className += " " + dashboardContent.className;
                } else {
                    main.appendChild(originalContent);
                }
            }

            // Precisely adjust main height = 100vh - exact header height
            const header = wrapper.querySelector("header");
            if (header && main) {
                const setMainHeight = () => {
                    const headerH = header.offsetHeight;
                    main.style.height = `calc(100vh - ${headerH}px)`;
                    main.style.maxHeight = `calc(100vh - ${headerH}px)`;
                };
                // Initial set
                setMainHeight();
                // Re-run after a short delay to ensure header is fully rendered with all CSS
                setTimeout(setMainHeight, 50);
                window.addEventListener("resize", setMainHeight);
            }

            this.applySidebarState();

            // Enable transitions only after initial state is applied to avoid flash/animation on load
            setTimeout(() => {
                const aside = document.getElementById("layoutAside");
                if (aside) aside.classList.add("animate-transitions");
            }, 100);

            this.setActiveMenu();
            this.setupUserDisplay();
            this.refreshSession(); // Run in background after initial render
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
            }, 500); // Small delay to show spinner
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

            // Show UO instead of Role per user request
            if (rEl) {
                const uoValue = session.uo || "---";
                rEl.textContent = `UO - ${uoValue}`;
            }

            if (tEl) tEl.textContent = session.user;

            if (aEl) {
                aEl.innerHTML = `<i class='bx bx-user text-2xl text-[#003D5D]'></i>`;
            }
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
                        this.setupUserDisplay(); // Refresh UI with new data
                    }
                } else if (res.status === 401 || res.status === 404) {
                    // Token expired or invalid
                    if (typeof clearSession === 'function') clearSession();
                    window.location.href = "../login/index.html";
                }
            }
        } catch (e) {
            console.error("Background session validation failed:", e);
        }
    },

    setHeaderActions(html) { }
};

if (document.body) {
    Layout.init();
} else {
    document.addEventListener("DOMContentLoaded", () => Layout.init());
}
