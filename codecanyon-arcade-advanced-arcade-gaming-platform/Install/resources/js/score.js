/**
 * Titans Systems Arcade - Score Integration API
 * Provides score submission and leaderboard functions for iframe games
 */

(function (window) {
    'use strict';

    // Configuration
    const API_BASE = '/requests/score';
    const DEBUG = false;

    // State management
    let currentGameId = null;

    // Utility functions
    const log = (...args) => {
        if (DEBUG) console.log('[ArcadeAPI]', ...args);
    };

    const error = (...args) => {
        // Error logging disabled for production
    };

    // Show personal best notification
    const showPersonalBestNotification = (score, previousBest) => {

        // Trigger confetti effect
        triggerConfetti();

        if (typeof iziToast !== 'undefined') {
            const previousBestText = previousBest ? ` ${__("games.previous_record")}: ${previousBest.toLocaleString()}` : '';

            try {
                iziToast.success({
                    title: __("games.new_personal_best"),
                    message: __("games.personal_best_message", { score: score.toLocaleString(), previousBest: previousBestText }),
                    position: 'topLeft',
                    timeout: 5000,
                    backgroundColor: '#f59e0b',
                    titleColor: '#fff',
                    messageColor: '#fff',
                    icon: false,
                    displayMode: 'replace'
                });
            } catch (error) {
                // Error handling disabled for production
            }
        }
    };

    // Show score submitted notification
    const showScoreSubmittedNotification = (score) => {
        if (typeof iziToast !== 'undefined') {
            iziToast.success({
                title: __("games.score_submitted_title"),
                message: __("games.score_submitted_message", { score: score.toLocaleString() }),
                position: 'topLeft',
                timeout: 3000,
                backgroundColor: '#10b981',
                titleColor: '#fff',
                messageColor: '#fff',
                icon: false,
                displayMode: 'replace'
            });
        }
    };

    // Show competitive login popup for score submission
    const showCompetitiveLoginPopup = (score) => {
        // Don't show popup for scores less than 1
        if (score < 1) {
            return;
        }

        // Check for template-specific implementation first
        if (typeof window.showTemplateCompetitivePopup === 'function') {
            try {
                return window.showTemplateCompetitivePopup(score);
            } catch (error) {
                console.error('Template competitive popup failed, using fallback:', error);
                // Fall through to original implementation
            }
        }

        // Remove existing popup if any
        const existingPopup = document.getElementById('competitive-login-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'competitive-login-popup';
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-start sm:items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto';

        // Create popup container
        const popup = document.createElement('div');
        popup.className = 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden max-w-4xl w-full animate-in slide-in-from-bottom-8 duration-300 my-4 sm:my-8 max-h-screen sm:max-h-[90vh] overflow-y-auto';

        // Create popup content  
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
                        <div class="mx-auto h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 flex items-center justify-center rounded-full bg-orange-100 mb-3 sm:mb-4 trophy-bounce">
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
                            <button class="w-full bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2.5 sm:py-3 px-4 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 text-sm sm:text-base" 
                                    onclick="document.getElementById('competitive-login-popup').remove()">
                                ${__("games.maybe_later")}
                            </button>
                        </div>

                        <div class="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            ${__("auth.no_account")} 
                            <a href="#" class="text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 font-medium transition-colors duration-200"
                               onclick="event.preventDefault(); document.getElementById('competitive-login-popup').remove(); if (window.pjax) { window.pjax.loadUrl('/register'); } else { window.location.href = '/register'; }">
                                ${__("auth.sign_up_here")}
                            </a>
                        </div>
                    </div>
                </div>
                
                <!-- Right Column - Benefits -->
                <div class="bg-gray-50 dark:bg-gray-700 p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
                    <!-- Header -->
                    <div class="text-center mb-4 sm:mb-6 lg:mb-8">
                        <h2 class="text-base sm:text-lg lg:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">${__("games.join_the_competition")}</h2>
                        <p class="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">${__("games.unlock_features")}</p>
                    </div>

                    <!-- Features -->
                    <div class="space-y-3 sm:space-y-4 lg:space-y-6">
                        <div class="flex items-start space-x-2 sm:space-x-3">
                            <div class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                <span class="text-orange-600 dark:text-orange-400 text-base sm:text-lg lg:text-xl">🏅</span>
                            </div>
                            <div>
                                <h3 class="font-medium text-gray-700 dark:text-gray-200 mb-1 text-xs sm:text-sm lg:text-base">${__("games.global_leaderboards")}</h3>
                                <p class="text-xs lg:text-sm text-gray-500 dark:text-gray-400">${__("games.leaderboards_description")}</p>
                            </div>
                        </div>

                        <div class="flex items-start space-x-2 sm:space-x-3">
                            <div class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                <span class="text-orange-600 dark:text-orange-400 text-base sm:text-lg lg:text-xl">💎</span>
                            </div>
                            <div>
                                <h3 class="font-medium text-gray-700 dark:text-gray-200 mb-1 text-xs sm:text-sm lg:text-base">${__("games.personal_records")}</h3>
                                <p class="text-xs lg:text-sm text-gray-500 dark:text-gray-400">${__("games.personal_records_description")}</p>
                            </div>
                        </div>

                        <div class="flex items-start space-x-2 sm:space-x-3">
                            <div class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                <span class="text-orange-600 dark:text-orange-400 text-base sm:text-lg lg:text-xl">⚡</span>
                            </div>
                            <div>
                                <h3 class="font-medium text-gray-700 dark:text-gray-200 mb-1 text-xs sm:text-sm lg:text-base">${__("games.exp_achievements")}</h3>
                                <p class="text-xs lg:text-sm text-gray-500 dark:text-gray-400">${__("games.exp_achievements_description")}</p>
                            </div>
                        </div>

                        <div class="flex items-start space-x-2 sm:space-x-3">
                            <div class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                <span class="text-orange-600 dark:text-orange-400 text-base sm:text-lg lg:text-xl">🎯</span>
                            </div>
                            <div>
                                <h3 class="font-medium text-gray-700 dark:text-gray-200 mb-1 text-xs sm:text-sm lg:text-base">${__("games.score_history")}</h3>
                                <p class="text-xs lg:text-sm text-gray-500 dark:text-gray-400">${__("games.score_history_description")}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Security Info -->
                    <div class="text-center text-xs lg:text-sm text-gray-500 mt-4 sm:mt-6 lg:mt-8">
                        <p class="mb-2">${__("games.safe_secure")}</p>
                        <div class="flex justify-center space-x-3 sm:space-x-4">
                            <span class="flex items-center">
                                <svg class="w-3 h-3 lg:w-4 lg:h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
                                </svg>
                                ${__("games.protected")}
                            </span>
                            <span class="flex items-center">
                                <svg class="w-3 h-3 lg:w-4 lg:h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                ${__("games.quick_setup")}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Close popup when clicking outside
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        // Close popup with Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    };

    // Notify followers of personal best via WebSocket
    const notifyFollowersOfPersonalBest = async (userId, gameId, score) => {

        try {
            // Get game title
            const gameTitle = $('#game-container').closest('main').find('h1').first().text() || 'a game';

            // Check WebSocket availability

            // Send notification to server to broadcast to followers
            if (window.arcade && window.arcade.websocket && window.arcade.websocket.isConnected()) {
                const notificationData = {
                    userId: userId,
                    gameId: gameId,
                    gameTitle: gameTitle,
                    score: score
                };

                window.arcade.websocket.send('personal_best_achieved', notificationData);
            }
        } catch (error) {
            // Error handling disabled for production
        }
    };

    // Confetti effect for personal best
    const triggerConfetti = () => {
        const duration = 4000;
        const animationEnd = Date.now() + duration;

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        // Create confetti container
        const confettiContainer = document.createElement('div');
        confettiContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
        document.body.appendChild(confettiContainer);

        // Add trophy animation in center
        const trophy = document.createElement('div');
        trophy.innerHTML = '🏆';
        trophy.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%) scale(0);
            font-size: 100px;
            z-index: 10000;
            animation: trophyPop 1s ease-out forwards;
        `;
        confettiContainer.appendChild(trophy);

        // Add keyframe animation for trophy
        const style = document.createElement('style');
        style.textContent = `
            @keyframes trophyPop {
                0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); }
                50% { transform: translate(-50%, -50%) scale(1.3) rotate(10deg); }
                100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
            }
            @keyframes starSpin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        // Remove trophy after animation
        setTimeout(() => {
            trophy.style.opacity = '0';
            trophy.style.transition = 'opacity 1s';
            setTimeout(() => trophy.remove(), 1000);
        }, 2000);

        const shapes = ['square', 'circle', 'triangle', 'star', 'heart'];
        const colors = [
            '#FFD700', // Gold
            '#FFA500', // Orange
            '#FF69B4', // Hot Pink
            '#00CED1', // Dark Turquoise
            '#9370DB', // Medium Purple
            '#32CD32', // Lime Green
            '#FF6347', // Tomato
            '#4169E1'  // Royal Blue
        ];
        const emojis = ['⭐', '✨', '💫', '🎉', '🎊', '🥳', '🎯', '💯'];

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                clearInterval(interval);
                setTimeout(() => {
                    confettiContainer.remove();
                    style.remove();
                }, 1000);
                return;
            }

            const particleCount = 30 * (timeLeft / duration);

            // Create confetti particles
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                const isEmoji = Math.random() < 0.3; // 30% chance for emoji
                const shape = shapes[Math.floor(Math.random() * shapes.length)];
                const color = colors[Math.floor(Math.random() * colors.length)];
                const size = randomInRange(8, 15);

                if (isEmoji) {
                    particle.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];
                    particle.style.cssText = `
                        position: absolute;
                        font-size: ${size * 2}px;
                        left: ${randomInRange(0, 100)}%;
                        top: -20px;
                        opacity: 1;
                        pointer-events: none;
                    `;
                } else {
                    // Create different shapes
                    switch (shape) {
                        case 'star':
                            particle.innerHTML = `
                                <svg width="${size * 2}" height="${size * 2}" viewBox="0 0 24 24" style="animation: starSpin 3s linear infinite;">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
                                          fill="${color}" stroke="${color}" stroke-width="1"/>
                                </svg>
                            `;
                            break;
                        case 'heart':
                            particle.innerHTML = `
                                <svg width="${size * 1.5}" height="${size * 1.5}" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
                                          fill="${color}"/>
                                </svg>
                            `;
                            break;
                        case 'triangle':
                            particle.style.cssText = `
                                position: absolute;
                                width: 0;
                                height: 0;
                                border-left: ${size}px solid transparent;
                                border-right: ${size}px solid transparent;
                                border-bottom: ${size * 1.7}px solid ${color};
                                left: ${randomInRange(0, 100)}%;
                                top: -20px;
                                opacity: 1;
                                pointer-events: none;
                            `;
                            break;
                        case 'circle':
                            particle.style.cssText = `
                                position: absolute;
                                width: ${size}px;
                                height: ${size}px;
                                background: ${color};
                                border-radius: 50%;
                                left: ${randomInRange(0, 100)}%;
                                top: -10px;
                                opacity: 1;
                                pointer-events: none;
                                box-shadow: 0 0 ${size / 2}px ${color}40;
                            `;
                            break;
                        default: // square
                            particle.style.cssText = `
                                position: absolute;
                                width: ${size}px;
                                height: ${size}px;
                                background: linear-gradient(45deg, ${color}, ${color}dd);
                                left: ${randomInRange(0, 100)}%;
                                top: -10px;
                                opacity: 1;
                                transform: rotate(${randomInRange(0, 360)}deg);
                                pointer-events: none;
                                box-shadow: 0 0 ${size / 2}px ${color}40;
                            `;
                    }

                    if (shape === 'star' || shape === 'heart') {
                        particle.style.position = 'absolute';
                        particle.style.left = `${randomInRange(0, 100)}%`;
                        particle.style.top = '-20px';
                        particle.style.opacity = '1';
                        particle.style.pointerEvents = 'none';
                    }
                }

                confettiContainer.appendChild(particle);

                // Animate particle
                const angle = randomInRange(0, 360);
                const velocity = randomInRange(15, 30);
                const gravity = 0.3;
                const friction = 0.99;
                let posX = 0;
                let posY = 0;
                let velocityX = velocity * Math.cos(angle * Math.PI / 180);
                let velocityY = velocity * Math.sin(angle * Math.PI / 180) - randomInRange(5, 15);
                let opacity = 1;
                let rotation = randomInRange(0, 360);
                let rotationSpeed = randomInRange(-10, 10);

                const updateParticle = () => {
                    velocityY += gravity;
                    velocityX *= friction;
                    posX += velocityX;
                    posY += velocityY;
                    opacity -= 0.01;
                    rotation += rotationSpeed;

                    particle.style.transform = `translate(${posX}px, ${posY}px) rotate(${rotation}deg) scale(${opacity})`;
                    particle.style.opacity = opacity;

                    if (opacity > 0 && posY < window.innerHeight) {
                        requestAnimationFrame(updateParticle);
                    } else {
                        particle.remove();
                    }
                };

                requestAnimationFrame(updateParticle);
            }
        }, 150);
    };

    // Make API calls using jQuery
    const apiCall = async (endpoint, method = 'GET', data = null) => {
        try {
            const ajaxOptions = {
                url: `${API_BASE}${endpoint}`,
                method: method,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            if (data && method !== 'GET') {
                ajaxOptions.data = data;
            }

            const response = await $.ajax(ajaxOptions);
            return response;
        } catch (xhr) {
            const errorMessage = xhr.responseJSON?.message || xhr.statusText || 'API call failed';
            error('API call failed:', errorMessage);

            // Check for authentication error (401 status)
            if (xhr.status === 401) {
                throw new Error('Authentication required!');
            }

            throw new Error(errorMessage);
        }
    };

    // Set current game context (called when game iframe loads)
    const setGameContext = (gameId) => {
        currentGameId = gameId;
        log('Game context set:', gameId);
    };

    // Submit a score for the current game
    window.__arcadeSubmitScore = async (score, scoreData = {}) => {

        try {
            const gameId = currentGameId || getGameIdFromFrame();

            if (!gameId) {
                error('No game ID available. Make sure the game iframe has data-game-id attribute.');
                return { success: false, error: 'No game ID available' };
            }

            if (typeof score !== 'number' || score < 0) {
                error('Invalid score value:', score);
                return { success: false, error: 'Score must be a positive number' };
            }

            log('Submitting score:', score, scoreData);

            const result = await apiCall('/submit-score', 'POST', {
                game_id: gameId,
                score: score,
                score_data: scoreData
            });


            if (result.status === 200) {
                log('Score submitted successfully:', result);

                // Refresh leaderboard if the function exists
                if (typeof window.refreshLeaderboard === 'function') {
                    window.refreshLeaderboard();
                }

                // Show success notification if it's a personal best
                if (result.data && result.data.isPersonalBest) {
                    showPersonalBestNotification(score, result.data.previousBest);

                    // Notify followers via WebSocket

                    if (window.user && window.user.id) {
                        notifyFollowersOfPersonalBest(window.user.id, currentGameId, score);
                    }
                } else {
                    if (result.data) {
                        showScoreSubmittedNotification(score);
                    }
                }
            }

            if (result.status === 401) {
                showCompetitiveLoginPopup(score);
            }

            return result;
        } catch (err) {
            error('Failed to submit score:', err.message);

            return { success: false, error: err.message };
        }
    };



    // Get leaderboard for a game
    window.__arcadeGetLeaderboard = async (gameId = null, limit = 10) => {
        try {
            const targetGameId = gameId || currentGameId || getGameIdFromFrame();

            if (!targetGameId) {
                error('No game ID provided and no game context set');
                return { success: false, error: 'Game ID required' };
            }

            log('Fetching leaderboard for game:', targetGameId);

            const result = await apiCall(`/leaderboard/${targetGameId}?limit=${limit}`);

            if (result.success) {
                log('Leaderboard fetched:', result.data);
            }

            return result;
        } catch (err) {
            error('Failed to fetch leaderboard:', err.message);
            return { success: false, error: err.message };
        }
    };

    // Get user's best score for a game
    window.__arcadeGetUserBest = async (gameId = null) => {
        try {
            const targetGameId = gameId || currentGameId || getGameIdFromFrame();

            if (!targetGameId) {
                error('No game ID provided and no game context set');
                return { success: false, error: 'Game ID required' };
            }

            log('Fetching user best for game:', targetGameId);

            const result = await apiCall(`/user-best/${targetGameId}`);

            if (result.success) {
                log('User best fetched:', result.data);
            }

            return result;
        } catch (err) {
            error('Failed to fetch user best:', err.message);
            return { success: false, error: err.message };
        }
    };

    // Get current user info (if authenticated)
    window.__arcadeGetUser = () => {
        // Return user data from global context if available
        if (window.user) {
            return {
                success: true,
                user: window.user
            };
        }

        return { success: false, error: 'User not authenticated' };
    };


    // Helper function to get game ID from game container using jQuery
    const getGameIdFromFrame = () => {
        const gameId = $('#game-container').data('game-id');

        if (gameId) {
            return parseInt(gameId);
        }
        return null;
    };

    // CTL Arcade compatibility wrappers
    window.__ctlArcadeStartSession = async () => {
        return { success: false, error: 'Session management not supported' };
    };

    window.__ctlArcadeEndSession = async () => {
        return { success: false, error: 'Session management not supported' };
    };

    window.__ctlArcadeSubmitScore = async (data = {}) => {
        try {
            const { score, mode = 'default' } = data;
            if (typeof score !== 'number' || score < 0) {
                return { success: false, error: 'Invalid score value' };
            }
            return await window.__arcadeSubmitScore(score, { mode });
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    // CTL level functions (local only)
    window.__ctlArcadeStartLevel = async (data = {}) => {
        const { level = 1 } = data;
        return { success: true, message: 'Level started', level };
    };

    window.__ctlArcadeRestartLevel = async (data = {}) => {
        const { level = 1 } = data;
        return { success: true, message: 'Level restarted', level };
    };

    window.__ctlArcadeEndLevel = async (data = {}) => {
        const { level = 1 } = data;
        return { success: true, message: 'Level ended', level };
    };

    window.__ctlArcadeSaveScore = async (data = {}) => {
        const { score, mode = 'default' } = data;
        if (typeof score !== 'number' || score < 0) {
            return { success: false, error: 'Score must be a positive number' };
        }
        return await window.__arcadeSubmitScore(score, { mode });
    };

    window.__ctlArcadeShareEvent = async () => {
        return { success: false, error: 'Share functionality not supported' };
    };

    // Generic ad display function for HTML5 games - matches Flash/ROM ad styling
    window.__arcadeShowAd = async (adType = 'interlevel', data = {}) => {
        try {
            const gameId = currentGameId || getGameIdFromFrame();
            
            if (!gameId) {
                return { success: false, error: 'No game ID available' };
            }

            log('Showing ad:', adType, data);

            const result = await apiCall('/show-ad', 'POST', {
                game_id: gameId,
                ad_type: adType,
                placement_context: data
            });

            if (result.status === 200 && result.data) {
                const { ad_code, placement_info } = result.data;
                
                // Find the game container (same pattern as Flash/ROM ads)
                const gameContainer = $('#game-container').length ? $('#game-container') : $('#emulatorjs-container');
                
                // Create overlay container positioned within the game frame (same as Flash/ROM ads)
                const adContainer = $(`
                    <div id="arcade-ad-overlay" class="
                        absolute inset-0 w-full h-full bg-black bg-opacity-80 backdrop-blur-sm
                        hidden z-50 flex items-center justify-center flex-col
                        transition-all duration-300 ease-in-out
                    ">
                        <div id="arcade-ad-content" class="
                            bg-white rounded-xl shadow-2xl p-4 text-center relative
                            inline-block max-w-4xl max-h-96
                            border border-gray-200 backdrop-blur-lg
                            transform scale-95 transition-transform duration-300
                            overflow-hidden
                        ">
                            <button id="arcade-ad-close" class="
                                absolute top-2 right-2 w-8 h-8
                                bg-gray-900 hover:bg-red-600 text-white
                                border-2 border-white rounded-full cursor-pointer
                                text-sm leading-none z-10
                                flex items-center justify-center
                                transition-all duration-200 hover:scale-110
                                shadow-lg hover:shadow-xl
                            ">&times;</button>
                        </div>
                    </div>
                `);
                
                // Add to game container and ensure it's positioned relative (same as Flash/ROM ads)
                if (gameContainer.length) {
                    gameContainer.css('position', 'relative').append(adContainer);
                } else {
                    // Fallback to body (same as ROM ads)
                    $('body').append(adContainer);
                    adContainer.removeClass('absolute').addClass('fixed');
                }
                
                // Show ad content with responsive wrapper (preserve the close button)
                $('#arcade-ad-content').html(`
                    <button id="arcade-ad-close" class="
                        absolute top-2 right-2 w-8 h-8
                        bg-gray-900 hover:bg-red-600 text-white
                        border-2 border-white rounded-full cursor-pointer
                        text-sm leading-none z-10
                        flex items-center justify-center
                        transition-all duration-200 hover:scale-110
                        shadow-lg hover:shadow-xl
                    ">&times;</button>
                    <div class="ad-content-wrapper max-w-full max-h-full flex items-center justify-center">
                        ${ad_code}
                    </div>
                `);
                
                // Apply responsive styles to ad content - preserve original dimensions for images (same as Flash/ROM ads)
                $('#arcade-ad-content').find('img').css({
                    'max-width': 'none',
                    'max-height': 'none',
                    'width': 'auto',
                    'height': 'auto',
                    'object-fit': 'none'
                });
                
                // Apply responsive styles only to other media elements (same as Flash/ROM ads)
                $('#arcade-ad-content').find('iframe, video, embed, object').css({
                    'max-width': '100%',
                    'max-height': '100%',
                    'width': 'auto',
                    'height': 'auto',
                    'object-fit': 'contain'
                });
                
                // Show overlay with animation (same as Flash/ROM ads)
                adContainer.removeClass('hidden').addClass('flex');
                
                // Animate content scaling (same as Flash/ROM ads)
                setTimeout(() => {
                    $('#arcade-ad-content').removeClass('scale-95').addClass('scale-100');
                }, 50);
                
                // Auto-close timer (same duration as ROM ads)
                const duration = 8000;
                const timer = setTimeout(() => {
                    hideAd();
                }, duration);
                
                // Hide ad function (same pattern as Flash/ROM ads)
                const hideAd = () => {
                    // Animate content scaling down
                    $('#arcade-ad-content').removeClass('scale-100').addClass('scale-95');
                    
                    // Hide overlay after animation
                    setTimeout(() => {
                        adContainer.removeClass('flex').addClass('hidden');
                        adContainer.remove();
                    }, 300);
                };
                
                // Set up close button click handler immediately (same as Flash/ROM ads)
                $('#arcade-ad-close').off('click').on('click', () => {
                    clearTimeout(timer);
                    hideAd();
                });
                
                return { 
                    success: true, 
                    message: 'Ad displayed successfully',
                    placement_info: placement_info
                };
            }
            
            return result;
        } catch (err) {
            error('Failed to show ad:', err.message);
            return { success: false, error: err.message };
        }
    };


    // CTL interlevel ad function - now wraps __arcadeShowAd
    window.__ctlArcadeShowInterlevelAD = async () => {
        return await window.__arcadeShowAd('interlevel', { placement: 'game-interlevel' });
    };

    // Auto-detect game context when script loads
    $(document).ready(() => {

        // First check game container, then iframe
        let gameId = $('#game-container').data('game-id');

        // Game ID should be available from game container

        if (gameId) {
            setGameContext(parseInt(gameId));
        }

        // Listen for postMessage from CTL arcade games (cross-origin support)
        $(window).on('message', (event) => {
            const originalEvent = event.originalEvent;
            const { type, data, source } = originalEvent.data || {};

            // Only handle CTL arcade game messages
            if (!source || source !== 'ctl_arcade_game') {
                return;
            }

            const respond = (responseType, result) => {
                originalEvent.source.postMessage({
                    type: responseType,
                    data: result,
                    source: 'arcade_parent'
                }, originalEvent.origin);
            };

            log('Received CTL arcade postMessage:', { type, data, origin: originalEvent.origin });

            switch (type) {
                // CTL Arcade API messages (cross-origin)
                case 'ctl_arcade_start_session':
                    window.__ctlArcadeStartSession()
                        .then(result => respond('ctl_arcade_session_started', result))
                        .catch(err => respond('ctl_arcade_session_started', {
                            success: false,
                            error: err.message
                        }));
                    break;
                case 'ctl_arcade_end_session':
                    window.__ctlArcadeEndSession()
                        .then(result => respond('ctl_arcade_session_ended', result))
                        .catch(err => respond('ctl_arcade_session_ended', {
                            success: false,
                            error: err.message
                        }));
                    break;
                case 'ctl_arcade_start_level':
                    window.__ctlArcadeStartLevel(data)
                        .then(result => respond('ctl_arcade_level_started', result))
                        .catch(err => respond('ctl_arcade_level_started', {
                            success: false,
                            error: err.message
                        }));
                    break;
                case 'ctl_arcade_restart_level':
                    window.__ctlArcadeRestartLevel(data)
                        .then(result => respond('ctl_arcade_level_restarted', result))
                        .catch(err => respond('ctl_arcade_level_restarted', {
                            success: false,
                            error: err.message
                        }));
                    break;
                case 'ctl_arcade_end_level':
                    window.__ctlArcadeEndLevel(data)
                        .then(result => respond('ctl_arcade_level_ended', result))
                        .catch(err => respond('ctl_arcade_level_ended', {
                            success: false,
                            error: err.message
                        }));
                    break;
                case 'ctl_arcade_save_score':
                    window.__ctlArcadeSaveScore(data)
                        .then(result => respond('ctl_arcade_score_saved', result))
                        .catch(err => respond('ctl_arcade_score_saved', {
                            success: false,
                            error: err.message
                        }));
                    break;
                case 'ctl_arcade_show_interlevel_ad':
                    window.__ctlArcadeShowInterlevelAD()
                        .then(result => respond('ctl_arcade_ad_shown', result))
                        .catch(err => respond('ctl_arcade_ad_shown', {
                            success: false,
                            error: err.message
                        }));
                    break;
                case 'ctl_arcade_share_event':
                    window.__ctlArcadeShareEvent(data)
                        .then(result => respond('ctl_arcade_event_shared', result))
                        .catch(err => respond('ctl_arcade_event_shared', {
                            success: false,
                            error: err.message
                        }));
                    break;
                default:
                    log('Unknown CTL Arcade message type:', type);
                    respond('unknown_message_type', {
                        success: false,
                        error: 'Unknown message type',
                        type: type
                    });
                    break;
            }
        });
    });


})(window);