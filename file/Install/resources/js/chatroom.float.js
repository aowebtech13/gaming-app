// Floating Chat System - Integration for non-chatroom pages
class FloatingChatSystem {
    constructor() {
        this.isExpanded = false;
        this.messages = [];
        this.socket = null;
        this.unreadCount = 0;
        this.isMainChatroom = window.location.pathname === '/chatroom';
        this.init();
    }
    
    init() {
        // Only initialize on non-chatroom pages
        if (!this.isMainChatroom) {
            this.startStatsUpdater(); // Always update stats
            
            // Only show floating chat for authenticated users
            if (window.user && window.user.id) {
                this.setupSocket();
                this.addFloatingChatHTML();
            }
        }
    }
    
    addFloatingChatHTML() {
        // Add floating chat HTML to page
        const chatText = window.__('chatroom.floating.chat');
        const virtualChatText = window.__('chatroom.floating.virtual_chat');
        const openFullChatroomText = window.__('chatroom.floating.open_full_chatroom');
        const connectToSeeMessagesText = window.__('chatroom.floating.connect_to_see_messages');
        const joinFullChatExpText = window.__('chatroom.floating.join_full_chat_exp');
        const typeMessageText = window.__('chatroom.floating.type_message');
        const loginToJoinText = window.__('chatroom.floating.login_to_join');
        const loginText = window.__('chatroom.floating.login');
        const registerText = window.__('chatroom.floating.register');

        // Check for template-specific implementation first
        if (typeof window.generateTemplateFloatingChatHTML === 'function') {
            try {
                const templateParams = {
                    chatText,
                    virtualChatText,
                    openFullChatroomText,
                    connectToSeeMessagesText,
                    joinFullChatExpText,
                    typeMessageText,
                    loginToJoinText,
                    loginText,
                    registerText,
                    userAuthenticated: window.user && window.user.id
                };
                
                const templateHTML = window.generateTemplateFloatingChatHTML(templateParams);
                if (templateHTML) {
                    document.body.insertAdjacentHTML('beforeend', templateHTML);
                    this.setupUserInterface();
                    this.setupMessageInput();
                    return;
                }
            } catch (error) {
                console.error('Template floating chat failed, using fallback:', error);
                // Fall through to original implementation
            }
        }
        
        const floatingChatHTML = `
            <!-- Floating Chat System -->
            <div id="floatingChatSystem" class="fixed bottom-6 right-6 z-40">
                <!-- Chat Button (collapsed state) -->
                <div id="floatingChatButton" class="relative">
                    <button onclick="window.floatingChat.toggleChat()" 
                            class="flex items-center space-x-2 bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-600 
                            text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl dark:shadow-2xl 
                            transition-all duration-200 transform hover:scale-105
                            sm:px-4 sm:py-3 sm:space-x-2
                            max-sm:px-3 max-sm:py-2 max-sm:space-x-1">
                        <svg class="w-5 h-5 max-sm:w-4 max-sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                        <span class="font-medium text-base max-sm:text-sm max-sm:hidden">${chatText}</span>
                        <span id="floatingPlayerCount" class="bg-white/20 dark:bg-black/20 text-xs px-2 py-1 rounded-full max-sm:px-1.5 max-sm:py-0.5">0</span>
                        <span id="chatNotificationBadge" class="absolute -top-2 -right-2 bg-red-500 dark:bg-red-400 
                              text-white text-xs w-5 h-5 rounded-full flex items-center justify-center 
                              hidden animate-pulse max-sm:w-4 max-sm:h-4 max-sm:-top-1 max-sm:-right-1">!</span>
                    </button>
                </div>

                <!-- Chat Window -->
                <div id="floatingChatWindow" class="hidden absolute 
                     bottom-0 right-0
                     w-80 h-96 
                     max-w-[calc(100vw-2rem)] 
                     bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-3xl border border-gray-200 dark:border-gray-600 flex flex-col
                     transform-gpu
                     max-sm:w-72 max-sm:h-72 max-sm:bottom-12">
                    
                    <!-- Chat Header -->
                    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 
                         bg-purple-50 dark:bg-purple-900/30 rounded-t-2xl max-sm:p-3">
                        <div class="flex items-center space-x-2">
                            <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                            <h3 class="font-semibold text-gray-900 dark:text-white text-base max-sm:text-sm">${virtualChatText}</h3>
                            <span id="windowPlayerCount" class="bg-purple-600 dark:bg-purple-500 text-white text-xs px-2 py-1 rounded-full max-sm:px-1.5 max-sm:py-0.5">0</span>
                        </div>
                        <div class="flex items-center space-x-2 max-sm:space-x-1">
                            <a href="/chatroom" target="_blank" class="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 p-1 
                               hover:bg-purple-100 dark:hover:bg-purple-800/50 rounded transition" title="${openFullChatroomText}">
                                <svg class="w-5 h-5 max-sm:w-4 max-sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>
                                </svg>
                            </a>
                            <button onclick="window.floatingChat.toggleChat()" 
                                    class="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 p-1">
                                <svg class="w-5 h-5 max-sm:w-4 max-sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Chat Messages -->
                    <div id="floatingChatMessages" class="flex-1 overflow-y-auto p-4 space-y-2 max-sm:p-3">
                        <div class="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
                            <svg class="w-8 h-8 max-sm:w-6 max-sm:h-6 mb-2 mx-auto text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                            <p class="text-sm max-sm:text-xs">${connectToSeeMessagesText}</p>
                            <p class="text-xs mt-1">${joinFullChatExpText}</p>
                        </div>
                    </div>

                    <!-- Chat Input -->
                    <div class="p-4 border-t border-gray-200 dark:border-gray-600 max-sm:p-3">
                        <div id="floatingChatInputContainer">
                            <!-- Will be populated based on user authentication -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', floatingChatHTML);
        this.setupUserInterface();
        this.setupMessageInput();
    }
    
    setupUserInterface() {
        const container = document.getElementById('floatingChatInputContainer');
        if (!container) return;

        if (window.user && window.user.id) {
            // Logged in user interface
            const typeMessageText = window.__('chatroom.floating.type_message');
            container.innerHTML = `
                <div id="floatingChatInput">
                    <div class="flex space-x-2">
                        <input type="text" id="floatingMessageInput" placeholder="${typeMessageText}" 
                               class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                               focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 text-sm
                               max-sm:px-2 max-sm:py-1.5">
                        <button onclick="window.floatingChat.sendMessage()" 
                                class="bg-purple-600 dark:bg-purple-500 text-white px-4 py-2 rounded-lg 
                                hover:bg-purple-700 dark:hover:bg-purple-600 transition max-sm:px-3 max-sm:py-1.5">
                            <svg class="w-4 h-4 max-sm:w-3.5 max-sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Guest interface
            const loginToJoinText = window.__('chatroom.floating.login_to_join');
            const loginText = window.__('chatroom.floating.login');
            const registerText = window.__('chatroom.floating.register');
            container.innerHTML = `
                <div class="text-center">
                    <p class="text-sm text-gray-600 dark:text-gray-300 mb-3 max-sm:text-xs max-sm:mb-2">${loginToJoinText}</p>
                    <div class="flex space-x-2">
                        <a href="/login" class="flex-1 bg-purple-600 dark:bg-purple-500 text-white py-2 px-3 
                           rounded-lg text-sm font-medium text-center hover:bg-purple-700 dark:hover:bg-purple-600 transition
                           max-sm:py-1.5 max-sm:px-2 max-sm:text-xs">
                            ${loginText}
                        </a>
                        <a href="/register" class="flex-1 border border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400 
                           py-2 px-3 rounded-lg text-sm font-medium text-center 
                           hover:bg-purple-50 dark:hover:bg-purple-800/50 transition max-sm:py-1.5 max-sm:px-2 max-sm:text-xs">
                            ${registerText}
                        </a>
                    </div>
                </div>
            `;
        }
    }
    
    setupSocket() {
        // Create our own socket connection for floating chat
        if (typeof io !== 'undefined' && window.user) {
            console.log('Setting up socket for floating chat');
            this.socket = io({
                auth: {
                    userId: window.user.id,
                    token: sessionStorage.getItem('socket_token') || 'floating_' + Date.now()
                }
            });
            
            this.socket.on('connect', () => {
                console.log('Floating chat socket connected');
                // Load chat history when connected
                this.loadChatHistory();
            });
            
            this.socket.on('chatMessage', (data) => {
                console.log('Received chat message in floating chat:', data);
                this.handleChatMessage(data);
            });
            
            this.socket.on('disconnect', () => {
                console.log('Floating chat socket disconnected');
            });
        }
    }
    
    setupMessageInput() {
        const input = document.getElementById('floatingMessageInput');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }
    
    toggleChat() {
        this.isExpanded = !this.isExpanded;
        const button = document.getElementById('floatingChatButton');
        const window = document.getElementById('floatingChatWindow');
        
        if (this.isExpanded) {
            window?.classList.remove('hidden');
            button?.classList.add('hidden');
            this.unreadCount = 0;
            this.updateNotificationBadge();
        } else {
            window?.classList.add('hidden');
            button?.classList.remove('hidden');
        }
    }
    
    async sendMessage() {
        const input = document.getElementById('floatingMessageInput');
        const message = input?.value.trim();
        
        if (!message || !window.user) {
            console.log('Cannot send message - no message or no user', { message, user: window.user });
            return;
        }
        
        console.log('Sending floating chat message:', message);
        
        try {
            // Send as form data to match the multer middleware expectation
            const formData = new FormData();
            formData.append('message', message);
            
            $.ajax({
                url: '/chatroom/floating-message',
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false
            })
            .done(function(result) {
                console.log('Message sent successfully:', result);
                input.value = '';
            })
            .fail(function(xhr, status, error) {
                console.error('Failed to send message:', xhr.responseText || error);
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }
    
    handleChatMessage(data) {
        this.messages.push(data);
        this.updateChatDisplay();
        
        if (!this.isExpanded) {
            this.unreadCount++;
            this.updateNotificationBadge();
        }
    }
    
    loadChatHistory() {
        $.ajax({
            url: '/chatroom/history',
            method: 'GET',
            dataType: 'json'
        })
        .done((data) => {
            if (data.status === 200 && data.data.messages) {
                console.log('Loading floating chat history:', data.data.messages.length + ' messages');
                
                // Replace current messages with cached ones
                this.messages = data.data.messages;
                this.updateChatDisplay();
                
                console.log('Floating chat history loaded successfully');
            }
        })
        .fail((xhr, status, error) => {
            console.error('Failed to load floating chat history:', error);
        });
    }
    
    updateChatDisplay() {
        const container = document.getElementById('floatingChatMessages');
        if (!container) return;
        
        const recentMessages = this.messages.slice(-20);
        if (recentMessages.length === 0) {
            const connectToSeeMessagesText = window.__('chatroom.floating.connect_to_see_messages');
            const joinFullChatExpText = window.__('chatroom.floating.join_full_chat_exp');
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
                    <svg class="w-8 h-8 mb-2 mx-auto text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    <p>${connectToSeeMessagesText}</p>
                    <p class="text-xs mt-1">${joinFullChatExpText}</p>
                </div>
            `;
            return;
        }
        
        // Check for template-specific message styling first
        let messageHTML = '';
        if (typeof window.generateTemplateFloatingChatMessageHTML === 'function') {
            try {
                messageHTML = window.generateTemplateFloatingChatMessageHTML(recentMessages, this.escapeHtml.bind(this));
            } catch (error) {
                console.error('Template floating chat message styling failed, using fallback:', error);
            }
        }
        
        // Use template HTML if available, otherwise use fallback
        if (messageHTML) {
            container.innerHTML = messageHTML;
        } else {
            container.innerHTML = recentMessages.map(msg => `
                <div class="text-sm max-sm:text-xs">
                    <span class="font-semibold text-purple-600 dark:text-purple-400">${this.escapeHtml(msg.name)}:</span>
                    <span class="text-gray-700 dark:text-gray-300 ml-1">${this.escapeHtml(msg.message)}</span>
                </div>
            `).join('');
        }
        
        container.scrollTop = container.scrollHeight;
    }
    
    updateNotificationBadge() {
        const badge = document.getElementById('chatNotificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount.toString();
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }
    
    updateStats() {
        $.ajax({
            url: '/chatroom/stats',
            method: 'GET',
            dataType: 'json'
        })
        .done((data) => {
            if (data.status === 200) {
                this.updateCounters(data.data.onlineCount);
            }
        })
        .fail((xhr, status, error) => {
            console.log('Stats update failed:', error);
        });
    }
    
    updateCounters(count) {
        const counters = [
            '#floatingPlayerCount', 
            '#windowPlayerCount',
            '#headerPlayerCount', 
            '#sidebarPlayerCount'
        ];
        counters.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) element.textContent = count;
        });
    }
    
    startStatsUpdater() {
        this.updateStats();
        setInterval(() => this.updateStats(), 30000); // Update every 30 seconds
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize floating chat system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure other scripts are loaded
    setTimeout(() => {
        window.floatingChat = new FloatingChatSystem();
    }, 100);
});