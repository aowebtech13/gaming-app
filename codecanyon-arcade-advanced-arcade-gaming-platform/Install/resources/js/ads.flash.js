/**
 * Flash Ad Manager - Flash Game Advertisement System
 * Handles preroll and interstitial ads for Flash games
 */

(function($) {
    'use strict';

    // Flash game ad management
    window.FlashAdManager = {
        player: null,
        adContainer: null,
        isPlaying: false,
        lastAdTime: 0,
        adCooldown: 180000, // 3 minutes between ads
        
        init: function(player) {
            console.log('FlashAdManager.init called with player:', player);
            this.player = player;
            this.createAdContainer();
            this.setupEventListeners();
            
            // Show preroll ad after 2 seconds
            console.log('Setting preroll ad timer for 2 seconds...');
            setTimeout(() => {
                console.log('Preroll ad timer triggered, calling showPrerollAd()');
                this.showPrerollAd();
            }, 2000);
        },
        
        createAdContainer: function() {
            // Find the game container
            const gameContainer = $(this.player).closest('#game-container');
            
            // Create overlay container positioned within the game frame
            this.adContainer = $(`
                <div id="flash-ad-overlay" class="
                    absolute inset-0 w-full h-full 
                    bg-black/80 dark:bg-black/90 backdrop-blur-sm
                    hidden z-50 flex items-center justify-center flex-col
                    transition-all duration-300 ease-in-out
                ">
                    <div id="flash-ad-content" class="
                        bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                        rounded-xl shadow-2xl p-4 text-center relative
                        inline-block max-w-4xl max-h-96
                        border border-gray-200 dark:border-gray-700 backdrop-blur-lg
                        transform scale-95 transition-transform duration-300
                        overflow-hidden
                    ">
                        <button id="flash-ad-close" class="
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
            
            // Add to game container and ensure it's positioned relative
            if (gameContainer.length) {
                gameContainer.css('position', 'relative').append(this.adContainer);
            } else {
                // Fallback to player parent
                $(this.player).parent().css('position', 'relative').append(this.adContainer);
            }
            
            // Close button handler
            $('#flash-ad-close').on('click', () => {
                this.hideAd();
            });
        },
        
        setupEventListeners: function() {
            // Use Ruffle's proper events and API
            
            // Listen for PJAX navigation to stop ads when navigating away
            $(document).on('pjax:send', () => {
                console.log('PJAX navigation detected, stopping Flash ads');
                this.destroy();
            });
            
            // Listen for when the Flash movie is fully loaded
            $(this.player).on('loadeddata', () => {
                console.log('Ruffle: Flash game loaded, starting ad scheduling');
                this.isPlaying = true;
                this.scheduleInterstitialAd();
            });
            
            // Listen for metadata to know when game is ready
            $(this.player).on('loadedmetadata', () => {
                console.log('Ruffle: Flash game metadata loaded');
                this.isPlaying = true;
            });
            
            // Track user interaction to know if game is active
            $(this.player).on('click mousedown mouseup keydown', () => {
                if (!this.isPlaying) {
                    console.log('User interaction detected, marking as playing');
                    this.isPlaying = true;
                }
            });
            
            // Track window focus/blur for pause detection
            $(window).on('focus', () => {
                if (this.player && this.player.readyState >= 1) {
                    this.isPlaying = true;
                }
            });
            
            $(window).on('blur', () => {
                this.isPlaying = false;
            });
            
            // Manual trigger for testing
            window.triggerFlashInterstitial = () => {
                console.log('Manual interstitial trigger called');
                this.showInterstitialAd();
            };
        },
        
        showPrerollAd: async function() {
            console.log('showPrerollAd() called, fetching ad...');
            try {
                const ad = await this.fetchAd('flash-preroll');
                console.log('fetchAd returned:', ad);
                if (ad) {
                    console.log('Ad data received, displaying preroll ad');
                    this.displayAd(ad, 5000); // 5 second timer
                } else {
                    console.log('No ad data returned from fetchAd');
                }
            } catch (error) {
                console.log('Error in showPrerollAd:', error);
                console.log('No preroll ad available for Flash game');
            }
        },
        
        showInterstitialAd: async function() {
            const now = Date.now();
            console.log('showInterstitialAd called - isPlaying:', this.isPlaying);
            
            if (now - this.lastAdTime < this.adCooldown) {
                console.log('Interstitial ad cooldown active, skipping');
                return; // Too soon for another ad
            }
            
            if (!this.isPlaying) {
                console.log('Game not playing, skipping interstitial ad');
                return;
            }
            
            try {
                console.log('Fetching interstitial ad...');
                const ad = await this.fetchAd('flash-interstitial');
                if (ad) {
                    console.log('Interstitial ad fetched, displaying...');
                    this.lastAdTime = now;
                    this.displayAd(ad, 8000); // 8 second timer
                } else {
                    console.log('No interstitial ad data returned');
                }
            } catch (error) {
                console.log('Error fetching interstitial ad:', error);
            }
        },
        
        fetchAd: async function(placement) {
            // Use 400x300 for both Flash ad types
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
        
        displayAd: function(adData, duration = 5000) {
            // Pause the game using Ruffle's suspend method
            if (this.player && typeof this.player.suspend === 'function') {
                this.player.suspend();
            } else if (this.player && typeof this.player.pause === 'function') {
                this.player.pause();
            }
            
            // Show ad content with responsive wrapper (preserve the close button)
            $('#flash-ad-content').html(`
                <button id="flash-ad-close" class="
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
            $('#flash-ad-content').find('img').css({
                'max-width': 'none',
                'max-height': 'none',
                'width': 'auto',
                'height': 'auto',
                'object-fit': 'none'
            });
            
            // Apply responsive styles only to other media elements
            $('#flash-ad-content').find('iframe, video, embed, object').css({
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
                $('#flash-ad-content').removeClass('scale-95').addClass('scale-100');
            }, 50);
            
            // Auto-close timer
            const timer = setTimeout(() => {
                this.hideAd();
            }, duration);
            
            // Set up close button click handler immediately
            $('#flash-ad-close').off('click').on('click', () => {
                clearTimeout(timer);
                this.hideAd();
            });
            
        },
        
        hideAd: function() {
            // Animate content scaling down
            $('#flash-ad-content').removeClass('scale-100').addClass('scale-95');
            
            // Hide overlay after animation
            setTimeout(() => {
                this.adContainer.removeClass('flex').addClass('hidden');
                
                // Resume game using Ruffle's resume method
                if (this.player && typeof this.player.resume === 'function') {
                    this.player.resume();
                } else if (this.player && typeof this.player.play === 'function' && this.isPlaying) {
                    this.player.play();
                }
            }, 300);
        },
        
        scheduleInterstitialAd: function() {
            // Schedule multiple interstitial ads at different intervals
            const intervals = [60000, 180000, 300000]; // 1min, 3min, 5min
            
            intervals.forEach(interval => {
                const timer = setTimeout(() => {
                    if (this.isPlaying && this.player) {
                        console.log(`Attempting to show interstitial ad after ${interval/1000}s`);
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
                    if (this.isPlaying && this.player) {
                        console.log('Showing recurring interstitial ad');
                        this.showInterstitialAd();
                    } else if (!this.player) {
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
            this.player = null;
            this.adContainer = null;
            this.isPlaying = false;
        }
    };

    // Global function to trigger Flash interstitial ads
    window.showFlashInterstitial = function() {
        if (window.FlashAdManager && typeof window.FlashAdManager.showInterstitialAd === 'function') {
            window.FlashAdManager.showInterstitialAd();
        }
    };

})(jQuery);