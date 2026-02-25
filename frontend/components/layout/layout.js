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
                <div class="flex-1 flex flex-col h-screen overflow-hidden">
                    ${headerHTML}
                    <main id="layoutMain" class="flex-1 p-8 bg-[#F6F6F6] overflow-y-auto no-scrollbar">
                    </main>
                </div>
            `;

            const main = document.getElementById("layoutMain");
            if (originalContent) {
                main.appendChild(originalContent);
            }

            this.setActiveMenu();
            this.setupUserDisplay();
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
                // Highlighting active state with better visual contrast
                link.classList.remove("text-slate-400", "hover:bg-white/5", "hover:text-white");
                link.classList.add("bg-[#FED73A]", "text-[#003D5D]", "shadow-lg", "shadow-[#FED73A]/20");
                const icon = link.querySelector("i");
                if (icon) icon.classList.replace("group-hover:text-[#FED73A]", "text-[#003D5D]");
            }
        });
    },

    setupUserDisplay() {
        const session = typeof getSession === 'function' ? getSession() : null;
        if (session) {
            const uEl = document.getElementById("sidebarUser");
            const rEl = document.getElementById("sidebarRole");
            const aEl = document.getElementById("userAvatar");

            if (uEl) uEl.textContent = session.user;
            if (rEl) rEl.textContent = session.role || "Usuário";

            if (aEl) {
                // Fixed: Use icon instead of initials per user request
                aEl.innerHTML = `<i class='bx bx-user text-2xl text-[#003D5D]'></i>`;
            }
        }
    },

    setHeaderActions(html) { }
};

if (document.body) {
    Layout.init();
} else {
    document.addEventListener("DOMContentLoaded", () => Layout.init());
}
