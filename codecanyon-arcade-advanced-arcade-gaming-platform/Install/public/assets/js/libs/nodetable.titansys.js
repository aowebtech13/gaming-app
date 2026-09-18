class TableHandler {
    constructor(config) {
        this.tableSelector = config.tableSelector;
        this.paginationSelector = config.paginationSelector;
        this.searchSelector = config.searchSelector;
        this.rowsPerPageSelector = config.rowsPerPageSelector;
        this.fetchUrl = config.fetchUrl;
        this.currentPage = 1;
        this.currentSearch = '';
        this.currentLimit = 10;

        // Bind event handlers
        this.init();
    }

    init() {
        // Initial fetch
        this.currentLimit = parseInt($(this.rowsPerPageSelector).val(), 10) || 10;
        this.fetchData();

        // Handle pagination click
        $(document).on('click', `${this.paginationSelector} a`, (e) => {
            e.preventDefault();
            const page = $(e.target).data('page');
            this.currentPage = page;
            this.fetchData();
        });

        // Handle search input
        $(this.searchSelector).on('input', () => {
            this.currentSearch = $(this.searchSelector).val();
            this.currentPage = 1; // Reset to first page
            this.fetchData();
        });

        // Handle rows per page change
        $(this.rowsPerPageSelector).on('change', () => {
            const newLimit = parseInt($(this.rowsPerPageSelector).val(), 10) || 10;

            // Recalculate the new page for the current offset
            const currentOffset = (this.currentPage - 1) * this.currentLimit;
            this.currentLimit = newLimit;
            this.currentPage = Math.floor(currentOffset / this.currentLimit) + 1;

            this.fetchData();
        });
    }

    renderTable(metadata, data) {
        // Add table layout classes to ensure proper column alignment
        $(`${this.tableSelector}`).addClass('w-full border-collapse shadow-sm rounded-lg overflow-hidden');
        
        const tableHead = metadata.map(meta => `<th class="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">${meta.label}</th>`).join('');
        $(`${this.tableSelector} thead`).html(`<tr>${tableHead}</tr>`);

        if (data.length === 0) {
            const colspan = metadata.length || 1; // If no metadata, default colspan to 1
            $(`${this.tableSelector} tbody`).html(
                `<tr><td colspan="${colspan}" class="px-12 py-20 text-center text-sm text-gray-500 bg-white">
                    <div class="flex flex-col items-center gap-6 max-w-sm mx-auto">
                        <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center shadow-sm">
                            <svg class="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clip-rule="evenodd"></path></svg>
                        </div>
                        <div class="text-center space-y-2">
                            <h3 class="text-base font-semibold text-gray-900 mb-2">${__('dashboard.table.no_entries_found')}</h3>
                            <p class="text-sm text-gray-600 leading-relaxed">${__('dashboard.table.adjust_search_criteria')}</p>
                        </div>
                    </div>
                </td></tr>`
            );
            return;
        }

        const tableBody = data.map((row, index) => {
            const rowHtml = metadata
                .map(meta => `<td class="px-6 py-4 text-sm text-gray-800 border-b border-gray-100 text-center">${row[meta.key] || ''}</td>`)
                .join('');
            return `<tr class="hover:bg-blue-50 hover:shadow-sm transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}">${rowHtml}</tr>`;
        }).join('');

        $(`${this.tableSelector} tbody`).html(tableBody);
    }

    renderPagination(totalPages) {
        if (totalPages <= 1) {
            $(this.paginationSelector).html('');
            return;
        }

        const maxVisiblePages = 5;
        let startPage, endPage;

        if (totalPages <= maxVisiblePages) {
            // Show all pages if total is less than max visible
            startPage = 1;
            endPage = totalPages;
        } else {
            // Calculate start and end pages
            const half = Math.floor(maxVisiblePages / 2);
            startPage = Math.max(1, this.currentPage - half);
            endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            // Adjust start page if we're near the end
            if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
        }

        let pagination = '<nav class="flex items-center justify-center"><ul class="inline-flex items-center shadow-sm rounded-lg overflow-hidden border border-gray-200">';

        // Previous button
        if (this.currentPage > 1) {
            pagination += `<li>
                <a class="inline-flex items-center px-4 py-3 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 hover:text-gray-800 transition-all duration-200 border-r border-gray-200" href="#" data-page="${this.currentPage - 1}">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                    ${__('dashboard.table.previous')}
                </a>
            </li>`;
        } else {
            pagination += `<li>
                <span class="inline-flex items-center px-4 py-3 text-sm font-medium text-gray-400 bg-gray-50 border-r border-gray-200 cursor-not-allowed">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                    ${__('dashboard.table.previous')}
                </span>
            </li>`;
        }

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage;
            if (isActive) {
                pagination += `<li>
                    <span class="inline-flex items-center px-4 py-3 text-sm font-medium text-white bg-blue-600 border-r border-blue-600">${i}</span>
                </li>`;
            } else {
                pagination += `<li>
                    <a class="inline-flex items-center px-4 py-3 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 hover:text-gray-800 transition-all duration-200 border-r border-gray-200" href="#" data-page="${i}">${i}</a>
                </li>`;
            }
        }

        // Next button
        if (this.currentPage < totalPages) {
            pagination += `<li>
                <a class="inline-flex items-center px-4 py-3 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 hover:text-gray-800 transition-all duration-200" href="#" data-page="${this.currentPage + 1}">
                    ${__('dashboard.table.next')}
                    <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg>
                </a>
            </li>`;
        } else {
            pagination += `<li>
                <span class="inline-flex items-center px-4 py-3 text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed">
                    ${__('dashboard.table.next')}
                    <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg>
                </span>
            </li>`;
        }

        pagination += '</ul></nav>';
        $(this.paginationSelector).html(pagination);
    }

    fetchData() {
        if (this.fetchUrl.length > 0) {
            $.ajax({
                url: `${this.fetchUrl}?page=${this.currentPage}&search=${this.currentSearch}&limit=${this.currentLimit}`,
                method: 'GET',
                success: (response) => {
                    if (response.success) {
                        const { metadata, data, total, limit } = response;

                        // Calculate total pages
                        const totalPages = Math.ceil(total / limit);

                        // Adjust current page if it becomes invalid
                        if (this.currentPage > totalPages) {
                            this.currentPage = totalPages > 0 ? totalPages : 1;
                        }

                        // Render table and pagination
                        this.renderTable(metadata, data);
                        this.renderPagination(totalPages);
                    }
                },
                error: () => {
                    // Show error with modern styling
                    const errorHtml = `
                        <div class="rounded-lg bg-red-50 border border-red-200 p-6">
                            <div class="flex items-center gap-4">
                                <svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                                <div>
                                    <h3 class="text-sm font-medium text-red-800">${__('dashboard.table.error_loading_data')}</h3>
                                    <p class="text-sm text-red-700">${__('dashboard.table.error_fetching_data')}</p>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    // Replace table content with error message
                    $(`${this.tableSelector} tbody`).html(`
                        <tr>
                            <td colspan="${metadata ? metadata.length : 1}" class="px-6 py-12">
                                ${errorHtml}
                            </td>
                        </tr>
                    `);
                },
            });
        }
    }

    destroyTable() {
        this.currentPage = 1;
        this.currentSearch = '';
        this.currentLimit = 10;
        this.fetchUrl = '';
        $(this.containerSelector).remove();
        $(this.paginationSelector).remove();
        $(this.searchSelector).remove();
        $(this.rowsPerPageSelector).remove();
    }

    refetchTable() {
        this.fetchData();
    }
}
