/**
 * General Ad Manager - General Game Advertisement System
 * Handles preroll and interstitial ads for HTML5 games and embed link games without API integration
 * Uses the unified __arcadeShowAd system for consistency
 */

(function($) {
    'use strict';

    // General game ad management
    window.GeneralAdManager = {
        gameFrame: null,
        isPlaying: false,
        lastAdTime: 0,
        adCooldown: 180000, // 3 minutes between ads
        
        init: function(gameFrame) {
            this.gameFrame = gameFrame;
            this.setupEventListeners();
            
            // Show preroll ad after 2 seconds
            setTimeout(() => {
                this.showPrerollAd();
            }, 2000);
        },
        
        setupEventListeners: function() {
            // Listen for PJAX navigation to stop ads when navigating away
            $(document).on('pjax:send', () => {
                console.log('PJAX navigation detected, stopping General ads');
                this.destroy();
            });
            
            // Track game frame loading states
            $(this.gameFrame).on('load', () => {
                console.log('General game loaded, starting ad scheduling');
                this.isPlaying = true;
                this.scheduleInterstitialAd();
            });
            
            // Track user interaction to know if game is active
            $(this.gameFrame).on('click mousedown mouseup keydown', () => {
                if (!this.isPlaying) {
                    console.log('User interaction detected, marking as playing');
                    this.isPlaying = true;
                }
            });
            
            // Track window focus/blur for pause detection
            $(window).on('focus', () => {
                if (this.gameFrame) {
                    this.isPlaying = true;
                }
            });
            
            $(window).on('blur', () => {
                this.isPlaying = false;
            });
            
            // Manual trigger for testing
            window.triggerGeneralInterstitial = () => {
                console.log('Manual general interstitial trigger called');
                this.showInterstitialAd();
            };
        },
        
        showPrerollAd: async function() {
            if (typeof window.__arcadeShowAd === 'function') {
                try {
                    console.log('Showing general preroll ad using __arcadeShowAd');
                    const result = await window.__arcadeShowAd('preroll', { placement: 'game-preroll' });
                    if (result && result.success) {
                        console.log('General preroll ad displayed successfully');
                    } else {
                        console.log('No preroll ad available for general game');
                    }
                } catch (error) {
                    console.log('Error showing general preroll ad:', error);
                }
            } else {
                console.log('__arcadeShowAd function not available');
            }
        },
        
        showInterstitialAd: async function() {
            const now = Date.now();
            console.log('General showInterstitialAd called - isPlaying:', this.isPlaying);
            
            if (now - this.lastAdTime < this.adCooldown) {
                console.log('General interstitial ad cooldown active, skipping');
                return; // Too soon for another ad
            }
            
            if (!this.isPlaying) {
                console.log('General game not playing, skipping interstitial ad');
                return;
            }
            
            if (typeof window.__arcadeShowAd === 'function') {
                try {
                    console.log('Showing general interstitial ad using __arcadeShowAd');
                    const result = await window.__arcadeShowAd('interlevel', { placement: 'game-interlevel' });
                    if (result && result.success) {
                        console.log('General interstitial ad displayed successfully');
                        this.lastAdTime = now;
                    } else {
                        console.log('No interstitial ad available for general game');
                    }
                } catch (error) {
                    console.log('Error showing general interstitial ad:', error);
                }
            } else {
                console.log('__arcadeShowAd function not available');
            }
        },
        
        scheduleInterstitialAd: function() {
            // Schedule multiple interstitial ads at different intervals
            const intervals = [60000, 180000, 300000]; // 1min, 3min, 5min
            
            intervals.forEach(interval => {
                const timer = setTimeout(() => {
                    if (this.isPlaying && this.gameFrame) {
                        console.log(`Attempting to show general interstitial ad after ${interval/1000}s`);
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
                    if (this.isPlaying && this.gameFrame) {
                        console.log('Showing recurring general interstitial ad');
                        this.showInterstitialAd();
                    } else if (!this.gameFrame) {
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
            
            // Reset state
            this.gameFrame = null;
            this.isPlaying = false;
        }
    };

    // Global function to trigger general interstitial ads
    window.showGeneralInterstitial = function() {
        if (window.GeneralAdManager && typeof window.GeneralAdManager.showInterstitialAd === 'function') {
            window.GeneralAdManager.showInterstitialAd();
        }
    };

})(jQuery);