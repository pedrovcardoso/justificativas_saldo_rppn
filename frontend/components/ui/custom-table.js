(function () {
    let activeFilters = {};
    const CONFIG = { primaryColor: '#003D5D' };

    function closeOpenFilterMenu() {
        const existingMenu = document.querySelector('.table-filter-menu');
        if (existingMenu) existingMenu.remove();
    }

    window.getActiveTableFilters = () => activeFilters;

    function applyTableFilters(table) {
        window.dispatchEvent(new CustomEvent('tableFiltersChanged'));
    }

    function openFilterMenu(triggerElement, table) {
        closeOpenFilterMenu();
        const key = triggerElement.dataset.key;
        const headerCell = triggerElement.closest('th');

        let customValues = null;
        try {
            if (table.dataset.globalValues) {
                customValues = JSON.parse(table.dataset.globalValues);
            }
        } catch (e) { }

        let values;
        if (customValues && customValues[key]) {
            values = new Set(customValues[key]);
        } else {
            values = new Set();
            table.querySelectorAll('tbody tr').forEach(row => {
                const cell = row.querySelector(`td[data-key="${key}"]`);
                if (cell && cell.dataset.value) {
                    cell.dataset.value.split('||').forEach(val => val && values.add(val));
                }
            });
        }
        const sortedValues = [...values].sort((a, b) => a.localeCompare(b, 'pt'));

        const menu = document.createElement('div');
        menu.className = 'table-filter-menu absolute top-full left-0 mt-2 z-50 w-72 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 p-2 flex flex-col max-h-80 animate-in fade-in zoom-in-95 duration-200';

        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'relative mb-2';
        searchWrapper.innerHTML = `
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i class="bx bx-search text-slate-400"></i>
            </div>
            <input type="text" placeholder="Pesquisar..." class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[${CONFIG.primaryColor}]">
        `;

        const listContainer = document.createElement('div');
        listContainer.className = 'flex-1 overflow-y-auto pr-1';

        const currentFilterValues = activeFilters[key] || [];
        let htmlStr = '';
        sortedValues.forEach(value => {
            const isChecked = currentFilterValues.includes(value);
            htmlStr += `
                <label class="flex items-center p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} value="${value}" class="peer hidden">
                    
                    <div class="mr-3 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border-2 border-slate-300 peer-checked:border-[${CONFIG.primaryColor}] peer-checked:bg-[${CONFIG.primaryColor}] transition duration-150">
                        <svg class="${isChecked ? '' : 'hidden'} h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>

                    <span class="line-clamp-2 text-sm text-left font-semibold">${value}</span>
                </label>`;
        });
        listContainer.innerHTML = htmlStr;

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'flex items-center justify-between pt-2 border-t border-slate-200 mt-1';
        actionsContainer.innerHTML = `
            <button class="select-all-btn text-sm text-[${CONFIG.primaryColor}] hover:opacity-80 transition-colors">Selecionar Todos</button>
            <button class="clear-filter-btn text-sm text-slate-500 hover:text-slate-800 transition-colors">Limpar Filtro</button>
        `;

        menu.append(searchWrapper, listContainer, actionsContainer);
        headerCell.appendChild(menu);

        menu.addEventListener('click', e => e.stopPropagation());
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
        const searchInput = searchWrapper.querySelector('input');
        const filterIcon = triggerElement.querySelector('.filter-icon');

        listContainer.querySelectorAll('.peer').forEach(peer => {
            const customBox = peer.nextElementSibling;
            const svg = customBox.querySelector('svg');
            peer.addEventListener('change', () => {
                svg.classList.toggle('hidden', !peer.checked);
            });
            svg.classList.toggle('hidden', !peer.checked);
        });

        const updateFilterState = () => {
            const selectedValues = [...checkboxes].filter(cb => cb.checked).map(cb => cb.value);
            activeFilters[key] = selectedValues;
            const allOptionsCount = checkboxes.length;
            const hasActiveFilter = selectedValues.length > 0 && selectedValues.length < allOptionsCount;
            filterIcon.className = hasActiveFilter ? `bx bxs-filter-alt filter-icon text-[${CONFIG.primaryColor}]` : 'bx bx-filter filter-icon';
            if (!hasActiveFilter) delete activeFilters[key];
            applyTableFilters(table);
        };

        checkboxes.forEach(cb => cb.addEventListener('change', updateFilterState));
        menu.querySelector('.clear-filter-btn').addEventListener('click', () => {
            checkboxes.forEach(cb => {
                cb.checked = false;
                cb.nextElementSibling.querySelector('svg').classList.add('hidden');
            });
            updateFilterState();
        });
        menu.querySelector('.select-all-btn').addEventListener('click', () => {
            const isAnyUnchecked = [...checkboxes].some(cb => !cb.checked);
            checkboxes.forEach(cb => {
                cb.checked = isAnyUnchecked;
                cb.nextElementSibling.querySelector('svg').classList.toggle('hidden', !isAnyUnchecked);
            });
            updateFilterState();
        });
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            listContainer.querySelectorAll('label').forEach(label => {
                const text = label.querySelector('span').textContent.toLowerCase();
                label.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });
    }

    window.initializeTableFilters = function (tableId, config = {}) {
        const tableContainer = document.getElementById(tableId);
        const table = tableContainer ? tableContainer.querySelector('table') : null;
        if (!table) return;

        if (config && config.globalValues) {
            table.dataset.globalValues = JSON.stringify(config.globalValues);
        }
        if (table.dataset.filtersInitialized === 'true') return;
        table.dataset.filtersInitialized = 'true';

        table.addEventListener('click', function (e) {
            const trigger = e.target.closest('.table-filter-trigger');
            if (trigger) {
                e.stopPropagation();
                if (trigger.closest('th').querySelector('.table-filter-menu')) {
                    closeOpenFilterMenu();
                } else {
                    openFilterMenu(trigger, table);
                }
            }
        });
        document.addEventListener('click', closeOpenFilterMenu);

        window.addEventListener('clearAllFilters', () => {
            activeFilters = {};
            table.querySelectorAll('.filter-icon').forEach(icon => {
                icon.className = 'bx bx-filter filter-icon';
                icon.style.color = '';
            });
        });
    };

    window.initializeTableResizing = function (tableId) {
        const tableContainer = document.getElementById(tableId);
        const table = tableContainer ? tableContainer.querySelector('table') : null;
        if (!table) return;

        const headers = table.querySelectorAll('thead th');

        headers.forEach((header, index) => {
            if (index === headers.length - 1) {
                return;
            }

            if (header.querySelector('.resize-handle')) return;

            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle cursor-col-resize absolute top-0 bottom-0 w-[4px] z-10 transition-colors hover:bg-[#003D5D]/20';
            resizeHandle.style.right = '-2px';

            header.appendChild(resizeHandle);

            resizeHandle.addEventListener('mousedown', function (e) {
                e.stopPropagation();
                e.preventDefault();

                const startX = e.pageX;
                const startWidth = header.offsetWidth;

                const handleMouseMove = (moveEvent) => {
                    const deltaX = moveEvent.pageX - startX;
                    const newWidth = startWidth + deltaX;
                    const minWidth = 50;
                    if (newWidth > minWidth) {
                        header.style.width = newWidth + 'px';
                        header.style.minWidth = newWidth + 'px';
                    }
                };

                const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
        });
    };

    window.initializeTableReordering = function (tableId) {
        const tableContainer = document.getElementById(tableId);
        const table = tableContainer ? tableContainer.querySelector('table') : null;
        if (!table) return;

        let sourceTh = null;
        let sourceIndex = -1;
        let cloneTh = null;
        let dropMarker = null;

        table.querySelectorAll('thead th .table-span-header').forEach(spanHeader => {
            const th = spanHeader.closest('th');
            if (th && !th.classList.contains('reorder-init')) {
                th.classList.add('reorder-init');
                spanHeader.classList.add('cursor-grab', 'active:cursor-grabbing');

                spanHeader.addEventListener('mousedown', (e) => {
                    if (e.target.closest('.table-filter-trigger') || e.target.closest('.resize-handle')) {
                        return;
                    }
                    e.preventDefault();

                    sourceTh = th;
                    sourceIndex = Array.from(sourceTh.parentElement.children).indexOf(sourceTh);

                    sourceTh.classList.add('opacity-50');

                    createClone(e);
                    createDropMarker();

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp, { once: true });
                });
            }
        });

        function createClone(e) {
            cloneTh = sourceTh.cloneNode(true);
            cloneTh.classList.add(
                'absolute', 'z-[1000]', 'pointer-events-none',
                'bg-white', 'shadow-xl', 'border', 'border-slate-200'
            );

            cloneTh.style.width = `${sourceTh.offsetWidth}px`;
            cloneTh.style.height = `${sourceTh.offsetHeight}px`;
            document.body.appendChild(cloneTh);
            updateClonePosition(e);
        }

        function createDropMarker() {
            dropMarker = document.createElement('div');
            dropMarker.className = 'absolute z-[100] w-1 bg-[#003D5D] hidden h-[500px] pointer-events-none';
            document.body.appendChild(dropMarker);
        }

        function handleMouseMove(e) {
            if (!cloneTh) return;
            document.body.classList.add('cursor-grabbing', 'select-none');
            updateClonePosition(e);
            updateDropMarker(e);
        }

        function updateClonePosition(e) {
            cloneTh.style.left = `${e.pageX - cloneTh.offsetWidth / 2}px`;
            cloneTh.style.top = `${e.pageY - cloneTh.offsetHeight / 2}px`;
        }

        function updateDropMarker(e) {
            const headers = Array.from(table.querySelectorAll('thead th'));
            let targetTh = null;
            let insertBefore = false;

            for (const th of headers) {
                if (th === sourceTh) continue;
                const rect = th.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                if (e.clientX >= rect.left && e.clientX <= rect.right) {
                    targetTh = th;
                    insertBefore = e.clientX < midX;
                    break;
                }
            }

            if (targetTh) {
                const rect = targetTh.getBoundingClientRect();
                const markerX = insertBefore ? rect.left : rect.right;
                dropMarker.style.top = `${rect.top + window.scrollY}px`;
                dropMarker.style.left = `${markerX + window.scrollX - 0.5}px`;
                dropMarker.style.height = `${table.offsetHeight}px`;
                dropMarker.classList.remove('hidden');
            } else {
                dropMarker.classList.add('hidden');
            }
        }

        function handleMouseUp(e) {
            if (!sourceTh) return;
            const headers = Array.from(sourceTh.parentElement.children);
            let targetTh = null;
            let insertBefore = false;

            for (const th of headers) {
                if (th === sourceTh) continue;
                const rect = th.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right) {
                    targetTh = th;
                    insertBefore = e.clientX < (rect.left + rect.width / 2);
                    break;
                }
            }

            if (targetTh) {
                const targetIndex = headers.indexOf(targetTh);
                reorderTable(sourceIndex, targetIndex, insertBefore);
            }
            cleanup();
        }

        function reorderTable(fromIndex, toIndex, insertBefore) {
            if (fromIndex === toIndex || (fromIndex === toIndex - 1 && !insertBefore)) return;
            table.querySelectorAll('tr').forEach(row => {
                const cells = Array.from(row.children);
                const sourceCell = cells[fromIndex];
                const targetCell = cells[toIndex];
                if (insertBefore) row.insertBefore(sourceCell, targetCell);
                else row.insertBefore(sourceCell, targetCell.nextElementSibling);
            });
        }

        function cleanup() {
            if (sourceTh) sourceTh.classList.remove('opacity-50');
            if (cloneTh) cloneTh.remove();
            if (dropMarker) dropMarker.remove();
            document.body.classList.remove('cursor-grabbing', 'select-none');
            sourceTh = cloneTh = dropMarker = null;
            sourceIndex = -1;
            document.removeEventListener('mousemove', handleMouseMove);
        }
    };

    window.initializeColumnVisibility = function (tableId, triggerBtnId) {
        const tableContainer = document.getElementById(tableId);
        const table = tableContainer ? tableContainer.querySelector('table') : null;
        const triggerBtn = document.getElementById(triggerBtnId);
        if (!table || !triggerBtn) return;

        function closeMenu() {
            const existingMenu = document.querySelector('.column-visibility-menu');
            if (existingMenu) existingMenu.remove();
        }

        triggerBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const existingMenu = document.querySelector('.column-visibility-menu');
            if (existingMenu) {
                closeMenu();
                return;
            }

            const headers = Array.from(table.querySelectorAll('thead th')).slice(0, -1);
            const menu = document.createElement('div');
            menu.className = 'column-visibility-menu absolute mt-2 z-50 w-72 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 p-2 flex flex-col max-h-80 transition-all animate-in fade-in zoom-in-95 duration-200';

            const rect = triggerBtn.getBoundingClientRect();
            menu.style.top = `${rect.bottom + window.scrollY}px`;
            menu.style.left = `${Math.max(10, rect.right + window.scrollX - 288)}px`;

            const searchWrapper = document.createElement('div');
            searchWrapper.className = 'relative mb-2';
            searchWrapper.innerHTML = `
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="bx bx-search text-slate-400"></i>
                </div>
                <input type="text" placeholder="Pesquisar colunas..." class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[${CONFIG.primaryColor}]">
            `;

            const listContainer = document.createElement('div');
            listContainer.className = 'flex-1 overflow-y-auto pr-1 flex flex-col gap-0.5';

            headers.forEach((th, index) => {
                const labelText = th.querySelector('.table-span-header')?.textContent || th.textContent.trim();
                const isVisible = th.style.display !== 'none';

                const label = document.createElement('label');
                label.className = 'flex items-center p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isVisible;
                checkbox.className = 'peer hidden';

                const customBox = document.createElement('div');
                customBox.className = `mr-3 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border-2 border-slate-300 peer-checked:border-[${CONFIG.primaryColor}] peer-checked:bg-[${CONFIG.primaryColor}] transition duration-150`;
                customBox.innerHTML = `
                    <svg class="h-2.5 w-2.5 text-white ${isVisible ? '' : 'hidden'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;

                const span = document.createElement('span');
                span.className = 'line-clamp-1 text-sm text-left font-semibold';
                span.textContent = labelText;

                label.append(checkbox, customBox, span);
                listContainer.appendChild(label);

                checkbox.addEventListener('change', () => {
                    const svg = customBox.querySelector('svg');
                    svg.classList.toggle('hidden', !checkbox.checked);
                    const display = checkbox.checked ? '' : 'none';
                    th.style.display = display;
                    table.querySelectorAll(`tbody tr`).forEach(row => {
                        const cell = row.children[index];
                        if (cell) cell.style.display = display;
                    });
                });
            });

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'flex items-center justify-between pt-2 border-t border-slate-200 mt-1 px-1';
            actionsContainer.innerHTML = `
                <button class="select-all-btn text-xs font-bold text-[${CONFIG.primaryColor}] hover:opacity-80 transition-colors uppercase">Selecionar Todas</button>
                <button class="clear-filter-btn text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase">Limpar</button>
            `;

            menu.append(searchWrapper, listContainer, actionsContainer);
            document.body.appendChild(menu);

            const searchInput = searchWrapper.querySelector('input');
            searchInput.addEventListener('input', () => {
                const term = searchInput.value.toLowerCase();
                listContainer.querySelectorAll('label').forEach(label => {
                    const text = label.querySelector('span').textContent.toLowerCase();
                    label.style.display = text.includes(term) ? 'flex' : 'none';
                });
            });

            actionsContainer.querySelector('.select-all-btn').addEventListener('click', () => {
                const checkboxes = listContainer.querySelectorAll('input[type="checkbox"]');
                const isAnyUnchecked = [...checkboxes].some(cb => !cb.checked);
                checkboxes.forEach(cb => { if (cb.checked !== isAnyUnchecked) { cb.checked = isAnyUnchecked; cb.dispatchEvent(new Event('change')); } });
            });

            actionsContainer.querySelector('.clear-filter-btn').addEventListener('click', () => {
                const checkboxes = listContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => { if (cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change')); } });
            });

            menu.addEventListener('click', e => e.stopPropagation());
        });

        document.addEventListener('click', closeMenu);
    };
})();