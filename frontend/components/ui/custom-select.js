(function () {
    const _eventListeners = {};

    function _normalizeText(text) {
        if (!text) return '';
        return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    }

    function _fireChangeEvent(selectId) {
        if (_eventListeners[selectId]) {
            const currentValues = getCustomSelectValues(selectId);
            _eventListeners[selectId].forEach(callback => callback(currentValues));
        }
    }

    function _createActiveItem(text, isCounter = false) {
        const item = document.createElement(isCounter ? 'span' : 'a');
        item.className = 'flex items-center gap-1 bg-[#003D5D]/5 text-slate-600 text-[11px] font-semibold px-2 py-1 rounded-lg select-active-item transition-all border border-[#003D5D]/10';
        if (!isCounter) {
            item.classList.add('cursor-pointer', 'hover:bg-[#003D5D]/10', 'hover:text-[#003D5D]');
        }
        item.appendChild(document.createTextNode(text));

        if (!isCounter) {
            const removeIcon = document.createElement('i');
            removeIcon.className = 'flex items-center justify-center w-4 h-4 text-[#003D5D] rounded-full hover:bg-white/50 transition-colors';
            removeIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3 h-3 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`;
            item.appendChild(removeIcon);
            item.dataset.value = text;
        }
        return item;
    }

    function _createListItem(text, isSelected) {
        const item = document.createElement('li');
        item.className = `px-4 py-3 text-sm cursor-pointer rounded-xl flex items-center justify-between transition-all group ${isSelected ? 'bg-slate-50 text-[#003D5D] font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-[#003D5D] font-medium'}`;
        item.innerHTML = `
            <span class="truncate pr-4">${text}</span>
            ${isSelected ? `<i class='bx bx-check text-xl text-[#003D5D] flex-shrink-0'></i>` : `<i class='bx bx-check text-xl text-transparent group-hover:text-slate-300 flex-shrink-0'></i>`}
        `;
        item.dataset.value = text;
        return item;
    }

    function _updateDropdownMessages(selectContainer) {
        const list = selectContainer.querySelector('ul');
        const noResultsMessage = list.querySelector('.no-results-message');
        const selectId = selectContainer.dataset.selectId;
        const originalSelect = document.getElementById(selectId);

        const validOptions = Array.from(originalSelect.options).filter(o => o.value !== "" && !o.textContent.toLowerCase().includes("todas") && !o.textContent.toLowerCase().includes("todos"));
        const selectedOptions = validOptions.filter(o => o.selected);
        const selectedCount = selectedOptions.length;
        const tagsWrapper = selectContainer.querySelector('.tags-wrapper');

        noResultsMessage.classList.add('hidden');

        tagsWrapper.innerHTML = '';
        const placeholderSpan = selectContainer.querySelector('.placeholder-hint');

        if (selectedCount === 0) {
            if (placeholderSpan) placeholderSpan.classList.remove('opacity-0', 'invisible');
        } else if (selectedCount === validOptions.length) {
            if (placeholderSpan) placeholderSpan.classList.add('opacity-0', 'invisible');
            const allSelectedHint = document.createElement('div');
            allSelectedHint.className = 'text-slate-400 text-[12px] italic font-medium tracking-wide all-selected-hint px-1 flex items-center h-full';
            allSelectedHint.textContent = 'Todos os itens selecionados';
            tagsWrapper.appendChild(allSelectedHint);
        } else if (selectedCount > 3) {
            if (placeholderSpan) placeholderSpan.classList.add('opacity-0', 'invisible');
            tagsWrapper.appendChild(_createActiveItem(`${selectedCount} valores selecionados`, true));
        } else {
            if (placeholderSpan) placeholderSpan.classList.add('opacity-0', 'invisible');
            selectedOptions.forEach(opt => {
                tagsWrapper.appendChild(_createActiveItem(opt.textContent));
            });
        }
    }

    function _updateDropdownResults(selectContainer, searchTerm = '') {
        const list = selectContainer.querySelector('ul');
        const selectId = selectContainer.dataset.selectId;
        const originalSelect = document.getElementById(selectId);
        const normalizedSearch = _normalizeText(searchTerm);

        list.querySelectorAll('li:not(.no-results-message)').forEach(li => li.remove());

        const validOptions = Array.from(originalSelect.options).filter(o => o.value !== "" && !o.textContent.toLowerCase().includes("todas") && !o.textContent.toLowerCase().includes("todos"));

        // Detectar se todas as opções são numéricas
        const isNumeric = validOptions.every(o => !isNaN(typeof parseMoeda === 'function' ? parseMoeda(o.textContent) : parseFloat(o.textContent)));

        const sortedOptions = [...validOptions].sort((a, b) => {
            if (isNumeric) {
                const parse = typeof parseMoeda === 'function' ? parseMoeda : parseFloat;
                return parse(b.textContent) - parse(a.textContent);
            }
            return a.textContent.localeCompare(b.textContent, 'pt');
        });

        const filtered = sortedOptions.filter(o =>
            _normalizeText(o.textContent).includes(normalizedSearch)
        );

        const fragment = document.createDocumentFragment();

        if (filtered.length > 0) {
            filtered.forEach(option => {
                const li = _createListItem(option.textContent, option.selected);
                fragment.appendChild(li);
            });
        }



        list.appendChild(fragment);

        const noResultsMessage = list.querySelector('.no-results-message');
        noResultsMessage.classList.toggle('hidden', filtered.length > 0 || searchTerm.length === 0);

        _updateDropdownMessages(selectContainer);
    }

    function _toggleDropdown(selectContainer, forceClose = false) {
        const dropdownPanel = selectContainer.querySelector('.dropdown-panel');
        const arrow = selectContainer.querySelector('.arrow-icon');
        const searchInput = selectContainer.querySelector('.search-input');
        const selectionArea = selectContainer.querySelector('.selection-area');

        if (forceClose || selectContainer.classList.contains('is-open')) {
            selectContainer.classList.remove('is-open');
            dropdownPanel.classList.add('scale-75', 'opacity-0', 'invisible');
            dropdownPanel.classList.remove('scale-100', 'opacity-100', 'visible', 'translate-y-2');
            if (arrow.querySelector('.bx')) {
                arrow.querySelector('.bx').classList.remove('rotate-180');
            }
            selectionArea.classList.remove('border-[#003D5D]', 'ring-4', 'ring-[#003D5D]/10');
        } else {
            document.querySelectorAll('.custom-select-container.is-open').forEach(openSelect => {
                _toggleDropdown(openSelect, true);
            });
            selectContainer.classList.add('is-open');
            dropdownPanel.classList.remove('scale-75', 'opacity-0', 'invisible');
            dropdownPanel.classList.add('scale-100', 'opacity-100', 'visible', 'translate-y-2');
            if (arrow.querySelector('.bx')) {
                arrow.querySelector('.bx').classList.add('rotate-180');
            }
            selectionArea.classList.add('border-[#003D5D]', 'ring-4', 'ring-[#003D5D]/10');

            // Dynamic Positioning - Flyout to the right
            const rect = selectionArea.getBoundingClientRect();
            let top = rect.top;
            const dropdownHeight = 400;
            const dropdownWidth = 320;

            if (top + dropdownHeight > window.innerHeight) {
                top = window.innerHeight - dropdownHeight - 16;
            }
            if (top < 16) top = 16;

            dropdownPanel.style.top = top + 'px';
            dropdownPanel.style.left = (rect.right + 12) + 'px';
            dropdownPanel.style.width = dropdownWidth + 'px';
            dropdownPanel.style.transformOrigin = 'left center';

            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.focus();
            }
        }
    }

    window.renderSkeletonSelect = function (selectId) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;

        const parent = selectElement.parentElement;
        if (parent.querySelector(`.skeleton-select[data-select-id="${selectId}"]`)) return;

        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-select relative w-full h-[40px] rounded-xl bg-slate-100 animate-pulse border-2 border-slate-100';
        skeleton.dataset.selectId = selectId;

        const inner = document.createElement('div');
        inner.className = 'absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-200 rounded-lg';
        skeleton.appendChild(inner);

        selectElement.style.display = 'none';
        parent.insertBefore(skeleton, selectElement);
    };

    window.createCustomSelect = function (selectId) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) { console.error(`Elemento com ID "${selectId}" não encontrado.`); return; }

        const parent = selectElement.parentElement;

        // Remove skeleton or old container
        const skeleton = parent.querySelector(`.skeleton-select[data-select-id="${selectId}"]`);
        if (skeleton) skeleton.remove();

        const oldContainer = parent.querySelector(`.custom-select-container[data-select-id="${selectId}"]`);
        if (oldContainer) oldContainer.remove();

        const selectContainer = document.createElement('div');
        selectContainer.className = 'relative w-full custom-select-container';
        selectContainer.dataset.selectId = selectId;

        const activeSelection = document.createElement('div');
        activeSelection.className = `selection-area relative w-full rounded-2xl border-2 border-slate-200 bg-white shadow-sm outline-none transition-all duration-300 min-h-[44px] cursor-pointer hover:border-[#003D5D]/50 flex items-center pr-10 overflow-hidden`;
        activeSelection.tabIndex = 0;

        const tagsWrapperContainer = document.createElement('div');
        tagsWrapperContainer.className = 'flex-1 pl-3 h-full flex items-center';

        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'flex flex-wrap items-center gap-1.5 tags-wrapper w-full';
        tagsWrapperContainer.appendChild(tagsWrapper);

        const dropdownPanel = document.createElement('div');
        dropdownPanel.className = 'dropdown-panel fixed z-[10001] bg-white/95 backdrop-blur-xl border-2 border-slate-100 rounded-3xl shadow-2xl shadow-[#003D5D]/10 origin-top-left transform scale-75 opacity-0 invisible transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col overflow-hidden w-auto min-w-[300px] max-w-[450px]';

        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'p-3 border-b border-slate-100 z-10 relative shrink-0 bg-slate-50/50';
        const searchInputContainer = document.createElement('div');
        searchInputContainer.className = 'relative flex items-center';
        const searchIcon = document.createElement('i');
        searchIcon.className = 'bx bx-search absolute left-4 text-slate-400 text-lg pointer-events-none transition-colors duration-300 focus-within:text-[#003D5D]';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Pesquisar opções...';
        searchInput.className = `w-full pl-10 pr-10 py-2.5 text-[13px] font-bold text-slate-700 bg-white border-2 border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-[#003D5D]/5 focus:border-[#003D5D] transition-all search-input placeholder-slate-400`;
        const clearSearchBtn = document.createElement('div');
        clearSearchBtn.className = 'hidden absolute right-4 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer flex items-center justify-center p-1';
        clearSearchBtn.innerHTML = `<i class='bx bxs-x-circle text-lg'></i>`;

        searchInputContainer.append(searchIcon, searchInput, clearSearchBtn);
        searchWrapper.append(searchInputContainer);

        const listWrapper = document.createElement('div');
        listWrapper.className = 'max-h-[300px] overflow-y-auto pr-1 p-2 flex-1';

        const listElement = document.createElement('ul');
        listElement.className = 'flex flex-col gap-1';

        const noResultsMessage = document.createElement('li');
        noResultsMessage.className = 'no-results-message hidden flex flex-col items-center justify-center py-8 text-slate-400';
        noResultsMessage.innerHTML = `<i class='bx bx-ghost text-4xl mb-2 opacity-50'></i><span class="text-xs font-bold uppercase tracking-wider">Nenhum resultado</span>`;
        listElement.appendChild(noResultsMessage);

        const placeholderSpan = document.createElement('span');
        placeholderSpan.className = 'absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[13px] transition-opacity duration-200 pointer-events-none placeholder-hint';
        placeholderSpan.textContent = selectElement.dataset.placeholder || 'Todos';

        const arrow = document.createElement('div');
        arrow.className = 'arrow-icon absolute right-3 top-1/2 -translate-y-1/2 pl-3 transition-transform duration-300 pointer-events-none flex items-center h-8';
        arrow.innerHTML = `<i class='bx bx-chevron-down text-[22px] text-slate-400 transition-transform duration-300 transform'></i>`;

        activeSelection.append(placeholderSpan, tagsWrapperContainer, arrow);

        const dropdownFooter = document.createElement('div');
        dropdownFooter.className = 'dropdown-footer p-3 px-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'select-all-btn text-xs font-bold text-[#003D5D] hover:opacity-80 transition-colors uppercase';
        selectAllBtn.textContent = 'Selecionar Todos';
        selectAllBtn.onclick = (e) => {
            e.stopPropagation();
            const searchTerm = _normalizeText(searchInput.value);
            const validOptions = Array.from(selectElement.options).filter(o => o.value !== "" && !o.textContent.toLowerCase().includes("todas/todos"));
            const filtered = validOptions.filter(o => _normalizeText(o.textContent).includes(searchTerm));

            filtered.forEach(o => o.selected = true);
            _updateDropdownResults(selectContainer, searchInput.value);
            _fireChangeEvent(selectId);
        };

        const clearAllBtn = document.createElement('button');
        clearAllBtn.className = 'clear-filter-btn text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase';
        clearAllBtn.textContent = 'Limpar Seleção';
        clearAllBtn.onclick = (e) => {
            e.stopPropagation();
            Array.from(selectElement.options).forEach(o => o.selected = false);
            _updateDropdownResults(selectContainer, searchInput.value);
            _fireChangeEvent(selectId);
        };

        dropdownFooter.append(selectAllBtn, clearAllBtn);

        listWrapper.appendChild(listElement);
        dropdownPanel.append(searchWrapper, listWrapper, dropdownFooter);
        selectContainer.append(activeSelection, dropdownPanel);

        _updateDropdownResults(selectContainer, '');

        selectElement.style.display = 'none';
        parent.insertBefore(selectContainer, selectElement);

        searchInput.addEventListener('input', () => {
            _updateDropdownResults(selectContainer, searchInput.value);
            clearSearchBtn.classList.toggle('hidden', searchInput.value.length === 0);
        });

        clearSearchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.focus();
        });

        searchWrapper.addEventListener('click', e => e.stopPropagation());
    };

    window.getCustomSelectValues = function (selectId) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return [];
        const validOptions = Array.from(selectElement.options).filter(o => o.value !== "" && !o.textContent.toLowerCase().includes("todas") && !o.textContent.toLowerCase().includes("todos"));
        const selected = validOptions.filter(o => o.selected);
        if (selected.length === validOptions.length || selected.length === 0) {
            return [];
        }
        return selected.map(o => o.value);
    };

    window.onCustomSelectChange = function (selectId, callback) {
        if (!document.getElementById(selectId) || typeof callback !== 'function') return;
        if (!_eventListeners[selectId]) _eventListeners[selectId] = [];
        _eventListeners[selectId].push(callback);
    };

    window.clearCustomSelect = function (selectId) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;
        const container = document.querySelector(`.custom-select-container[data-select-id="${selectId}"]`);
        if (!container) return;

        Array.from(selectElement.options).forEach(o => o.selected = false);
        _updateDropdownResults(container, container.querySelector('.search-input')?.value || '');
    };

    window.selectAllCustomSelect = function (selectId) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;
        const container = document.querySelector(`.custom-select-container[data-select-id="${selectId}"]`);
        if (!container) return;

        const validOptions = Array.from(selectElement.options).filter(o => o.value !== "" && !o.textContent.toLowerCase().includes("todas") && !o.textContent.toLowerCase().includes("todos"));
        validOptions.forEach(o => o.selected = true);

        _updateDropdownResults(container, container.querySelector('.search-input')?.value || '');
        _fireChangeEvent(selectId);
    };

    window.setCustomSelectOptions = function (selectId, values) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;

        const previouslySelected = new Set(
            Array.from(selectElement.options)
                .filter(o => o.selected)
                .map(o => o.value)
        );

        selectElement.innerHTML = '';
        values.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            if (previouslySelected.has(val)) opt.selected = true;
            selectElement.appendChild(opt);
        });

        createCustomSelect(selectId);

        if (_eventListeners[selectId]) {
            const newListeners = _eventListeners[selectId].slice();
            _eventListeners[selectId] = [];
            newListeners.forEach(cb => {
                if (!_eventListeners[selectId]) _eventListeners[selectId] = [];
                _eventListeners[selectId].push(cb);
            });
        }
    };

    document.addEventListener('click', function (e) {
        const selectContainer = e.target.closest('.custom-select-container');

        if (!selectContainer) {
            document.querySelectorAll('.custom-select-container.is-open').forEach(sc => _toggleDropdown(sc, true));
            return;
        }

        const selectId = selectContainer.dataset.selectId;
        const originalSelect = document.getElementById(selectId);

        if (e.target.closest('.select-active-item')) {
            const activeItem = e.target.closest('.select-active-item');
            if (activeItem.tagName === 'SPAN') {
                e.stopPropagation();
                _toggleDropdown(selectContainer);
                return;
            }
            const itemText = activeItem.dataset.value;
            const option = Array.from(originalSelect.options).find(o => o.textContent === itemText);
            if (option) option.selected = false;

            _updateDropdownResults(selectContainer, selectContainer.querySelector('.search-input')?.value || '');
            _fireChangeEvent(selectId);
            e.stopPropagation();
            return;
        }

        if (e.target.closest('li:not(.no-results-message)')) {
            const listItem = e.target.closest('li:not(.no-results-message)');
            const itemText = listItem.dataset.value;
            const option = Array.from(originalSelect.options).find(o => o.textContent === itemText);
            if (option) {
                option.selected = !option.selected;
            }

            _updateDropdownResults(selectContainer, selectContainer.querySelector('.search-input')?.value || '');
            _fireChangeEvent(selectId);
            return;
        }

        if (e.target.closest('.selection-area')) {
            _toggleDropdown(selectContainer);
        }
    });
})();