/**
 * Heroicons Picker Component
 * Provides a searchable icon picker for Heroicons
 */
class HeroIconsPicker {
    constructor(options = {}) {
        this.inputSelector = options.inputSelector;
        this.containerSelector = options.containerSelector;
        this.onSelect = options.onSelect || function() {};
        this.iconsPath = options.iconsPath || '/assets/images/heroicons';
        this.icons = [];
        this.filteredIcons = [];
        this.isOpen = false;
        
        this.init();
    }

    async init() {
        await this.loadIconsList();
        this.createPickerHTML();
        this.bindEvents();
    }

    async loadIconsList() {
        // List of all heroicons (outline versions)
        this.icons = [
            'academic-cap', 'adjustments-horizontal', 'adjustments-vertical', 'archive-box-arrow-down',
            'archive-box-x-mark', 'archive-box', 'arrow-down-circle', 'arrow-down-left',
            'arrow-down-on-square-stack', 'arrow-down-on-square', 'arrow-down-right', 'arrow-down-tray',
            'arrow-down', 'arrow-left-circle', 'arrow-left-end-on-rectangle', 'arrow-left-on-rectangle',
            'arrow-left-start-on-rectangle', 'arrow-left', 'arrow-long-down', 'arrow-long-left',
            'arrow-long-right', 'arrow-long-up', 'arrow-path-rounded-square', 'arrow-path',
            'arrow-right-circle', 'arrow-right-end-on-rectangle', 'arrow-right-on-rectangle',
            'arrow-right-start-on-rectangle', 'arrow-right', 'arrow-small-down', 'arrow-small-left',
            'arrow-small-right', 'arrow-small-up', 'arrow-top-right-on-square', 'arrow-trending-down',
            'arrow-trending-up', 'arrow-turn-down-left', 'arrow-turn-down-right', 'arrow-turn-left-down',
            'arrow-turn-left-up', 'arrow-turn-right-down', 'arrow-turn-right-up', 'arrow-turn-up-left',
            'arrow-turn-up-right', 'arrow-up-circle', 'arrow-up-left', 'arrow-up-on-square-stack',
            'arrow-up-on-square', 'arrow-up-right', 'arrow-up-tray', 'arrow-up', 'arrow-uturn-down',
            'arrow-uturn-left', 'arrow-uturn-right', 'arrow-uturn-up', 'arrows-pointing-in',
            'arrows-pointing-out', 'arrows-right-left', 'arrows-up-down', 'at-symbol', 'backspace',
            'backward', 'banknotes', 'bars-2', 'bars-3-bottom-left', 'bars-3-bottom-right',
            'bars-3-center-left', 'bars-3', 'bars-4', 'bars-arrow-down', 'bars-arrow-up',
            'battery-0', 'battery-100', 'battery-50', 'beaker', 'bell-alert', 'bell-slash',
            'bell-snooze', 'bell', 'bold', 'bolt-slash', 'bolt', 'book-open', 'bookmark-slash',
            'bookmark-square', 'bookmark', 'briefcase', 'bug-ant', 'building-library',
            'building-office-2', 'building-office', 'building-storefront', 'cake', 'calculator',
            'calendar-date-range', 'calendar-days', 'calendar', 'camera', 'chart-bar-square',
            'chart-bar', 'chart-pie', 'chat-bubble-bottom-center-text', 'chat-bubble-bottom-center',
            'chat-bubble-left-ellipsis', 'chat-bubble-left-right', 'chat-bubble-left',
            'chat-bubble-oval-left-ellipsis', 'chat-bubble-oval-left', 'check-badge', 'check-circle',
            'check', 'chevron-double-down', 'chevron-double-left', 'chevron-double-right',
            'chevron-double-up', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up-down',
            'chevron-up', 'circle-stack', 'clipboard-document-check', 'clipboard-document-list',
            'clipboard-document', 'clipboard', 'clock', 'cloud-arrow-down', 'cloud-arrow-up',
            'cloud', 'code-bracket-square', 'code-bracket', 'cog-6-tooth', 'cog-8-tooth', 'cog',
            'command-line', 'computer-desktop', 'cpu-chip', 'credit-card', 'cube-transparent',
            'cube', 'currency-bangladeshi', 'currency-dollar', 'currency-euro', 'currency-pound',
            'currency-rupee', 'currency-yen', 'cursor-arrow-rays', 'cursor-arrow-ripple',
            'device-phone-mobile', 'device-tablet', 'divide', 'document-arrow-down',
            'document-arrow-up', 'document-chart-bar', 'document-check', 'document-currency-bangladeshi',
            'document-currency-dollar', 'document-currency-euro', 'document-currency-pound',
            'document-currency-rupee', 'document-currency-yen', 'document-duplicate',
            'document-magnifying-glass', 'document-minus', 'document-plus', 'document-text',
            'document', 'ellipsis-horizontal-circle', 'ellipsis-horizontal', 'ellipsis-vertical',
            'envelope-open', 'envelope', 'equals', 'exclamation-circle', 'exclamation-triangle',
            'eye-dropper', 'eye-slash', 'eye', 'face-frown', 'face-smile', 'film', 'finger-print',
            'fire', 'flag', 'folder-arrow-down', 'folder-minus', 'folder-open', 'folder-plus',
            'folder', 'forward', 'funnel', 'gif', 'gift-top', 'gift', 'globe-alt', 'globe-americas',
            'globe-asia-australia', 'globe-europe-africa', 'h1', 'h2', 'h3', 'hand-raised',
            'hand-thumb-down', 'hand-thumb-up', 'hashtag', 'heart', 'home-modern', 'home',
            'identification', 'inbox-arrow-down', 'inbox-stack', 'inbox', 'information-circle',
            'italic', 'key', 'language', 'lifebuoy', 'light-bulb', 'link-slash', 'link',
            'list-bullet', 'lock-closed', 'lock-open', 'magnifying-glass-circle',
            'magnifying-glass-minus', 'magnifying-glass-plus', 'magnifying-glass', 'map-pin',
            'map', 'megaphone', 'microphone', 'minus-circle', 'minus-small', 'minus', 'moon',
            'musical-note', 'newspaper', 'no-symbol', 'numbered-list', 'paint-brush',
            'paper-airplane', 'paper-clip', 'pause-circle', 'pause', 'pencil-square', 'pencil',
            'percent-badge', 'phone-arrow-down-left', 'phone-arrow-up-right', 'phone-x-mark',
            'phone', 'photo', 'play-circle', 'play-pause', 'play', 'plus-circle', 'plus-small',
            'plus', 'power', 'presentation-chart-bar', 'presentation-chart-line', 'printer',
            'puzzle-piece', 'qr-code', 'question-mark-circle', 'queue-list', 'radio',
            'receipt-percent', 'receipt-refund', 'rectangle-group', 'rectangle-stack',
            'rocket-launch', 'rss', 'scale', 'scissors', 'server-stack', 'server', 'share',
            'shield-check', 'shield-exclamation', 'shopping-bag', 'shopping-cart', 'signal-slash',
            'signal', 'slash', 'sparkles', 'speaker-wave', 'speaker-x-mark', 'square-2-stack',
            'square-3-stack-3d', 'squares-2x2', 'squares-plus', 'star', 'stop-circle', 'stop',
            'strikethrough', 'sun', 'swatch', 'table-cells', 'tag', 'ticket', 'trash', 'trophy',
            'truck', 'tv', 'underline', 'user-circle', 'user-group', 'user-minus', 'user-plus',
            'user', 'users', 'variable', 'video-camera-slash', 'video-camera', 'view-columns',
            'viewfinder-circle', 'wallet', 'wifi', 'window', 'wrench-screwdriver', 'wrench',
            'x-circle', 'x-mark'
        ];
        this.filteredIcons = [...this.icons];
    }

    createPickerHTML() {
        const container = document.querySelector(this.containerSelector);
        if (!container) return;

        const pickerHTML = `
            <div class="heroicons-picker-wrapper relative">
                <div class="heroicons-picker-trigger flex items-center gap-2 cursor-pointer border border-gray-300 rounded-lg px-4 py-2 bg-white hover:border-gray-400 transition-colors">
                    <div class="heroicons-picker-preview w-5 h-5 flex items-center justify-center">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                        </svg>
                    </div>
                    <span class="heroicons-picker-text text-sm text-gray-600">Select an icon</span>
                    <svg class="w-4 h-4 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
                
                <div class="heroicons-picker-dropdown absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg hidden max-h-80 overflow-hidden" onclick="event.stopPropagation()">
                    <div class="p-3 border-b border-gray-200">
                        <input type="text" class="heroicons-picker-search w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-500" placeholder="Search icons...">
                    </div>
                    <div class="heroicons-picker-grid p-3 max-h-64 overflow-y-auto grid grid-cols-8 gap-2">
                        <!-- Icons will be populated here -->
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = pickerHTML;
        this.renderIcons();
    }

    renderIcons() {
        const grid = document.querySelector('.heroicons-picker-grid');
        if (!grid) return;

        grid.innerHTML = '';
        
        // Show "no icons found" message if no filtered icons
        if (this.filteredIcons.length === 0) {
            grid.innerHTML = `
                <div class="col-span-8 flex flex-col items-center justify-center py-6 text-gray-500">
                    <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-sm">No icons found</p>
                    <p class="text-xs mt-1">Try a different search term</p>
                </div>
            `;
            return;
        }
        
        this.filteredIcons.forEach(iconName => {
            const iconButton = document.createElement('button');
            iconButton.type = 'button';
            iconButton.className = 'heroicons-picker-icon w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:border-blue-500 hover:bg-blue-50 transition-colors';
            iconButton.title = iconName;
            iconButton.dataset.icon = iconName;
            
            // Create the SVG element
            const svgElement = document.createElement('div');
            svgElement.className = 'w-5 h-5';
            svgElement.innerHTML = `<svg class="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><use href="${this.iconsPath}/${iconName}.svg#icon"></use></svg>`;
            
            // Fallback: load SVG content directly
            fetch(`${this.iconsPath}/${iconName}.svg`)
                .then(response => response.text())
                .then(svgContent => {
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                    const svg = svgDoc.querySelector('svg');
                    if (svg) {
                        svg.setAttribute('class', 'w-5 h-5');
                        svgElement.innerHTML = '';
                        svgElement.appendChild(svg);
                    }
                })
                .catch(() => {
                    // If SVG loading fails, show icon name
                    svgElement.innerHTML = `<span class="text-xs">${iconName.charAt(0)}</span>`;
                });
            
            iconButton.appendChild(svgElement);
            grid.appendChild(iconButton);
        });
    }

    bindEvents() {
        const trigger = document.querySelector('.heroicons-picker-trigger');
        const dropdown = document.querySelector('.heroicons-picker-dropdown');
        const search = document.querySelector('.heroicons-picker-search');
        const grid = document.querySelector('.heroicons-picker-grid');

        // Toggle dropdown
        trigger?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        // Search functionality
        search?.addEventListener('input', (e) => {
            e.stopPropagation();
            this.filterIcons(e.target.value);
        });

        // Icon selection
        grid?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const iconButton = e.target.closest('.heroicons-picker-icon');
            if (iconButton) {
                this.selectIcon(iconButton.dataset.icon);
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.heroicons-picker-wrapper')) {
                this.close();
            }
        });
    }

    filterIcons(searchTerm) {
        const term = searchTerm.toLowerCase();
        this.filteredIcons = this.icons.filter(icon => 
            icon.toLowerCase().includes(term)
        );
        this.renderIcons();
    }

    selectIcon(iconName) {
        const preview = document.querySelector('.heroicons-picker-preview');
        const text = document.querySelector('.heroicons-picker-text');
        const input = document.querySelector(this.inputSelector);

        // Update preview
        if (preview) {
            fetch(`${this.iconsPath}/${iconName}.svg`)
                .then(response => response.text())
                .then(svgContent => {
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                    const svg = svgDoc.querySelector('svg');
                    if (svg) {
                        svg.setAttribute('class', 'w-5 h-5');
                        preview.innerHTML = '';
                        preview.appendChild(svg);
                    }
                });
        }

        // Update text
        if (text) {
            text.textContent = iconName;
        }

        // Update input value
        if (input) {
            input.value = iconName;
            input.dispatchEvent(new Event('change'));
        }

        // Call callback
        this.onSelect(iconName);

        this.close();
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        const dropdown = document.querySelector('.heroicons-picker-dropdown');
        if (dropdown) {
            dropdown.classList.remove('hidden');
            this.isOpen = true;
        }
    }

    close() {
        const dropdown = document.querySelector('.heroicons-picker-dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
            this.isOpen = false;
        }
    }

    setValue(iconName) {
        if (this.icons.includes(iconName)) {
            this.selectIcon(iconName);
        }
    }
}

// Make it globally available
window.HeroIconsPicker = HeroIconsPicker;