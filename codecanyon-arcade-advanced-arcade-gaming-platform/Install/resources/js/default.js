(function ($) {
    "use strict";

    $(function () {

        // Initialize menu functionality
        initMenu();

        // Initialize smooth scrolling for horizontal containers
        initHorizontalScrolling();

        // Initialize authentication handling
        initAuthentication();

        // Initialize forgot password functionality
        initForgotPassword();

        // Initialize reset password functionality
        initResetPassword();

        // Initialize user dropdowns
        initUserDropdowns();

        // Initialize settings handling
        initSettings();

        // Initialize template functionality
        initTemplate();

        // Initialize follow management
        initFollowManagement();

        // Initialize WebSocket connection
        initWebSocket();

        // Initialize floating chat system
        initFloatingChat();

        // Initialize carousel functionality
        initCarousel();

        // Initialize play page functionality
        initPlayPage();

        // Initialize leaderboard functionality
        initLeaderboard();

        // Initialize leaderboard page functionality
        initLeaderboardPage();

        // Initialize search functionality
        initSearch();

        // Initialize language switcher
        initLanguageSwitcher();

        // Initialize games page functionality
        initGamesPage();

        // Initialize promo modal for guests
        setupPromoModal();

        // Initialize category links hover effects
        initCategoryHoverEffects();

        // Initialize universal password toggle (always available)
        initPasswordToggle();

        // Initialize dark mode
        initDarkMode();
        
        // Setup global dark mode event delegation (survives PJAX navigation)
        setupGlobalDarkModeHandlers();
        
        // Setup dark mode mutation observer
        setupDarkModeObserver();
    });

    function initMenu() {
        const $menuBtn = $('#menuBtn');
        const $closeBtn = $('#closeBtn');
        const $sidebar = $('#sidebar');
        const $overlay = $('#overlay');

        function openMenu() {
            const isRTL = document.documentElement.dir === 'rtl';
            if (isRTL) {
                $sidebar.removeClass('translate-x-full').addClass('translate-x-0');
            } else {
                $sidebar.removeClass('-translate-x-full').addClass('translate-x-0');
            }
            $overlay.removeClass('hidden');
            $('body').css('overflow', 'hidden'); // Prevent background scroll
        }

        function closeMenu() {
            const isRTL = document.documentElement.dir === 'rtl';
            if (isRTL) {
                $sidebar.removeClass('translate-x-0').addClass('translate-x-full');
            } else {
                $sidebar.removeClass('translate-x-0').addClass('-translate-x-full');
            }
            $overlay.addClass('hidden');
            $('body').css('overflow', ''); // Restore scroll
        }

        // Event listeners with touch support
        $menuBtn.on('click', openMenu);
        $closeBtn.on('click', closeMenu);
        $overlay.on('click', closeMenu);

        // Close menu on escape key
        $(document).on('keydown', function (e) {
            const isOpen = $sidebar.hasClass('translate-x-0');
            if (e.key === 'Escape' && isOpen) {
                closeMenu();
            }
        });

        // Close menu on window resize (if mobile menu is open on desktop)
        $(window).on('resize', function () {
            const isOpen = $sidebar.hasClass('translate-x-0');
            if (window.innerWidth >= 1024 && isOpen) {
                closeMenu();
            }
        });
    }

    function initHorizontalScrolling() {
        // Add smooth scrolling to all horizontal scroll containers
        $('[id$="-list"]').each(function () {
            const container = this;
            let isDown = false;
            let startX;
            let scrollLeft;

            $(container).on('mousedown', function (e) {
                isDown = true;
                container.style.cursor = 'grabbing';
                startX = e.pageX - container.offsetLeft;
                scrollLeft = container.scrollLeft;
            });

            $(container).on('mouseleave', function () {
                isDown = false;
                container.style.cursor = 'grab';
            });

            $(container).on('mouseup', function () {
                isDown = false;
                container.style.cursor = 'grab';
            });

            $(container).on('mousemove', function (e) {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const walk = (x - startX) * 2;
                container.scrollLeft = scrollLeft - walk;
            });
        });
    }

    // Function to dynamically load reCAPTCHA when needed
    function loadRecaptchaIfNeeded() {
        // Check if we're on an auth page and if reCAPTCHA elements exist
        const authPages = ['/login', '/register', '/forgot-password', '/reset-password'];
        const currentPath = window.location.pathname;
        const isAuthPage = authPages.some(page => currentPath.includes(page));
        const hasRecaptchaElements = $('.g-recaptcha').length > 0;

        if (isAuthPage && hasRecaptchaElements && typeof grecaptcha === 'undefined') {
            // Check if script is already being loaded
            if (!window.recaptchaLoading && !document.querySelector('script[src*="recaptcha/api.js"]') && typeof grecaptcha === 'undefined') {
                window.recaptchaLoading = true;

                // Create and load reCAPTCHA script using vanilla JavaScript
                const recaptchaScript = document.createElement('script');
                recaptchaScript.src = 'https://www.google.com/recaptcha/api.js';
                recaptchaScript.async = true;
                recaptchaScript.defer = true;
                recaptchaScript.onload = function () {
                    window.recaptchaLoading = false;
                    // Render reCAPTCHA elements once loaded
                    setTimeout(function () {
                        if (typeof grecaptcha !== 'undefined') {
                            $('.g-recaptcha').each(function () {
                                const siteKey = $(this).data('sitekey');
                                if (siteKey && !$(this).children().length) {
                                    grecaptcha.render(this, {
                                        'sitekey': siteKey
                                    });
                                }
                            });
                        }
                    }, 100);
                };
                recaptchaScript.onerror = function () {
                    window.recaptchaLoading = false;
                    console.warn('Failed to load reCAPTCHA script');
                };
                document.head.appendChild(recaptchaScript);
            }
        }

        // If reCAPTCHA is already loaded, just render elements
        if (hasRecaptchaElements && typeof grecaptcha !== 'undefined') {
            $('.g-recaptcha').each(function () {
                const siteKey = $(this).data('sitekey');
                if (siteKey && !$(this).children().length) {
                    grecaptcha.render(this, {
                        'sitekey': siteKey
                    });
                }
            });
        }
    }

    function initAuthentication() {
        // Load reCAPTCHA if needed for auth pages
        loadRecaptchaIfNeeded();

        // Handle authentication forms (login/register)
        $('[system-auth-form]').on('submit', function (e) {
            e.preventDefault();

            const formType = $(this).attr('system-auth-form');
            const formData = new FormData(this);

            // Show loading state
            const $submitBtn = $(this).find('button[type="submit"]');
            const $btnText = $submitBtn.find('.btn-text');
            const $btnLoading = $submitBtn.find('.btn-loading');

            $submitBtn.prop('disabled', true);
            $btnText.addClass('hidden');
            $btnLoading.removeClass('hidden');

            // Clear previous errors
            $('.text-red-500').addClass('hidden');

            $.ajax({
                url: `/auth/${formType}`,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    if (response.status === 200) {
                        // Show success message
                        alert.success(response.message, true);
                    } else {
                        alert.danger(response.message);

                        // Reset button state
                        $submitBtn.prop('disabled', false);
                        $btnText.removeClass('hidden');
                        $btnLoading.addClass('hidden');

                        // Reset reCAPTCHA on failed submission
                        if (typeof grecaptcha !== 'undefined') {
                            grecaptcha.reset();
                        }
                    }
                },
                error: function (xhr) {
                    let errorMessage = __('errors.generic');
                    let showEmailVerification = false;
                    let userEmail = '';
                    let isCSRFError = false;

                    try {
                        const response = JSON.parse(xhr.responseText);
                        errorMessage = response.message || response.error || errorMessage;

                        // Check for CSRF token errors
                        if (response.code === 'CSRF_INVALID') {
                            isCSRFError = true;
                            errorMessage = __('errors.csrf_expired');
                        }
                        // Check for rate limiting errors
                        else if (response.code === 'RATE_LIMIT_EXCEEDED') {
                            errorMessage = __('errors.rate_limit');
                        }
                        else if (response.code === 'AUTH_RATE_LIMIT_EXCEEDED') {
                            errorMessage = __('errors.auth_rate_limit');
                        }
                        // Check if this is an email verification error
                        else if (response.data && response.data.error_type === 'email_not_verified') {
                            showEmailVerification = true;
                            userEmail = response.data.email || '';
                        }
                    } catch (e) {
                        // Use default error message
                    }

                    // Show appropriate error message
                    if (isCSRFError) {
                        alert.warning(errorMessage, true); // true triggers page reload
                    } else {
                        alert.danger(errorMessage);
                    }

                    // Show email verification section if needed
                    if (showEmailVerification) {
                        const $verificationSection = $('#emailVerificationSection');
                        $verificationSection.removeClass('hidden');

                        // Store email for resend functionality
                        $verificationSection.data('email', userEmail);
                    }

                    // Reset button state
                    $submitBtn.prop('disabled', false);
                    $btnText.removeClass('hidden');
                    $btnLoading.addClass('hidden');

                    // Reset reCAPTCHA on error
                    if (typeof grecaptcha !== 'undefined') {
                        grecaptcha.reset();
                    }
                }
            });
        });

        // Handle resend verification email
        $(document).off('click', '#resendVerificationBtn').on('click', '#resendVerificationBtn', function () {
            const $btn = $(this);
            const $btnText = $btn.find('.btn-text');
            const $btnLoading = $btn.find('.btn-loading');
            const $verificationSection = $('#emailVerificationSection');
            const email = $verificationSection.data('email') || $('#username').val();

            if (!email) {
                alert.danger(__('auth.email_required'));
                return;
            }

            // Show loading state
            $btn.prop('disabled', true);
            $btnText.addClass('hidden');
            $btnLoading.removeClass('hidden');

            $.ajax({
                url: '/auth/resend-verification',
                type: 'POST',
                data: {
                    email: email,
                    _csrf: $('meta[name="csrf-token"]').attr('content') || $('input[name="_csrf"]').val()
                },
                success: function (response) {
                    if (response.status === 200) {
                        alert.success(response.message);
                    } else {
                        alert.danger(response.message);
                    }
                },
                error: function (xhr) {
                    let errorMessage = __('errors.email_send_failed');
                    let isCSRFError = false;

                    try {
                        const response = JSON.parse(xhr.responseText);
                        errorMessage = response.message || response.error || errorMessage;

                        // Check for CSRF token errors
                        if (response.code === 'CSRF_INVALID') {
                            isCSRFError = true;
                            errorMessage = __('errors.csrf_expired');
                        }
                        // Check for rate limiting errors
                        else if (response.code === 'RATE_LIMIT_EXCEEDED') {
                            errorMessage = __('errors.rate_limit');
                        }
                        else if (response.code === 'AUTH_RATE_LIMIT_EXCEEDED') {
                            errorMessage = __('errors.auth_rate_limit_attempts');
                        }
                    } catch (e) {
                        // Use default error message
                    }

                    // Show appropriate error message
                    if (isCSRFError) {
                        alert.warning(errorMessage, true); // true triggers page reload
                    } else {
                        alert.danger(errorMessage);
                    }
                },
                complete: function () {
                    // Reset button state
                    $btn.prop('disabled', false);
                    $btnText.removeClass('hidden');
                    $btnLoading.addClass('hidden');
                }
            });
        });

    }

    function initPasswordToggle() {
        // Universal password visibility toggle handler that works across all pages
        $(document).on('click', '[id^="toggle"][id*="Password"]', function () {
            const $button = $(this);
            const buttonId = $button.attr('id');

            // Map button IDs to their target input fields
            const targetMap = {
                'togglePassword': '#password',
                'toggleConfirmPassword': '#confirm_password',
                'toggleCurrentPassword': '#current_password',
                'toggleNewPassword': '#new_password'
            };

            const targetSelector = targetMap[buttonId];
            if (!targetSelector) return;

            const $passwordField = $(targetSelector);
            if ($passwordField.length === 0) return;

            const currentType = $passwordField.attr('type');
            const newType = currentType === 'password' ? 'text' : 'password';
            $passwordField.attr('type', newType);

            // Toggle eye icon - find the SVG inside the button
            const $eyeIcon = $button.find('svg').first();
            if ($eyeIcon.length > 0) {
                if (newType === 'text') {
                    // Show "eye-slash" icon (password is visible)
                    $eyeIcon.html(`
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m3.121-3.121L21 21m-6.879-6.879L12 12m0 0l3.121-3.121"/>
                    `);
                } else {
                    // Show "eye" icon (password is hidden)
                    $eyeIcon.html(`
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    `);
                }
            }
        });
    }

    function initDarkMode() {
        // Initialize dark mode state and setup event handlers
        initDarkModeState();
        setupDarkModeHandlers();
    }
    
    function initDarkModeState() {
        // Temporarily disable transitions to prevent flash on load
        $('html').addClass('no-transitions');
        
        // Initialize dark mode on page load
        const isDarkMode = getDarkModePreference();
        setDarkMode(isDarkMode);
        
        // Re-enable transitions after a short delay
        setTimeout(() => {
            $('html').removeClass('no-transitions');
        }, 100);
    }
    
    function setupDarkModeHandlers() {
        // Debug: Check if buttons exist
        const $buttons = $('#darkModeToggle, #mobileDarkModeToggle');
        console.log('Dark mode buttons found:', $buttons.length);
        
        // Remove existing event handlers to prevent duplicates
        $buttons.off('click.darkmode');
        
        // Setup toggle button event listeners with namespaced events
        $buttons.on('click.darkmode', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Dark mode toggle clicked via direct handler, button ID:', this.id);
            toggleDarkMode();
        });
        
        // Also ensure the buttons are visible and clickable
        $buttons.each(function() {
            const $btn = $(this);
            if ($btn.css('display') === 'none' || $btn.css('visibility') === 'hidden') {
                console.warn('Dark mode button is hidden:', this.id);
            }
        });
    }
    
    function setupGlobalDarkModeHandlers() {
        // Use event delegation on document for dark mode toggles (survives PJAX navigation)
        $(document).off('click.darkmode-global').on('click.darkmode-global', '#darkModeToggle, #mobileDarkModeToggle', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Dark mode toggle clicked via global delegation, button ID:', this.id);
            toggleDarkMode();
        });
    }
    
    // Debug function for troubleshooting dark mode issues
    window.debugDarkMode = function() {
        const $html = $('html');
        const $buttons = $('#darkModeToggle, #mobileDarkModeToggle');
        const currentMode = $html.hasClass('dark') ? 'dark' : 'light';
        const storedMode = localStorage.getItem('darkMode');
        
        console.log('=== Dark Mode Debug Info ===');
        console.log('Current HTML class:', $html.attr('class'));
        console.log('Current mode:', currentMode);
        console.log('Stored preference:', storedMode);
        console.log('Dark mode buttons found:', $buttons.length);
        
        $buttons.each(function(index) {
            const $btn = $(this);
            console.log(`Button ${index + 1} (${this.id}):`);
            console.log('  - Visible:', $btn.is(':visible'));
            console.log('  - Display:', $btn.css('display'));
            console.log('  - Visibility:', $btn.css('visibility'));
            console.log('  - Events:', $._data(this, 'events'));
        });
        
        return {
            currentMode,
            storedMode,
            buttonsFound: $buttons.length,
            htmlClasses: $html.attr('class')
        };
    };
    
    // Test function to manually toggle dark mode
    window.testDarkModeToggle = function() {
        console.log('Testing dark mode toggle...');
        toggleDarkMode();
    };
    
    // Setup mutation observer to detect when dark mode buttons are added to DOM
    function setupDarkModeObserver() {
        if (typeof MutationObserver === 'undefined') {
            return;
        }
        
        const observer = new MutationObserver(function(mutations) {
            let needsReinitialization = false;
            
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                            const $node = $(node);
                            if ($node.is('#darkModeToggle, #mobileDarkModeToggle') || 
                                $node.find('#darkModeToggle, #mobileDarkModeToggle').length > 0) {
                                needsReinitialization = true;
                            }
                        }
                    });
                }
            });
            
            if (needsReinitialization) {
                console.log('Dark mode buttons detected in DOM, reinitializing handlers...');
                setTimeout(() => {
                    setupDarkModeHandlers();
                }, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialize the mutation observer
    $(document).ready(function() {
        setupDarkModeObserver();
        
        // Periodic check to ensure dark mode state is consistent
        setInterval(function() {
            const $html = $('html');
            const currentlyDark = $html.hasClass('dark');
            const storedPreference = localStorage.getItem('darkMode') === 'true';
            
            // If there's a mismatch between stored preference and current state, fix it
            if (currentlyDark !== storedPreference) {
                console.warn('Dark mode state mismatch detected, correcting...', {
                    current: currentlyDark,
                    stored: storedPreference
                });
                setDarkMode(storedPreference);
            }
        }, 5000); // Check every 5 seconds
    });

    function getDarkModePreference() {
        // Check localStorage first
        const stored = localStorage.getItem('darkMode');
        if (stored !== null) {
            return stored === 'true';
        }
        
        // Fall back to system preference
        if (window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        
        // Default to light mode
        return false;
    }

    function setDarkMode(isDark) {
        try {
            const $html = $('html');
            
            console.log('Setting dark mode to:', isDark);
            
            if (isDark) {
                $html.addClass('dark');
            } else {
                $html.removeClass('dark');
            }
            
            // Store preference
            localStorage.setItem('darkMode', isDark.toString());
            
            // Force a repaint to ensure the change is applied
            $html[0].offsetHeight;
            
            console.log('Dark mode class applied:', $html.hasClass('dark'));
            
            // Update icon visibility (handled by CSS classes)
            // The icons have dark:hidden and dark:block classes for automatic switching
            
        } catch (error) {
            console.error('Error setting dark mode:', error);
        }
    }

    function toggleDarkMode() {
        try {
            const $html = $('html');
            const currentlyDark = $html.hasClass('dark');
            const newMode = !currentlyDark;
            
            console.log('Toggling dark mode:', currentlyDark ? 'dark -> light' : 'light -> dark');
            
            setDarkMode(newMode);
            
            // Trigger a custom event that other parts of the app can listen to
            $(document).trigger('darkModeChanged', { isDark: newMode });
            
        } catch (error) {
            console.error('Error toggling dark mode:', error);
        }
    }

    function initForgotPassword() {
        // Handle forgot password form
        $('#forgotPasswordForm').on('submit', function (e) {
            e.preventDefault();

            const $form = $(this);
            const $submitBtn = $('#submitBtn');
            const $btnText = $submitBtn.find('.btn-text');
            const $btnLoading = $submitBtn.find('.btn-loading');

            // Show loading state
            $submitBtn.prop('disabled', true);
            $btnText.addClass('hidden');
            $btnLoading.removeClass('hidden');

            const formData = new FormData(this);

            // Add reCAPTCHA token if present
            if (typeof grecaptcha !== 'undefined') {
                try {
                    const recaptchaResponse = grecaptcha.getResponse();
                    if (recaptchaResponse) {
                        formData.append('g-recaptcha-response', recaptchaResponse);
                    }
                } catch (e) {
                    // reCAPTCHA not ready or error
                }
            }

            $.ajax({
                url: '/auth/forgot-password',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    if (response.status === 200) {
                        // Show success alert
                        alert.success(response.message || __('auth.reset_link_sent'));

                        // Clear form
                        $form[0].reset();

                        // Reset reCAPTCHA
                        if (typeof grecaptcha !== 'undefined') {
                            try {
                                grecaptcha.reset();
                            } catch (e) {
                                // reCAPTCHA not ready
                            }
                        }
                    } else {
                        // Show error alert
                        alert.danger(response.message || __('notifications.error'));

                        // Reset reCAPTCHA
                        if (typeof grecaptcha !== 'undefined') {
                            try {
                                grecaptcha.reset();
                            } catch (e) {
                                // reCAPTCHA not ready
                            }
                        }
                    }
                },
                error: function (xhr) {
                    let errorMessage = __('errors.network_error');

                    try {
                        const response = JSON.parse(xhr.responseText);
                        errorMessage = response.message || errorMessage;
                    } catch (e) {
                        // Use default error message
                    }

                    // Show error alert
                    alert.danger(errorMessage);

                    // Reset reCAPTCHA
                    if (typeof grecaptcha !== 'undefined') {
                        try {
                            grecaptcha.reset();
                        } catch (e) {
                            // reCAPTCHA not ready
                        }
                    }
                },
                complete: function () {
                    // Reset button state
                    $submitBtn.prop('disabled', false);
                    $btnText.removeClass('hidden');
                    $btnLoading.addClass('hidden');
                }
            });
        });
    }

    function initResetPassword() {
        // Handle reset password form
        $('#resetPasswordForm').on('submit', function (e) {
            e.preventDefault();

            const $form = $(this);
            const $submitBtn = $('#resetSubmitBtn');
            const $btnText = $submitBtn.find('.btn-text');
            const $btnLoading = $submitBtn.find('.btn-loading');

            // Show loading state
            $submitBtn.prop('disabled', true);
            $btnText.addClass('hidden');
            $btnLoading.removeClass('hidden');

            const formData = new FormData(this);

            // Add reCAPTCHA token if present
            if (typeof grecaptcha !== 'undefined') {
                try {
                    const recaptchaResponse = grecaptcha.getResponse();
                    if (recaptchaResponse) {
                        formData.append('g-recaptcha-response', recaptchaResponse);
                    }
                } catch (e) {
                    // reCAPTCHA not ready or error
                }
            }

            $.ajax({
                url: '/auth/reset-password',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    if (response.status === 200) {
                        // Show success alert
                        alert.success(response.message || __('auth.password_reset_success'));

                        // Redirect to login page after short delay
                        setTimeout(function () {
                            window.location.href = '/login';
                        }, 2000);
                    } else {
                        // Show error alert
                        alert.danger(response.message || __('auth.password_reset_failed'));

                        // Reset reCAPTCHA
                        if (typeof grecaptcha !== 'undefined') {
                            try {
                                grecaptcha.reset();
                            } catch (e) {
                                // reCAPTCHA not ready
                            }
                        }
                    }
                },
                error: function (xhr) {
                    let errorMessage = __('errors.generic');

                    try {
                        const response = JSON.parse(xhr.responseText);
                        errorMessage = response.message || errorMessage;
                    } catch (e) {
                        // Use default error message
                    }

                    // Show error alert
                    alert.danger(errorMessage);

                    // Reset reCAPTCHA
                    if (typeof grecaptcha !== 'undefined') {
                        try {
                            grecaptcha.reset();
                        } catch (e) {
                            // reCAPTCHA not ready
                        }
                    }
                },
                complete: function () {
                    // Reset button state (only if not redirecting)
                    $submitBtn.prop('disabled', false);
                    $btnText.removeClass('hidden');
                    $btnLoading.addClass('hidden');
                }
            });
        });

        // Password functionality for reset password page
        initResetPasswordFeatures();
    }

    function initResetPasswordFeatures() {
        // Only initialize on reset password page
        if (!$('#resetPasswordForm').length) {
            return;
        }

        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirm_password');
        const strengthDiv = document.getElementById('password-strength');
        const strengthBar = document.getElementById('strength-bar');
        const strengthText = document.getElementById('strength-text');
        const togglePassword = document.getElementById('togglePassword');
        const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
        const eyeIcon = document.getElementById('eyeIcon');
        const eyeIconConfirm = document.getElementById('eyeIconConfirm');

        // Password toggle functionality handled by universal handler - removed duplicate code

        // Password strength indicator
        if (passwordInput && strengthBar) {
            $(passwordInput).off('input.resetPassword').on('input.resetPassword', function () {
                const password = this.value;
                const strength = calculatePasswordStrength(password);

                if (password.length > 0) {
                    strengthDiv.classList.remove('hidden');
                } else {
                    strengthDiv.classList.add('hidden');
                    return;
                }

                // Update strength bar
                strengthBar.style.width = strength.score + '%';
                strengthBar.className = `h-2 rounded-full transition-all duration-300 ${strength.color}`;
                strengthText.textContent = strength.text;
                strengthText.className = `text-xs font-medium ${strength.textColor}`;
            });
        }

        // Password match validation
        if (confirmInput) {
            $(confirmInput).off('input.resetPassword').on('input.resetPassword', function () {
                const password = passwordInput.value;
                const confirmPassword = this.value;

                if (confirmPassword.length > 0) {
                    if (password === confirmPassword) {
                        this.style.borderColor = '#10B981';
                    } else {
                        this.style.borderColor = '#EF4444';
                    }
                } else {
                    this.style.borderColor = '#D1D5DB';
                }
            });
        }

        function calculatePasswordStrength(password) {
            let score = 0;
            let text = '';
            let color = '';
            let textColor = '';

            if (password.length >= 6) score += 20;
            if (password.length >= 8) score += 20;
            if (/[a-z]/.test(password)) score += 20;
            if (/[A-Z]/.test(password)) score += 20;
            if (/[0-9]/.test(password)) score += 10;
            if (/[^A-Za-z0-9]/.test(password)) score += 10;

            if (score < 30) {
                text = __('password.strength.weak');
                color = 'bg-red-500';
                textColor = 'text-red-600';
            } else if (score < 60) {
                text = __('password.strength.fair');
                color = 'bg-yellow-500';
                textColor = 'text-yellow-600';
            } else if (score < 80) {
                text = __('password.strength.good');
                color = 'bg-blue-500';
                textColor = 'text-blue-600';
            } else {
                text = __('password.strength.strong');
                color = 'bg-green-500';
                textColor = 'text-green-600';
            }

            return { score, text, color, textColor };
        }
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

    function initSettings() {
        // Initialize avatar upload functionality
        initAvatarUpload();

        // Handle settings forms (profile, password, preferences)
        $('[system-settings-form]').on('submit', function (e) {
            e.preventDefault();

            const formType = $(this).attr('system-settings-form');
            const formData = new FormData(this);

            // Show loading state
            const $submitBtn = $(this).find('button[type="submit"]');
            const $btnText = $submitBtn.find('.btn-text');
            const $btnLoading = $submitBtn.find('.btn-loading');

            $submitBtn.prop('disabled', true);
            $btnText.addClass('hidden');
            $btnLoading.removeClass('hidden');

            // Clear previous errors
            $('.text-red-500').addClass('hidden');

            $.ajax({
                url: `/requests/update-${formType}`,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    if (response.status === 200) {
                        // For password changes, clear the form
                        if (formType === 'password') {
                            $(`[system-settings-form="${formType}"]`)[0].reset();
                        }

                        // For profile updates with avatar, refresh the page to show new avatar
                        if (formType === 'profile' && formData.has('avatar')) {
                            alert.success(response.message, true);
                        } else {
                            alert.success(response.message);
                        }
                    } else {
                        alert.danger(response.message);
                    }

                    // Reset button state
                    $submitBtn.prop('disabled', false);
                    $btnText.removeClass('hidden');
                    $btnLoading.addClass('hidden');
                },
                error: function (xhr) {
                    let errorMessage = __('errors.generic');

                    try {
                        const response = JSON.parse(xhr.responseText);
                        errorMessage = response.message || errorMessage;

                        // Show field-specific errors if available
                        if (response.errors) {
                            Object.keys(response.errors).forEach(field => {
                                const $errorDiv = $(`#${field}Error`);
                                if ($errorDiv.length) {
                                    $errorDiv.text(response.errors[field]).removeClass('hidden');
                                }
                            });
                        }
                    } catch (e) {
                        // Use default error message
                    }

                    if (!response || !response.errors) {
                        alert.danger(errorMessage);
                    }

                    // Reset button state
                    $submitBtn.prop('disabled', false);
                    $btnText.removeClass('hidden');
                    $btnLoading.addClass('hidden');
                }
            });
        });

        // Password visibility toggles handled by universal handler - removed duplicate code

        // Password strength indicator
        $('#new_password').on('input', function () {
            const password = $(this).val();
            const $strengthDiv = $('#passwordStrength');
            const $strengthText = $('#strengthText');
            const $strengthBars = $strengthDiv.find('.h-1');

            if (password.length === 0) {
                $strengthDiv.addClass('hidden');
                return;
            }

            $strengthDiv.removeClass('hidden');

            // Calculate strength
            let strength = 0;
            if (password.length >= 8) strength++;
            if (/[a-z]/.test(password)) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^A-Za-z0-9]/.test(password)) strength++;

            // Reset bars
            $strengthBars.removeClass('bg-red-400 bg-yellow-400 bg-blue-400 bg-green-400').addClass('bg-gray-200');

            // Set strength colors and text
            const strengthConfig = [
                { text: __('password.strength.very_weak'), color: 'bg-red-400', bars: 1 },
                { text: __('password.strength.weak'), color: 'bg-red-400', bars: 1 },
                { text: __('password.strength.fair'), color: 'bg-yellow-400', bars: 2 },
                { text: __('password.strength.good'), color: 'bg-blue-400', bars: 3 },
                { text: __('password.strength.strong'), color: 'bg-green-400', bars: 4 }
            ];

            const config = strengthConfig[Math.min(strength, 4)];
            $strengthText.text(config.text);

            for (let i = 0; i < config.bars; i++) {
                $strengthBars.eq(i).removeClass('bg-gray-200').addClass(config.color);
            }
        });

        // Account action handlers
        $('#exportDataBtn').on('click', function () {
            // Use iziToast confirmation instead of browser alert
            iziToast.question({
                title: __('user.export_data_title'),
                message: __('user.export_data_message'),
                position: 'center',
                backgroundColor: '#3B82F6',
                titleColor: '#fff',
                messageColor: '#fff',
                icon: false,
                timeout: false,
                close: false,
                overlay: true,
                buttons: [
                    [`<button style="color: white;">${__('user.export')}</button>`, function (instance, toast) {
                        instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                        window.location.href = '/requests/export-data';
                    }, true],
                    [`<button style="color: white;">${__('games.cancel')}</button>`, function (instance, toast) {
                        instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                    }]
                ]
            });
        });

        // Initialize country search functionality
        initCountrySelect();
    }

    function initCountrySelect() {
        // Initialize searchable country selects
        const $countrySelects = $('.system-country-select');
        if ($countrySelects.length === 0) return;

        $countrySelects.each(function () {
            const $select = $(this);

            // Skip if already processed (avoid double initialization)
            if ($select.siblings(`input[placeholder="${__("forms.search_countries")}"]`).length > 0) {
                return;
            }

            const selectedValue = $select.val();
            makeSelectSearchable($select, selectedValue);
        });
    }

    function makeSelectSearchable($select, selectedValue) {
        const $wrapper = $('<div class="relative"></div>');
        const $input = $(`<input type="text" class="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-md placeholder-gray-400 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:shadow-lg" placeholder="${__("forms.search_countries")}">`);
        const $dropdown = $('<div class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>');

        // Build options array from existing select options
        const options = [];
        $select.find('option').each(function () {
            const $option = $(this);
            options.push({
                value: $option.val(),
                text: $option.text(),
                selected: $option.prop('selected')
            });
        });

        // Hide original select and wrap with new elements
        $select.hide();
        $select.wrap($wrapper);
        $select.after($dropdown);
        $select.after($input);

        // Set initial value if provided
        if (selectedValue) {
            const selectedOption = options.find(option => option.value === selectedValue);
            if (selectedOption) {
                $input.val(selectedOption.text);
                $select.val(selectedValue); // Ensure original select has correct value
            }
        } else {
            // Clear input if no value selected
            $input.val('');
            $select.val('');
        }

        function populateDropdown(searchTerm = '') {
            $dropdown.empty();

            const filteredOptions = options.filter(option =>
                option.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                option.value.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (filteredOptions.length === 0) {
                $dropdown.append('<div class="px-4 py-2 text-gray-500">No countries found</div>');
            } else {
                filteredOptions.forEach(option => {
                    if (option.value === '') return; // Skip empty option

                    const $item = $(`<div class="px-4 py-2 cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200" data-value="${option.value}">${option.text}</div>`);
                    $dropdown.append($item);
                });
            }

            $dropdown.show();
        }

        // Event handlers
        $input.on('input focus', function () {
            populateDropdown($(this).val());
        });

        // Handle manual clearing of input
        $input.on('input', function () {
            const inputValue = $(this).val();
            if (inputValue === '') {
                // If input is cleared, clear the select value too
                $select.val('').trigger('change');
            }
        });

        $dropdown.on('click', '[data-value]', function () {
            const value = $(this).data('value');
            const text = $(this).text();

            $input.val(text);
            $select.val(value).trigger('change');
            $dropdown.hide();
        });

        $input.on('blur', function () {
            setTimeout(() => $dropdown.hide(), 200);
        });

        // Close dropdown when clicking outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest($input.parent()).length) {
                $dropdown.hide();
            }
        });
    }

    function initTemplate() {
        // Setup alert system
        alert.setup();

        // Initialize system functions
        system.modals();
        system.delete();
        system.actions();

        // Initialize PJAX for navigation only if enabled for frontend
        if (window.FRONTEND_PJAX_ENABLED !== false) {
            initPjax();
        }
    }

    function initPjax() {
        window.pjax = new Pjax({
            scrollTo: 0,
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
            topbar.show();

            // Clean up Flash Ad Manager
            if (window.FlashAdManager && typeof window.FlashAdManager.destroy === 'function') {
                window.FlashAdManager.destroy();
            }

            // Clean up Ruffle
            cleanupRuffle();
        });

        $(document).on('pjax:complete', function () {
            // Reinitialize games page functionality
            initGamesPage();

            // Reinitialize leaderboard page functionality
            initLeaderboardPage();

            // Reinitialize authentication handlers for new content
            initAuthentication();

            // Reinitialize forgot password for new content
            initForgotPassword();

            // Reinitialize reset password for new content
            initResetPassword();

            // Reinitialize user dropdowns for new content
            initUserDropdowns();

            // Reinitialize settings for new content
            initSettings();

            // Reinitialize country select for new content
            initCountrySelect();

            // Reinitialize follow management for new content
            initFollowManagement();

            // Reinitialize WebSocket for new content
            initWebSocket();

            // Reinitialize play page for new content
            initPlayPage();

            // Reinitialize leaderboard for new content
            initLeaderboard();

            // Load and initialize reCAPTCHA if needed on new page
            loadRecaptchaIfNeeded();

            // Reinitialize dark mode for new content (only state, handlers are global)
            initDarkModeState();
            
            // Also ensure handlers are attached to new elements
            setTimeout(() => {
                setupDarkModeHandlers();
            }, 200);

            topbar.hide();
        });
    }

    function initFollowManagement() {
        // Follow User
        $(document).off('click', '#followUserBtn').on('click', '#followUserBtn', function () {
            const $btn = $(this);
            const username = $btn.data('username') || $btn.closest('[data-username]').data('username');
            const originalHtml = $btn.html();

            if (!username) {
                alert.danger(__("auth.username_not_found"));
                return;
            }

            $btn.prop('disabled', true).html('<svg class="w-4 h-4 animate-spin inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> ' + __('user.following_loading'));

            $.ajax({
                url: '/requests/follow-user',
                method: 'POST',
                data: { username: username },
                success: function (response) {
                    if (response.status === 200) {
                        $btn.removeClass('bg-blue-600 hover:bg-blue-700')
                            .addClass('bg-gray-600 hover:bg-gray-700')
                            .attr('id', 'unfollowUserBtn')
                            .prop('disabled', false)
                            .html('<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> ' + __('user.following'));

                        alert.success(response.message);
                        // Update follower count if element exists
                        const $followerCount = $('#followerCount');
                        if ($followerCount.length) {
                            const currentCount = parseInt($followerCount.text()) || 0;
                            $followerCount.text(currentCount + 1);
                        }
                    } else {
                        $btn.prop('disabled', false).html(originalHtml);
                        alert.danger(response.message);
                    }
                },
                error: function (xhr) {
                    $btn.prop('disabled', false).html(originalHtml);
                    const errorMessage = xhr.responseJSON?.message || __('notifications.follow_failed');
                    alert.danger(errorMessage);
                }
            });
        });

        // Unfollow User
        $(document).off('click', '#unfollowUserBtn').on('click', '#unfollowUserBtn', function () {
            const $btn = $(this);
            const username = $btn.data('username') || $btn.closest('[data-username]').data('username');
            const originalHtml = $btn.html();

            // Use iziToast confirmation instead of browser confirm
            const unfollowUserTitle = window.__('user.unfollow_user');
            const unfollowConfirmMessage = window.__('user.unfollow_confirm');
            const unfollowText = window.__('user.unfollow');
            const cancelText = window.__('games.cancel');

            iziToast.question({
                title: unfollowUserTitle,
                message: unfollowConfirmMessage,
                position: 'center',
                backgroundColor: '#EF4444',
                titleColor: '#fff',
                messageColor: '#fff',
                icon: false,
                timeout: false,
                close: false,
                overlay: true,
                buttons: [
                    [`<button style="color: white;">${unfollowText}</button>`, function (instance, toast) {
                        instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');

                        $btn.prop('disabled', true).html('<svg class="w-4 h-4 animate-spin inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> ' + __('user.unfollowing_loading'));

                        $.ajax({
                            url: '/requests/unfollow-user',
                            method: 'POST',
                            data: { username: username },
                            success: function (response) {
                                if (response.status === 200) {
                                    $btn.removeClass('bg-gray-600 hover:bg-gray-700')
                                        .addClass('bg-blue-600 hover:bg-blue-700')
                                        .attr('id', 'followUserBtn')
                                        .prop('disabled', false)
                                        .html('<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg> ' + __('user.follow'));

                                    alert.warning(response.message);
                                    // Update follower count if element exists
                                    const $followerCount = $('#followerCount');
                                    if ($followerCount.length) {
                                        const currentCount = parseInt($followerCount.text()) || 0;
                                        $followerCount.text(Math.max(0, currentCount - 1));
                                    }
                                } else {
                                    $btn.prop('disabled', false).html(originalHtml);
                                    alert.danger(response.message);
                                }
                            },
                            error: function (xhr) {
                                $btn.prop('disabled', false).html(originalHtml);
                                const errorMessage = xhr.responseJSON?.message || window.__('user.failed_to_unfollow');
                                alert.danger(errorMessage);
                            }
                        });
                    }, true],
                    [`<button style="color: white;">${cancelText}</button>`, function (instance, toast) {
                        instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                    }]
                ]
            });
        });
    }

    // Socket.IO connection management
    let socket = null;

    function initWebSocket() {
        // Initialize for both authenticated and anonymous users if Socket.IO is available
        if (typeof io === 'undefined') {
            return;
        }

        connectSocketIO();
    }

    function connectSocketIO() {
        if (socket && socket.connected) {
            return;
        }

        // Get or generate session token
        let sessionToken = sessionStorage.getItem('socket_token');
        if (!sessionToken) {
            sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('socket_token', sessionToken);
        }

        // Prepare auth config
        const authConfig = {};
        if (window.user && window.user.id) {
            // Authenticated user
            authConfig.userId = window.user.id;
            authConfig.token = sessionToken;
        }
        // For anonymous users, we don't send auth data

        // Initialize Socket.IO connection
        socket = io({
            auth: authConfig,
            transports: ['websocket', 'polling'],
            timeout: 5000
        });

        // Connection events
        socket.on('connect', function () {
            updateConnectionStatus(true);
        });

        socket.on('disconnect', function (reason) {
            updateConnectionStatus(false);
        });

        socket.on('connect_error', function (error) {
            updateConnectionStatus(false);
        });

        // Server event listeners
        socket.on('connected', function (data) {
            // Connection confirmed
        });

        socket.on('user_followed', function (data) {
            handleUserFollowed(data);
        });

        socket.on('user_unfollowed', function (data) {
            handleUserUnfollowed(data);
        });

        socket.on('user_online', function (data) {
            handleUserOnline(data);
        });

        socket.on('user_offline', function (data) {
            handleUserOffline(data);
        });

        socket.on('game_started', function (data) {
            handleGameStarted(data);
        });

        socket.on('game_finished', function (data) {
            handleGameFinished(data);
        });

        socket.on('notification', function (data) {
            handleNotification(data);
        });

        socket.on('personal_best_notification', function (data) {
            handlePersonalBestNotification(data);
        });

        socket.on('game_viewer_count', function (data) {
            updateGameViewerCount(data.gameId, data.viewerCount);
        });

        socket.on('error', function (data) {
            handleWebSocketError(data);
        });

        // Setup heartbeat
        setInterval(function () {
            if (socket && socket.connected) {
                socket.emit('heartbeat');
            }
        }, 30000);

        // Cleanup on page unload
        $(window).on('beforeunload', function () {
            if (socket) {
                socket.disconnect();
            }
            // Clean up Ruffle on page unload
            cleanupRuffle();
        });
    }


    // WebSocket event handlers
    function handleUserFollowed(data) {
        // Show notification
        showWebSocketNotification(`${data.followerUsername} started following you`, 'primary');

        // Update follower count if on profile page
        if (window.location.pathname.includes('/profile')) {
            const $followerCount = $('#followerCount');
            if ($followerCount.length) {
                const currentCount = parseInt($followerCount.text()) || 0;
                $followerCount.text(currentCount + 1);
            }
        }
    }

    function handleUserUnfollowed(data) {
        showWebSocketNotification(`${data.followerUsername} unfollowed you`, 'warning');

        // Update follower count if on profile page
        if (window.location.pathname.includes('/profile')) {
            const $followerCount = $('#followerCount');
            if ($followerCount.length) {
                const currentCount = parseInt($followerCount.text()) || 0;
                $followerCount.text(Math.max(0, currentCount - 1));
            }
        }
    }

    function handleUserOnline(data) {
        // Update user online indicators if present
        updateUserOnlineStatus(data.userId, true);
    }

    function handleUserOffline(data) {
        // Update user online indicators if present
        updateUserOnlineStatus(data.userId, false);
    }

    function handleGameStarted(data) {
        showWebSocketNotification(data.message, 'primary');
    }

    function handleGameFinished(data) {
        showWebSocketNotification(data.message, 'primary');
    }

    function handleNotification(data) {
        showWebSocketNotification(data.message, data.type || 'primary');
    }

    function handlePersonalBestNotification(data) {
        iziToast.success({
            title: __('user.personal_best_title'),
            message: data.message,
            position: 'topLeft',
            timeout: 8000,
            backgroundColor: '#10b981',
            titleColor: '#fff',
            messageColor: '#fff',
            icon: false,
            displayMode: 'replace',
            buttons: [
                [`<button style="color: white;">${__('user.view_profile')}</button>`, function (instance, toast) {
                    if (window.pjax) {
                        pjax.loadUrl(`/profile/${data.username}`);
                    } else {
                        window.location.href = `/profile/${data.username}`;
                    }
                    instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                }]
            ]
        });
    }

    function handleWebSocketError(data) {
        alert.danger(data.message);
    }

    // Utility functions
    function updateConnectionStatus(isConnected) {
        // Update any connection status indicators in the UI
        const $statusIndicator = $('#connectionStatus');
        if ($statusIndicator.length) {
            if (isConnected) {
                $statusIndicator.removeClass('bg-red-500').addClass('bg-green-500').attr('title', __('notifications.connected'));
            } else {
                $statusIndicator.removeClass('bg-green-500').addClass('bg-red-500').attr('title', __('notifications.disconnected'));
            }
        }
    }


    function updateUserOnlineStatus(userId, isOnline) {
        // Update online status indicators for specific user
        $(`.user-${userId}-status`).each(function () {
            const $indicator = $(this);
            if (isOnline) {
                $indicator.removeClass('bg-gray-400').addClass('bg-green-400').attr('title', __('notifications.online'));
            } else {
                $indicator.removeClass('bg-green-400').addClass('bg-gray-400').attr('title', __('notifications.offline'));
            }
        });
    }

    function showWebSocketNotification(message, type) {
        // Use the existing alert system for WebSocket notifications
        switch (type) {
            case 'success':
                alert.success(message);
                break;
            case 'error':
                alert.danger(message);
                break;
            case 'warning':
                alert.warning(message);
                break;
            default:
                alert.primary(message);
        }
    }

    // Expose Socket.IO functions globally for use by other scripts
    window.arcade = window.arcade || {};
    window.arcade.websocket = {
        send: function (type, data) {
            if (socket && socket.connected) {
                socket.emit(type, data);
                return true;
            }
            return false;
        },
        isConnected: () => socket && socket.connected,
        reconnect: () => {
            if (socket) {
                socket.disconnect();
            }
            setTimeout(() => {
                if (window.user && window.user.id) {
                    connectSocketIO();
                }
            }, 1000);
        },

        // Game event helpers
        gameStart: function (gameData) {
            if (socket && socket.connected) {
                socket.emit('game:start', gameData);
            }
        },

        gameFinish: function (gameData) {
            if (socket && socket.connected) {
                socket.emit('game:finish', gameData);
            }
        },

        // Room management
        joinRoom: function (roomName) {
            if (socket && socket.connected) {
                socket.emit('join_room', roomName);
            }
        },

        leaveRoom: function (roomName) {
            if (socket && socket.connected) {
                socket.emit('leave_room', roomName);
            }
        }
    };

    function initFloatingChat() {
        // Initialize floating chat system - it will handle checking if on chatroom page
        // Check if FloatingChatSystem class is available (only loaded on non-chatroom pages)
        if (typeof FloatingChatSystem !== 'undefined') {
            // Small delay to ensure DOM is ready and other scripts loaded
            setTimeout(() => {
                window.floatingChat = new FloatingChatSystem();
            }, 500);
        }
    }

    function initCarousel() {
        // Carousel scroll function for category games
        window.scrollCarousel = function (listId, direction) {
            const carousel = document.getElementById(listId);
            if (!carousel) return;

            const scrollAmount = 200; // Amount to scroll

            if (direction === 'prev') {
                carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        };
    }

    function initPlayPage() {
        // Only initialize on play pages - check for game container first
        if (!$('#game-container').length) {
            return;
        }

        // Get game slug from URL
        const pathSegments = window.location.pathname.split('/');
        const gameSlug = pathSegments[pathSegments.length - 1];

        if (!gameSlug || gameSlug === 'play') {
            return;
        }

        // Fetch game data from API
        $.ajax({
            url: `/requests/game-data/${gameSlug}`,
            method: 'GET',
            success: function (response) {
                if (response.status === 200) {
                    window.gameData = response.data;

                    // Initialize all play page functionality
                    initGameFrame();
                    initViewModes();
                    initRatingSystem();
                    initCommentSystem();
                    initShareButton();
                    initFavoriteButton();

                    // Send WebSocket notification that user is playing
                    if (window.arcade && window.arcade.websocket && window.arcade.websocket.isConnected()) {
                        window.arcade.websocket.gameStart({
                            gameId: window.gameData.id,
                            gameTitle: window.gameData.title,
                            gameSlug: window.gameData.slug
                        });
                    }
                } else {
                    // Initialize basic functionality without game data
                    initViewModes();
                    initCommentSystem();
                    initShareButton();
                }
            },
            error: function (xhr) {
                // Initialize basic functionality without game data
                initViewModes();
                initCommentSystem();
                initShareButton();
            }
        });
    }

    function initGameFrame() {
        // Initialize Ruffle for Flash games
        if (window.gameData && window.gameData.type === 'flash') {
            const $container = $('#ruffle-player');
            if ($container.length) {
                // Get SWF path from data attribute
                const gameUrl = $container.data('game-src');
                if (!gameUrl) {
                    console.error('No game URL found in data-game-src');
                    return;
                }

                // Add loading indicator
                const loadingGameText = window.__('games.loading_game');
                const loadingGameMessageText = window.__('games.loading_game_message');
                $container.html(`
                    <div class="flex flex-col items-center justify-center h-full p-8 text-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <div class="text-lg font-medium text-gray-700 mb-2">${loadingGameText}</div>
                        <div class="text-sm text-gray-500">${loadingGameMessageText}</div>
                    </div>
                `);

                // Check if Flash Ad Manager is already loaded to prevent duplicates
                if (!document.querySelector('script[src="/assets/js/ads.flash.min.js"]') && !window.FlashAdManager) {
                    // Dynamically load Flash Ad Manager first
                    const flashAdScript = document.createElement('script');
                    flashAdScript.src = '/assets/js/ads.flash.min.js';
                    flashAdScript.onload = function () {
                        // Then load Ruffle library if not already loaded
                        if (!document.querySelector('script[src="/assets/js/libs/ruffle/ruffle.js"]') && !window.RufflePlayer) {
                            const ruffleScript = document.createElement('script');
                            ruffleScript.src = '/assets/js/libs/ruffle/ruffle.js';
                            ruffleScript.onload = function () {
                                // Initialize Ruffle after both scripts load
                                initRufflePlayer($container, gameUrl);
                            };
                            ruffleScript.onerror = function () {
                                console.error('Failed to load Ruffle library');
                                $container.html('<div class="text-center text-red-500 p-4">' + __('notifications.flash_load_failed') + '</div>');
                            };
                            document.head.appendChild(ruffleScript);
                        } else {
                            // Ruffle already loaded, just initialize
                            initRufflePlayer($container, gameUrl);
                        }
                    };
                    flashAdScript.onerror = function () {
                        console.error('Failed to load Flash Ad Manager');
                        // Continue with Ruffle loading even if ad manager fails
                        if (!document.querySelector('script[src="/assets/js/libs/ruffle/ruffle.js"]') && !window.RufflePlayer) {
                            const ruffleScript = document.createElement('script');
                            ruffleScript.src = '/assets/js/libs/ruffle/ruffle.js';
                            ruffleScript.onload = function () {
                                initRufflePlayer($container, gameUrl);
                            };
                            ruffleScript.onerror = function () {
                                console.error('Failed to load Ruffle library');
                                $container.html('<div class="text-center text-red-500 p-4">' + __('notifications.flash_load_failed') + '</div>');
                            };
                            document.head.appendChild(ruffleScript);
                        } else {
                            // Ruffle already loaded, just initialize
                            initRufflePlayer($container, gameUrl);
                        }
                    };

                    // Add Flash Ad Manager script to document head
                    document.head.appendChild(flashAdScript);
                } else {
                    // Flash Ad Manager already loaded, check Ruffle
                    if (!document.querySelector('script[src="/assets/js/libs/ruffle/ruffle.js"]') && !window.RufflePlayer) {
                        const ruffleScript = document.createElement('script');
                        ruffleScript.src = '/assets/js/libs/ruffle/ruffle.js';
                        ruffleScript.onload = function () {
                            initRufflePlayer($container, gameUrl);
                        };
                        ruffleScript.onerror = function () {
                            console.error('Failed to load Ruffle library');
                            $container.html('<div class="text-center text-red-500 p-4">' + __('notifications.flash_load_failed') + '</div>');
                        };
                        document.head.appendChild(ruffleScript);
                    } else {
                        // Both scripts already loaded, just initialize
                        initRufflePlayer($container, gameUrl);
                    }
                }
            }
        }

        // Load Score system for all games (required for __arcadeShowAd and CTL arcade API)
        if (window.gameData) {
            // Check if score system is already loaded to prevent duplicate loading
            if (!document.querySelector('script[src="/assets/js/score.min.js"]')) {
                // Dynamically load Score system first using vanilla JavaScript
                const scoreScript = document.createElement('script');
                scoreScript.src = '/assets/js/score.min.js';
                scoreScript.onload = function () {
                    console.log('Score system loaded for', window.gameData.type, 'game');

                    // Set game context for score system
                    if (window.gameData.id) {
                        // Manually set game context since score system is loaded dynamically
                        window.currentGameId = window.gameData.id;
                    }

                    // Initialize General Ad Manager for HTML5/embed games without API integration
                    if ((window.gameData.type === 'html' || window.gameData.type === 'embed') && !window.gameData.api_enabled) {
                        // Check if General Ad Manager is already loaded
                        if (!document.querySelector('script[src="/assets/js/ads.general.min.js"]') && !window.GeneralAdManager) {
                            const generalAdScript = document.createElement('script');
                            generalAdScript.src = '/assets/js/ads.general.min.js';
                            generalAdScript.onload = function () {
                                // Initialize General Ad Manager with game frame
                                const gameFrame = $('#game-frame')[0];
                                if (gameFrame && window.GeneralAdManager) {
                                    console.log('Initializing General Ad Manager for', window.gameData.type, 'game');
                                    window.GeneralAdManager.init(gameFrame);
                                } else {
                                    console.error('Game frame not found or General Ad Manager not loaded');
                                }
                            };
                            generalAdScript.onerror = function () {
                                console.error('Failed to load General Ad Manager');
                                // Continue without ad manager if it fails to load
                            };
                            document.head.appendChild(generalAdScript);
                        } else if (window.GeneralAdManager) {
                            // Script already loaded, just initialize
                            const gameFrame = $('#game-frame')[0];
                            if (gameFrame) {
                                console.log('Initializing General Ad Manager for', window.gameData.type, 'game (script already loaded)');
                                window.GeneralAdManager.init(gameFrame);
                            }
                        }
                    }
                };
                scoreScript.onerror = function () {
                    console.error('Failed to load Score system');
                    // Continue without score system if it fails to load
                };
                document.head.appendChild(scoreScript);
            } else {
                // Score system already loaded, just set game context
                console.log('Score system already loaded, setting game context for', window.gameData.type, 'game');
                if (window.gameData.id) {
                    window.currentGameId = window.gameData.id;
                }

                // Initialize General Ad Manager for HTML5/embed games without API integration
                if ((window.gameData.type === 'html' || window.gameData.type === 'embed') && !window.gameData.api_enabled) {
                    if (!document.querySelector('script[src="/assets/js/ads.general.min.js"]') && !window.GeneralAdManager) {
                        const generalAdScript = document.createElement('script');
                        generalAdScript.src = '/assets/js/ads.general.min.js';
                        generalAdScript.onload = function () {
                            // Initialize General Ad Manager with game frame
                            const gameFrame = $('#game-frame')[0];
                            if (gameFrame && window.GeneralAdManager) {
                                console.log('Initializing General Ad Manager for', window.gameData.type, 'game');
                                window.GeneralAdManager.init(gameFrame);
                            } else {
                                console.error('Game frame not found or General Ad Manager not loaded');
                            }
                        };
                        generalAdScript.onerror = function () {
                            console.error('Failed to load General Ad Manager');
                            // Continue without ad manager if it fails to load
                        };
                        document.head.appendChild(generalAdScript);
                    } else if (window.GeneralAdManager) {
                        // Script already loaded, just initialize
                        const gameFrame = $('#game-frame')[0];
                        if (gameFrame) {
                            console.log('Initializing General Ad Manager for', window.gameData.type, 'game (script already loaded)');
                            window.GeneralAdManager.init(gameFrame);
                        }
                    }
                }
            }
        }

    }

    function initRufflePlayer($container, gameUrl) {
        try {
            // Configure global Ruffle settings
            window.RufflePlayer = window.RufflePlayer || {};
            window.RufflePlayer.config = {
                publicPath: "/assets/js/libs/ruffle/",
                allowScriptAccess: false,
                autoplay: "on",
                splashScreen: false,
                letterbox: "on",
                logLevel: "warn",
                contextMenu: "off",
                backgroundColor: "#000000",
                unmuteOverlay: "hidden",
                preferredRenderer: "webgl",
                openUrlMode: "deny"
            };

            $container.empty();

            // Create Ruffle player instance
            const player = window.RufflePlayer.newest().createPlayer();

            // Store player reference globally
            window.currentRufflePlayer = player;

            // Set player styles
            $(player).css({
                width: '100%',
                height: '100%',
                display: 'block'
            });

            // Add player to container
            $container.append(player);

            // Load the Flash game
            player.load(gameUrl);

            // Initialize Flash Ad Manager with the player (script already loaded in sequence)
            if (window.FlashAdManager) {
                console.log('Initializing Flash Ad Manager with player:', player);
                window.FlashAdManager.init(player);
            } else {
                console.log('FlashAdManager not available - script may not have loaded yet');
            }

            // Add event listeners
            $(player).on('loadedmetadata', function () {
                console.log('Flash game loaded successfully');
            });

            $(player).on('error', function (e) {
                console.error('Error loading Flash game:', e);
                $container.html('<div class="text-center text-red-500 p-4">Failed to load Flash game</div>');
            });

        } catch (error) {
            console.error('Error initializing Ruffle player:', error);
            $container.html('<div class="text-center text-red-500 p-4">Failed to initialize Flash emulator</div>');
        }
    }

    function initViewModes() {
        let currentMode = 'default';

        // Remove existing event handlers to prevent duplicates
        $('#mode-default, #mode-cinematic, #mode-fullscreen').off('click.viewmode');
        $(document).off('keydown.playpage');

        $('#mode-default').on('click.viewmode', function () {
            setViewMode('default');
        });

        $('#mode-cinematic').on('click.viewmode', function () {
            setViewMode('cinematic');
        });

        $('#mode-fullscreen').on('click.viewmode', function () {
            setViewMode('fullscreen');
        });

        function setViewMode(mode) {
            const $gameContainer = $('#game-container');
            const $gameSection = $gameContainer.closest('section'); // The flex section containing game and sidebar
            const $gameInfoSidebar = $gameSection.find('aside'); // The right sidebar with game info/rating
            const $header = $('header');
            const $commentsSection = $gameSection.next('section'); // Comments section below

            // Reset all mode buttons
            $('#mode-default, #mode-cinematic, #mode-fullscreen')
                .removeClass('bg-white shadow-sm')
                .addClass('hover:bg-white');

            if (mode === 'default') {
                $('#mode-default').addClass('bg-white shadow-sm').removeClass('hover:bg-white');

                // Reset to original layout
                $gameContainer.removeClass('cinematic-mode fullscreen-mode').css({
                    'position': 'relative',
                    'left': 'auto',
                    'right': 'auto',
                    'top': 'auto',
                    'transform': 'none',
                    'width': (window.gameData.width || 800) + 'px',
                    'height': (window.gameData.height || 600) + 'px',
                    'max-width': '100%',
                    'z-index': 'auto',
                    'background': '#e5e7eb'
                });

                // Remove cinematic close button
                $gameContainer.find('.cinematic-close-btn').remove();

                // Reset iframe styles
                const $gameFrame = $gameContainer.find('#game-frame');
                $gameFrame.css({
                    'border-radius': '0.5rem' // Reset to original rounded corners
                });

                // Show game info sidebar and comments
                $gameInfoSidebar.show();
                $commentsSection.show();
                $('body').removeClass('overflow-hidden');

            } else if (mode === 'cinematic') {
                $('#mode-cinematic').addClass('bg-white shadow-sm').removeClass('hover:bg-white');

                // Hide the game info sidebar (rating section)
                $gameInfoSidebar.hide();
                $commentsSection.hide();

                // Expand game container to full width
                $gameContainer.addClass('cinematic-mode').removeClass('fullscreen-mode').css({
                    'position': 'fixed',
                    'left': '0',
                    'right': '0',
                    'top': '50%',
                    'transform': 'translateY(-50%)',
                    'width': '100vw',
                    'height': '75vh',
                    'max-width': 'none',
                    'z-index': '40',
                    'background': '#000',
                    'margin': '0',
                    'border-radius': '0'
                });

                // Add close button for cinematic mode
                if (!$gameContainer.find('.cinematic-close-btn').length) {
                    const $closeBtn = $(`
                        <button class="cinematic-close-btn absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-all duration-200 backdrop-blur-sm">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    `);
                    $gameContainer.append($closeBtn);

                    // Close button event handler
                    $closeBtn.off('click.cinematic').on('click.cinematic', function () {
                        setViewMode('default');
                    });
                }

                // Ensure iframe fills container properly
                const $gameFrame = $gameContainer.find('#game-frame');
                $gameFrame.css({
                    'border-radius': '0'
                });

                $('body').addClass('overflow-hidden');

            } else if (mode === 'fullscreen') {
                $('#mode-fullscreen').addClass('bg-white shadow-sm').removeClass('hover:bg-white');

                // Fullscreen just the game container, not the entire page
                const gameContainer = $gameContainer[0];
                if (gameContainer.requestFullscreen) {
                    gameContainer.requestFullscreen().then(() => {
                        // Add fullscreen styles to game container
                        $gameContainer.addClass('fullscreen-mode').css({
                            'width': '100vw',
                            'height': '100vh',
                            'background': '#000'
                        });

                        // Ensure iframe fills container
                        const $gameFrame = $gameContainer.find('#game-frame, #emulator-iframe');
                        $gameFrame.css({
                            'border-radius': '0'
                        });
                    }).catch(() => {
                        // Fallback to manual fullscreen if API fails
                        manualGameFullscreen();
                    });
                } else if (gameContainer.webkitRequestFullscreen) {
                    gameContainer.webkitRequestFullscreen();
                    applyFullscreenStyles();
                } else if (gameContainer.msRequestFullscreen) {
                    gameContainer.msRequestFullscreen();
                    applyFullscreenStyles();
                } else if (gameContainer.mozRequestFullScreen) {
                    gameContainer.mozRequestFullScreen();
                    applyFullscreenStyles();
                } else {
                    // Browser doesn't support fullscreen API, use manual fullscreen
                    manualGameFullscreen();
                }

                function applyFullscreenStyles() {
                    $gameContainer.addClass('fullscreen-mode').css({
                        'width': '100vw',
                        'height': '100vh',
                        'background': '#000'
                    });

                    const $gameFrame = $gameContainer.find('#game-frame');
                    $gameFrame.css({
                        'border-radius': '0'
                    });
                }

                function manualGameFullscreen() {
                    // Hide UI elements and make game container fullscreen manually
                    $gameInfoSidebar.hide();
                    $commentsSection.hide();

                    $gameContainer.addClass('fullscreen-mode').removeClass('cinematic-mode').css({
                        'position': 'fixed',
                        'left': '0',
                        'right': '0',
                        'top': '0',
                        'bottom': '0',
                        'width': '100vw',
                        'height': '100vh',
                        'max-width': 'none',
                        'z-index': '50',
                        'background': '#000',
                        'margin': '0',
                        'border-radius': '0'
                    });

                    // Ensure iframe fills container properly
                    const $gameFrame = $gameContainer.find('#game-frame');
                    $gameFrame.css({
                        'border-radius': '0'
                    });

                    $('body').addClass('overflow-hidden');
                }
            }

            currentMode = mode;
        }

        // Exit fullscreen/cinematic on Escape key
        $(document).on('keydown.playpage', function (e) {
            if (e.key === 'Escape' && (currentMode === 'fullscreen' || currentMode === 'cinematic')) {
                setViewMode('default');
            }
        });

        // Handle browser fullscreen change events
        $(document).on('fullscreenchange webkitfullscreenchange mozfullscreenchange msfullscreenchange', function () {
            if (!document.fullscreenElement && !document.webkitFullscreenElement &&
                !document.mozFullScreenElement && !document.msFullscreenElement) {
                // Exited fullscreen, reset to default mode properly
                if (currentMode === 'fullscreen') {
                    setViewMode('default');
                }
            }
        });
    }

    function initRatingSystem() {
        // Check if user is logged in OR guest rating is allowed
        if ((!window.user && !window.gameData.allowGuestRating) || !window.gameData) return;

        // Remove existing event handlers to prevent duplicates
        $('.star-btn').off('click.rating');

        $('.star-btn').on('click.rating', function () {
            const rating = parseInt($(this).data('rating'));

            $.ajax({
                url: '/requests/rate-game',
                method: 'POST',
                data: {
                    gameId: window.gameData.id,
                    rating: rating,
                    userId: window.user ? window.user.id : 0  // Use 0 for guests
                },
                success: function (response) {
                    if (response.status === 200) {
                        // Update stars with Line Awesome icons
                        $('.star-btn').each(function (index) {
                            const $star = $(this);
                            const $icon = $star.find('i');
                            if (index < rating) {
                                $star.removeClass('text-gray-300 hover:text-yellow-300').addClass('text-yellow-400');
                                $icon.html('<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>');
                            } else {
                                $star.removeClass('text-yellow-400').addClass('text-gray-300 hover:text-yellow-300');
                                $icon.html('<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>');
                            }
                        });

                        // Update display rating
                        const newRating = parseFloat(response.data.gameRating).toFixed(1);
                        const totalRatings = response.data.totalRatings;

                        // Update rating displays
                        $('span:contains("★")').each(function () {
                            const $span = $(this);
                            const text = $span.text();
                            if (text.includes('★') && text.includes('rating')) {
                                $span.text(`${newRating} ★ • ${totalRatings} rating${totalRatings !== 1 ? 's' : ''}`);
                            } else if (text.includes('★')) {
                                $span.text(`${newRating} ★`);
                            }
                        });

                        window.gameData.userRating = rating;
                        window.gameData.gameRating = response.data.gameRating;
                        window.gameData.totalRatings = response.data.totalRatings;

                        alert.success(__("notifications.rating_submitted"));
                    } else {
                        alert.danger(response.message || __('notifications.rating_failed'));
                    }
                },
                error: function (xhr) {
                    const errorMessage = xhr.responseJSON?.message || __('notifications.rating_submit_error');
                    alert.danger(errorMessage);
                }
            });
        });
    }

    function initCommentSystem() {
        const $commentText = $('#comment-text');
        const $charCount = $('#char-count');
        const $postBtn = $('#post-comment-btn');

        // Remove existing event handlers to prevent duplicates - use more specific selectors
        if ($commentText.length) $commentText.off('input.comment');
        if ($postBtn.length) $postBtn.off('click.comment');
        $('#load-more-comments').off('click.comment');
        $(document).off('click.comment', '.delete-comment-btn');

        // Load More Comments - works for all users (logged in or not)
        $('#load-more-comments').on('click.comment', function () {
            const $btn = $(this);
            const offset = parseInt($btn.data('offset'));
            const originalText = $btn.text();

            // Add loading state with spinner
            $btn.prop('disabled', true).html('<svg class="w-4 h-4 animate-spin inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>' + __('notifications.loading'));

            $.ajax({
                url: '/requests/load-comments',
                method: 'GET',
                data: {
                    gameId: window.gameData.id,
                    offset: offset,
                    limit: 5
                },
                success: function (response) {
                    if (response.status === 200 && response.data && response.data.length > 0) {
                        // Add each comment directly to maintain spacing
                        const $commentsList = $('#comments-list');

                        response.data.forEach(comment => {
                            const commentHtml = createCommentHTML(comment, false);
                            const $comment = $(commentHtml).hide(); // Hide initially for animation
                            $commentsList.append($comment);
                            $comment.fadeIn(400); // Fade in each comment
                        });

                        // Update offset for next load
                        $btn.data('offset', offset + 5);

                        // Hide button if fewer comments than requested (end of list)
                        if (response.data.length < 5) {
                            $btn.fadeOut(300);
                        }
                    } else {
                        // No more comments available
                        $btn.fadeOut(300, function () {
                            $(this).after('<p class="text-center text-gray-500 text-sm mt-4">No more comments to load</p>');
                        });
                    }
                },
                error: function (xhr) {
                    const errorMessage = xhr.responseJSON?.message || __('notifications.comment_load_failed');
                    alert.danger(errorMessage);
                },
                complete: function () {
                    $btn.prop('disabled', false).html(originalText);
                }
            });
        });

        // Only initialize comment posting/deletion for logged-in users
        if (!window.user) return;

        // Character counter
        $commentText.on('input.comment', function () {
            const length = $(this).val().length;
            $charCount.text(length);

            if (length > 500) {
                $charCount.addClass('text-red-500');
                $postBtn.prop('disabled', true).addClass('opacity-50');
            } else {
                $charCount.removeClass('text-red-500');
                $postBtn.prop('disabled', false).removeClass('opacity-50');
            }
        });

        // Post Comment
        $postBtn.on('click.comment', function () {
            const comment = $commentText.val().trim();

            if (!comment) {
                alert.warning(__("games.enter_comment"));
                return;
            }

            if (comment.length > 500) {
                alert.danger(__("games.comment_too_long"));
                return;
            }

            const originalText = $postBtn.text();
            $postBtn.prop('disabled', true).text('Posting...');

            $.ajax({
                url: '/requests/post-comment',
                method: 'POST',
                data: {
                    gameId: window.gameData.id,
                    comment: comment
                },
                success: function (response) {
                    if (response.status === 200) {
                        // Remove "no comments" message if it exists
                        const $noComments = $('#comments-list .text-center');
                        if ($noComments.length > 0) {
                            $noComments.remove();
                        }

                        // Add new comment to top of list
                        const newComment = createCommentHTML(response.data.comment, true);
                        $('#comments-list').prepend(newComment);

                        // Update comment count
                        window.gameData.commentCount++;
                        $('#comment-count').text(window.gameData.commentCount);

                        // Clear form
                        $commentText.val('');
                        $charCount.text('0');

                        alert.success(__("games.comment_posted"));
                    } else {
                        alert.danger(response.message || __('notifications.comment_failed'));
                    }
                },
                error: function (xhr) {
                    const errorMessage = xhr.responseJSON?.message || __('notifications.comment_post_failed');
                    alert.danger(errorMessage);
                },
                complete: function () {
                    $postBtn.prop('disabled', false).text(originalText);
                }
            });
        });

        // Delete Comment
        $(document).on('click.comment', '.delete-comment-btn', function () {
            const commentId = $(this).data('comment-id');
            const $commentItem = $(this).closest('.comment-item');

            // Use iziToast confirmation instead of browser confirm
            const deleteCommentTitle = window.__('games.delete_comment');
            const deleteCommentMessage = window.__('games.delete_comment_confirm');
            const confirmText = window.__('games.confirm');
            const cancelText = window.__('games.cancel');

            iziToast.question({
                title: deleteCommentTitle,
                message: deleteCommentMessage,
                position: 'center',
                backgroundColor: '#EF4444',
                titleColor: '#fff',
                messageColor: '#fff',
                icon: false,
                timeout: false,
                close: false,
                overlay: true,
                buttons: [
                    [`<button style="color: white;">${confirmText}</button>`, function (instance, toast) {
                        instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');

                        $.ajax({
                            url: '/requests/delete-comment',
                            method: 'POST',
                            data: {
                                commentId: commentId
                            },
                            success: function (response) {
                                if (response.status === 200) {
                                    $commentItem.fadeOut(300, function () {
                                        $(this).remove();
                                        window.gameData.commentCount--;
                                        $('#comment-count').text(window.gameData.commentCount);

                                        // Check if no comments left
                                        if ($('#comments-list .comment-item').length === 0) {
                                            $('#comments-list').html(`
                                                <div class="text-center py-8 text-gray-500">
                                                    <svg class="w-16 h-16 mb-2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                                    </svg>
                                                    <p>' + __('games.no_comments') + '</p>
                                                </div>
                                            `);
                                        }
                                    });
                                    alert.success(__("games.comment_deleted"));
                                } else {
                                    alert.danger(response.message || window.__('games.delete_comment_failed'));
                                }
                            },
                            error: function (xhr) {
                                const errorMessage = xhr.responseJSON?.message || window.__('games.delete_comment_error');
                                alert.danger(errorMessage);
                            }
                        });
                    }, true],
                    [`<button style="color: white;">${cancelText}</button>`, function (instance, toast) {
                        instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                    }]
                ]
            });
        });
    }

    function createCommentHTML(comment, isNew) {
        const deleteBtn = (window.user && window.user.id === comment.user_id) ?
            `<button class="delete-comment-btn text-gray-400 hover:text-red-500 text-sm" data-comment-id="${comment.id}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
            </button>` : '';

        const timeDisplay = isNew ? window.__('games.just_now') : new Date(comment.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="comment-item flex space-x-3">
                <img src="${comment.avatar || 'https://www.gravatar.com/avatar/default?d=identicon&s=40'}" alt="${comment.username}"
                    class="w-10 h-10 rounded-full flex-shrink-0" />
                <div class="flex-1">
                    <div class="bg-gray-50 rounded-xl p-4">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center space-x-2">
                                <span class="font-medium text-gray-900">${comment.username}</span>
                                <span class="text-xs text-gray-500">${timeDisplay}</span>
                            </div>
                            ${deleteBtn}
                        </div>
                        <p class="text-gray-700 text-sm">${comment.comment}</p>
                    </div>
                </div>
            </div>
        `;
    }

    function initShareButton() {
        // Remove existing event handlers to prevent duplicates
        $('#share-btn').off('click.share');

        $('#share-btn').on('click.share', function () {
            const gameUrl = window.location.href;
            const gameTitle = window.gameData.title;

            if (navigator.share) {
                navigator.share({
                    title: gameTitle,
                    text: `Play ${gameTitle} online for free!`,
                    url: gameUrl
                });
            } else {
                // Fallback - copy to clipboard
                navigator.clipboard.writeText(gameUrl).then(() => {
                    $(this).html('<svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' + __('notifications.copied'))
                        .removeClass('bg-blue-500 hover:bg-blue-600')
                        .addClass('bg-green-500');

                    setTimeout(() => {
                        $(this).html('<svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>' + __('buttons.share'))
                            .removeClass('bg-green-500')
                            .addClass('bg-blue-500 hover:bg-blue-600');
                    }, 2000);

                    alert.success(__("games.url_copied"));
                }).catch(() => {
                    alert.danger(__("games.copy_failed"));
                });
            }
        });
    }

    function initFavoriteButton() {
        if (!window.user || !window.gameData) return;

        // Remove existing event handlers to prevent duplicates
        $('#favorite-btn').off('click.favorite');

        $('#favorite-btn').on('click.favorite', function () {
            const $btn = $(this);
            $btn.prop('disabled', true).html('<svg class="w-4 h-4 mr-2 animate-pulse inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>' + __('notifications.processing'));

            $.ajax({
                url: '/requests/toggle-favorite',
                method: 'POST',
                data: {
                    gameId: window.gameData.id
                },
                success: function (response) {
                    if (response.status === 200) {
                        if (response.data.favorited) {
                            $btn.removeClass('bg-pink-500 hover:bg-pink-600')
                                .addClass('bg-red-500 hover:bg-red-600')
                                .html('<svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>' + __('games.unfavorite'));
                            alert.success(__("api.requests.added_to_favorites"));
                        } else {
                            $btn.removeClass('bg-red-500 hover:bg-red-600')
                                .addClass('bg-pink-500 hover:bg-pink-600')
                                .html('<svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>' + __('games.favorite'));
                            alert.warning(__("api.requests.removed_from_favorites"));
                        }
                    }
                },
                error: function () {
                    alert.danger(__("notifications.favorite_update_failed"));
                },
                complete: function () {
                    $btn.prop('disabled', false);
                }
            });
        });
    }

    function initSearch() {
        const $searchInput = $('#gameSearch');
        const $searchResults = $('#searchResults');
        const $searchContent = $('#searchContent');
        const $searchLoading = $('#searchLoading');
        const $searchNoResults = $('#searchNoResults');
        const $clearBtn = $('#clearSearch');

        if (!$searchInput.length) return; // No search input found

        // Check if already initialized to prevent duplicate event handlers
        if ($searchInput.data('search-initialized')) return;
        $searchInput.data('search-initialized', true);

        let searchTimeout;
        let currentRequest = null; // Track current AJAX request
        let isSearchOpen = false;

        // Clear search functionality
        $clearBtn.on('click', function () {
            // Cancel any pending request
            if (currentRequest && currentRequest.readyState !== 4) {
                currentRequest.abort();
                currentRequest = null;
            }
            clearTimeout(searchTimeout);
            $searchInput.val('').trigger('input').focus();
        });

        // Handle search input
        $searchInput.on('input', function () {
            const query = $(this).val().trim();

            // Show/hide clear button
            if (query.length > 0) {
                $clearBtn.removeClass('hidden');
            } else {
                $clearBtn.addClass('hidden');
                // Cancel any pending request and timeout
                if (currentRequest && currentRequest.readyState !== 4) {
                    currentRequest.abort();
                    currentRequest = null;
                }
                clearTimeout(searchTimeout);
                hideSearchResults();
                return;
            }

            // Clear previous timeout
            clearTimeout(searchTimeout);

            // Don't search for very short queries
            if (query.length < 2) {
                // Cancel any pending request
                if (currentRequest && currentRequest.readyState !== 4) {
                    currentRequest.abort();
                    currentRequest = null;
                }
                hideSearchResults();
                return;
            }

            // Debounce search requests
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        });

        // Handle Enter key for full search page
        $searchInput.on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = $(this).val().trim();
                if (query.length >= 2) {
                    window.location.href = `/search/${encodeURIComponent(query)}`;
                }
            }
        });

        // Hide search results when clicking outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest('#gameSearch, #searchResults').length) {
                hideSearchResults();
            }
        });

        // Handle clicking on search results
        $(document).on('click', '#searchContent .search-result-item', function (e) {
            e.preventDefault();
            const href = $(this).attr('href');
            hideSearchResults();

            // Use PJAX navigation if available
            if (window.pjax) {
                window.pjax.loadUrl(href);
            } else {
                window.location.href = href;
            }
        });

        function performSearch(query) {
            // Cancel previous request if it exists
            if (currentRequest && currentRequest.readyState !== 4) {
                currentRequest.abort();
            }

            showSearchResults();
            $searchLoading.removeClass('hidden');
            $searchContent.empty();
            $searchNoResults.addClass('hidden');

            currentRequest = $.ajax({
                url: '/requests/search-games',
                method: 'GET',
                data: {
                    q: query,
                    limit: 6 // Limit results for dropdown
                },
                success: function (response) {
                    currentRequest = null;
                    $searchLoading.addClass('hidden');

                    if (response.status === 200 && response.data.games.length > 0) {
                        displaySearchResults(response.data.games, query, response.data.totalCount);
                    } else {
                        $searchNoResults.removeClass('hidden');
                    }
                },
                error: function (xhr) {
                    currentRequest = null;
                    // Don't show error if request was aborted
                    if (xhr.statusText !== 'abort') {
                        $searchLoading.addClass('hidden');
                        $searchNoResults.removeClass('hidden');
                    }
                }
            });
        }

        function displaySearchResults(games, query, totalCount) {
            let html = '';

            games.forEach((game, index) => {
                // Parse thumbnail data to support new JSON format with WebP
                let thumbnail;
                if (game.thumbnail) {
                    try {
                        // Check if it's JSON format
                        if (typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
                            const parsedThumbnail = JSON.parse(game.thumbnail);
                            if (parsedThumbnail.webp && parsedThumbnail.webp.thumbnail) {
                                thumbnail = '/' + parsedThumbnail.webp.thumbnail.relativePath;
                            } else if (parsedThumbnail.webp && parsedThumbnail.webp.standard) {
                                thumbnail = '/' + parsedThumbnail.webp.standard.relativePath;
                            } else if (parsedThumbnail.original && parsedThumbnail.original.thumbnail) {
                                thumbnail = '/' + parsedThumbnail.original.thumbnail.relativePath;
                            } else if (parsedThumbnail.original && parsedThumbnail.original.standard) {
                                thumbnail = '/' + parsedThumbnail.original.standard.relativePath;
                            } else {
                                // Fallback to old format
                                thumbnail = game.thumbnail.startsWith('/') ? game.thumbnail : '/' + game.thumbnail;
                            }
                        } else {
                            // Old format - simple path
                            thumbnail = game.thumbnail.startsWith('/') ? game.thumbnail : '/' + game.thumbnail;
                        }
                    } catch (e) {
                        // JSON parsing failed, use as regular path
                        thumbnail = game.thumbnail.startsWith('/') ? game.thumbnail : '/' + game.thumbnail;
                    }
                } else {
                    // No thumbnail available
                    thumbnail = `https://dummyimage.com/80x60/9CA3AF/FFFFFF?text=${encodeURIComponent(game.title.charAt(0))}`;
                }

                // Add category color based on game category
                const categoryColors = {};
                categoryColors[__('categories.action')] = 'bg-red-100 text-red-700';
                categoryColors[__('categories.adventure')] = 'bg-green-100 text-green-700';
                categoryColors[__('categories.puzzle')] = 'bg-purple-100 text-purple-700';
                categoryColors[__('categories.sports')] = 'bg-blue-100 text-blue-700';
                categoryColors[__('categories.racing')] = 'bg-orange-100 text-orange-700';
                categoryColors[__('categories.strategy')] = 'bg-indigo-100 text-indigo-700';
                const categoryClass = categoryColors[game.category_name] || 'bg-gray-100 text-gray-700';

                // Format play count
                const playCount = game.play_count ?
                    (game.play_count >= 1000 ? Math.floor(game.play_count / 1000) + 'k' : game.play_count) :
                    '0';

                html += `
                    <a href="/play/${game.slug}" class="search-result-item group flex items-center p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300 border-b border-gray-50 last:border-b-0" system-nav>
                        <div class="relative flex-shrink-0 mr-4">
                            <img src="${thumbnail}" alt="${game.title}" class="w-16 h-12 rounded-xl object-cover shadow-sm group-hover:shadow-md transition-shadow duration-300">
                            <div class="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full shadow-sm flex items-center justify-center text-xs font-bold text-gray-600">
                                ${index + 1}
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between mb-1">
                                <h4 class="text-sm font-semibold text-gray-900 truncate pr-2 group-hover:text-blue-700 transition-colors duration-200">${game.title}</h4>
                                <div class="flex items-center space-x-1 flex-shrink-0">
                                    <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"/>
                                    </svg>
                                </div>
                            </div>
                            <div class="flex items-center space-x-2 mb-2">
                                <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${categoryClass}">
                                    ${game.category_name || __('categories.default')}
                                </span>
                                <div class="flex items-center text-xs text-gray-500">
                                    <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"/>
                                    </svg>
                                    <span>${playCount} plays</span>
                                </div>
                            </div>
                            ${game.rating ? `
                                <div class="flex items-center space-x-1">
                                    <div class="flex items-center">
                                        ${'★'.repeat(Math.floor(game.rating))}${'☆'.repeat(5 - Math.floor(game.rating))}
                                    </div>
                                    <span class="text-xs text-gray-500">${parseFloat(game.rating).toFixed(1)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </a>
                `;
            });

            // Add "See all results" link if there are more results
            if (totalCount > games.length) {
                html += `
                    <div class="bg-gradient-to-r from-gray-50 to-blue-50 border-t border-gray-100">
                        <a href="/search/${encodeURIComponent(query)}" class="flex items-center justify-center p-4 text-sm text-blue-600 hover:text-blue-700 transition-colors duration-200 font-semibold group" system-nav>
                            <div class="flex items-center space-x-2">
                                <span>${__('search.see_all_results', { count: totalCount.toLocaleString() })}</span>
                                <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                                </svg>
                            </div>
                        </a>
                    </div>
                `;
            }

            $searchContent.html(html);
        }

        function showSearchResults() {
            if (!isSearchOpen) {
                $searchResults.removeClass('hidden');
                isSearchOpen = true;
            }
        }

        function hideSearchResults() {
            if (isSearchOpen) {
                $searchResults.addClass('hidden');
                $searchLoading.addClass('hidden');
                $searchNoResults.addClass('hidden');
                isSearchOpen = false;
            }
        }

        // Reinitialize search on PJAX navigation
        // Note: initLeaderboardPage() is already called in the main pjax:complete handler

        // Clean up Ruffle and Flash Ad Manager before PJAX navigation
        $(document).on('pjax:send', function () {
            cleanupRuffle();

            // Clean up Flash Ad Manager
            if (window.FlashAdManager && typeof window.FlashAdManager.destroy === 'function') {
                window.FlashAdManager.destroy();
            }
        });
    }

    function initLeaderboard() {
        // Only initialize if leaderboard container exists
        if (!$('#leaderboard-container').length) {
            return;
        }

        // Get game ID from game container
        const gameId = $('#game-container').data('game-id');

        if (!gameId) {
            console.warn('No game ID found for leaderboard');
            return;
        }

        loadGameLeaderboard(gameId);
    }

    function loadGameLeaderboard(gameId) {
        $.ajax({
            url: `/requests/score/leaderboard/${gameId}`,
            method: 'GET',
            data: { limit: 5 },
            dataType: 'json'
        })
            .done(function (result) {
                if (result.status === 200 && result.data && result.data.leaderboard && result.data.leaderboard.length > 0) {
                    displayLeaderboard(result.data.leaderboard);
                } else {
                    displayEmptyLeaderboard();
                }
            })
            .fail(function (xhr, status, error) {
                displayEmptyLeaderboard();
            });
    }

    function displayLeaderboard(leaderboard) {
        const container = document.getElementById('leaderboard-container');
        const currentUsername = window.user?.username;

        let html = '<div class="space-y-3">';
        leaderboard.forEach((entry, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            const isCurrentUser = currentUsername && entry.username === currentUsername;

            html += `
                <div class="flex items-center justify-between py-2 px-3 ${isCurrentUser ? 'bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900/30 dark:to-yellow-900/30 border border-orange-300 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-800'} rounded-lg transition-all duration-300 ${isCurrentUser ? 'shadow-md' : ''}">
                    <div class="flex items-center space-x-3">
                        <span class="text-sm font-bold min-w-[24px] ${isCurrentUser ? 'text-orange-600 dark:text-orange-400' : 'dark:text-gray-300'}">${medal}</span>
                        <a href="/profile/${entry.username}" class="font-medium ${isCurrentUser ? 'text-orange-800 dark:text-orange-200' : 'text-gray-900 dark:text-gray-100'} text-sm hover:underline" system-nav>
                            ${entry.username}
                            ${isCurrentUser ? '<span class="text-xs ml-1">(You)</span>' : ''}
                        </a>
                    </div>
                    <span class="font-semibold ${isCurrentUser ? 'text-orange-700 dark:text-orange-300' : 'text-orange-600 dark:text-orange-400'}">${entry.high_score.toLocaleString()}</span>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

        // Refresh PJAX to bind new elements
        if (window.pjax) {
            window.pjax.refresh(container);
        }
    }

    function displayEmptyLeaderboard() {
        const container = document.getElementById('leaderboard-container');
        container.innerHTML = `
            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                <svg class="w-12 h-12 mb-2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/>
                </svg>
                <p class="text-sm">No scores yet</p>
                <p class="text-xs">Be the first to score!</p>
            </div>
        `;
    }

    // Expose function to refresh leaderboard
    window.refreshLeaderboard = function () {
        const gameId = $('#game-container').data('game-id');
        if (gameId) {
            loadGameLeaderboard(gameId);
        }
    };

    // Template-specific competitive login popup (Light Theme)
    window.showTemplateCompetitivePopup = function (score) {
        // Don't show popup for scores less than 1
        if (score < 1) {
            return;
        }

        // Remove existing popup if any
        const existingPopup = document.getElementById('competitive-login-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Create overlay with dark mode support
        const overlay = document.createElement('div');
        overlay.id = 'competitive-login-popup';
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-start sm:items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto';

        // Create popup container with dark mode support
        const popup = document.createElement('div');
        popup.className = 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden max-w-4xl w-full animate-in slide-in-from-bottom-8 duration-300 my-4 sm:my-8 max-h-screen sm:max-h-[90vh] overflow-y-auto';

        // Create popup content with light theme colors
        popup.innerHTML = `
            <style>
                @keyframes pulse-score {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes trophy-bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-5px); }
                    60% { transform: translateY(-3px); }
                }
                .score-pulse { animation: pulse-score 2s ease-in-out infinite; }
                .trophy-bounce { animation: trophy-bounce 2s ease-in-out infinite; }
                
                /* Mobile scrolling improvements */
                #competitive-login-popup {
                    -webkit-overflow-scrolling: touch;
                    scroll-behavior: smooth;
                }
                
                /* Ensure content doesn't get cut off on very short screens */
                @media (max-height: 600px) {
                    .popup-content {
                        padding-top: 1rem;
                        padding-bottom: 1rem;
                    }
                }
            </style>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 min-h-[350px] sm:min-h-[400px] lg:min-h-[500px]">
                <!-- Left Column - Score Display -->
                <div class="p-4 sm:p-6 lg:p-8 flex flex-col justify-center relative">
                    <button class="absolute top-4 right-4 w-8 h-8 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center text-lg font-bold transition-all hover:scale-110" 
                            onclick="document.getElementById('competitive-login-popup').remove()">×</button>
                    
                    <!-- Score Header -->
                    <div class="text-center mb-4 sm:mb-6 lg:mb-8">
                        <div class="mx-auto h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 mb-3 sm:mb-4 trophy-bounce">
                            <span class="text-orange-500 text-xl sm:text-2xl lg:text-3xl">🏆</span>
                        </div>
                        <h1 class="text-gray-600 dark:text-gray-200 text-lg sm:text-xl lg:text-2xl font-bold mb-2">${__("games.amazing_score")}</h1>
                        <div class="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-orange-500 mb-2 score-pulse">
                            ${score.toLocaleString()}
                        </div>
                        <p class="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                            ${__("games.join_competition")}
                        </p>
                    </div>

                    <!-- Login Form Section -->
                    <div class="space-y-3 sm:space-y-4 lg:space-y-6">
                        <div class="text-center">
                            <h3 class="text-base sm:text-lg lg:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2 sm:mb-3">${__("games.ready_to_compete")}</h3>
                            <p class="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                                ${__("games.login_to_compete")}
                            </p>
                        </div>

                        <!-- Action Buttons -->
                        <div class="space-y-2 sm:space-y-3">
                            <button class="w-full bg-black dark:bg-gray-700 text-white py-2.5 sm:py-3 px-4 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center text-sm sm:text-base" 
                                    onclick="document.getElementById('competitive-login-popup').remove(); if (window.pjax) { window.pjax.loadUrl('/login'); } else { window.location.href = '/login'; }">
                                <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
                                </svg>
                                ${__("games.login_to_save_score")}
                            </button>
                            <button class="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 sm:py-3 px-4 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 text-sm sm:text-base" 
                                    onclick="document.getElementById('competitive-login-popup').remove()">
                                ${__("games.maybe_later")}
                            </button>
                        </div>

                        <div class="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            ${__("auth.no_account")} 
                            <a href="#" class="text-orange-500 hover:text-orange-600 font-medium transition-colors duration-200"
                               onclick="event.preventDefault(); document.getElementById('competitive-login-popup').remove(); if (window.pjax) { window.pjax.loadUrl('/register'); } else { window.location.href = '/register'; }">
                                ${__("auth.register")}
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Right Column - Visual -->
                <div class="bg-gradient-to-br from-orange-50 via-orange-100/30 to-amber-50 dark:from-gray-800 dark:via-gray-700/60 dark:to-gray-800 p-4 sm:p-6 lg:p-8 flex flex-col justify-center items-center text-center relative overflow-hidden">
                    <!-- Background decoration -->
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(251,191,36,0.1)_0%,_transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_20%,_rgba(251,191,36,0.05)_0%,_transparent_50%)]"></div>
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,_rgba(249,115,22,0.1)_0%,_transparent_50%)] dark:bg-[radial-gradient(circle_at_70%_80%,_rgba(249,115,22,0.05)_0%,_transparent_50%)]"></div>
                    
                    <div class="relative z-10 space-y-4 sm:space-y-6">
                        <!-- Gaming icons -->
                        <div class="flex justify-center space-x-2 sm:space-x-4 mb-4 sm:mb-6">
                            <div class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-white/80 dark:bg-gray-800/80 rounded-full flex items-center justify-center shadow-sm">
                                <span class="text-orange-500 text-lg sm:text-xl lg:text-2xl">🎮</span>
                            </div>
                            <div class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-white/80 dark:bg-gray-800/80 rounded-full flex items-center justify-center shadow-sm">
                                <span class="text-orange-500 text-lg sm:text-xl lg:text-2xl">🏆</span>
                            </div>
                            <div class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-white/80 dark:bg-gray-800/80 rounded-full flex items-center justify-center shadow-sm">
                                <span class="text-orange-500 text-lg sm:text-xl lg:text-2xl">⭐</span>
                            </div>
                        </div>

                        <div class="space-y-2 sm:space-y-3">
                            <h2 class="text-xl sm:text-2xl lg:text-3xl font-black text-gray-800 dark:text-gray-100 leading-tight">
                                ${__("games.join_the_competition")}
                            </h2>
                            <p class="text-gray-600 dark:text-gray-300 text-sm sm:text-base lg:text-lg leading-relaxed max-w-xs mx-auto">
                                ${__("games.leaderboards_description")}
                            </p>
                        </div>

                        <!-- Features -->
                        <div class="space-y-4">
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                    <span class="text-orange-600 dark:text-orange-400 text-lg">🏅</span>
                                </div>
                                <div class="text-left">
                                    <h3 class="font-medium text-gray-700 dark:text-gray-200 mb-1 text-sm">${__("games.global_leaderboards")}</h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${__("games.leaderboards_description")}</p>
                                </div>
                            </div>

                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                    <span class="text-orange-600 dark:text-orange-400 text-lg">💎</span>
                                </div>
                                <div class="text-left">
                                    <h3 class="font-medium text-gray-700 dark:text-gray-200 mb-1 text-sm">${__("games.personal_records")}</h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${__("games.personal_records_description")}</p>
                                </div>
                            </div>

                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                    <span class="text-orange-600 dark:text-orange-400 text-lg">⚡</span>
                                </div>
                                <div class="text-left">
                                    <h3 class="font-medium text-gray-700 dark:text-gray-200 mb-1 text-sm">${__("games.exp_achievements")}</h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${__("games.exp_achievements_description")}</p>
                                </div>
                            </div>

                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                    <span class="text-orange-600 dark:text-orange-400 text-lg">🎯</span>
                                </div>
                                <div class="text-left">
                                    <h3 class="font-medium text-gray-700 dark:text-gray-200 mb-1 text-sm">${__("games.score_history")}</h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${__("games.score_history_description")}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Security Info -->
                        <div class="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
                            <p class="mb-2">${__("games.safe_secure")}</p>
                            <div class="flex justify-center space-x-3">
                                <span class="flex items-center">
                                    <svg class="w-3 h-3 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
                                    </svg>
                                    ${__("games.protected")}
                                </span>
                                <span class="flex items-center">
                                    <svg class="w-3 h-3 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    ${__("games.quick_setup")}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Add click outside to close
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        // Add ESC key to close
        const closeHandler = function(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', closeHandler);
            }
        };
        document.addEventListener('keydown', closeHandler);
    };

    // Template-specific floating chat HTML generation (Purple Theme)
    window.generateTemplateFloatingChatHTML = function (params) {
        const {
            chatText, virtualChatText, openFullChatroomText,
            connectToSeeMessagesText, joinFullChatExpText,
            typeMessageText, loginToJoinText, loginText, registerText,
            userAuthenticated
        } = params;

        // Generate user interface HTML based on authentication status
        let userInterfaceHTML = '';
        if (userAuthenticated) {
            // Logged in user interface with premium purple theme
            userInterfaceHTML = `
                <div id="floatingChatInput">
                    <div class="flex space-x-2">
                        <input type="text" id="floatingMessageInput" placeholder="${typeMessageText}" 
                               class="flex-1 px-3 py-2 border-2 border-purple-200/60 dark:border-purple-700/60 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 dark:focus:border-purple-500 text-sm dark:text-gray-100
                               placeholder-purple-400/70 dark:placeholder-purple-400/50 transition-all duration-300 shadow-sm hover:shadow-md
                               max-sm:px-2 max-sm:py-1.5">
                        <button onclick="window.floatingChat.sendMessage()" 
                                class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 
                                text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl 
                                transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200
                                max-sm:px-3 max-sm:py-1.5 group">
                            <svg class="w-4 h-4 max-sm:w-3.5 max-sm:h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Guest interface with premium purple theme
            userInterfaceHTML = `
                <div class="text-center">
                    <p class="text-sm text-purple-600/80 dark:text-purple-400/80 mb-3 max-sm:text-xs max-sm:mb-2">${loginToJoinText}</p>
                    <div class="flex space-x-2">
                        <a href="/login" class="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800
                           text-white py-2 px-3 rounded-lg text-sm font-medium text-center 
                           shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200
                           max-sm:py-1.5 max-sm:px-2 max-sm:text-xs">
                            ${loginText}
                        </a>
                        <a href="/register" class="flex-1 border-2 border-purple-600/60 dark:border-purple-500/60 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-900/30
                           py-2 px-3 rounded-lg text-sm font-medium text-center 
                           hover:bg-purple-100/70 dark:hover:bg-purple-800/50 hover:border-purple-600 dark:hover:border-purple-400 hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200
                           max-sm:py-1.5 max-sm:px-2 max-sm:text-xs">
                            ${registerText}
                        </a>
                    </div>
                </div>
            `;
        }

        // Return complete floating chat HTML with premium purple theme styling
        return `
            <!-- Floating Chat System -->
            <div id="floatingChatSystem" class="fixed bottom-6 right-6 z-40">
                <!-- Chat Button (collapsed state) -->
                <div id="floatingChatButton" class="relative">
                    <button onclick="window.floatingChat.toggleChat()" 
                            class="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-purple-700 
                            hover:from-purple-700 hover:to-purple-800 text-white px-4 py-3 rounded-full 
                            shadow-lg hover:shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40
                            transition-all duration-300 transform hover:scale-105 active:scale-95
                            backdrop-blur-sm border border-white/20
                            sm:px-4 sm:py-3 sm:space-x-2
                            max-sm:px-3 max-sm:py-2 max-sm:space-x-1 group">
                        <svg class="w-5 h-5 max-sm:w-4 max-sm:h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                        <span class="font-medium text-base max-sm:text-sm max-sm:hidden group-hover:text-purple-100 transition-colors duration-200">${chatText}</span>
                        <span id="floatingPlayerCount" class="bg-white/25 backdrop-blur-sm text-xs px-2 py-1 rounded-full max-sm:px-1.5 max-sm:py-0.5 
                              border border-white/20 group-hover:bg-white/30 transition-all duration-200">0</span>
                        <span id="chatNotificationBadge" class="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 
                              text-white text-xs w-5 h-5 rounded-full flex items-center justify-center 
                              hidden animate-bounce shadow-lg shadow-red-500/30
                              max-sm:w-4 max-sm:h-4 max-sm:-top-1 max-sm:-right-1 border border-white/20">!</span>
                    </button>
                </div>

                <!-- Chat Window -->
                <div id="floatingChatWindow" class="hidden absolute 
                     bottom-0 right-0
                     w-80 h-96 
                     max-w-[calc(100vw-2rem)] 
                     bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-2xl shadow-purple-500/20 dark:shadow-purple-400/10 
                     border border-purple-200/60 dark:border-purple-700/60 flex flex-col
                     transform-gpu animate-in slide-in-from-bottom-8 fade-in duration-300
                     max-sm:w-72 max-sm:h-72 max-sm:bottom-12">
                    
                    <!-- Chat Header -->
                    <div class="flex items-center justify-between p-4 border-b border-purple-200/50 dark:border-purple-700/50 
                         bg-gradient-to-r from-purple-50/80 to-purple-100/60 dark:from-purple-900/40 dark:to-purple-800/40 backdrop-blur-sm rounded-t-2xl max-sm:p-3">
                        <div class="flex items-center space-x-2">
                            <div class="p-1.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full shadow-sm">
                                <svg class="w-4 h-4 text-white max-sm:w-3.5 max-sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                </svg>
                            </div>
                            <h3 class="font-semibold text-purple-800 dark:text-purple-200 text-base max-sm:text-sm">${virtualChatText}</h3>
                            <span id="windowPlayerCount" class="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs px-2 py-1 
                                  rounded-full shadow-sm border border-purple-300/30 max-sm:px-1.5 max-sm:py-0.5">0</span>
                        </div>
                        <div class="flex items-center space-x-2 max-sm:space-x-1">
                            <a href="/chatroom" target="_blank" class="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 p-2 
                               hover:bg-purple-200/50 dark:hover:bg-purple-800/50 rounded-lg transition-all duration-300 group" title="${openFullChatroomText}">
                                <svg class="w-4 h-4 max-sm:w-3.5 max-sm:h-3.5 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>
                                </svg>
                            </a>
                            <button onclick="window.floatingChat.toggleChat()" 
                                    class="text-purple-400 dark:text-purple-500 hover:text-purple-600 dark:hover:text-purple-300 p-2 hover:bg-purple-200/50 dark:hover:bg-purple-800/50 rounded-lg 
                                    transition-all duration-300 group">
                                <svg class="w-4 h-4 max-sm:w-3.5 max-sm:h-3.5 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Chat Messages -->
                    <div id="floatingChatMessages" class="flex-1 overflow-y-auto p-4 space-y-2 max-sm:p-3 
                         scrollbar-thin scrollbar-thumb-purple-300 dark:scrollbar-thumb-purple-600 scrollbar-track-purple-50 dark:scrollbar-track-purple-900">
                        <div class="text-center text-purple-400 dark:text-purple-500 text-sm py-8">
                            <div class="p-3 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 rounded-full w-16 h-16 mx-auto mb-4 
                                 flex items-center justify-center shadow-sm border border-purple-200 dark:border-purple-700">
                                <svg class="w-8 h-8 max-sm:w-6 max-sm:h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                </svg>
                            </div>
                            <p class="text-sm max-sm:text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">${connectToSeeMessagesText}</p>
                            <p class="text-xs text-purple-500/70 dark:text-purple-500/60">${joinFullChatExpText}</p>
                        </div>
                    </div>

                    <!-- Chat Input -->
                    <div class="p-4 border-t border-purple-200/50 dark:border-purple-700/50 bg-gradient-to-r from-purple-50/30 to-white/50 dark:from-purple-900/20 dark:to-gray-800/50 
                         backdrop-blur-sm rounded-b-2xl max-sm:p-3">
                        <div id="floatingChatInputContainer">
                            ${userInterfaceHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // Template-specific floating chat message styling (Premium Purple Theme)
    window.generateTemplateFloatingChatMessageHTML = function (messages, escapeHtml) {
        return messages.map((msg, index) => `
            <div class="text-sm max-sm:text-xs hover:bg-gradient-to-r hover:from-purple-50/60 hover:to-purple-100/40 dark:hover:from-purple-900/30 dark:hover:to-purple-800/30 
                 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-sm
                 border border-transparent hover:border-purple-200/40 dark:hover:border-purple-700/40 group animate-in slide-in-from-left-4"
                 style="animation-delay: ${index * 50}ms">
                <span class="font-semibold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent 
                      group-hover:from-purple-700 group-hover:to-purple-800 transition-all duration-200">${escapeHtml(msg.name)}:</span>
                <span class="text-gray-700 dark:text-gray-300 ml-1 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors duration-200">${escapeHtml(msg.message)}</span>
            </div>
        `).join('');
    };

    // Function to clean up Ruffle instance before navigation
    function cleanupRuffle() {
        try {
            // Check if Ruffle player instance exists
            if (window.currentRufflePlayer) {
                console.log('Cleaning up Ruffle player instance...');

                // Pause the player first
                if (typeof window.currentRufflePlayer.pause === 'function') {
                    window.currentRufflePlayer.pause();
                }

                // Stop the player
                if (typeof window.currentRufflePlayer.stop === 'function') {
                    window.currentRufflePlayer.stop();
                }

                // Destroy the player instance
                if (typeof window.currentRufflePlayer.destroy === 'function') {
                    window.currentRufflePlayer.destroy();
                }

                // Clear the player reference
                window.currentRufflePlayer = null;
                delete window.currentRufflePlayer;
            }

            // Clean up RufflePlayer global variables
            if (window.RufflePlayer) {
                window.RufflePlayer = null;
                delete window.RufflePlayer;
            }

            // Remove any Ruffle script elements that were dynamically loaded
            const ruffleScripts = document.querySelectorAll('script[src*="ruffle"]');
            ruffleScripts.forEach(script => {
                script.remove();
            });

            // Clean up Ruffle container using jQuery
            const $ruffleContainer = $('#ruffle-player');
            if ($ruffleContainer.length) {
                // Remove all child elements to stop any running content
                $ruffleContainer.empty();
            }

            // Clear any running audio/video elements in Ruffle container using jQuery
            $('ruffle-player').each(function () {
                try {
                    // Try to pause any media in the Ruffle player
                    if (this.pause && typeof this.pause === 'function') {
                        this.pause();
                    }
                    // Remove the element
                    $(this).remove();
                } catch (e) {
                    // Ignore errors during cleanup
                }
            });

            // Clear any Ruffle-specific containers or elements using jQuery
            $('[id*="ruffle"], [class*="ruffle"]').each(function () {
                try {
                    if (this.pause && typeof this.pause === 'function') {
                        this.pause();
                    }
                } catch (e) {
                    // Ignore errors during cleanup
                }
            });

            // Reset body overflow state to restore scrolling
            $('body').removeClass('overflow-hidden').css('overflow', '');

        } catch (error) {
            console.warn('Error during Ruffle cleanup:', error);
        }
    }

    // Game page tracking functions
    function joinGamePage(gameId) {
        console.log('Attempting to join game page:', gameId);
        console.log('Socket connected:', socket && socket.connected);

        if (socket && socket.connected && gameId) {
            console.log('Emitting join_game_page event for game:', gameId);
            socket.emit('join_game_page', gameId);
        } else {
            console.log('Cannot join game page - socket not ready or no game ID');
        }
    }

    function leaveGamePage(gameId) {
        console.log('Attempting to leave game page:', gameId);

        if (socket && socket.connected && gameId) {
            console.log('Emitting leave_game_page event for game:', gameId);
            socket.emit('leave_game_page', gameId);
        } else {
            console.log('Cannot leave game page - socket not ready or no game ID');
        }
    }

    // Update game viewer count on thumbnails
    function updateGameViewerCount(gameId, viewerCount) {
        console.log('Updating viewer count for game', gameId, 'count:', viewerCount);

        // Update all thumbnails with this game ID
        const $thumbnails = $(`.game-thumbnail[data-game-id="${gameId}"]`);
        console.log('Found', $thumbnails.length, 'thumbnails for game', gameId);

        $thumbnails.each(function () {
            const $thumbnail = $(this);
            let $viewerBadge = $thumbnail.find('.viewer-count-badge');

            if (viewerCount > 0) {
                if ($viewerBadge.length === 0) {
                    // Get category color for this thumbnail (if available)
                    const $categorySection = $thumbnail.closest('section');
                    let badgeColor = '#ef4444'; // Default red

                    // Try to extract category color from the page
                    if ($categorySection.length > 0) {
                        const $colorElement = $categorySection.find('[style*="background"]').first();
                        if ($colorElement.length > 0) {
                            const styleAttr = $colorElement.attr('style');
                            const colorMatch = styleAttr.match(/#[0-9a-fA-F]{6}/);
                            if (colorMatch) {
                                badgeColor = colorMatch[0];
                            }
                        }
                    }

                    // Create viewer count badge
                    $viewerBadge = $(`
                        <div class="viewer-count-badge absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10" style="background-color: ${badgeColor};">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                            </svg>
                            <span class="viewer-count">${viewerCount}</span>
                        </div>
                    `);
                    $thumbnail.append($viewerBadge);
                    console.log('Created new viewer badge for game', gameId, 'with count', viewerCount, 'color:', badgeColor);
                } else {
                    // Update existing badge
                    $viewerBadge.find('.viewer-count').text(viewerCount);
                    console.log('Updated existing viewer badge for game', gameId, 'with count', viewerCount);
                }
            } else {
                // Remove badge if no viewers
                if ($viewerBadge.length > 0) {
                    $viewerBadge.remove();
                    console.log('Removed viewer badge for game', gameId);
                }
            }
        });
    }

    // Track current game being viewed
    let currentGameId = null;

    // Track game page visits
    function initGamePageTracking() {
        console.log('Initializing game page tracking...');

        // Leave previous game if we were tracking one
        if (currentGameId) {
            console.log('Leaving previous game page:', currentGameId);
            leaveGamePage(currentGameId);
            currentGameId = null;
        }

        // Check if we're on a game play page
        const pathSegments = window.location.pathname.split('/');
        console.log('Current path segments:', pathSegments);

        if (pathSegments[1] === 'play' && pathSegments[2]) {
            console.log('On game play page, looking for game ID...');

            // Get game ID from game container or page data
            const gameId = $('#game-container').data('game-id') ||
                window.gameData?.id;

            console.log('Found game ID:', gameId);

            if (gameId) {
                console.log('Setting up game page tracking for game ID:', gameId);
                currentGameId = gameId;

                // Join game page when page loads (with delay to ensure socket is connected)
                setTimeout(() => {
                    joinGamePage(gameId);
                }, 1000);
            } else {
                console.log('No game ID found, game page tracking not enabled');
            }
        } else {
            console.log('Not on a game play page');
        }
    }

    // Initialize game page tracking
    initGamePageTracking();

    // Reinitialize game page tracking after pjax navigation
    $(document).on('pjax:success', function () {
        console.log('PJAX navigation completed, reinitializing game page tracking...');
        initGamePageTracking();

        $('.ad-container[data-auto-init="true"]').each(function () {
            const $container = $(this);
            if (!$container.data('initialized')) {
                const width = $container.data('width') || 320;
                const height = $container.data('height') || 250;
                const placement = $container.data('placement') || 'sidebar';
                setTimeout(() => {
                    window.initAdContainer(this, width, height, placement);
                }, Math.random() * 1000);
            }
        });
    });

    // Handle page unload to leave current game and cleanup Ruffle
    $(window).on('beforeunload', function () {
        if (currentGameId) {
            console.log('Page unloading, leaving game page:', currentGameId);
            leaveGamePage(currentGameId);
        }

        // Clean up Ruffle on page unload
        cleanupRuffle();
    });

    // Debug function to test viewer count display
    window.testViewerCount = function (gameId, count) {
        updateGameViewerCount(gameId, count);
    };

    // Promo Modal System - moved from chatroom.functions.js
    let promoModalStylesInjected = false;

    function setupPromoModal() {
        if (shouldShowPromoModal()) {
            // Inject styles once
            injectPromoModalStyles();

            setTimeout(() => {
                showPromoModal();
                setInterval(() => showPromoModal(), 300000); // Show every 5 minutes
            }, 30000); // First show after 30 seconds
        }
    }

    function shouldShowPromoModal() {
        // Don't show for logged-in users
        if (window.user) {
            return false;
        }
        
        // Don't show in maintenance mode
        if (window.MAINTENANCE_MODE === true) {
            console.log('Promo modal disabled: maintenance mode active');
            return false;
        }
        
        // Don't show on excluded page paths
        const currentPath = window.location.pathname;
        const excludedPatterns = [
            /^\/play\//,                    // Play pages
            /^\/auth\//,                    // Auth routes
            /^\/(login|register|forgot-password|reset-password|verify-email)/,  // Auth pages
            /^\/errors?\//,                 // Error pages
        ];
        
        for (const pattern of excludedPatterns) {
            if (pattern.test(currentPath)) {
                console.log('Promo modal disabled on page:', currentPath);
                return false;
            }
        }
        
        return true;
    }

    function injectPromoModalStyles() {
        if (promoModalStylesInjected || document.getElementById('promoModalStyles')) {
            return;
        }

        const styleElement = document.createElement('style');
        styleElement.id = 'promoModalStyles';
        styleElement.textContent = `
            @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes scale-in {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            
            @keyframes slide-up {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes slide-right {
                from { transform: translateX(-20px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            
            @keyframes bounce-slow {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
            }
            
            @keyframes pulse-slow {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 0.9; }
            }
            
            .promo-animate-fade-in { animation: fade-in 0.4s ease-out; }
            .promo-animate-scale-in { animation: scale-in 0.5s ease-out; }
            .promo-animate-slide-up { animation: slide-up 0.6s ease-out; }
            .promo-animate-slide-right { animation: slide-right 0.6s ease-out; }
            .promo-animate-float { animation: float 6s ease-in-out infinite; }
            .promo-animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
            .promo-animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
            
            .promo-animation-delay-200 { animation-delay: 0.2s; }
            .promo-animation-delay-300 { animation-delay: 0.3s; }
            .promo-animation-delay-400 { animation-delay: 0.4s; }
            .promo-animation-delay-500 { animation-delay: 0.5s; }
        `;

        document.head.appendChild(styleElement);
        promoModalStylesInjected = true;
    }

    function showPromoModal() {
        // Don't show if modal already exists
        if (document.getElementById('chatroomPromoModal')) {
            return;
        }

        // Double-check if we should show the modal
        if (!shouldShowPromoModal()) {
            return;
        }

        // Ensure styles are injected
        injectPromoModalStyles();

        // Create and show promotional modal for guests
        const modal = document.createElement('div');
        modal.id = 'chatroomPromoModal';
        modal.className = 'fixed inset-0 z-50 promo-animate-fade-in';
        modal.innerHTML = `
            <div class="bg-black/70 backdrop-blur-md absolute inset-0 promo-animate-pulse-slow" onclick="this.parentElement.remove()"></div>
            <div class="relative flex items-center justify-center min-h-screen p-4 overflow-y-auto">
                <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl dark:shadow-2xl max-w-4xl w-full overflow-hidden transform promo-animate-scale-in my-8">
                    <div class="flex flex-col lg:flex-row max-h-[90vh] overflow-y-auto">
                        <!-- Hero Image Side -->
                        <div class="lg:w-1/2 relative bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 p-6 lg:p-8 flex items-center justify-center bg-center bg-cover min-h-[300px] lg:min-h-[500px]" style="background-image: url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.05\"%3E%3Cpath d=\"M10 10h40v40H10V10zm5 5v30h30V15H15zm5 5h20v20H20V20z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');">
                            <div class="absolute inset-0 bg-gradient-to-br from-purple-600/90 via-blue-600/90 to-indigo-700/90"></div>
                            <div class="relative z-10 text-center text-white">
                                <div class="w-16 h-16 lg:w-24 lg:h-24 mx-auto mb-4 lg:mb-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg promo-animate-bounce-slow">
                                    <svg class="w-10 h-10 lg:w-16 lg:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                    </svg>
                                </div>
                                <h4 class="text-xl lg:text-2xl font-bold mb-2 lg:mb-3 promo-animate-slide-up">${__('promo.modal.virtual_chat')}</h4>
                                <p class="text-purple-100 text-sm leading-relaxed promo-animate-slide-up promo-animation-delay-200">${__('promo.modal.chat_description')}</p>
                                <div class="mt-4 lg:mt-6 grid grid-cols-2 gap-2 text-xs promo-animate-slide-up promo-animation-delay-400">
                                    <div class="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-2 flex items-center justify-center">
                                        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                        </svg>
                                        <span>${__('promo.modal.character')}</span>
                                    </div>
                                    <div class="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-2 flex items-center justify-center">
                                        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/>
                                        </svg>
                                        <span>${__('promo.modal.earn_exp')}</span>
                                    </div>
                                    <div class="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-2 flex items-center justify-center">
                                        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/>
                                        </svg>
                                        <span>${__('promo.modal.explore')}</span>
                                    </div>
                                    <div class="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-2 flex items-center justify-center">
                                        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                                        </svg>
                                        <span>${__('promo.modal.make_friends')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Content Side -->
                        <div class="lg:w-1/2 p-4 lg:p-6 relative flex-1">
                            <div class="absolute top-3 right-3">
                                <button onclick="this.closest('#chatroomPromoModal').remove()" 
                                        class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>
                            
                            <div class="promo-animate-slide-right">
                                <h3 class="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">${__('promo.modal.join_community')}</h3>
                                <p class="text-gray-600 dark:text-gray-300 mb-4 lg:mb-6 leading-relaxed text-sm">${__('promo.modal.community_description')}</p>
                                
                                <div class="space-y-3 mb-4 lg:mb-6">
                                    <div class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-800 promo-animate-slide-right promo-animation-delay-200">
                                        <div class="flex items-center space-x-3 text-purple-700 dark:text-purple-300">
                                            <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <p class="font-semibold text-sm">${__('promo.modal.level_up_system')}</p>
                                                <p class="text-xs text-purple-600 dark:text-purple-400">${__('promo.modal.level_up_description')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-800 promo-animate-slide-right promo-animation-delay-300">
                                        <div class="flex items-center space-x-3 text-blue-700 dark:text-blue-300">
                                            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <p class="font-semibold text-sm">${__('promo.modal.interactive_world')}</p>
                                                <p class="text-xs text-blue-600 dark:text-blue-400">${__('promo.modal.interactive_world_description')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3 border border-green-100 dark:border-green-800 promo-animate-slide-right promo-animation-delay-400">
                                        <div class="flex items-center space-x-3 text-green-700 dark:text-green-300">
                                            <div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <p class="font-semibold text-sm">${__('promo.modal.realtime_interaction')}</p>
                                                <p class="text-xs text-green-600 dark:text-green-400">${__('promo.modal.realtime_interaction_description')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="flex space-x-2 promo-animate-slide-right promo-animation-delay-500">
                                    <a href="/register" onclick="window.pjax.loadUrl('/register'); this.closest('#chatroomPromoModal').remove(); return false;" class="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2.5 px-4 
                                       rounded-lg font-semibold text-center hover:from-purple-700 hover:to-blue-700 
                                       transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl text-sm">
                                        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.674-1.334c.343.061.676.133 1.001.207a3.978 3.978 0 01-.675 1.337z"/>
                                        </svg>
                                        ${__('promo.modal.join_now')}
                                    </a>
                                    <button onclick="this.closest('#chatroomPromoModal').remove()" 
                                            class="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2.5 px-4 
                                            rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 
                                            transition-all duration-300 transform hover:scale-105 text-sm">
                                        ${__('promo.modal.later')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    function initGamesPage() {
        // Initialize sort dropdown functionality
        const $sortDropdownBtn = $('#sortDropdownBtn');
        const $sortDropdown = $('#sortDropdown');
        const $sortDropdownIcon = $('#sortDropdownIcon');

        if (!$sortDropdownBtn.length) return; // Exit if not on games page

        // Remove existing event handlers to prevent duplicates
        $sortDropdownBtn.off('click.gamesPage');
        $(document).off('click.gamesPageDropdown keydown.gamesPageDropdown');

        // Toggle dropdown visibility
        $sortDropdownBtn.on('click.gamesPage', function (e) {
            e.preventDefault();
            e.stopPropagation();

            $sortDropdown.toggleClass('hidden');
            $sortDropdownIcon.toggleClass('rotate-180');
        });

        // Close dropdown when clicking outside
        $(document).on('click.gamesPageDropdown', function (e) {
            if (!$sortDropdownBtn.is(e.target) && !$sortDropdown.is(e.target) && $sortDropdown.has(e.target).length === 0) {
                $sortDropdown.addClass('hidden');
                $sortDropdownIcon.removeClass('rotate-180');
            }
        });

        // Close dropdown on escape key
        $(document).on('keydown.gamesPageDropdown', function (e) {
            if (e.key === 'Escape' && !$sortDropdown.hasClass('hidden')) {
                $sortDropdown.addClass('hidden');
                $sortDropdownIcon.removeClass('rotate-180');
            }
        });

        // Initialize tag scrolling functionality
        const $tagsContainer = $('#tags-scroll');
        const $leftBtn = $('#tags-left');
        const $rightBtn = $('#tags-right');

        if ($tagsContainer.length) {
            // Remove existing handlers
            $leftBtn.off('click.gamesPage');
            $rightBtn.off('click.gamesPage');
            $tagsContainer.off('scroll.gamesPage');
            $(window).off('resize.gamesPage');

            // Scroll left button
            $leftBtn.on('click.gamesPage', function () {
                const scrollAmount = -200;
                $tagsContainer.animate({
                    scrollLeft: $tagsContainer.scrollLeft() + scrollAmount
                }, 300);
            });

            // Scroll right button
            $rightBtn.on('click.gamesPage', function () {
                const scrollAmount = 200;
                $tagsContainer.animate({
                    scrollLeft: $tagsContainer.scrollLeft() + scrollAmount
                }, 300);
            });

            // Update button visibility based on scroll position
            function updateScrollButtons() {
                const scrollLeft = $tagsContainer.scrollLeft();
                const maxScroll = $tagsContainer[0].scrollWidth - $tagsContainer.outerWidth();

                $leftBtn.toggle(scrollLeft > 0);
                $rightBtn.toggle(scrollLeft < maxScroll);
            }

            // Update buttons on scroll
            $tagsContainer.on('scroll.gamesPage', updateScrollButtons);

            // Initial button state
            updateScrollButtons();

            // Update on window resize
            $(window).on('resize.gamesPage', updateScrollButtons);
        }
    }

    function initCategoryHoverEffects() {
        // Handle beautiful category link hover effects
        $('.category-link').each(function () {
            const $link = $(this);
            const categoryColor = $link.css('--category-color') || $link.data('category-color') || '#6366F1';

            // Store original background for reset
            const originalBg = $link.css('background');

            $link.on('mouseenter', function () {
                $(this).css('background', `linear-gradient(135deg, ${categoryColor}90 0%, ${categoryColor}70 100%)`);
            });

            $link.on('mouseleave', function () {
                $(this).css('background', originalBg);
            });
        });
    }




    // ============================================================================
    // BANNER AD CONTAINER SYSTEM - Auto-loading banner ads
    // ============================================================================

    // Initialize ad container function
    window.initAdContainer = async function (container, width = 320, height = 250, placement = 'sidebar') {
        const $container = $(container);

        // Mark as initialized to prevent double-loading
        if ($container.data('initialized')) {
            return;
        }
        $container.data('initialized', true);

        // Show container and loading state
        $container.removeClass('hidden');
        const $loading = $container.find('.ad-loading');
        const $content = $container.find('.ad-content');
        const $fallback = $container.find('.ad-fallback');

        // Show loading, hide content and fallback
        $loading.removeClass('hidden');
        $content.addClass('hidden');
        $fallback.addClass('hidden');

        try {
            // Request ad from banner endpoint using jQuery AJAX
            const response = await $.ajax({
                url: `/requests/banner-ad?width=${width}&height=${height}&placement=${placement}`,
                method: 'GET',
                dataType: 'json'
            });

            if (response.status === 200 && response.data && response.data.ad_code) {
                // Hide loading, show ad content
                $loading.addClass('hidden');
                $content.removeClass('hidden').html(response.data.ad_code);

                // Set container dimensions
                $container.css({
                    'width': width + 'px',
                    'height': height + 'px',
                    'min-height': height + 'px'
                });

            } else {
                // No ad available, remove container or its wrapper
                removeAdContainer($container);
            }
        } catch (error) {
            console.log('Failed to load ad for container:', error);
            // Remove container or its wrapper on error
            removeAdContainer($container);
        }
    };

    // Helper function to remove ad container and its wrapper if needed
    function removeAdContainer($container) {
        // Look for parent divs going up the tree to find any styled wrapper
        let $wrapper = $container.parent();
        let foundWrapper = false;

        // Go up the DOM tree looking for any styled wrapper (max 5 levels)
        for (let i = 0; i < 5; i++) {
            if ($wrapper.length === 0) break;

            const classes = $wrapper.attr('class') || '';
            // Check for any banner wrapper styles (header, footer, sidebar, etc.)
            if ((classes.includes('bg-gray-50') && classes.includes('border-')) ||
                (classes.includes('bg-gray-50') && classes.includes('py-')) ||
                (classes.includes('border-t') && classes.includes('py-')) ||
                (classes.includes('border-b') && classes.includes('py-'))) {
                foundWrapper = true;
                break;
            }
            $wrapper = $wrapper.parent();
        }

        if (foundWrapper && $wrapper.length > 0) {
            // Check if this wrapper contains only ad containers (and their structural divs)
            const $allAdsInWrapper = $wrapper.find('.ad-container');
            const $otherAds = $allAdsInWrapper.not($container);

            // If this is the only ad container in the wrapper, or all others are hidden, remove the wrapper
            if ($allAdsInWrapper.length <= 2 && ($otherAds.length === 0 || $otherAds.filter(':visible').length === 0)) {
                $wrapper.remove();
                return;
            }
        }

        // Default: just remove the container
        $container.remove();
    }

    // Initialize all ad containers on page load
    $(document).ready(function () {
        $('.ad-container[data-auto-init="true"]').each(function () {
            const container = this;
            // Stagger ad loading to avoid overwhelming the server
            setTimeout(() => {
                const width = $(container).data('width') || 320;
                const height = $(container).data('height') || 250;
                const placement = $(container).data('placement') || 'sidebar';
                window.initAdContainer(container, width, height, placement);
            }, Math.random() * 2000);
        });
    });

    /**
     * Initialize language switcher functionality
     */
    function initLanguageSwitcher() {
        // Desktop language switcher
        const $languageBtn = $('#languageDropdownBtn');
        const $languageDropdown = $('#languageDropdown');

        if ($languageBtn.length && $languageDropdown.length) {
            // Toggle dropdown
            $languageBtn.on('click', function (e) {
                e.stopPropagation();
                $languageDropdown.toggleClass('hidden');

                // Scroll active language into view when dropdown opens
                if (!$languageDropdown.hasClass('hidden')) {
                    scrollToActiveLanguage($languageDropdown);
                }
            });

            // Close dropdown when clicking outside
            $(document).on('click', function (e) {
                if (!$(e.target).closest('#languageSwitcher').length) {
                    $languageDropdown.addClass('hidden');
                }
            });

            // Keyboard navigation for desktop dropdown
            $languageBtn.on('keydown', function (e) {
                handleLanguageDropdownKeyNav(e, $languageDropdown);
            });
        }

        // Mobile language switcher
        const $mobileLanguageBtn = $('#mobileLanguageDropdownBtn');
        const $mobileLanguageDropdown = $('#mobileLanguageDropdown');

        if ($mobileLanguageBtn.length && $mobileLanguageDropdown.length) {
            // Toggle dropdown
            $mobileLanguageBtn.on('click', function (e) {
                e.stopPropagation();
                $mobileLanguageDropdown.toggleClass('hidden');

                // Scroll active language into view when dropdown opens
                if (!$mobileLanguageDropdown.hasClass('hidden')) {
                    scrollToActiveLanguage($mobileLanguageDropdown);
                }
            });

            // Close dropdown when clicking outside
            $(document).on('click', function (e) {
                if (!$(e.target).closest('#mobileLanguageSwitcher').length) {
                    $mobileLanguageDropdown.addClass('hidden');
                }
            });

            // Keyboard navigation for mobile dropdown
            $mobileLanguageBtn.on('keydown', function (e) {
                handleLanguageDropdownKeyNav(e, $mobileLanguageDropdown);
            });
        }
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

    /**
     * Change language function (global)
     */
    window.changeLanguage = function (languageCode) {
        // Show loading state
        const $languageBtn = $('#languageDropdownBtn');
        const originalText = $languageBtn.find('span').text();
        $languageBtn.find('span').text(__('notifications.loading'));

        // Make API call to change language
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

    /**
     * Initialize leaderboard page functionality
     */
    function initLeaderboardPage() {
        // Only initialize if we're on the leaderboard page
        if (!$('.leaderboard-tab').length) {
            return;
        }

        let currentPeriod = 'all-time';

        // Clean up existing event handlers to prevent duplicates
        $('.leaderboard-tab').off('click.leaderboard');

        // Tab switching functionality with namespaced events
        $('.leaderboard-tab').on('click.leaderboard', function () {
            const period = $(this).data('period');
            if (period === currentPeriod) return;

            // Update tab appearance
            $('.leaderboard-tab').removeClass('bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-600').addClass('text-gray-500 dark:text-gray-400');
            $(this).addClass('bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-600').removeClass('text-gray-500 dark:text-gray-400');

            currentPeriod = period;
            loadLeaderboardData(period);
        });

        // Load leaderboard data via AJAX
        function loadLeaderboardData(period) {
            const $loading = $('#leaderboard-loading');
            const $content = $('#leaderboard-content');

            // Show loading state
            $loading.removeClass('hidden');
            $content.addClass('hidden');

            // Make API request
            $.ajax({
                url: `/requests/leaderboard/${period}`,
                method: 'GET',
                data: { limit: 50 },
                success: function (response) {
                    console.log('Leaderboard API Response:', response); // Debug logging
                    $loading.addClass('hidden');

                    if (response.status === 200 && response.data && response.data.leaderboard && response.data.leaderboard.length > 0) {
                        renderLeaderboard(response.data.leaderboard);
                        $content.removeClass('hidden');
                    } else {
                        renderEmptyLeaderboard();
                        $content.removeClass('hidden');
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Leaderboard load error:', error);
                    $loading.addClass('hidden');
                    $content.removeClass('hidden');

                    // Show error message
                    alert.danger(__('leaderboard.load_error'));
                }
            });
        }

        // Render empty leaderboard state
        function renderEmptyLeaderboard() {
            const $container = $('#leaderboard-content .space-y-4');
            $container.empty();

            const emptyHtml = `
                <div class="text-center py-12">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                        <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">${__('leaderboard.no_players')}</h3>
                    <p class="text-gray-500 dark:text-gray-400">${__('leaderboard.no_players_desc')}</p>
                </div>
            `;

            $container.append(emptyHtml);
        }

        // Render leaderboard data
        function renderLeaderboard(leaderboard) {
            const $container = $('#leaderboard-content .space-y-4');
            $container.empty();

            leaderboard.forEach((player, index) => {
                const playerRank = player.rank || (index + 1);
                const isTopThree = playerRank <= 3;
                const rankDisplay = getRankDisplay(playerRank - 1); // Convert to 0-based index for display function

                const playerHtml = `
                    <div class="flex items-center space-x-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md dark:hover:shadow-lg transition-all duration-200 ${isTopThree ? 'ring-2 ring-yellow-200 dark:ring-yellow-400/50 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20' : ''}">
                        <!-- Rank -->
                        <div class="flex-shrink-0 text-center">
                            ${rankDisplay}
                        </div>

                        <!-- Player Avatar -->
                        <div class="flex-shrink-0">
                            <img src="${player.avatarUrl}" alt="${player.displayName}" class="w-14 h-14 rounded-full border-2 border-gray-200 dark:border-gray-600 object-cover">
                        </div>

                        <!-- Player Info -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center space-x-2">
                                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">${player.displayName}</h3>
                                <span class="text-sm text-gray-500 dark:text-gray-400">@${player.username}</span>
                            </div>
                            <div class="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-300">
                                <span>${__('leaderboard.level')}: <strong>${parseInt(player.level || 1).toLocaleString()}</strong></span>
                                <span>${__('leaderboard.current_exp')}: <strong>${parseInt(player.exp_points || 0).toLocaleString()}</strong></span>
                            </div>
                        </div>

                        <!-- Total EXP -->
                        <div class="flex-shrink-0 text-right">
                            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">${parseInt(player.total_exp_earned || 0).toLocaleString()}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${__('leaderboard.total_exp')}</div>
                        </div>
                    </div>
                `;

                $container.append(playerHtml);
            });
        }

        // Get rank display HTML
        function getRankDisplay(index) {
            const displayRank = index + 1;

            if (index === 0) {
                return `
                    <div class="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </div>
                `;
            } else if (index === 1) {
                return `
                    <div class="w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </div>
                `;
            } else if (index === 2) {
                return `
                    <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </div>
                `;
            } else {
                return `
                    <div class="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-lg">
                        #${displayRank}
                    </div>
                `;
            }
        }
    }

    function initAvatarUpload() {
        const $avatarUpload = $('#avatarUpload');
        const $avatarPreview = $('#avatarPreview');
        const $avatarDropZone = $('#avatarDropZone');
        const $avatarOverlay = $('#avatarOverlay');
        const $avatarProgress = $('#avatarProgress');
        const $avatarProgressBar = $('#avatarProgressBar');
        const $avatarProgressText = $('#avatarProgressText');
        const $removeAvatarBtn = $('#removeAvatarBtn');

        if (!$avatarUpload.length) return;

        // File input change handler
        $avatarUpload.on('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                handleAvatarFile(file);
            }
        });

        // Drag and drop handlers
        $avatarDropZone.on('dragover', function (e) {
            e.preventDefault();
            $(this).addClass('border-orange-400 bg-orange-50');
        });

        $avatarDropZone.on('dragleave', function (e) {
            e.preventDefault();
            $(this).removeClass('border-orange-400 bg-orange-50');
        });

        $avatarDropZone.on('drop', function (e) {
            e.preventDefault();
            $(this).removeClass('border-orange-400 bg-orange-50');

            const files = e.originalEvent.dataTransfer.files;
            if (files.length > 0) {
                handleAvatarFile(files[0]);
            }
        });

        // Avatar preview hover effect
        $avatarPreview.on('mouseenter', function () {
            $avatarOverlay.removeClass('hidden').addClass('flex');
        });

        $avatarPreview.on('mouseleave', function () {
            $avatarOverlay.addClass('hidden').removeClass('flex');
        });

        // Remove avatar handler
        $removeAvatarBtn.on('click', function () {
            const $profileForm = $('#profileForm');
            const formData = new FormData($profileForm[0]);
            formData.append('remove_avatar', 'true');

            $.ajax({
                url: '/requests/update-profile',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    if (response.status === 200) {
                        $avatarPreview.attr('src', '/assets/images/default-avatar.jpg');
                        $removeAvatarBtn.addClass('hidden');
                        alert.success(__('settings.avatar_removed_success'), true);
                    } else {
                        alert.danger(response.message);
                    }
                },
                error: function (xhr) {
                    const errorMessage = xhr.responseJSON?.message || __('settings.avatar_upload_error');
                    alert.danger(errorMessage);
                }
            });
        });

        function handleAvatarFile(file) {
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                alert.danger(__('settings.avatar_format_error'));
                return;
            }

            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert.danger(__('settings.avatar_size_error'));
                return;
            }

            // Show preview
            const reader = new FileReader();
            reader.onload = function (e) {
                $avatarPreview.attr('src', e.target.result);
                $removeAvatarBtn.removeClass('hidden');
            };
            reader.readAsDataURL(file);

            // Set the file in the input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            $avatarUpload[0].files = dataTransfer.files;
        }
    }

})(jQuery);