(function () {
    function _getLabel(selectEl) {
        const opt = Array.from(selectEl.options).find(o => o.selected) || selectEl.options[0];
        return opt ? opt.textContent : '';
    }

    function _buildContainer(selectEl) {
        const selectId = selectEl.id;
        const parent = selectEl.parentElement;

        const old = parent.querySelector(`.admin-select-container[data-select-id="${selectId}"]`);
        if (old) old.remove();

        const container = document.createElement('div');
        container.className = 'relative w-full admin-select-container';
        container.dataset.selectId = selectId;

        const trigger = document.createElement('div');
        trigger.className = 'selection-area relative w-full rounded-2xl border-2 border-border bg-slate-50 outline-none transition-all duration-200 min-h-[52px] cursor-pointer hover:border-[#003D5D]/50 flex items-center px-5 gap-3 group';
        trigger.tabIndex = 0;

        const labelEl = document.createElement('span');
        labelEl.className = 'flex-1 text-[13px] font-medium text-slate-700 truncate select-label';
        labelEl.textContent = _getLabel(selectEl);

        const arrow = document.createElement('i');
        arrow.className = 'bx bx-chevron-down text-xl text-slate-400 transition-transform duration-300 arrow-icon';

        trigger.append(labelEl, arrow);

        const panel = document.createElement('div');
        panel.className = 'dropdown-panel absolute z-50 top-full left-0 right-0 mt-1 bg-white border-2 border-slate-100 rounded-3xl shadow-2xl shadow-[#003D5D]/10 origin-top transform scale-95 opacity-0 invisible transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden';

        const listWrapper = document.createElement('div');
        listWrapper.className = 'max-h-[240px] overflow-y-auto p-2';

        const ul = document.createElement('ul');
        ul.className = 'flex flex-col gap-0.5';

        Array.from(selectEl.options).forEach(opt => {
            const li = document.createElement('li');
            const isSelected = opt.selected;
            li.className = `px-4 py-3 text-[13px] cursor-pointer rounded-xl flex items-center justify-between transition-all group/item ${isSelected ? 'bg-[#003D5D]/5 text-[#003D5D] font-bold' : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-[#003D5D]'}`;
            li.dataset.value = opt.value;
            li.innerHTML = `
                <span class="truncate pr-4">${opt.textContent}</span>
                <i class='bx bx-check text-xl ${isSelected ? 'text-[#003D5D]' : 'text-transparent group-hover/item:text-slate-300'} flex-shrink-0'></i>
            `;
            ul.appendChild(li);
        });

        listWrapper.appendChild(ul);
        panel.appendChild(listWrapper);
        container.append(trigger, panel);

        selectEl.style.display = 'none';
        parent.insertBefore(container, selectEl);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = container.classList.contains('is-open');

            document.querySelectorAll('.admin-select-container.is-open').forEach(c => _close(c));

            if (!isOpen) _open(container);
        });

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
            if (e.key === 'Escape') _close(container);
        });

        ul.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li) return;
            const val = li.dataset.value;
            selectEl.value = val;
            container.querySelector('.select-label').textContent = _getLabel(selectEl);
            _close(container);
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    function _open(container) {
        container.classList.add('is-open');
        const panel = container.querySelector('.dropdown-panel');
        const arrow = container.querySelector('.arrow-icon');
        panel.classList.remove('scale-95', 'opacity-0', 'invisible');
        panel.classList.add('scale-100', 'opacity-100', 'visible');
        arrow.classList.add('rotate-180');
        container.querySelector('.selection-area').classList.add('border-[#003D5D]', 'ring-4', 'ring-[#003D5D]/10', 'bg-white');
    }

    function _close(container) {
        container.classList.remove('is-open');
        const panel = container.querySelector('.dropdown-panel');
        const arrow = container.querySelector('.arrow-icon');
        panel.classList.add('scale-95', 'opacity-0', 'invisible');
        panel.classList.remove('scale-100', 'opacity-100', 'visible');
        arrow.classList.remove('rotate-180');
        container.querySelector('.selection-area').classList.remove('border-[#003D5D]', 'ring-4', 'ring-[#003D5D]/10', 'bg-white');
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.admin-select-container.is-open').forEach(c => _close(c));
    });

    window.createAdminSelect = function (selectId) {
        const el = document.getElementById(selectId);
        if (!el) return;
        _buildContainer(el);
    };

    window.getAdminSelectValue = function (selectId) {
        const el = document.getElementById(selectId);
        return el ? el.value : '';
    };

    window.setAdminSelectValue = function (selectId, value) {
        const el = document.getElementById(selectId);
        if (!el) return;
        el.value = value;
        const container = el.parentElement?.querySelector(`.admin-select-container[data-select-id="${selectId}"]`);
        if (container) {
            container.querySelector('.select-label').textContent = el.options[el.selectedIndex]?.textContent || '';
        }
    };
})();
