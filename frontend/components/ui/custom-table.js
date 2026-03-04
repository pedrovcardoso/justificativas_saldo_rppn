(function () {
    let activeFilters = {};
    const CONFIG = { primaryColor: '#003D5D' };

    function closeOpenFilterMenu(e) {
        // Ignore scroll events originating from within the filter menu
        if (e && e.type === 'scroll' && e.target.closest && e.target.closest('.table-filter-menu')) {
            return;
        }
        const existingMenu = document.querySelector('.table-filter-menu');
        if (existingMenu) existingMenu.remove();
    }

    window.getActiveTableFilters = () => activeFilters;

    let currentSort = { key: null, direction: null };

    window.getActiveTableSort = () => currentSort;

    function applyTableFilters() {
        window.dispatchEvent(new CustomEvent('tableFiltersChanged'));
    }

    window.sortDataArray = function (data, key, direction) {
        if (!data || !data.length || !key || !direction) return data;

        const isNumeric = data.every(row => {
            const val = row[key];
            return val == null || val === '' || !isNaN(typeof parseMoeda === 'function' ? parseMoeda(val) : parseFloat(val));
        });

        return data.sort((a, b) => {
            const valA = a[key];
            const valB = b[key];
            if (valA == null || valA === '') return 1;
            if (valB == null || valB === '') return -1;

            if (isNumeric) {
                const parse = typeof parseMoeda === 'function' ? parseMoeda : parseFloat;
                return direction === 'asc' ? parse(valA) - parse(valB) : parse(valB) - parse(valA);
            }
            return direction === 'asc' ? String(valA).localeCompare(String(valB), 'pt') : String(valB).localeCompare(String(valA), 'pt');
        });
    };

    function _sortTable(table, key, direction) {
        const sourceData = window._tableFilteredData || [];
        if (!sourceData.length) return;

        currentSort = { key, direction };
        window.sortDataArray(sourceData, key, direction);

        table.querySelectorAll('.sort-indicator').forEach(el => el.innerHTML = '');
        const th = table.querySelector(`th .table-filter-trigger[data-key="${key}"]`)?.closest('th');
        if (th) {
            const indicator = th.querySelector('.sort-indicator');
            if (indicator) {
                indicator.innerHTML = `<i class='bx bx-chevron-${direction === 'asc' ? 'up' : 'down'} text-[14px] text-primary ml-1 pointer-events-auto cursor-pointer'></i>`;
            }
        }

        applyTableFilters();
    }

    function _getFilterableValues(key) {
        const source = window._tableFilteredData;
        if (source && Array.isArray(source)) {
            const values = new Set();
            source.forEach(row => {
                const val = row[key];
                if (val != null && val !== '') {
                    String(val).split('||').forEach(v => v && values.add(v));
                }
            });
            return values;
        }

        const table = document.querySelector('#stateTable table');
        const values = new Set();
        if (table) {
            table.querySelectorAll('tbody tr').forEach(row => {
                const cell = row.querySelector(`td[data-key="${key}"]`);
                if (cell && cell.dataset.value) {
                    cell.dataset.value.split('||').forEach(val => val && values.add(val));
                }
            });
        }
        return values;
    }

    function openFilterMenu(triggerElement, table) {
        closeOpenFilterMenu();
        const key = triggerElement.dataset.key;
        const headerCell = triggerElement.closest('th');

        const values = _getFilterableValues(key);

        const isNumeric = [...values].every(v => !isNaN(typeof parseMoeda === 'function' ? parseMoeda(v) : parseFloat(v)));

        const sortedValues = [...values].sort((a, b) => {
            if (isNumeric) {
                const parse = typeof parseMoeda === 'function' ? parseMoeda : parseFloat;
                return parse(b) - parse(a);
            }
            return a.localeCompare(b, 'pt');
        });

        const menu = document.createElement('div');
        menu.className = 'table-filter-menu fixed z-[9999] w-72 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 p-2 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden';
        menu.style.maxHeight = '40vh';
        menu.style.maxHeight = '40vh';

        const sortActions = document.createElement('div');
        sortActions.className = 'grid grid-cols-2 gap-2 p-1.5 mb-2 border-b border-slate-100 bg-slate-50/50 rounded-xl';

        const isAsc = currentSort.key === key && currentSort.direction === 'asc';
        const isDesc = currentSort.key === key && currentSort.direction === 'desc';

        sortActions.innerHTML = `
            <button class="sort-asc-btn flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase ${isAsc ? 'text-primary bg-white shadow-sm ring-1 ring-slate-100' : 'text-slate-500 hover:text-primary hover:bg-white'} rounded-lg transition-all">
                <i class="bx bx-sort-a-z text-sm"></i> Crescente
            </button>
            <button class="sort-desc-btn flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase ${isDesc ? 'text-primary bg-white shadow-sm ring-1 ring-slate-100' : 'text-slate-500 hover:text-primary hover:bg-white'} rounded-lg transition-all">
                <i class="bx bx-sort-z-a text-sm"></i> Decrescente
            </button>
        `;

        let rangeHtml = '';
        if (isNumeric) {
            const currentRange = activeFilters[key + '_range'] || { min: '', max: '' };
            rangeHtml = `
                <div class="p-2 pt-0 border-b border-slate-100">
                    <div class="grid grid-cols-2 gap-2">
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">MÍN</span>
                            <input type="number" step="any" placeholder="0.00" value="${currentRange.min}" class="range-min w-full pl-9 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-[${CONFIG.primaryColor}]">
                        </div>
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">MÁX</span>
                            <input type="number" step="any" placeholder="∞" value="${currentRange.max}" class="range-max w-full pl-9 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-[${CONFIG.primaryColor}]">
                        </div>
                    </div>
                </div>
            `;
        }

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
                <label class="flex items-center p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden">
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

        if (rangeHtml) {
            const rangeDiv = document.createElement('div');
            rangeDiv.innerHTML = rangeHtml;
            menu.appendChild(rangeDiv.firstElementChild);
        }
        menu.append(sortActions, searchWrapper, listContainer, actionsContainer);
        document.body.appendChild(menu);

        const triggerRect = triggerElement.getBoundingClientRect();
        const menuHeight = menu.offsetHeight || 300;
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
            menu.style.bottom = (window.innerHeight - triggerRect.top + 8) + 'px';
            menu.style.left = (triggerRect.left) + 'px';
        } else {
            menu.style.top = (triggerRect.bottom + 8) + 'px';
            menu.style.left = (triggerRect.left) + 'px';
        }

        menu.querySelector('.sort-asc-btn').addEventListener('click', () => { _sortTable(table, key, 'asc'); closeOpenFilterMenu(); });
        menu.querySelector('.sort-desc-btn').addEventListener('click', () => { _sortTable(table, key, 'desc'); closeOpenFilterMenu(); });

        menu.addEventListener('click', e => e.stopPropagation());
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
        const minInput = menu.querySelector('.range-min');
        const maxInput = menu.querySelector('.range-max');
        const searchInput = searchWrapper.querySelector('input');
        const filterIcon = triggerElement.querySelector('.filter-icon');

        const updateFilterState = () => {
            const selectedValues = [...checkboxes].filter(cb => cb.checked).map(cb => cb.value);
            activeFilters[key] = selectedValues;

            let hasRange = false;
            if (isNumeric) {
                const min = minInput.value;
                const max = maxInput.value;
                if (min !== '' || max !== '') {
                    activeFilters[key + '_range'] = { min, max };
                    hasRange = true;
                } else {
                    delete activeFilters[key + '_range'];
                }
            }

            const allOptionsCount = checkboxes.length;
            const hasActiveFilter = (selectedValues.length > 0 && selectedValues.length < allOptionsCount) || hasRange;
            filterIcon.className = hasActiveFilter ? `bx bxs-filter-alt filter-icon text-slate-400` : 'bx bx-filter filter-icon';

            triggerElement.classList.toggle('opacity-100', hasActiveFilter);
            triggerElement.classList.toggle('opacity-0', !hasActiveFilter);

            if (!hasActiveFilter) delete activeFilters[key];
            applyTableFilters();
        };

        checkboxes.forEach(cb => cb.addEventListener('change', updateFilterState));
        if (isNumeric) {
            minInput.addEventListener('input', updateFilterState);
            maxInput.addEventListener('input', updateFilterState);
        }

        menu.querySelector('.clear-filter-btn').addEventListener('click', () => {
            checkboxes.forEach(cb => {
                cb.checked = false;
                cb.nextElementSibling.querySelector('svg').classList.add('hidden');
            });
            if (currentSort.key === key) {
                currentSort = { key: null, direction: null };
                table.querySelectorAll('.sort-indicator').forEach(el => el.innerHTML = '');
            }
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

    window.initializeTableFilters = function (tableId) {
        const tableContainer = document.getElementById(tableId);
        const table = tableContainer ? tableContainer.querySelector('table') : null;
        if (!table) return;

        if (table.dataset.filtersInitialized === 'true') return;
        table.dataset.filtersInitialized = 'true';

        table.addEventListener('click', function (e) {
            const trigger = e.target.closest('.table-filter-trigger');
            const sortIndicator = e.target.closest('.sort-indicator');

            if (sortIndicator) {
                e.stopPropagation();
                const key = sortIndicator.closest('th').querySelector('.table-filter-trigger').dataset.key;
                const newDir = (currentSort.key === key && currentSort.direction === 'asc') ? 'desc' : 'asc';
                _sortTable(table, key, newDir);
                return;
            }

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
        window.addEventListener('scroll', closeOpenFilterMenu, true);
        window.addEventListener('resize', closeOpenFilterMenu);

        window.addEventListener('clearAllFilters', () => {
            activeFilters = {};
            currentSort = { key: null, direction: null };
            table.querySelectorAll('.sort-indicator').forEach(el => el.innerHTML = '');
            table.querySelectorAll('.filter-icon').forEach(icon => {
                icon.className = 'bx bx-filter filter-icon';
                icon.style.color = '';
            });
            table.querySelectorAll('.table-filter-trigger').forEach(trigger => {
                trigger.classList.add('opacity-0');
                trigger.classList.remove('opacity-100');
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
                    const maxWidth = window.innerWidth * 0.9;

                    if (newWidth > minWidth && newWidth < maxWidth) {
                        header.style.width = newWidth + 'px';
                        header.style.minWidth = newWidth + 'px';
                        header.style.maxWidth = newWidth + 'px';
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

        table.querySelectorAll('thead th .table-drag-handle').forEach(dragHandle => {
            const th = dragHandle.closest('th');
            if (th && !th.classList.contains('reorder-init')) {
                th.classList.add('reorder-init');

                dragHandle.addEventListener('mousedown', (e) => {
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
                const container = table.closest('.overflow-auto, .overflow-hidden') || table.parentElement;
                const containerRect = container.getBoundingClientRect();

                dropMarker.style.top = `${rect.top + window.scrollY}px`;
                dropMarker.style.left = `${markerX + window.scrollX - 0.5}px`;
                dropMarker.style.height = `${Math.min(table.offsetHeight, container.offsetHeight)}px`;
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

    window.initializeColumnVisibility = function (tableId, triggerBtnId, initialConfig = []) {
        const tableContainer = document.getElementById(tableId);
        const table = tableContainer ? tableContainer.querySelector('table') : null;
        const triggerBtn = document.getElementById(triggerBtnId);
        if (!table || !triggerBtn) return;

        if (triggerBtn.dataset.visibilityInitialized === 'true') return;
        triggerBtn.dataset.visibilityInitialized = 'true';

        const isEnhanced = Array.isArray(initialConfig) && initialConfig.length > 0;

        function closeMenu(e) {
            // Ignore scroll events originating from within the menu
            if (e && e.type === 'scroll' && e.target.closest && e.target.closest('.column-visibility-menu')) {
                return;
            }
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

            const parent = triggerBtn.parentElement;
            if (parent) parent.style.position = 'relative';

            const menu = document.createElement('div');
            menu.className = `column-visibility-menu fixed mt-2 z-[10000] ${isEnhanced ? 'w-[550px]' : 'w-[280px]'} bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 p-6 flex flex-col max-h-[400px] transition-all animate-in fade-in zoom-in-95 duration-200`;

            const btnRect = triggerBtn.getBoundingClientRect();
            menu.style.top = (btnRect.bottom + 8) + 'px';
            menu.style.right = (window.innerWidth - btnRect.right) + 'px';

            const searchWrapper = document.createElement('div');
            searchWrapper.className = 'relative mb-6';
            searchWrapper.innerHTML = `
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="bx bx-search text-slate-400"></i>
                </div>
                <input type="text" placeholder="${isEnhanced ? 'Pesquisar colunas...' : 'Pesquisar...'}" class="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[${CONFIG.primaryColor}]/10 focus:border-[${CONFIG.primaryColor}] transition-all shadow-sm">
            `;

            const listWrapper = document.createElement('div');
            listWrapper.className = 'flex-1 overflow-y-auto pr-1 flex flex-col min-h-0 custom-scrollbar';

            const tbody = document.createElement(isEnhanced ? 'tbody' : 'div');
            if (isEnhanced) {
                const listTable = document.createElement('table');
                listTable.className = 'w-full text-left border-collapse';
                listTable.innerHTML = `
                    <thead class="sticky top-0 bg-white z-10">
                        <tr class="border-b border-slate-100">
                            <th class="py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Visível</th>
                            <th class="py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/2">Nome Original</th>
                            <th class="py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Personalizado</th>
                        </tr>
                    </thead>
                `;
                tbody.className = 'divide-y divide-slate-50';
                listTable.appendChild(tbody);
                listWrapper.appendChild(listTable);
            } else {
                tbody.className = 'flex flex-col gap-1';
                listWrapper.appendChild(tbody);
            }

            const renderRows = () => {
                tbody.innerHTML = '';
                if (isEnhanced) {
                    initialConfig.forEach((conf, index) => {
                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-slate-50/80 transition-colors group cursor-move';
                        tr.draggable = true;
                        tr.dataset.index = index;

                        tr.innerHTML = `
                            <td class="py-3 px-3">
                                <div class="flex items-center gap-2">
                                    <i class='bx bx-grid-vertical text-slate-300 group-hover:text-slate-400'></i>
                                    <label class="flex items-center justify-center cursor-pointer">
                                        <input type="checkbox" ${conf.visible ? 'checked' : ''} class="peer hidden">
                                        <div class="h-5 w-5 rounded border-2 border-slate-300 peer-checked:border-[${CONFIG.primaryColor}] peer-checked:bg-[${CONFIG.primaryColor}] flex items-center justify-center transition-all shadow-sm">
                                            <i class="bx bx-check text-white text-sm ${conf.visible ? '' : 'hidden'}"></i>
                                        </div>
                                    </label>
                                </div>
                            </td>
                            <td class="py-3 px-3">
                                <span class="text-[11px] font-medium text-slate-400 break-all select-all">${conf.key}</span>
                            </td>
                            <td class="py-3 px-3">
                                <input type="text" value="${conf.label}" class="label-input w-full px-3 py-1.5 text-xs font-bold text-[#003D5D] border border-slate-200 rounded-lg outline-none focus:border-[${CONFIG.primaryColor}] focus:ring-2 focus:ring-[${CONFIG.primaryColor}]/5 transition-all">
                            </td>
                        `;

                        // Drag & Drop for Enhanced Mode
                        tr.addEventListener('dragstart', (e) => {
                            e.dataTransfer.setData('text/plain', index);
                            tr.classList.add('opacity-40');
                        });
                        tr.addEventListener('dragend', () => {
                            tr.classList.remove('opacity-40');
                            tbody.querySelectorAll('td').forEach(td => {
                                td.style.borderTop = '';
                                td.style.borderBottom = '';
                            });
                        });
                        tr.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            const rect = tr.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;

                            // Clear all row cells first
                            tbody.querySelectorAll('td').forEach(td => {
                                td.style.borderTop = '';
                                td.style.borderBottom = '';
                            });

                            const borderStyle = `2px solid ${CONFIG.primaryColor}`;
                            if (e.clientY < midY) {
                                Array.from(tr.cells).forEach(td => td.style.borderTop = borderStyle);
                            } else {
                                Array.from(tr.cells).forEach(td => td.style.borderBottom = borderStyle);
                            }
                        });
                        tr.addEventListener('dragleave', () => {
                            Array.from(tr.cells).forEach(td => {
                                td.style.borderTop = '';
                                td.style.borderBottom = '';
                            });
                        });
                        tr.addEventListener('drop', (e) => {
                            e.preventDefault();
                            Array.from(tr.cells).forEach(td => {
                                td.style.borderTop = '';
                                td.style.borderBottom = '';
                            });
                            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                            const rect = tr.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;
                            let toIndex = index;

                            // Adjust toIndex based on drop position (above or below)
                            if (e.clientY > midY && fromIndex < toIndex) {
                                // Already handled by splice logic usually, but let's be precise
                            } else if (e.clientY < midY && fromIndex > toIndex) {
                                // Above
                            }

                            if (fromIndex !== toIndex) {
                                const [removed] = initialConfig.splice(fromIndex, 1);
                                initialConfig.splice(toIndex, 0, removed);
                                window.dispatchEvent(new CustomEvent('columnConfigChanged', { detail: { config: initialConfig } }));
                                renderRows();
                            }
                        });

                        const checkbox = tr.querySelector('input');
                        checkbox.addEventListener('change', () => {
                            conf.visible = checkbox.checked;
                            tr.querySelector('.bx-check').classList.toggle('hidden', !conf.visible);
                            window.dispatchEvent(new CustomEvent('columnConfigChanged', { detail: { config: initialConfig } }));
                        });

                        const labelInput = tr.querySelector('.label-input');
                        labelInput.addEventListener('input', () => {
                            conf.label = labelInput.value;
                            window.dispatchEvent(new CustomEvent('columnConfigChanged', { detail: { config: initialConfig } }));
                        });

                        tbody.appendChild(tr);
                    });
                } else {
                    const headers = Array.from(table.querySelectorAll('thead th')).slice(0, -1);
                    headers.forEach((th, index) => {
                        if (th.dataset.noColvis === "true") return;
                        const name = th.querySelector('.table-span-header')?.textContent || th.textContent.trim();
                        const isVisible = th.style.display !== 'none';

                        const label = document.createElement('div');
                        label.className = 'flex items-center p-2 rounded-lg hover:bg-slate-50 cursor-move transition-colors group';
                        label.draggable = true;
                        label.dataset.index = index;

                        label.innerHTML = `
                            <i class='bx bx-grid-vertical text-slate-300 group-hover:text-slate-400 mr-2'></i>
                            <label class="flex items-center cursor-pointer flex-1 min-w-0">
                                <input type="checkbox" ${isVisible ? 'checked' : ''} class="peer hidden">
                                <div class="mr-3 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-slate-300 peer-checked:border-[${CONFIG.primaryColor}] peer-checked:bg-[${CONFIG.primaryColor}] transition-all">
                                    <i class="bx bx-check text-white text-[10px] ${isVisible ? '' : 'hidden'}"></i>
                                </div>
                                <span class="text-xs font-bold text-slate-600 group-hover:text-[#003D5D] transition-colors truncate">${name}</span>
                            </label>
                        `;

                        // Drag & Drop for Standard Mode
                        label.addEventListener('dragstart', (e) => {
                            e.dataTransfer.setData('text/plain', index);
                            label.classList.add('opacity-40');
                        });
                        label.addEventListener('dragend', () => {
                            label.classList.remove('opacity-40');
                            tbody.querySelectorAll('.group').forEach(l => l.classList.remove('border-t-2', 'border-b-2', 'border-[#003D5D]'));
                        });
                        label.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            const rect = label.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;
                            label.classList.remove('border-t-2', 'border-b-2', 'border-[#003D5D]');
                            if (e.clientY < midY) {
                                label.classList.add('border-t-2', 'border-[#003D5D]');
                            } else {
                                label.classList.add('border-b-2', 'border-[#003D5D]');
                            }
                        });
                        label.addEventListener('dragleave', () => {
                            label.classList.remove('border-t-2', 'border-b-2', 'border-[#003D5D]');
                        });
                        label.addEventListener('drop', (e) => {
                            e.preventDefault();
                            label.classList.remove('border-t-2', 'border-b-2', 'border-[#003D5D]');
                            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                            const toIdx = index;
                            if (fromIdx !== toIdx) {
                                // Reorder headers and cells in DOM
                                const rows = table.querySelectorAll('tr');
                                rows.forEach(row => {
                                    const cells = Array.from(row.children);
                                    const fromCell = cells[fromIdx];
                                    const toCell = cells[toIdx];
                                    if (fromIdx < toIdx) {
                                        row.insertBefore(fromCell, toCell.nextElementSibling);
                                    } else {
                                        row.insertBefore(fromCell, toCell);
                                    }
                                });
                                renderRows();
                            }
                        });

                        const checkbox = label.querySelector('input');
                        checkbox.addEventListener('change', () => {
                            label.querySelector('.bx-check').classList.toggle('hidden', !checkbox.checked);
                            const display = checkbox.checked ? '' : 'none';
                            th.style.display = display;
                            table.querySelectorAll('tbody tr').forEach(row => {
                                const cell = row.children[index];
                                if (cell) cell.style.display = display;
                            });
                        });

                        tbody.appendChild(label);
                    });
                }
            };

            renderRows();

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'flex items-center justify-between pt-4 border-t border-slate-100 mt-4';
            actionsContainer.innerHTML = `
                <button class="select-all-btn text-[10px] font-black text-[${CONFIG.primaryColor}] hover:opacity-80 transition-colors uppercase tracking-widest">Todas</button>
                <button class="clear-all-btn text-[10px] font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Nenhuma</button>
            `;

            menu.append(searchWrapper, listWrapper, actionsContainer);
            if (parent) parent.appendChild(menu);
            else document.body.appendChild(menu);

            const searchInput = searchWrapper.querySelector('input');
            searchInput.addEventListener('input', () => {
                const term = searchInput.value.toLowerCase();
                const items = isEnhanced ? tbody.querySelectorAll('tr') : tbody.querySelectorAll('.group');
                items.forEach(item => {
                    const text = item.innerText.toLowerCase();
                    item.style.display = text.includes(term) ? (isEnhanced ? '' : 'flex') : 'none';
                });
            });

            actionsContainer.querySelector('.select-all-btn').addEventListener('click', () => {
                if (isEnhanced) {
                    initialConfig.forEach(c => c.visible = true);
                    window.dispatchEvent(new CustomEvent('columnConfigChanged', { detail: { config: initialConfig } }));
                    renderRows();
                } else {
                    tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
                    });
                }
            });

            actionsContainer.querySelector('.clear-all-btn').addEventListener('click', () => {
                if (isEnhanced) {
                    initialConfig.forEach(c => c.visible = false);
                    window.dispatchEvent(new CustomEvent('columnConfigChanged', { detail: { config: initialConfig } }));
                    renderRows();
                } else {
                    tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        if (cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
                    });
                }
            });

            menu.addEventListener('click', e => e.stopPropagation());
        });

        document.addEventListener('click', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
        window.addEventListener('resize', closeMenu);
    };
    window.initializeColumnRenaming = function (tableId) {
        const tableContainer = document.getElementById(tableId);
        const table = tableContainer ? tableContainer.querySelector('table') : null;
        if (!table) return;

        table.querySelectorAll('thead th .table-span-header').forEach(span => {
            if (span.dataset.renamingInitialized === 'true') return;
            span.dataset.renamingInitialized = 'true';

            span.addEventListener('dblclick', function (e) {
                e.stopPropagation();
                const currentText = span.textContent.trim();
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentText;
                input.className = 'w-full bg-white border border-primary text-[#003D5D] px-1 py-0.5 rounded outline-none text-[11px] font-bold';
                input.style.width = '150px';
                input.style.minWidth = '0';

                const originalDisplay = span.style.display;
                const parent = span.parentElement;
                const originalGap = parent.style.gap;

                span.style.display = 'none';
                parent.style.gap = '0';
                parent.insertBefore(input, span);
                input.focus();
                input.select();

                const cleanupInput = () => {
                    input.remove();
                    span.style.display = originalDisplay;
                    parent.style.gap = originalGap;
                };

                const save = () => {
                    const newText = input.value.trim();
                    if (newText) {
                        span.textContent = newText;

                        // Sync with COLUMN_CONFIG in script.js if it exists
                        const originalKey = span.closest('th').querySelector('.table-filter-trigger')?.dataset.key;
                        if (originalKey && typeof COLUMN_CONFIG !== 'undefined') {
                            const conf = COLUMN_CONFIG.find(c => c.key === originalKey);
                            if (conf) {
                                conf.label = newText;
                                window.dispatchEvent(new CustomEvent('columnConfigChanged', { detail: { config: COLUMN_CONFIG } }));
                            }
                        }
                    }
                    cleanupInput();
                };

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') cleanupInput();
                });
                input.addEventListener('blur', save);
                input.addEventListener('click', e => e.stopPropagation());
                input.addEventListener('mousedown', e => e.stopPropagation());
            });
        });
    };
})();