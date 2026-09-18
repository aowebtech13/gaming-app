/**
 * Dashboard jQuery Functionality
 * Handles sidebar toggle, dropdowns, and modal interactions
 */

(function ($) {
    "use strict";
    $(function () {
        // Initialize dashboard functionality
        initDashboard();
        // Initialize game form handlers
        initGameFormHandlers();

        // Initialize template functionality
        initTemplate();

        // Initialize category form handlers
        initCategoryFormHandlers();

        // Initialize page form handlers
        initPageFormHandlers();
    });

    function initDashboard() {
        // Sidebar functionality
        initSidebar();

        // User dropdown functionality
        initUserDropdowns();

        // Language switcher functionality
        initLanguageSwitcher();

        // Clear cache functionality
        initClearCacheButton();
    }

    function initSidebar() {
        // Sidebar toggle functionality
        $('#sidebarToggleBtn').on('click', function () {
            toggleSidebar();
        });

        // Sidebar close button
        $('#sidebarCloseBtn').on('click', function () {
            closeSidebar();
        });

        // Sidebar overlay click
        $('#sidebarOverlay').on('click', function () {
            closeSidebar();
        });

        // Listen for custom toggle event
        $(document).on('toggle-sidebar', function () {
            toggleSidebar();
        });
    }

    function toggleSidebar() {
        const sidebar = $('#sidebar');
        const overlay = $('#sidebarOverlay');
        const closeBtn = $('#sidebarCloseBtn');

        if (sidebar.hasClass('-translate-x-full')) {
            openSidebar();
        } else {
            closeSidebar();
        }
    }

    function openSidebar() {
        const sidebar = $('#sidebar');
        const overlay = $('#sidebarOverlay');
        const closeBtn = $('#sidebarCloseBtn');

        sidebar.removeClass('-translate-x-full').addClass('translate-x-0');
        overlay.fadeIn(200);
        closeBtn.fadeIn(200);
        $('body').addClass('sidebar-open');
    }

    function closeSidebar() {
        const sidebar = $('#sidebar');
        const overlay = $('#sidebarOverlay');
        const closeBtn = $('#sidebarCloseBtn');

        sidebar.removeClass('translate-x-0').addClass('-translate-x-full');
        overlay.fadeOut(200);
        closeBtn.fadeOut(200);
        $('body').removeClass('sidebar-open');
    }

    function initUserDropdowns() {
        // Desktop user dropdown functionality
        $('#userDropdownBtn').on('click', function (e) {
            e.stopPropagation();
            $('#userDropdown').slideToggle(200);
        });

        // Mobile user dropdown functionality
        $('#mobileUserDropdownBtn').on('click', function (e) {
            e.stopPropagation();
            $('#mobileUserDropdown').slideToggle(200);
        });

        // Close dropdowns when clicking outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest('[system-usernav]').length) {
                $('#userDropdown, #mobileUserDropdown').slideUp(200);
            }
        });
    }

    function initLanguageSwitcher() {
        const $languageBtn = $('#languageDropdownBtn');
        const $languageDropdown = $('#languageDropdown');

        // Language dropdown functionality
        $languageBtn.on('click', function (e) {
            e.stopPropagation();
            $languageDropdown.toggleClass('hidden');

            // Scroll active language into view when dropdown opens
            if (!$languageDropdown.hasClass('hidden')) {
                scrollToActiveLanguage($languageDropdown);
            }
        });

        // Close language dropdown when clicking outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest('#languageSwitcher').length) {
                $languageDropdown.addClass('hidden');
            }
        });

        // Keyboard navigation for dropdown
        $languageBtn.on('keydown', function (e) {
            handleLanguageDropdownKeyNav(e, $languageDropdown);
        });
    }

    /**
     * Scroll active language into view in dropdown
     */
    function scrollToActiveLanguage($dropdown) {
        const $activeItem = $dropdown.find('button.bg-blue-50');
        if ($activeItem.length) {
            const scrollContainer = $dropdown.find('.overflow-y-auto')[0];
            if (scrollContainer) {
                const itemTop = $activeItem[0].offsetTop;
                const itemHeight = $activeItem[0].offsetHeight;
                const containerHeight = scrollContainer.clientHeight;
                const scrollTop = scrollContainer.scrollTop;

                // Check if item is outside visible area
                if (itemTop < scrollTop || itemTop + itemHeight > scrollTop + containerHeight) {
                    scrollContainer.scrollTop = itemTop - (containerHeight / 2) + (itemHeight / 2);
                }
            }
        }
    }

    /**
     * Handle keyboard navigation in language dropdown
     */
    function handleLanguageDropdownKeyNav(e, $dropdown) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            $dropdown.toggleClass('hidden');
            if (!$dropdown.hasClass('hidden')) {
                scrollToActiveLanguage($dropdown);
                // Focus first language option
                $dropdown.find('button[role="menuitem"]').first().focus();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            $dropdown.addClass('hidden');
        }
    }

    // Language change function (global scope)
    window.changeLanguage = function (languageCode) {
        // Show loading state
        const $languageBtn = $('#languageDropdownBtn');
        const originalContent = $languageBtn.html();

        $languageBtn.prop('disabled', true).html(`
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span class="hidden sm:inline text-sm font-medium text-gray-700">${__("api.languages.changing")}</span>
        `);

        // Make AJAX request to change language
        $.post('/languages/change', { language: languageCode })
            .done(function (response) {
                if (response.status === 200) {
                    // Show success message briefly then reload
                    alert.success(response.message || __('notifications.success'), true);
                } else {
                    // Show error notification
                    alert.danger(response.message || __('notifications.error'));
                    $languageBtn.find('span').text(originalText);
                }
            })
            .fail(function (xhr) {
                // Show error notification
                let errorMessage = __('notifications.network_error');
                try {
                    const response = JSON.parse(xhr.responseText);
                    errorMessage = response.message || errorMessage;
                } catch (e) {
                    // Use default error message
                }
                alert.danger(errorMessage);
                $languageBtn.find('span').text(originalText);
            });
    };

    function initClearCacheButton() {
        $('#clearCacheBtn').on('click', function (e) {
            e.preventDefault();

            const $button = $(this);

            // Use the project's wrapped iziToast question dialog
            iziToast.question({
                title: __("dashboard.cache.clear_title"),
                message: __("dashboard.cache.clear_message"),
                titleLineHeight: "25px",
                backgroundColor: "#FE9431",
                position: "center",
                icon: false,
                drag: false,
                timeout: false,
                close: false,
                overlay: true,
                layout: 1,
                zindex: 1024,
                buttons: [
                    [`<button style="color: white !important;">${__("notifications.confirm")}</button>`, function (instance, toast) {
                        instance.hide({ transitionOut: "fadeOut" }, toast, "button");

                        // Make the request
                        $.ajax({
                            url: '/requests/clear-cache',
                            method: 'POST',
                            dataType: 'json'
                        })
                            .done(function (data) {
                                const result = system._parseResponse(data);
                                if (result.status === 200) {
                                    alert.success(result.message);
                                } else {
                                    alert.danger(result.message);
                                }
                            })
                            .fail(function (xhr, status, error) {
                                console.error('Cache clear error:', error);
                                alert.danger(__('notifications.cache_clear_error'));
                            });
                    }, true],
                    [`<button style="color: white !important;">${__("notifications.cancel")}</button>`, function (instance, toast) {
                        instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                    }]
                ]
            });
        });
    }

    // Game Form Handlers (moved from modal templates)
    function initGameFormHandlers() {
        // Handle game type selection changes (for both create and update forms)
        $(document).on('change', 'select[name="game_type"]', function () {
            const fileSection = document.getElementById('file-upload-section');
            const romFileSection = document.getElementById('rom-file-upload-section');
            const romSystemSection = document.getElementById('rom-system-section');
            const embedSection = document.getElementById('embed-url-section');
            const apiSection = document.getElementById('api-enabled-section');
            const gameFileInputs = document.querySelectorAll('input[name="game_file"]');
            const embedUrlInput = document.querySelector('input[name="embed_url"]');
            const romSystemInput = document.querySelector('select[name="rom_system"]');

            if (!fileSection || !embedSection) return; // Exit if sections don't exist

            // Hide all sections first
            if (fileSection) fileSection.style.display = 'none';
            if (romFileSection) romFileSection.style.display = 'none';
            if (romSystemSection) romSystemSection.style.display = 'none';
            if (embedSection) embedSection.style.display = 'none';

            // Reset all file inputs
            gameFileInputs.forEach(input => {
                input.required = false;
                input.disabled = true;
            });

            if (this.value === 'embed') {
                embedSection.style.display = 'block';
                if (apiSection) apiSection.style.display = 'block';
                if (embedUrlInput) embedUrlInput.required = true;
                if (romSystemInput) romSystemInput.required = false;
            } else if (this.value === 'rom') {
                if (romFileSection) romFileSection.style.display = 'block';
                if (romSystemSection) romSystemSection.style.display = 'block';
                if (apiSection) apiSection.style.display = 'none'; // Hide API for ROM games

                // Enable ROM file input
                const romFileInput = romFileSection.querySelector('input[name="game_file"]');
                if (romFileInput) {
                    // Only require file for create forms, not update forms
                    const isUpdateForm = romFileInput.closest('form').querySelector('input[name="title"]')?.value;
                    romFileInput.required = !isUpdateForm;
                    romFileInput.disabled = false;
                }

                if (embedUrlInput) embedUrlInput.required = false;
                if (romSystemInput) romSystemInput.required = true;
            } else {
                // HTML5 and Flash games
                fileSection.style.display = 'block';
                // Show API section for HTML5 and embed games, hide for flash and rom
                if (apiSection) {
                    apiSection.style.display = (this.value === 'flash' || this.value === 'rom') ? 'none' : 'block';
                }

                // Enable regular file input
                const regularFileInput = fileSection.querySelector('input[name="game_file"]');
                if (regularFileInput) {
                    // Only require file for create forms, not update forms
                    const isUpdateForm = regularFileInput.closest('form').querySelector('input[name="title"]')?.value;
                    regularFileInput.required = !isUpdateForm;
                    regularFileInput.disabled = false;
                }

                if (embedUrlInput) embedUrlInput.required = false;
                if (romSystemInput) romSystemInput.required = false;
            }
        });

        // Initialize section visibility on modal open
        $(document).on('system:modal:opened', function (event, data) {
            const $gameTypeSelect = $(data.modalContent).find('select[name="game_type"]');
            const $apiSection = $(data.modalContent).find('#api-enabled-section');
            const $romSystemSection = $(data.modalContent).find('#rom-system-section');
            const $romFileSection = $(data.modalContent).find('#rom-file-upload-section');

            if ($gameTypeSelect.length) {
                // Set initial visibility based on current game type
                const gameType = $gameTypeSelect.val();

                if ($apiSection.length) {
                    $apiSection.css('display', (gameType === 'flash' || gameType === 'rom') ? 'none' : 'block');
                }

                if ($romSystemSection.length) {
                    $romSystemSection.css('display', gameType === 'rom' ? 'block' : 'none');
                }

                if ($romFileSection.length) {
                    $romFileSection.css('display', gameType === 'rom' ? 'block' : 'none');
                }

                // Trigger change event to initialize form state
                $gameTypeSelect.trigger('change');
            }
        });
    }

    function initTemplate() {
        // Setup alert system
        alert.setup();

        // Initialize titansys functions
        system.modals();
        system.delete();
        system.actions();

        // Initialize PJAX for dashboard navigation
        initPjax();

        // Initialize modal event listeners
        initModalEventListeners();

        // Initialize cron guide functionality
        initCronGuide();

        // Initialize template activation functionality
        initTemplateActivation();
        
        // Initialize template deletion functionality
        initTemplateDeletion();

        // Initialize rebuild system functionality
        initRebuildSystem();

        // Handle preloader
        $('[system-preloader]').fadeOut('fast', function () {
            system.tables();
        });
    }

    function initModalEventListeners() {
        // Listen for modal open events to initialize custom functionality
        $(document).on('system:modal:opened', function (event, data) {
            // Initialize searchable country select
            initCountrySelect(data.modalContent);

            // Initialize searchable timezone select
            initTimezoneSelect(data.modalContent);

            // Initialize enhanced tags input for game forms
            initTagsInput(data.modalContent);
        });
    }

    function initCountrySelect($modalContent) {
        // Find country select elements in the modal
        const $countrySelects = $modalContent.find('.system-country-select');

        if ($countrySelects.length === 0) return;

        $countrySelects.each(function () {
            const $select = $(this);
            const originalValue = $select.val();

            // Add search functionality
            makeSelectSearchable($select, originalValue, __("forms.search_countries"));
        });
    }

    function initTimezoneSelect($modalContent) {
        // Find timezone select elements in the modal
        const $timezoneSelects = $modalContent.find('.system-timezone-select');

        if ($timezoneSelects.length === 0) return;

        $timezoneSelects.each(function () {
            const $select = $(this);
            const originalValue = $select.val();

            // Add search functionality
            makeSelectSearchable($select, originalValue, __("forms.search_timezones"));
        });
    }

    function makeSelectSearchable($select, originalValue, placeholder = __("forms.search")) {
        const $wrapper = $('<div class="relative"></div>');
        const $searchInput = $(`<input type="text" class="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-md placeholder-gray-400 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:shadow-lg" placeholder="${placeholder}">`);
        const $dropdown = $('<div class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>');

        // Store original options
        const options = [];
        $select.find('option').each(function () {
            const $option = $(this);
            options.push({
                value: $option.val(),
                text: $option.text(),
                selected: $option.prop('selected')
            });
        });

        // Hide original select
        $select.hide();

        // Wrap and add new elements
        $select.wrap($wrapper);
        $select.after($dropdown);
        $select.after($searchInput);

        // Set initial value if exists
        if (originalValue) {
            const selectedOption = options.find(opt => opt.value === originalValue);
            if (selectedOption) {
                $searchInput.val(selectedOption.text);
            }
        }

        // Filter and display options
        function updateDropdown(searchText = '') {
            $dropdown.empty();

            const filteredOptions = options.filter(option =>
                option.text.toLowerCase().includes(searchText.toLowerCase()) ||
                option.value.toLowerCase().includes(searchText.toLowerCase())
            );

            if (filteredOptions.length === 0) {
                const noResultsText = $select.hasClass('system-timezone-select') ? __("forms.no_timezones_found") : __("forms.no_countries_found");
                $dropdown.append(`<div class="px-4 py-2 text-gray-500">${noResultsText}</div>`);
            } else {
                filteredOptions.forEach(option => {
                    if (option.value === '') return; // Skip empty option

                    const $item = $(`<div class="px-4 py-2 cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200" data-value="${option.value}">${option.text}</div>`);
                    $dropdown.append($item);
                });
            }

            $dropdown.show();
        }

        // Handle search input
        $searchInput.on('input focus', function () {
            updateDropdown($(this).val());
        });

        // Handle option selection
        $dropdown.on('click', '[data-value]', function () {
            const value = $(this).data('value');
            const text = $(this).text();

            $searchInput.val(text);
            $select.val(value).trigger('change');
            $dropdown.hide();
        });

        // Handle blur to hide dropdown
        $searchInput.on('blur', function () {
            setTimeout(() => $dropdown.hide(), 200);
        });

        // Handle clicking outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest($searchInput.parent()).length) {
                $dropdown.hide();
            }
        });
    }

    function initPjax() {
        window.pjax = new Pjax({
            scrollTo: false,
            cacheBust: false,
            elements: '[system-nav]',
            selectors: [
                'title',
                '[system-navbar]',
                '[system-usernav]',
                '[system-wrapper]'
            ]
        });

        $(document).on('pjax:send', function () {
            if (window.table) {
                table.destroyTable();
                window.table = null;
            }

            // Close sidebar and remove sidebar-open class before navigation
            closeSidebar();
            $('body').removeClass('sidebar-open');

            topbar.show();
        });

        $(document).on('pjax:complete', function () {
            // Remove sidebar-open class to restore scrolling
            $('body').removeClass('sidebar-open');

            system.tables();
            topbar.hide();
            initUserDropdowns();
            initSidebar();
            initLanguageSwitcher();
            initClearCacheButton();
            initRebuildSystem();
        });
    }

    function initCategoryFormHandlers() {
        // Color picker sync for category forms (when modals are opened)
        $(document).on('system:modal:opened', function (event, data) {
            const $colorPicker = data.modalContent.find('input[type="color"][name="color"]');
            const $colorInput = data.modalContent.find('input[type="text"]#colorInput');
            const $presetColors = data.modalContent.find('.preset-color');

            // Initialize heroicons picker for category forms
            const $iconContainer = data.modalContent.find('#heroicons-picker-container');
            const $iconInput = data.modalContent.find('#iconInput');

            if ($iconContainer.length && $iconInput.length) {
                const picker = new HeroIconsPicker({
                    inputSelector: '#iconInput',
                    containerSelector: '#heroicons-picker-container',
                    onSelect: function (iconName) {
                        console.log('Selected icon:', iconName);
                    }
                });

                // Set initial value if editing
                const currentIcon = $iconInput.val();
                if (currentIcon) {
                    picker.setValue(currentIcon);
                }
            }

            if ($colorPicker.length && $colorInput.length) {
                // Update preset color selection based on current color
                function updatePresetSelection(color) {
                    $presetColors.removeClass('ring-4 ring-blue-400');
                    $presetColors.filter(`[data-color="${color}"]`).addClass('ring-4 ring-blue-400');
                }

                // Initialize with current color
                updatePresetSelection($colorPicker.val());

                // Preset color button clicks
                $presetColors.on('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    const color = $(this).data('color');
                    $colorPicker.val(color);
                    $colorInput.val(color);
                    updatePresetSelection(color);
                });

                // Sync color picker with text input
                $colorPicker.on('input', function () {
                    $colorInput.val(this.value);
                    updatePresetSelection(this.value);
                });

                // Sync text input with color picker
                $colorInput.on('input', function () {
                    const value = this.value;
                    if (/^#[0-9A-F]{6}$/i.test(value)) {
                        $colorPicker.val(value);
                        updatePresetSelection(value);
                    }
                });
            }
        });
    }

    function initPageFormHandlers() {
        // Handle Quill.js editor initialization for page forms
        $(document).on('system:modal:opened', function (event, data) {
            // Initialize Quill for create page form
            if (data.modalContent.find('#page-content-editor').length > 0) {
                initQuillEditor('#page-content-editor');
            }

            // Initialize Quill for update page form
            if (data.modalContent.find('#page-content-editor-update').length > 0) {
                initQuillEditor('#page-content-editor-update');
            }
        });

        // Clean up Quill when modals are closed
        $(document).on('hidden.bs.modal', function () {
            // Quill editors are automatically cleaned up when DOM elements are removed
            window.pageEditors = {};
        });
    }

    function initQuillEditor(selector) {
        // Initialize page editors object if it doesn't exist
        if (!window.pageEditors) {
            window.pageEditors = {};
        }

        const elementId = selector.replace('#', '');
        const element = document.getElementById(elementId);

        if (!element) return;

        // Create a container for Quill editor
        const editorContainer = document.createElement('div');
        editorContainer.id = elementId + '-quill';
        editorContainer.style.height = '300px';

        // Hide the textarea and insert the Quill container after it
        element.style.display = 'none';
        element.parentNode.insertBefore(editorContainer, element.nextSibling);

        // Initialize Quill
        const quill = new Quill('#' + elementId + '-quill', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'image'],
                    ['clean']
                ]
            },
            placeholder: __("forms.page_content_placeholder")
        });

        // Set initial content if textarea has value
        if (element.value) {
            quill.setContents(quill.clipboard.convert(element.value));
        }

        // Update textarea when Quill content changes
        quill.on('text-change', function () {
            element.value = quill.root.innerHTML;
        });

        // Also update on form submission to ensure content is saved
        $(element).closest('form').on('submit', function () {
            element.value = quill.root.innerHTML;
        });

        // Store the editor instance
        window.pageEditors[elementId] = quill;
    }

    // Copy page link functionality
    window.copyPageLink = function (slug) {
        const pageUrl = window.location.origin + '/page/' + slug;

        if (navigator.clipboard && window.isSecureContext) {
            // Use modern clipboard API
            navigator.clipboard.writeText(pageUrl).then(function () {
                alert.success(__('notifications.link_copied'));
            }).catch(function () {
                fallbackCopyToClipboard(pageUrl);
            });
        } else {
            // Fallback for older browsers
            fallbackCopyToClipboard(pageUrl);
        }
    };

    function fallbackCopyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, 99999);

        try {
            document.execCommand('copy');
            alert.success(__("notifications.page_link_copied"));
        } catch (err) {
            alert.error(__('notifications.copy_failed') + ': ' + text);
        }

        document.body.removeChild(textarea);
    }

    // Enhanced Tags Input System
    function initTagsInput($modalContent) {
        const $tagInput = $modalContent.find('#tagInput');
        const $tagsContainer = $modalContent.find('#tagsContainer');
        const $hiddenInput = $modalContent.find('#tagsHiddenInput');

        if (!$tagInput.length || !$tagsContainer.length || !$hiddenInput.length) return;

        let tags = [];

        // Initialize with existing tags if any
        const existingTags = $hiddenInput.val();
        if (existingTags) {
            tags = existingTags.split(',').map(tag => tag.trim()).filter(tag => tag);
            renderTags();
        }

        // Handle keydown events for Enter and Space
        $tagInput.on('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                addTag();
            } else if (e.key === 'Backspace' && $(this).val() === '' && tags.length > 0) {
                // Remove last tag if input is empty and backspace is pressed
                removeTag(tags.length - 1);
            }
        });

        // Handle blur event to add tag when focus is lost
        $tagInput.on('blur', function () {
            if ($(this).val().trim()) {
                addTag();
            }
        });

        function addTag() {
            const tagValue = $tagInput.val().trim();
            if (tagValue && !tags.includes(tagValue)) {
                tags.push(tagValue);
                $tagInput.val('');
                renderTags();
                updateHiddenInput();
            }
        }

        function removeTag(index) {
            tags.splice(index, 1);
            renderTags();
            updateHiddenInput();
        }

        function renderTags() {
            $tagsContainer.empty();

            tags.forEach((tag, index) => {
                const $tagPill = $(`
                    <div class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium animate-fadeIn">
                        <span>${escapeHtml(tag)}</span>
                        <button type="button" class="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none focus:text-blue-800 transition-colors duration-200" data-tag-index="${index}">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                `);

                $tagsContainer.append($tagPill);
            });

            // Show/hide container based on whether there are tags
            if (tags.length > 0) {
                $tagsContainer.removeClass('empty:hidden').show();
            } else {
                $tagsContainer.addClass('empty:hidden').hide();
            }
        }

        function updateHiddenInput() {
            $hiddenInput.val(tags.join(', '));
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

        // Handle tag removal clicks
        $tagsContainer.on('click', '[data-tag-index]', function (e) {
            e.preventDefault();
            const index = parseInt($(this).data('tag-index'));
            removeTag(index);
        });
    }

    function initCronGuide() {
        // Listen for modal open events to initialize cron functionality
        $(document).on('system:modal:opened', function (event, data) {
            // Check if this is the cron guide modal
            if (data.modalContent.find('.cronRunBtn').length > 0) {
                initCronRunButtons(data.modalContent);
            }
        });
    }

    function initCronRunButtons($modalContent) {
        const $runButtons = $modalContent.find('.cronRunBtn');

        $runButtons.each(function () {
            const $button = $(this);

            $button.on('click', function (e) {
                e.preventDefault();

                const job = $button.data('job');
                const originalText = $button.text();

                // Disable button and show loading state
                $button.prop('disabled', true);
                $button.text(__("dashboard.cron.running"));
                $button.addClass('opacity-50');

                // Get cron password from the modal data
                const cronPassword = $modalContent.find('[data-cron-password]').data('cron-password') || '';

                $.ajax({
                    url: `/cronjobs/${job}`,
                    method: 'GET',
                    data: { password: cronPassword },
                    dataType: 'json'
                })
                    .done(function (result) {
                        if (result.status === 200) {
                            // Success
                            $button.text(__('notifications.success'));
                            $button.removeClass('bg-green-600 hover:bg-green-700');
                            $button.addClass('bg-green-500');

                            // Reset button after 3 seconds
                            setTimeout(() => {
                                $button.text(originalText);
                                $button.addClass('bg-green-600 hover:bg-green-700');
                                $button.removeClass('bg-green-500 opacity-50');
                                $button.prop('disabled', false);
                            }, 3000);

                            alert.success(result.message);
                        } else {
                            alert.danger(result.message);
                        }
                    })
                    .fail(function (xhr, status, error) {
                        console.error('Cron job execution error:', error);

                        // Error
                        $button.text(__("dashboard.cron.failed"));
                        $button.removeClass('bg-green-600 hover:bg-green-700');
                        $button.addClass('bg-red-500');

                        // Get error message from response or use default
                        let errorMessage = __("dashboard.cron.failed_message");
                        if (xhr.responseJSON && xhr.responseJSON.message) {
                            errorMessage = xhr.responseJSON.message;
                        } else if (error) {
                            errorMessage = error;
                        }

                        // Reset button after 3 seconds
                        setTimeout(() => {
                            $button.text(originalText);
                            $button.addClass('bg-green-600 hover:bg-green-700');
                            $button.removeClass('bg-red-500 opacity-50');
                            $button.prop('disabled', false);
                        }, 3000);

                        alert.danger(errorMessage);
                    });
            });
        });
    }

    function initTemplateActivation() {
        // Initialize template activation buttons
        $(document).on('click', '.activate-template-btn', function (e) {
            e.preventDefault();
            
            const $button = $(this);
            const templateId = $button.data('template-id');
            
            if (!templateId) {
                alert.danger(__('dashboard.template_manager.template_id_not_found'));
                return;
            }
            
            activateTemplate(templateId, $button);
        });
    }

    function activateTemplate(templateId, $button) {
        // Store original button state
        const originalHtml = $button.html();
        const $buttonText = $button.find('span');
        const originalText = $buttonText.text();
        
        // Show loading state
        $button.prop('disabled', true);
        $button.removeClass('hover:shadow-xl hover:scale-105');
        $button.addClass('opacity-75 cursor-not-allowed');
        $buttonText.text(__('dashboard.template_manager.activating'));
        
        // Make AJAX request to activate template
        $.ajax({
            url: '/requests/activate-template',
            method: 'POST',
            data: {
                template_id: templateId
            },
            dataType: 'json'
        })
        .done(function (data) {
            const result = system._parseResponse(data);
            if (result.status === 200) {
                // Show success message
                pjax.loadUrl(`/dashboard/templates`);
                alert.success(result.message);
            } else {
                // Restore button state on error
                restoreButtonState($button, originalHtml);
                alert.danger(result.message);
            }
        })
        .fail(function (xhr, status, error) {
            // Restore button state on failure
            restoreButtonState($button, originalHtml);
            
            let errorMessage = __('dashboard.template_manager.activation_failed');
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            }
            
            alert.danger(errorMessage);
        });
    }

    function restoreButtonState($button, originalHtml) {
        $button.prop('disabled', false);
        $button.removeClass('opacity-75 cursor-not-allowed');
        $button.addClass('hover:shadow-xl hover:scale-105');
        $button.html(originalHtml);
    }

    function initTemplateDeletion() {
        // Initialize template delete buttons
        $(document).on('click', '[template-delete^="templates/"]', function (e) {
            e.preventDefault();
            
            const deleteId = $(this).attr('template-delete');
            const templateId = deleteId.replace('templates/', '');
            
            if (!templateId) {
                alert.danger(__('dashboard.template_manager.template_id_not_found'));
                return;
            }
            
            showTemplateDeleteConfirmation(templateId);
        });
    }

    function showTemplateDeleteConfirmation(templateId) {
        iziToast.question({
            title: __('dashboard.template_manager.delete_template'),
            message: __('dashboard.template_manager.delete_template_confirm', { template: templateId }),
            titleLineHeight: "25px",
            backgroundColor: "#E82753",
            position: "center",
            icon: false,
            drag: false,
            timeout: false,
            close: false,
            overlay: true,
            layout: 1,
            zindex: 1024,
            buttons: [
                ["<button style=\"color: white !important;\">" + __('notifications.confirm') + "</button>", function(instance, toast) {
                    executeTemplateDelete(templateId, instance, toast);
                }, true],
                ["<button style=\"color: white !important;\">" + __('notifications.cancel') + "</button>", function(instance, toast) {
                    instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                }]
            ]
        });
    }

    function executeTemplateDelete(templateId, instance, toast) {
        instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        system.loader(__("notifications.processing_request"));

        $.ajax({
            url: `/requests/delete-template/${templateId}`,
            type: "GET",
            success: function(response) {
                system.loader(false, false);
                const result = system._parseResponse(response);
                handleTemplateDeleteResponse(result);
            },
            error: function() {
                system.loader(false, false);
                alert.danger(__("notifications.error"));
            }
        });
    }

    function handleTemplateDeleteResponse(response) {
        switch (response.status) {
            case 200:
                pjax.loadUrl(`/dashboard/templates`);
                alert.success(response.message);
                break;
            case 302:
                alert.warning(__('notifications.session_expired'), true);
                break;
            default:
                alert.danger(response.message);
        }
    }

    function initRebuildSystem() {
        // Initialize rebuild assets button
        $('#rebuildAssetsBtn').on('click', function (e) {
            e.preventDefault();
            showRebuildConfirmation();
        });
    }

    function showRebuildConfirmation() {
        iziToast.question({
            title: __('dashboard.template_manager.rebuild_assets'),
            message: __('dashboard.template_manager.rebuild_confirm'),
            titleLineHeight: "25px",
            backgroundColor: "#FB923C",
            position: "center",
            icon: false,
            drag: false,
            timeout: false,
            close: false,
            overlay: true,
            layout: 1,
            zindex: 1024,
            buttons: [
                [`<button style="color: white !important;">${__("notifications.confirm")}</button>`, function (instance, toast) {
                    instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                    executeRebuildAssets();
                }, true],
                [`<button style="color: white !important;">${__("notifications.cancel")}</button>`, function (instance, toast) {
                    instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                }]
            ]
        });
    }

    function executeRebuildAssets() {
        system.loader(__("dashboard.template_manager.rebuilding_assets"));

        $.ajax({
            url: '/requests/rebuild-assets',
            method: 'POST',
            dataType: 'json'
        })
        .done(function (data) {
            system.loader(false, false);
            const result = system._parseResponse(data);
            if (result.status === 200) {
                alert.success(result.message);
            } else {
                alert.danger(result.message);
            }
        })
        .fail(function (xhr, status, error) {
            system.loader(false, false);
            let errorMessage = __('dashboard.template_manager.rebuild_failed');
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            }
            alert.danger(errorMessage);
        });
    }

    // Global utility functions
    window.dashboardUtils = {
        toggleSidebar: toggleSidebar,
        openSidebar: openSidebar,
        closeSidebar: closeSidebar,
        initGameFormHandlers: initGameFormHandlers,
        initCategoryFormHandlers: initCategoryFormHandlers,
        initPageFormHandlers: initPageFormHandlers,
        initTagsInput: initTagsInput,
        initCronGuide: initCronGuide
    };

})(jQuery);