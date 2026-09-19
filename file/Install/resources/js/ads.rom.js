/**
 * EmulatorJS Integration and Management
 * Isolated EmulatorJS functionality for iframe implementation
 */

// ROM game ad management
window.ROMAdManager = {
    isPlaying: false,
    lastAdTime: 0,
    adCooldown: 180000, // 3 minutes between ads
    adContainer: null,
    
    init: function() {
        this.createAdContainer();
        this.setupEventListeners();
    },
    
    createAdContainer: function() {
        // Find the emulator container
        const emulatorContainer = $('#emulatorjs-container');
        
        // Create overlay container positioned within the emulator frame (same as Flash ads)
        this.adContainer = $(`
            <div id="rom-ad-overlay" class="
                absolute inset-0 w-full h-full 
                bg-black/80 dark:bg-black/90 backdrop-blur-sm
                hidden z-50 flex items-center justify-center flex-col
                transition-all duration-300 ease-in-out
            ">
                <div id="rom-ad-content" class="
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    rounded-xl shadow-2xl p-4 text-center relative
                    inline-block max-w-4xl max-h-96
                    border border-gray-200 dark:border-gray-700 backdrop-blur-lg
                    transform scale-95 transition-transform duration-300
                    overflow-hidden
                ">
                    <button id="rom-ad-close" class="
                        absolute top-2 right-2 w-8 h-8
                        bg-gray-900 dark:bg-gray-700 hover:bg-red-600 dark:hover:bg-red-500 
                        text-white border-2 border-white dark:border-gray-300 
                        rounded-full cursor-pointer text-sm leading-none z-10
                        flex items-center justify-center
                        transition-all duration-200 hover:scale-110
                        shadow-lg hover:shadow-xl
                    ">&times;</button>
                </div>
            </div>
        `);
        
        // Add to emulator container and ensure it's positioned relative
        if (emulatorContainer.length) {
            emulatorContainer.css('position', 'relative').append(this.adContainer);
        } else {
            // Fallback to body with fixed positioning
            $('body').append(this.adContainer);
        }
        
        // Close button handler
        $('#rom-ad-close').on('click', () => {
            this.hideAd();
        });
    },
    
    setupEventListeners: function() {
        // Listen for PJAX navigation to stop ads when navigating away
        $(document).on('pjax:send', () => {
            console.log('PJAX navigation detected, stopping ROM ads');
            this.destroy();
        });
        
        // Track emulator state
        if (window.EJS_emulator) {
            window.EJS_emulator.on('ready', () => {
                console.log('ROM emulator ready, marking as playing');
                this.isPlaying = true;
            });
            
            window.EJS_emulator.on('pause', () => {
                this.isPlaying = false;
            });
            
            window.EJS_emulator.on('play', () => {
                this.isPlaying = true;
            });
        }
        
        // Track window focus/blur for pause detection
        $(window).on('focus', () => {
            if (window.EJS_emulator) {
                this.isPlaying = true;
            }
        });
        
        $(window).on('blur', () => {
            this.isPlaying = false;
        });
        
        // Manual trigger for testing
        window.triggerROMInterstitial = () => {
            console.log('Manual ROM interstitial trigger called');
            this.showInterstitialAd();
        };
        
    },
    
    showInterstitialAd: async function() {
        const now = Date.now();
        console.log('ROM showInterstitialAd called - isPlaying:', this.isPlaying);
        
        if (now - this.lastAdTime < this.adCooldown) {
            console.log('ROM interstitial ad cooldown active, skipping');
            return; // Too soon for another ad
        }
        
        if (!this.isPlaying) {
            console.log('ROM game not playing, skipping interstitial ad');
            return;
        }
        
        try {
            console.log('Fetching ROM interstitial ad...');
            const ad = await this.fetchAd('rom-interstitial');
            if (ad) {
                console.log('ROM interstitial ad fetched, displaying...');
                this.lastAdTime = now;
                this.displayAd(ad, 8000); // 8 second timer
            } else {
                console.log('No ROM interstitial ad data returned');
            }
        } catch (error) {
            console.log('Error fetching ROM interstitial ad:', error);
        }
    },
    
    fetchAd: async function(placement) {
        // Use 400x300 for ROM ads
        const response = await $.ajax({
            url: `/requests/banner-ad?width=400&height=300&placement=${placement}`,
            method: 'GET',
            dataType: 'json'
        });
        
        if (response.status === 200 && response.data && response.data.ad_code) {
            return response.data;
        }
        return null;
    },
    
    displayAd: function(adData, duration = 8000) {
        // Pause the emulator
        if (window.EJS_emulator && typeof window.EJS_emulator.pause === 'function') {
            window.EJS_emulator.pause();
        }
        
        // Show ad content with responsive wrapper (preserve the close button)
        $('#rom-ad-content').html(`
            <button id="rom-ad-close" class="
                absolute top-2 right-2 w-8 h-8
                bg-gray-900 dark:bg-gray-700 hover:bg-red-600 dark:hover:bg-red-500 
                text-white border-2 border-white dark:border-gray-300 
                rounded-full cursor-pointer text-sm leading-none z-10
                flex items-center justify-center
                transition-all duration-200 hover:scale-110
                shadow-lg hover:shadow-xl
            ">&times;</button>
            <div class="ad-content-wrapper max-w-full max-h-full flex items-center justify-center text-gray-900 dark:text-gray-100">
                ${adData.ad_code}
            </div>
        `);
        
        // Apply responsive styles to ad content - preserve original dimensions for images
        $('#rom-ad-content').find('img').css({
            'max-width': 'none',
            'max-height': 'none',
            'width': 'auto',
            'height': 'auto',
            'object-fit': 'none'
        });
        
        // Apply responsive styles only to other media elements
        $('#rom-ad-content').find('iframe, video, embed, object').css({
            'max-width': '100%',
            'max-height': '100%',
            'width': 'auto',
            'height': 'auto',
            'object-fit': 'contain'
        });
        
        // Show overlay with animation
        this.adContainer.removeClass('hidden').addClass('flex');
        
        // Animate content scaling
        setTimeout(() => {
            $('#rom-ad-content').removeClass('scale-95').addClass('scale-100');
        }, 50);
        
        // Auto-close timer
        const timer = setTimeout(() => {
            this.hideAd();
        }, duration);
        
        // Set up close button click handler immediately
        $('#rom-ad-close').off('click').on('click', () => {
            clearTimeout(timer);
            this.hideAd();
        });
    },
    
    hideAd: function() {
        // Animate content scaling down
        $('#rom-ad-content').removeClass('scale-100').addClass('scale-95');
        
        // Hide overlay after animation
        setTimeout(() => {
            this.adContainer.removeClass('flex').addClass('hidden');
            
            // Resume emulator
            if (window.EJS_emulator && typeof window.EJS_emulator.play === 'function' && this.isPlaying) {
                window.EJS_emulator.play();
            }
        }, 300);
    },
    
    scheduleInterstitialAd: function() {
        // Schedule multiple interstitial ads at different intervals
        const intervals = [60000, 180000, 300000]; // 1min, 3min, 5min
        
        intervals.forEach(interval => {
            const timer = setTimeout(() => {
                if (this.isPlaying && window.EJS_emulator) {
                    console.log(`Attempting to show ROM interstitial ad after ${interval/1000}s`);
                    this.showInterstitialAd();
                }
            }, interval);
            
            // Store timer for cleanup
            if (!this.timers) this.timers = [];
            this.timers.push(timer);
        });
        
        // Also schedule recurring ads every 4 minutes after initial 2 minutes
        const mainTimer = setTimeout(() => {
            const recurringAd = setInterval(() => {
                if (this.isPlaying && window.EJS_emulator) {
                    console.log('Showing recurring ROM interstitial ad');
                    this.showInterstitialAd();
                } else if (!window.EJS_emulator) {
                    clearInterval(recurringAd);
                }
            }, 240000); // Every 4 minutes
            
            // Store recurring interval for cleanup
            this.recurringInterval = recurringAd;
        }, 120000); // Start after 2 minutes
        
        // Store main timer for cleanup
        if (!this.timers) this.timers = [];
        this.timers.push(mainTimer);
    },
    
    destroy: function() {
        // Clear all timers
        if (this.timers) {
            this.timers.forEach(timer => clearTimeout(timer));
            this.timers = [];
        }
        
        // Clear recurring interval
        if (this.recurringInterval) {
            clearInterval(this.recurringInterval);
            this.recurringInterval = null;
        }
        
        // Remove ad container
        if (this.adContainer) {
            this.adContainer.remove();
        }
        
        // Reset state
        this.adContainer = null;
        this.isPlaying = false;
    }
};

// Global function to trigger ROM interstitial ads
window.showROMInterstitial = function() {
    if (window.ROMAdManager && typeof window.ROMAdManager.showInterstitialAd === 'function') {
        window.ROMAdManager.showInterstitialAd();
    }
};

// Define EmulatorJS event handlers globally before initialization
window.EJS_onGameStart = function () {
    console.log('🎮 ROM game started');
    
    // Initialize ROM ad manager
    if (window.ROMAdManager && !window.ROMAdManager.adContainer) {
        window.ROMAdManager.init();
    }
    
    // Mark as playing and schedule ads
    if (window.ROMAdManager) {
        window.ROMAdManager.isPlaying = true;
        window.ROMAdManager.scheduleInterstitialAd();
    }
    
};

window.EJS_ready = function () {
    console.log('🎮 EmulatorJS ready');
    
    // Don't initialize ad manager on ready - wait for game start
};

window.EJS_adBlocked = function (fallbackUrl) {
    console.log('EmulatorJS ad blocked, switching to fallback');
    // Try fallback ad endpoint
    return `/ads/emulator/fallback/${window.gameData.id}`;
};

$(document).ready(function () {
    // Initialize EmulatorJS for ROM games
    if (window.gameData && window.gameData.type === 'rom') {
        const $container = $('#emulatorjs-container');
        if ($container.length) {
            const romSystem = $container.data('rom-system');
            const romFile = $container.data('rom-file');

            if (romSystem && romFile) {
                // Map ROM system to EmulatorJS core
                const coreMapping = {
                    'nes': 'fceumm',
                    'snes': 'snes9x',
                    'gba': 'mgba',
                    'gb': 'gambatte',
                    'gbc': 'gambatte',
                    'genesis': 'genesis_plus_gx',
                    'megadrive': 'genesis_plus_gx',
                    'segacd': 'genesis_plus_gx',
                    'n64': 'mupen64plus_next',
                    'psx': 'pcsx_rearmed',
                    'atari2600': 'stella',
                    'atari7800': 'prosystem',
                    'lynx': 'handy',
                    'jaguar': 'virtualjaguar',
                    'mame': 'mame2003_plus',
                    'arcade': 'mame2003_plus',
                    'neogeo': 'fbneo',
                    'dos': 'dosbox_pure',
                    '3do': 'opera',
                    'amiga': 'puae',
                    'c64': 'vice_x64',
                    'msx': 'bluemsx',
                    'pce': 'mednafen_pce_fast',
                    'pcengine': 'mednafen_pce_fast',
                    'sg1000': 'genesis_plus_gx',
                    'mastersystem': 'genesis_plus_gx',
                    'gamegear': 'genesis_plus_gx',
                    'saturn': 'beetle_saturn',
                    'virtualboy': 'beetle_vb',
                    'wonderswan': 'mednafen_wswan',
                    'nds': 'melonds'
                };

                const core = coreMapping[romSystem.toLowerCase()] || 'fceumm';

                // Use the parsed thumbnail URL from the controller
                const thumbnailUrl = window.gameData.thumbnailUrl || '/assets/images/default-game-thumbnail.webp';

                // Configure EmulatorJS global variables
                window.EJS_player = "#emulatorjs-game";
                window.EJS_core = core;
                window.EJS_gameName = window.gameData.title || "ROM Game";
                window.EJS_color = "#0097c4";
                window.EJS_backgroundColor = '#000';
                window.EJS_backgroundImage = thumbnailUrl;
                window.EJS_backgroundBlur = true;
                window.EJS_pathtodata = "/assets/js/libs/emulatorjs/";
                window.EJS_gameUrl = romFile;

                // Configure EmulatorJS Advertisement System
                configureEmulatorAds();

                window.EJS_Buttons = {
                    playPause: true,
                    restart: true,
                    mute: false,
                    settings: false,
                    fullscreen: false,
                    saveState: false,
                    loadState: false,
                    screenRecord: false,
                    gamepad: true,
                    cheat: false,
                    volume: true,
                    saveSavFiles: false,
                    loadSavFiles: false,
                    quickSave: false,
                    quickLoad: false,
                    screenshot: false,
                    cacheManager: false,
                    exitEmulation: false
                };

                // Hide EmulatorJS context menu
                hideEmulatorContextMenu();

                // Dynamically load EmulatorJS loader after setting up EJS variables using jQuery
                $('<script>')
                    .attr('src', '/assets/js/libs/emulatorjs/loader.js')
                    .appendTo('head');
            } else {
                console.error('ROM system or file URL not found');
            }
        }
    }
});

// Function to hide the EmulatorJS context menu
function hideEmulatorContextMenu() {
    // Function to hide the Context Menu button and context menu
    function hideContextMenuButton() {
        // Find all emulator menu buttons and check their text content
        $('.ejs_menu_button').each(function () {
            const $button = $(this);
            const buttonText = $button.find('.ejs_menu_text').text().trim();

            // Hide only the button with "Context Menu" text
            if (buttonText === 'Context Menu') {
                $button.hide();
            }
        });
        
        // Also hide any ejs_context_menu elements
        $('.ejs_context_menu').css('display', 'none');
        
        // Disable right-click context menu on emulator elements
        $('#emulatorjs-container, #emulatorjs-game, canvas').off('contextmenu.emulator').on('contextmenu.emulator', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    }

    // Run immediately if elements exist
    hideContextMenuButton();

    // Also run periodically in case emulator loads later
    const contextMenuObserver = setInterval(() => {
        if ($('.ejs_menu_button').length > 0) {
            hideContextMenuButton();
        }
    }, 1000);

    // Observer to watch for new emulator elements
    if (window.MutationObserver) {
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(function (node) {
                        if (node.nodeType === 1) { // Element node
                            const $node = $(node);
                            // Check if the added node or its children contain emulator buttons
                            if ($node.hasClass('ejs_menu_button') || $node.find('.ejs_menu_button').length > 0) {
                                setTimeout(hideContextMenuButton, 100);
                            }
                            
                            // Disable context menu on any new canvas or emulator elements
                            if ($node.is('canvas') || $node.hasClass('ejs_') || $node.find('canvas').length > 0) {
                                setTimeout(() => {
                                    $node.find('canvas, [class*="ejs_"]').addBack().off('contextmenu.emulator').on('contextmenu.emulator', function(e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return false;
                                    });
                                }, 100);
                            }
                        }
                    });
                }
            });
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Additional global prevention for EmulatorJS context menus
    $(document).off('contextmenu.emulatorGlobal').on('contextmenu.emulatorGlobal', function(e) {
        const target = $(e.target);
        if (target.closest('#emulatorjs-container, #emulatorjs-game').length > 0 || 
            target.is('canvas') || 
            target.hasClass('ejs_context_menu') ||
            target.closest('.ejs_context_menu').length > 0) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });
}

// Configure EmulatorJS Advertisement System
function configureEmulatorAds() {
    // Check for pre-roll ads
    $.ajax({
        url: `/requests/banner-ad?width=400&height=300&placement=rom-preroll`,
        method: 'GET',
        dataType: 'json',
        success: function (adCheckResponse) {
            if (adCheckResponse.status === 200 && adCheckResponse.data && adCheckResponse.data.ad_code) {
                window.EJS_AdUrl = `/ads/emulator/rom-preroll/${window.gameData.id}`;
                window.EJS_AdTimer = 8000;
                window.EJS_AdMode = 1;
                window.EJS_AdSize = ["400px", "300px"];
            }
        }
    });
}