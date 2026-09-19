/**
 * Core System Functions
 * Shared utilities and components used across all templates
 */

(function($) {
    "use strict";
    
    // Core System utilities
    window.system = {

        /**
         * Initialize or reload data tables
         * @param {boolean} reload - Whether to reload existing table
         */
        tables: function(reload = false) {
            if (reload && window.table) {
                table.refetchTable();
            } else {
                const tableId = $("[system-table]").attr("system-table");
                if (tableId) {
                    window.table = new TableHandler({
                        tableSelector: '#systemTable',
                        paginationSelector: '#systemPagination',
                        searchSelector: '#systemSearchInput',
                        rowsPerPageSelector: '#systemRowsPerPage',
                        fetchUrl: `/tables/${tableId}`
                    });
                }
            }
        },

        /**
         * Show/hide loading overlay
         * @param {string} msg - Loading message
         * @param {boolean} state - Show/hide state
         * @param {string} element - Target element selector
         */
        loader: function(msg, state = true, element = "body") {
            const $target = $(element);
            
            if (state) {
                $target.loading({
                    stoppable: false,
                    zIndex: 1100,
                    message: this._createLoaderHTML(msg)
                });
            } else {
                $target.loading("stop");
            }
        },

        /**
         * Create loading HTML template
         * @private
         */
        _createLoaderHTML: function(msg) {
            return `
                <div class="flex flex-col items-center justify-center space-y-4">
                    <div class="relative">
                        <div class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <div class="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-blue-400 rounded-full animate-ping"></div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-semibold text-gray-700">${msg}</div>
                        <div class="text-sm text-gray-500">${__("notifications.please_wait")}</div>
                    </div>
                </div>
            `;
        },

        /**
         * Handle global action buttons
         */
        actions: function() {
            $(document).on("click", "[system-action]", function(e) {
                e.preventDefault();
                const action = $(this).attr("system-action");
                system._handleAction(action);
            });
        },

        /**
         * Process individual actions
         * @private
         */
        _handleAction: function(action) {
            const actions = {
                logout: function() {
                    $.get(`/auth/logout`)
                        .done(function(response) {
                            const result = system._parseResponse(response);
                            if (result.status === 200) {
                                alert.success(result.message, true);
                            } else {
                                location.reload();
                            }
                        })
                        .fail(function() {
                            alert.danger(__('notifications.error'));
                        });
                }
            };

            if (actions[action]) {
                actions[action]();
            } else {
                alert.danger(__('errors.invalid_request'));
            }
        },

        /**
         * Disable/enable form elements
         * @param {boolean} disabled - Disable state
         */
        disabled: function(disabled = true) {
            const $elements = $(".form-control, .input, button[type=submit]");
            if (disabled) {
                $elements.attr("disabled", "");
            } else {
                $elements.removeAttr("disabled");
            }
        },

        /**
         * Redirect to specified path
         * @param {string} path - Target URL
         */
        redirect: function(path) {
            window.location.href = path;
        },

        /**
         * Handle delete confirmations
         */
        delete: function() {
            $(document).on("click", "[system-delete]", function(e) {
                e.preventDefault();
                const deleteId = $(this).attr("system-delete");
                if (!deleteId) return;

                system._showDeleteConfirmation(deleteId);
            });
        },

        /**
         * Show delete confirmation dialog
         * @private
         */
        _showDeleteConfirmation: function(deleteId) {
            iziToast.question({
                title: __('forms.delete'),
                message: __('notifications.delete_confirm'),
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
                        system._executeDelete(deleteId, instance, toast);
                    }, true],
                    ["<button style=\"color: white !important;\">" + __('notifications.cancel') + "</button>", function(instance, toast) {
                        instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                    }]
                ]
            });
        },

        /**
         * Execute delete operation
         * @private
         */
        _executeDelete: function(deleteId, instance, toast) {
            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
            system.loader(__("notifications.processing_request"));

            $.ajax({
                url: `/requests/delete/${deleteId}`,
                type: "GET",
                success: function(response) {
                    system.loader(false, false);
                    const result = system._parseResponse(response);
                    system._handleDeleteResponse(result);
                },
                error: function() {
                    system.loader(false, false);
                    alert.danger(__("notifications.error"));
                }
            });
        },

        /**
         * Handle delete response
         * @private
         */
        _handleDeleteResponse: function(response) {
            switch (response.status) {
                case 200:
                    if (window.table) table.refetchTable();
                    alert.success(response.message);
                    break;
                case 302:
                    alert.warning(__('notifications.session_expired'), true);
                    break;
                default:
                    alert.danger(response.message);
            }
        },

        /**
         * Initialize modal system
         */
        modals: function() {
            this._createModalContainer();
            this._bindModalEvents();
        },

        /**
         * Create modal container if it doesn't exist
         * @private
         */
        _createModalContainer: function() {
            if ($("#systemModalContainer").length) return;

            $("body").append(`
                <div id="systemModalContainer" class="fixed inset-0 z-[1099] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4" style="display: none;">
                    <div id="systemModalDialog" class="w-full max-w-lg mx-auto transition-all duration-300 transform -translate-y-12 opacity-0">
                        <div id="systemModalContent" class="bg-white rounded-2xl shadow-2xl">
                            <!-- Modal content will be injected here -->
                        </div>
                    </div>
                </div>
            `);
        },

        /**
         * Bind modal event handlers
         * @private
         */
        _bindModalEvents: function() {
            // Modal toggle handler
            $(document).on("click", "[system-toggle]", function(e) {
                e.preventDefault();
                topbar.show();
                const modalPath = $(this).attr("system-toggle");
                if (modalPath) {
                    system._loadModal(modalPath);
                }
            });

            // Close modal handlers
            $(document).on("click", ".modal-close", function(e) {
                system.hideModal();
            });

            $(document).on("click", "#systemModalContent button[type='button']", function(e) {
                const $btn = $(this);
                // Exclude Quill editor toolbar buttons
                if ($btn.closest('.ql-toolbar').length) {
                    return;
                }
                if ($btn.find('svg').length || $btn.hasClass('text-gray-400') || $btn.text().trim() === '') {
                    e.preventDefault();
                    system.hideModal();
                }
            });

            // ESC key to close modal
            $(document).on("keydown", function(e) {
                if (e.key === "Escape" && $("#systemModalContainer").is(":visible")) {
                    system.hideModal();
                }
            });
        },

        /**
         * Load modal content
         * @private
         */
        _loadModal: function(modalPath) {
            $.get(`/widgets/${modalPath}?_=${Date.now()}`)
                .done(function(response) {
                    system.loader(false, false);
                    const modal = system._parseResponse(response);
                    system._handleModalResponse(modal);
                    topbar.hide();
                })
                .fail(function() {
                    system.loader(false, false);
                    alert.danger(__("notifications.error"));
                    topbar.hide();
                });
        },

        /**
         * Handle modal response
         * @private
         */
        _handleModalResponse: function(modal) {
            switch (modal.status) {
                case 200:
                    this._setupModal(modal);
                    this.showModal();
                    if (modal.data.vars.type) {
                        this._bindModalForm(modal);
                    }
                    break;
                case 302:
                    alert.warning(__('notifications.session_expired'), true);
                    break;
                default:
                    alert.danger(modal.message);
            }
        },

        /**
         * Setup modal content and size
         * @private
         */
        _setupModal: function(modal) {
            const $dialog = $("#systemModalDialog");
            const sizes = {
                sm: "max-w-sm",
                md: "max-w-lg", 
                lg: "max-w-xl",
                xl: "max-w-2xl",
                xxl: "max-w-4xl"
            };

            // Reset size classes
            $dialog.removeClass("max-w-sm max-w-lg max-w-xl max-w-2xl max-w-4xl");
            
            // Apply new size
            const size = modal.data.vars.size || 'xl';
            $dialog.addClass(`${sizes[size]}`);
            
            // Set content
            $("#systemModalBody").remove();
            $("#systemModalContent").html(modal.data.tpl);
        },

        /**
         * Bind modal form submission
         * @private
         */
        _bindModalForm: function(modal) {
            $("#systemModalContent [system-form]").off("submit").on("submit", function(e) {
                e.preventDefault();
                system._submitModalForm(this, modal);
            });
        },

        /**
         * Submit modal form
         * @private
         */
        _submitModalForm: function(form, modal) {
            const formData = new FormData(form);
            
            // Handle unchecked checkboxes - ensure they are included with value '0'
            $(form).find('input[type="checkbox"]').each(function() {
                const checkbox = $(this);
                const name = checkbox.attr('name');
                if (name && !checkbox.is(':checked')) {
                    // Add unchecked checkbox with value '0'
                    formData.append(name, '0');
                }
            });
            
            if (modal.data.vars.id) {
                formData.append("id", modal.data.vars.id);
            }

            // Validate required fields
            if (!this._validateModalForm(formData, modal.data.vars.require)) {
                return;
            }

            system.disabled();
            if (modal.data.vars.loader) {
                system.loader(modal.data.vars.loader);
            }

            $.ajax({
                url: `/requests/${modal.data.vars.type}/${modal.data.vars.tpl}`,
                type: "POST",
                data: formData,
                contentType: false,
                processData: false,
                success: function(response) {
                    system._handleFormResponse(response, modal.data.vars.loader);
                },
                error: function() {
                    system.disabled(false);
                    if (modal.data.vars.loader) {
                        system.loader(false, false);
                    }
                    alert.danger(__("notifications.error"));
                }
            });
        },

        /**
         * Validate modal form fields
         * @private
         */
        _validateModalForm: function(formData, requireConfig) {
            if (!requireConfig) return true;

            const fields = requireConfig.split("<=>");
            for (const field of fields) {
                if (!field) continue;
                
                const [fieldName, errorMsg] = field.split("|");
                try {
                    if (formData.get(fieldName)?.length < 1) {
                        alert.warning(__('forms.field_required', {field: errorMsg}));
                        return false;
                    }
                } catch (e) {
                    if (formData.getAll(`${fieldName}[]`)?.length < 1) {
                        alert.warning(__('forms.field_required', {field: errorMsg}));
                        return false;
                    }
                }
            }
            return true;
        },

        /**
         * Handle form submission response
         * @private
         */
        _handleFormResponse: function(response, hasLoader) {
            const processResponse = () => {
                const result = system._parseResponse(response);
                system._processFormResult(result);
            };

            if (hasLoader) {
                setTimeout(() => {
                    system.loader(false, false);
                    processResponse();
                }, 1000);
            } else {
                processResponse();
            }
            
            system.disabled(false);
        },

        /**
         * Process form submission result
         * @private
         */
        _processFormResult: function(response) {
            const actions = {
                200: () => {
                    if (window.table) table.refetchTable();
                    if ($("#rebuildAssetsBtn").length) pjax.loadUrl(`/dashboard/templates`);
                    system.hideModal();
                    alert.success(response.message);
                },
                301: () => {
                    system.hideModal();
                    alert.success(response.message, true);
                },
                302: () => {
                    system.hideModal();
                    alert.warning(__('notifications.session_expired'), true);
                },
                303: () => {
                    system.hideModal();
                    alert.warning(response.message);
                    setTimeout(() => system.redirect(response.data), 3000);
                },
                304: () => {
                    system.hideModal();
                    alert.success(response.message);
                    setTimeout(() => system.redirect(response.data), 5000);
                }
            };

            if (actions[response.status]) {
                actions[response.status]();
            } else {
                alert.danger(response.message);
            }
        },

        /**
         * Show modal with animation
         */
        showModal: function() {
            const $container = $("#systemModalContainer");
            const $dialog = $("#systemModalDialog");
            
            $container.fadeIn(200, function() {
                $dialog.css({
                    "transform": "translateY(0)",
                    "opacity": "1"
                });
                
                // Dispatch custom modal open event for templates to listen to
                $(document).trigger('system:modal:opened', {
                    modalContainer: $container,
                    modalDialog: $dialog,
                    modalContent: $("#systemModalContent")
                });
            });
        },

        /**
         * Hide modal with animation
         */
        hideModal: function() {
            const $container = $("#systemModalContainer");
            const $dialog = $("#systemModalDialog");
            
            $dialog.css({
                "transform": "translateY(-50px)",
                "opacity": "0"
            });
            
            setTimeout(() => $container.fadeOut(200), 300);
        },

        /**
         * Parse JSON response safely
         * @private
         */
        _parseResponse: function(response) {
            try {
                return typeof response === "string" ? JSON.parse(response) : response;
            } catch (e) {
                return { status: 500, message: __("errors.invalid_response_format") };
            }
        }
    };

    // Alert system
    window.alert = {
        /**
         * Setup iziToast defaults
         */
        setup: function() {
            iziToast.settings({
                title: __("notifications.attention"),
                titleSize: "18px",
                titleLineHeight: "25px",
                messageSize: "17px",
                messageLineHeight: "20px",
                icon: false,
                timeout: 3000,
                animateInside: true,
                titleColor: "#f5f5f5",
                messageColor: "#f5f5f5",
                iconColor: "#f5f5f5",
                transitionIn: "fadeInRight",
                transitionOut: "fadeOutRight",
                position: "topLeft",
                displayMode: "replace",
                layout: 2,
                maxWidth: "300px",
                close: false
            });
        },

        /**
         * Show primary notification
         */
        primary: function(message, redirect = false, overlap = false, title = false, notify = false, image = false) {
            this._showNotification('info', message, "#465fff", redirect, overlap, title, notify, image);
        },

        /**
         * Show success notification
         */
        success: function(message, redirect = false, overlap = false, title = false, notify = false, image = false) {
            this._showNotification('success', message, "#00c52c", redirect, overlap, title, notify, image);
        },

        /**
         * Show warning notification
         */
        warning: function(message, redirect = false, overlap = false, title = false, notify = false, image = false) {
            this._showNotification('warning', message, "#FE9431", redirect, overlap, title, notify, image);
        },

        /**
         * Show error notification
         */
        danger: function(message, redirect = false, overlap = false, title = false, notify = false, image = false) {
            this._showNotification('error', message, "#E82753", redirect, overlap, title, notify, image);
        },

        /**
         * Show notification with specified type
         * @private
         */
        _showNotification: function(type, message, backgroundColor, redirect, overlap, title, notify, image) {
            const config = {
                backgroundColor: backgroundColor,
                message: message,
                onClosed: () => {
                    if (redirect) location.reload();
                }
            };

            if (overlap) {
                Object.assign(config, {
                    title: title || false,
                    displayMode: 0,
                    image: image || false,
                    imageWidth: image ? 85 : undefined,
                    timeout: notify ? false : 3000,
                    close: notify || false,
                    maxWidth: notify ? "600px" : "300px",
                    position: "bottomLeft"
                });
            }

            iziToast[type](config);
        }
    };

})(jQuery);