// Chatroom-specific functionality (extracted from chatroom/default.ejs)
$(document).ready(function() {
    console.log('Chatroom functions: Document ready, initializing...');
    
    // Initialize dark mode first
    console.log('Chatroom functions: About to initialize dark mode...');
    initChatroomDarkMode();
    
    // Send button functionality
    $('#sendBtn').on('click', function() {
        const $input = $('#chatInput');
        if ($input.val().trim()) {
            // Trigger the existing chat functionality
            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            Object.defineProperty(event, 'target', { value: $input[0], enumerable: true });
            $input[0].dispatchEvent(event);
        }
    });
    
    // Hide chat container initially
    $('#chatContainer').hide();
});

// User profile modal functions
function showUserProfile(playerId) {
    const player = window.players ? window.players[playerId] : null;
    if (!player) return;
    
    const $modal = $('#userProfileModal');
    const $content = $('#userProfileContent');
    
    const rankColor = window.getRankColor ? window.getRankColor(player.level) : '#3B82F6';
    
    // Show modal with loading state for follow button
    $content.html(`
        <div class="text-center mb-4">
            <img src="${player.avatarUrl || '/assets/images/default-avatar.jpg'}" alt="Avatar" class="w-20 h-20 rounded-full mx-auto mb-3">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-white">${player.name}</h4>
            <span class="inline-block px-2 py-1 rounded text-sm font-bold text-white" style="background-color: ${rankColor};">
                ${player.rankTitle}
            </span>
        </div>
        
        <div class="space-y-3">
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div class="text-sm text-gray-600 dark:text-gray-300">${__('user.rank').replace('{level}', '')}</div>
                <div class="font-semibold text-gray-900 dark:text-white">${player.rankTitle}</div>
            </div>
            
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div class="text-sm text-gray-600 dark:text-gray-300">${__('user.exp_points').replace('{points}', '')}</div>
                <div class="font-semibold text-gray-900 dark:text-white">${player.expPoints} EXP</div>
            </div>
            
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div class="text-sm text-gray-600 dark:text-gray-300">${__('user.character')}</div>
                <div class="font-semibold text-gray-900 dark:text-white">${player.charType || 'Fighter'}</div>
            </div>
        </div>
        
        <div class="mt-4 flex space-x-3">
            <button id="followToggleBtn" 
                    class="flex-1 bg-gray-400 dark:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors duration-200" 
                    disabled>
                <span class="follow-btn-text">${__('user.loading')}</span>
            </button>
            <button onclick="viewFullProfile('${player.name}')" 
                    class="flex-1 bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors duration-200">
${__('nav.profile')}
            </button>
        </div>
    `);
    
    $modal.removeClass('hidden');
    
    // Check follow status and update button
    checkFollowStatusAndUpdateButton(player.name);
}

function closeUserProfile() {
    $('#userProfileModal').addClass('hidden');
}

// Check follow status and update button accordingly
function checkFollowStatusAndUpdateButton(username) {
    $.ajax({
        url: `/chatroom/follow-status/${username}`,
        method: 'GET',
        dataType: 'json'
    })
    .done(function(data) {
        const $followBtn = $('#followToggleBtn');
        const $followBtnText = $('.follow-btn-text');
        
        if (data.status === 200) {
            const isFollowing = data.data.isFollowing;
            updateFollowButton(isFollowing, username);
        } else {
            // Error checking status, default to follow state
            updateFollowButton(false, username);
        }
    })
    .fail(function(xhr, status, error) {
        console.error('Error checking follow status:', error);
        // Error checking status, default to follow state
        updateFollowButton(false, username);
    });
}

// Update follow button based on current status
function updateFollowButton(isFollowing, username) {
    const $followBtn = $('#followToggleBtn');
    const $followBtnText = $('.follow-btn-text');
    
    if (isFollowing) {
        // User is following - show unfollow button
        $followBtn.removeClass('bg-gray-400 dark:bg-gray-600 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600')
                  .addClass('bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600')
                  .prop('disabled', false)
                  .off('click')
                  .on('click', () => toggleFollow(username, true));
        $followBtnText.text(__('user.unfollow'));
    } else {
        // User is not following - show follow button
        $followBtn.removeClass('bg-gray-400 dark:bg-gray-600 bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600')
                  .addClass('bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600')
                  .prop('disabled', false)
                  .off('click')
                  .on('click', () => toggleFollow(username, false));
        $followBtnText.text(__('user.follow'));
    }
}

// Toggle follow/unfollow
async function toggleFollow(username, isCurrentlyFollowing) {
    const $followBtn = $('#followToggleBtn');
    const $followBtnText = $('.follow-btn-text');
    
    // Show loading state
    $followBtn.prop('disabled', true)
             .removeClass('bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600')
             .addClass('bg-gray-400 dark:bg-gray-600');
    $followBtnText.text(__('user.loading'));
    
    try {
        const endpoint = isCurrentlyFollowing ? '/chatroom/unfollow-user' : '/chatroom/follow-user';
        const data = await $.post(endpoint, { username: username });
        
        if (data.status === 200) {
            // Show success notification
            showNotification(data.message, 'success');
            
            // Update button to reflect new state
            const newIsFollowing = data.data.isFollowing;
            updateFollowButton(newIsFollowing, username);
        } else {
            showNotification(data.message || __("notifications.action_failed"), 'error');
            // Restore previous state
            updateFollowButton(isCurrentlyFollowing, username);
        }
    } catch (error) {
        showNotification(__("notifications.network_error"), 'error');
        console.error('Toggle follow error:', error);
        // Restore previous state
        updateFollowButton(isCurrentlyFollowing, username);
    }
}

// Legacy function for backward compatibility
async function followUser(username) {
    toggleFollow(username, false);
}

function viewFullProfile(username) {
    // Close modal and redirect to full profile page
    closeUserProfile();
    window.open(`/profile/${username}`, '_blank');
}

function showNotification(message, type = 'info') {
    const bgColor = type === 'success' ? 'bg-green-500 dark:bg-green-600' : type === 'error' ? 'bg-red-500 dark:bg-red-600' : 'bg-blue-500 dark:bg-blue-600';
    const $notification = $('<div>', {
        class: `fixed top-4 left-1/2 transform -translate-x-1/2 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 opacity-0 transition-opacity duration-300`,
        text: message
    });
    
    $('body').append($notification);
    
    setTimeout(() => {
        $notification.removeClass('opacity-0').addClass('opacity-100');
    }, 100);
    
    setTimeout(() => {
        $notification.addClass('opacity-0');
        setTimeout(() => {
            $notification.remove();
        }, 300);
    }, 3000);
}

// ==========================================
// Dark Mode Functionality for Chatroom
// ==========================================

// Get dark mode preference from localStorage or system
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

// Set dark mode state and store preference
function setDarkMode(isDark) {
    try {
        const $html = $('html');
        
        console.log('Chatroom: Setting dark mode to:', isDark);
        
        if (isDark) {
            $html.addClass('dark');
        } else {
            $html.removeClass('dark');
        }
        
        // Store preference (shared with other templates)
        localStorage.setItem('darkMode', isDark.toString());
        
        // Force a repaint to ensure the change is applied
        $html[0].offsetHeight;
        
        console.log('Chatroom: Dark mode class applied:', $html.hasClass('dark'));
        
    } catch (error) {
        console.error('Chatroom: Error setting dark mode:', error);
    }
}

// Toggle between light and dark mode
function toggleDarkMode() {
    try {
        const $html = $('html');
        const currentlyDark = $html.hasClass('dark');
        const newMode = !currentlyDark;
        
        console.log('Chatroom: Toggling dark mode:', currentlyDark ? 'dark -> light' : 'light -> dark');
        
        setDarkMode(newMode);
        
        // Trigger a custom event that other parts of the app can listen to
        $(document).trigger('darkModeChanged', { isDark: newMode });
        
    } catch (error) {
        console.error('Chatroom: Error toggling dark mode:', error);
    }
}

// Initialize dark mode system for chatroom
function initChatroomDarkMode() {
    console.log('Chatroom: Initializing dark mode...');
    
    // Check if jQuery is available
    if (typeof $ === 'undefined') {
        console.error('Chatroom: jQuery not available for dark mode initialization');
        return;
    }
    
    // Temporarily disable transitions to prevent flash on load
    $('html').addClass('no-transitions');
    
    // Initialize dark mode on page load
    const isDarkMode = getDarkModePreference();
    console.log('Chatroom: Dark mode preference:', isDarkMode);
    setDarkMode(isDarkMode);
    
    // Re-enable transitions after a short delay
    setTimeout(() => {
        $('html').removeClass('no-transitions');
    }, 100);
    
    // Setup event handler for dark mode toggle button
    setupChatroomDarkModeHandler();
    
    console.log('Chatroom: Dark mode initialized, current mode:', isDarkMode ? 'dark' : 'light');
}

// Setup event handler for chatroom dark mode toggle
function setupChatroomDarkModeHandler() {
    console.log('Chatroom: Setting up dark mode handler');
    
    // Check if jQuery is available
    if (typeof $ === 'undefined') {
        console.error('Chatroom: jQuery not available for dark mode setup');
        return;
    }
    
    // Check if button exists
    const $button = $('#chatroomDarkModeToggle');
    console.log('Chatroom: Dark mode button found:', $button.length);
    
    // Use event delegation for the dark mode toggle button
    $(document).off('click.chatroomDarkMode').on('click.chatroomDarkMode', '#chatroomDarkModeToggle', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Chatroom: Dark mode toggle clicked');
        toggleDarkMode();
    });
    
    // Also try direct binding as fallback
    if ($button.length > 0) {
        $button.off('click.chatroomDarkModeDirect').on('click.chatroomDarkModeDirect', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Chatroom: Dark mode toggle clicked (direct)');
            toggleDarkMode();
        });
    }
}

// Make functions available globally
window.showUserProfile = showUserProfile;
window.closeUserProfile = closeUserProfile;
window.followUser = followUser;
window.viewFullProfile = viewFullProfile;
window.initChatroomDarkMode = initChatroomDarkMode;