/**
 * Componente de Toast Independente e Discreto
 * Auto-gerencia estilos, container e ciclo de vida.
 */

(function () {
    const styles = `
        #toastContainer {
            position: fixed;
            top: 1.5rem;
            right: 1.5rem;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            pointer-events: none;
        }

        .toast {
            pointer-events: auto;
            width: 280px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(8px);
            border-radius: 10px;
            padding: 0.75rem 1rem;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            border: 1px solid #f1f5f9;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            animation: toast-in 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toast-info { border-left: 3px solid #3b82f6; }
        .toast-success { border-left: 3px solid #10b981; }
        .toast-error { border-left: 3px solid #ef4444; }
        .toast-warning { border-left: 3px solid #f59e0b; }

        .toast-content {
            flex: 1;
            min-width: 0;
        }

        .toast-message {
            font-size: 11px;
            font-weight: 600;
            color: #1e293b;
            line-height: 1.4;
            margin: 0;
        }

        .toast-time {
            font-size: 9px;
            font-weight: 700;
            color: #94a3b8;
            margin-top: 2px;
            display: block;
        }

        @keyframes toast-in {
            from { opacity: 0; transform: translateY(-10px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .toast-out {
            opacity: 0;
            transform: translateX(20px);
        }
    `;

    // Injeta estilos se não existirem
    if (!document.getElementById('toast-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'toast-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    function showToast(msg, type = "info") {
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;

        const icons = {
            info: 'bx-info-circle text-blue-500',
            success: 'bx-check-circle text-emerald-500',
            error: 'bx-x-circle text-rose-500',
            warning: 'bx-error text-amber-500'
        };

        const now = new Date();
        const timestamp = now.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        toast.innerHTML = `
            <i class='bx ${icons[type] || icons.info} text-lg'></i>
            <div class="toast-content">
                <p class="toast-message">${msg}</p>
                <span class="toast-time">${timestamp}</span>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-out");
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }

    window.showToast = showToast;
})();
