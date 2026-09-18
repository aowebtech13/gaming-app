/**
 * Games Importer JavaScript
 * Handles API integration, pagination, filtering and game import functionality
 */

(function ($) {
    "use strict";

    // Initialize importer when document is ready and on pjax events
    $(function () {
        initImporter();
    });

    // Re-initialize on PJAX navigation
    $(document).on('pjax:complete', function () {
        initImporter();
    });

    function initImporter() {
        // Only initialize if we're on the importer page
        if (window.location.pathname !== '/dashboard/importer') {
            return;
        }
        
        const state = {
            currentPage: 1,
            itemsPerPage: 16,
            totalPages: 1,
            totalCount: 0,
            isLoading: false,
            filters: {
                search: '',
                category: '',
            }
        };

        const elements = {
            searchInput: $('#searchInput'),
            categoryFilter: $('#categoryFilter'),
            applyFilters: $('#applyFilters'),
            clearFilters: $('#clearFilters'),
            refreshGames: $('#refreshGames'),
            itemsPerPage: $('#itemsPerPage'),
            gamesContainer: $('#gamesContainer'),
            loadingState: $('#loadingState'),
            gamesGrid: $('#gamesGrid'),
            emptyState: $('#emptyState'),
            errorState: $('#errorState'),
            errorMessage: $('#errorMessage'),
            retryConnection: $('#retryConnection'),
            paginationContainer: $('#paginationContainer'),
            paginationNav: $('#paginationNav'),
            currentPageInfo: $('#currentPageInfo'),
            totalPagesInfo: $('#totalPagesInfo'),
            resultsCount: $('#resultsCount'),
            apiStatus: $('#apiStatus'),
            statusDot: $('#statusDot'),
            statusText: $('#statusText')
        };

        // Check if required elements exist
        if (elements.gamesContainer.length === 0) {
            return;
        }

        // Initialize event handlers
        setupEventHandlers();

        // Load initial data
        loadGames();

        function setupEventHandlers() {
            // Filter and search handlers
            elements.applyFilters.on('click', handleApplyFilters);
            elements.clearFilters.on('click', handleClearFilters);
            elements.refreshGames.on('click', handleRefreshGames);
            elements.retryConnection.on('click', handleRefreshGames);

            // Items per page change
            elements.itemsPerPage.on('change', handleItemsPerPageChange);

            // Search input with debounce
            let searchTimeout;
            elements.searchInput.on('input', function () {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    state.filters.search = $(this).val().trim();
                    if (state.filters.search !== '') {
                        loadGames(1);
                    }
                }, 500);
            });

            // Enter key on search
            elements.searchInput.on('keypress', function (e) {
                if (e.which === 13) {
                    e.preventDefault();
                    handleApplyFilters();
                }
            });
        }

        function handleApplyFilters() {
            state.filters.search = elements.searchInput.val().trim();
            state.filters.category = elements.categoryFilter.val();
            state.currentPage = 1;
            loadGames();
        }

        function handleClearFilters() {
            elements.searchInput.val('');
            elements.categoryFilter.val('');
            state.filters = { search: '', category: '' };
            state.currentPage = 1;
            loadGames();
        }

        function handleRefreshGames() {
            state.currentPage = 1;
            loadGames();
        }

        function handleItemsPerPageChange() {
            state.itemsPerPage = parseInt(elements.itemsPerPage.val());
            state.currentPage = 1;
            loadGames();
        }

        function updateApiStatus(status, message) {
            const statusClass = {
                'connected': 'bg-green-400',
                'error': 'bg-red-400',
                'loading': 'bg-yellow-400'
            };

            elements.statusDot.removeClass('bg-green-400 bg-red-400 bg-yellow-400 bg-gray-400')
                .addClass(statusClass[status] || 'bg-gray-400');
            elements.statusText.text(message);
        }

        function showState(stateName) {
            elements.loadingState.hide();
            elements.gamesGrid.hide();
            elements.emptyState.hide();
            elements.errorState.hide();
            elements.paginationContainer.hide();

            switch (stateName) {
                case 'loading':
                    elements.loadingState.show();
                    break;
                case 'games':
                    elements.gamesGrid.show();
                    elements.paginationContainer.show();
                    break;
                case 'empty':
                    elements.emptyState.show();
                    break;
                case 'error':
                    elements.errorState.show();
                    break;
            }
        }

        function loadGames(page = null) {
            if (state.isLoading) return;

            if (page !== null) {
                state.currentPage = page;
            }

            state.isLoading = true;
            showState('loading');
            updateApiStatus('loading', __('dashboard.importer.connecting'));

            // Build API URL
            const params = new URLSearchParams({
                page: state.currentPage,
                limit: state.itemsPerPage
            });

            if (state.filters.search) params.append('search', state.filters.search);
            if (state.filters.category) params.append('category', state.filters.category);

            const apiUrl = `/requests/importer?${params.toString()}`;

            $.ajax({
                url: apiUrl,
                method: 'GET',
                timeout: 10000,
                success: function (response) {
                    state.isLoading = false;

                    if (response.status === 200 && response.data) {
                        updateApiStatus('connected', __('dashboard.importer.api_connected'));
                        handleGamesResponse(response.data);
                    } else {
                        updateApiStatus('error', __('dashboard.importer.api_error'));
                        showError(response.message || __('dashboard.importer.invalid_api_response'));
                    }
                },
                error: function (xhr, status, error) {
                    state.isLoading = false;
                    updateApiStatus('error', __('dashboard.importer.connection_failed'));

                    let errorMsg = __('dashboard.importer.api_connection_failed');
                    if (status === 'timeout') {
                        errorMsg = __('dashboard.importer.request_timeout');
                    } else if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMsg = xhr.responseJSON.message;
                    }

                    showError(errorMsg);
                }
            });
        }

        function handleGamesResponse(data) {
            const { games, pagination } = data;

            if (!games || games.length === 0) {
                showState('empty');
                updateResultsInfo(0, 0, 0);
                return;
            }

            // Update state from pagination
            state.currentPage = pagination.current_page;
            state.totalPages = pagination.total_pages;
            state.totalCount = pagination.total_count;

            // Render games
            renderGames(games);
            renderPagination(pagination);
            updateResultsInfo(games.length, state.totalCount, state.currentPage);

            showState('games');
        }

        function renderGames(games) {
            elements.gamesGrid.empty();

            // Store game data in a global object for easy access
            window.importerGameData = window.importerGameData || {};

            games.forEach(game => {
                // Store game data globally
                window.importerGameData[game.id] = game;
                
                const gameCard = createGameCard(game);
                elements.gamesGrid.append(gameCard);
            });
        }

        function createGameCard(game) {
            const thumbnailUrl = game.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0ibTEyIDJsMyA3aDdhMSAxIDAgMCAxIC41OSAxLjVsLTYgNC40YTEgMSAwIDAgMC0uMzYgMS4xbDMgNmExIDEgMCAwIDEtMS41MyAxLjE1TDEyIDEyIDYuNSAyMi4xYTEgMSAwIDAgMS0xLjUzLTEuMTVsMy02YTEgMSAwIDAgMC0uMzYtMS4xbC02LTQuNGExIDEgMCAwIDEgLjU5LTEuNWg3eiIgZmlsbD0iI2ZmZDcwMCIgc3Ryb2tlPSIjZmZkNzAwIiBzdHJva2Utd2lkdGg9IjEuNSIvPgo8L3N2Zz4K';
            const downloadUrl = game.game_file;

            return $(`
                <div class="relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                    <!-- Game Thumbnail -->
                    <div class="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200">
                        <img src="${thumbnailUrl}" alt="${escapeHtml(game.title)}" 
                             class="w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${!game.thumbnail ? 'opacity-20' : ''}"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0ibTEyIDJsMyA3aDdhMSAxIDAgMCAxIC41OSAxLjVsLTYgNC40YTEgMSAwIDAgMC0uMzYgMS4xbDMgNmExIDEgMCAwIDEtMS41MyAxLjE1TDEyIDEyIDYuNSAyMi4xYTEgMSAwIDAgMS0xLjUzLTEuMTVsMy02YTEgMSAwIDAgMC0uMzYtMS4xbC02LTQuNGExIDEgMCAwIDEgLjU5LTEuNWg3eiIgZmlsbD0iI2ZmZDcwMCIgc3Ryb2tlPSIjZmZkNzAwIiBzdHJva2Utd2lkdGg9IjEuNSIvPgo8L3N2Zz4K'; this.className='w-full h-full object-cover opacity-20';">
                        
                        <!-- Hover overlay for darkening effect -->
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300"></div>
                        
                        <!-- Import Button in Corner -->
                        <button class="import-game-btn absolute top-2 right-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white p-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:scale-110 opacity-95 hover:opacity-100 group-hover:opacity-100" 
                                data-game-id="${game.id}" 
                                data-game-title="${escapeHtml(game.title)}"
                                data-download-url="${downloadUrl}"
                                title="Import ${escapeHtml(game.title)}">
                            <span class="btn-icon">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                                </svg>
                            </span>
                            <span class="btn-loading hidden">
                                <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 14 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </span>
                        </button>
                        
                        <!-- Game Type Badge -->
                        <div class="absolute top-2 left-2">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${game.game_type === 'rom' ? 'bg-purple-100 text-purple-800' : game.game_type === 'html5' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
                                ${game.game_type === 'rom' ? 'ROM' : game.game_type === 'html5' ? 'HTML5' : game.game_type === 'flash' ? 'Flash' : game.game_type.toUpperCase()}
                            </span>
                        </div>
                        
                        <!-- Game Title Overlay -->
                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <h3 class="text-white font-medium text-sm line-clamp-2">${escapeHtml(game.title)}</h3>
                        </div>
                    </div>
                </div>
            `);
        }

        function renderPagination(pagination) {
            const nav = elements.paginationNav;
            nav.empty();

            if (pagination.total_pages <= 1) {
                elements.paginationContainer.hide();
                return;
            }

            // Previous button
            if (pagination.has_prev_page) {
                nav.append(`
                    <button class="pagination-btn px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" data-page="${pagination.prev_page}">
                        ${__('dashboard.importer.previous')}
                    </button>
                `);
            }

            // Page numbers
            const startPage = Math.max(1, pagination.current_page - 2);
            const endPage = Math.min(pagination.total_pages, pagination.current_page + 2);

            if (startPage > 1) {
                nav.append(`<button class="pagination-btn px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" data-page="1">1</button>`);
                if (startPage > 2) {
                    nav.append(`<span class="px-2 text-gray-500">...</span>`);
                }
            }

            for (let page = startPage; page <= endPage; page++) {
                const isActive = page === pagination.current_page;
                nav.append(`
                    <button class="pagination-btn px-3 py-2 text-sm ${isActive ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border-gray-300 hover:bg-gray-50'} border rounded-lg" data-page="${page}">
                        ${page}
                    </button>
                `);
            }

            if (endPage < pagination.total_pages) {
                if (endPage < pagination.total_pages - 1) {
                    nav.append(`<span class="px-2 text-gray-500">...</span>`);
                }
                nav.append(`<button class="pagination-btn px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" data-page="${pagination.total_pages}">${pagination.total_pages}</button>`);
            }

            // Next button
            if (pagination.has_next_page) {
                nav.append(`
                    <button class="pagination-btn px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" data-page="${pagination.next_page}">
                        ${__('dashboard.importer.next')}
                    </button>
                `);
            }

            // Pagination click handlers
            nav.find('.pagination-btn').on('click', function () {
                const page = parseInt($(this).data('page'));
                loadGames(page);
            });

            // Update page info
            elements.currentPageInfo.text(pagination.current_page);
            elements.totalPagesInfo.text(pagination.total_pages);
        }

        function updateResultsInfo(currentCount, totalCount, currentPage) {
            elements.resultsCount.text(totalCount.toLocaleString());
        }

        function showError(message) {
            elements.errorMessage.text(message);
            showState('error');
        }

        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, function (m) { return map[m]; });
        }

        function resetImportButton($btn) {
            $btn.removeClass('importing').prop('disabled', false);
            $btn.find('.btn-loading').hide();
            $btn.find('.btn-icon').html(`
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                </svg>
            `).show();
        }

        // Game import functionality
        elements.gamesContainer.on('click', '.import-game-btn', function () {
            const $btn = $(this);
            const gameId = $btn.data('game-id');
            const gameTitle = $btn.data('game-title');
            const downloadUrl = $btn.data('download-url');
            
            // Get game data from global object
            const gameData = window.importerGameData && window.importerGameData[gameId];
            
            if (!gameData) {
                alert.danger(__('dashboard.importer.game_data_not_found'));
                return;
            }
            
            // Debug: Log the game data to see what's being sent
            console.log('Import button clicked - gameData:', gameData);
            console.log('Available fields:', gameData ? Object.keys(gameData) : 'no gameData');
            console.log('Field values:', {
                id: gameData?.id,
                title: gameData?.title,
                game_type: gameData?.game_type,
                game_file: gameData?.game_file,
                file: gameData?.file,
                download_url: gameData?.download_url,
                url: gameData?.url
            });

            if ($btn.hasClass('importing')) return;

            $btn.addClass('importing').prop('disabled', true);
            $btn.find('.btn-icon').hide();
            $btn.find('.btn-loading').show();

            // Import game using real API endpoint
            $.ajax({
                url: '/requests/import-game',
                method: 'POST',
                data: JSON.stringify(gameData),
                contentType: 'application/json',
                timeout: 60000, // 60 seconds timeout for file downloads
                success: function(response) {
                    if (response.status === 200) {
                        // Show success notification using the project's alert system
                        alert.success(__('dashboard.importer.import_success', { title: gameTitle }));

                        // Update button state
                        $btn.removeClass('importing').addClass('imported')
                            .removeClass('from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700')
                            .addClass('from-green-600 to-emerald-600')
                            .prop('disabled', true);

                        $btn.find('.btn-loading').hide();
                        $btn.find('.btn-icon').html(`
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        `).show();
                    } else {
                        // Show error notification
                        alert.danger(response.message || __('dashboard.importer.import_failed'));
                        resetImportButton($btn);
                    }
                },
                error: function(xhr, status, error) {
                    let errorMsg = __('dashboard.importer.import_error');
                    if (status === 'timeout') {
                        errorMsg = __('dashboard.importer.import_timeout');
                    } else if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMsg = xhr.responseJSON.message;
                    } else if (xhr.responseText) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            errorMsg = response.message || errorMsg;
                        } catch (e) {
                            // Use default error message if JSON parsing fails
                        }
                    }
                    
                    alert.danger(errorMsg);
                    resetImportButton($btn);
                }
            });
        });

    }

    // Export importer utilities to global scope if needed
    window.importerUtils = {
        initImporter: initImporter
    };

})(jQuery);