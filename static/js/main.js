// State Management
let allReleases = [];
let filteredReleases = [];
let starredIds = JSON.parse(localStorage.getItem('starred_releases') || '[]');

const state = {
    searchQuery: '',
    selectedTypes: new Set(['Feature', 'Change', 'Breaking', 'Issue', 'Announcement', 'Deprecated', 'Fixed', 'General']),
    timeRange: 'all', // 'all', '30', '90', '180', '365'
    starredOnly: false,
    sortOrder: 'desc', // 'desc', 'asc'
    activeTab: 'explorer' // 'explorer', 'analytics'
};

// Vietnamese translations for release types
const typeTranslations = {
    Feature: 'Tính năng mới',
    Change: 'Thay đổi',
    Breaking: 'Thay đổi đột phá',
    Issue: 'Lỗi phát sinh',
    Announcement: 'Thông báo',
    Deprecated: 'Không còn hỗ trợ',
    Fixed: 'Đã sửa lỗi',
    General: 'Cập nhật chung'
};

// DOM Elements
const elements = {
    releaseNotesContainer: document.getElementById('release-notes-container'),
    searchInput: document.getElementById('search-input'),
    typeFilterGroup: document.getElementById('type-filter-group'),
    clearTypesBtn: document.getElementById('clear-types-btn'),
    dateRangeSelect: document.getElementById('date-range-select'),
    bookmarkFilterToggle: document.getElementById('bookmark-filter-toggle'),
    starredTotal: document.getElementById('starred-total'),
    sortOrderBtn: document.getElementById('sort-order-btn'),
    refreshFeedBtn: document.getElementById('refresh-feed-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    themeToggle: document.getElementById('theme-toggle'),
    tabExplorerBtn: document.getElementById('tab-explorer-btn'),
    tabAnalyticsBtn: document.getElementById('tab-analytics-btn'),
    mainViewTitle: document.getElementById('main-view-title'),
    searchStatus: document.getElementById('search-status'),
    syncTime: document.getElementById('sync-time'),
    totalCountDisplay: document.getElementById('total-count-display'),
    featureCountDisplay: document.getElementById('feature-count-display'),
    breakingCountDisplay: document.getElementById('breaking-count-display'),
    starredCountDisplay: document.getElementById('starred-count-display'),
    metricsSection: document.getElementById('metrics-section'),
    explorerView: document.getElementById('explorer-view'),
    analyticsView: document.getElementById('analytics-view'),
    toggleSidebar: document.getElementById('toggle-sidebar'),
    sidebar: document.getElementById('sidebar')
};

// Chart.js Instances
let charts = {
    frequency: null,
    type: null,
    keyword: null
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchReleaseNotes();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        updateThemeIcon(false);
    } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        updateThemeIcon(true);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.documentElement.classList.toggle('light', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
    
    // Re-render charts to adjust text color for theme
    if (state.activeTab === 'analytics') {
        renderCharts();
    }
}

function updateThemeIcon(isDark) {
    const icon = elements.themeToggle.querySelector('i');
    if (isDark) {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}

// Event Listeners
function setupEventListeners() {
    // Theme
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Search with debounce
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value.trim();
            applyFilters();
        }, 250);
    });
    
    // Select All / Clear Types Toggle
    elements.clearTypesBtn.addEventListener('click', () => {
        const checkboxes = elements.typeFilterGroup.querySelectorAll('.filter-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
            if (cb.checked) {
                state.selectedTypes.add(cb.value);
            } else {
                state.selectedTypes.delete(cb.value);
            }
        });
        
        elements.clearTypesBtn.textContent = allChecked ? 'Chọn tất cả' : 'Xóa tất cả';
        applyFilters();
    });
    
    // Type Filters
    elements.typeFilterGroup.addEventListener('change', (e) => {
        if (e.target.classList.contains('filter-checkbox')) {
            const type = e.target.value;
            if (e.target.checked) {
                state.selectedTypes.add(type);
            } else {
                state.selectedTypes.delete(type);
            }
            
            // Update Clear/Select Button Text
            const checkboxes = elements.typeFilterGroup.querySelectorAll('.filter-checkbox');
            const someChecked = Array.from(checkboxes).some(cb => cb.checked);
            elements.clearTypesBtn.textContent = someChecked ? 'Xóa tất cả' : 'Chọn tất cả';
            
            applyFilters();
        }
    });
    
    // Time Range Selector
    elements.dateRangeSelect.addEventListener('change', (e) => {
        state.timeRange = e.target.value;
        applyFilters();
    });
    
    // Starred Filter Toggle
    elements.bookmarkFilterToggle.addEventListener('change', (e) => {
        state.starredOnly = e.target.checked;
        applyFilters();
    });
    
    // Sort Order Button
    elements.sortOrderBtn.addEventListener('click', () => {
        if (state.sortOrder === 'desc') {
            state.sortOrder = 'asc';
            elements.sortOrderBtn.querySelector('span').textContent = 'Cũ nhất trước';
            elements.sortOrderBtn.querySelector('i').className = 'fa-solid fa-sort-up';
        } else {
            state.sortOrder = 'desc';
            elements.sortOrderBtn.querySelector('span').textContent = 'Mới nhất trước';
            elements.sortOrderBtn.querySelector('i').className = 'fa-solid fa-sort-down';
        }
        applyFilters();
    });
    
    // Refresh feed button
    elements.refreshFeedBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });
    
    // Navigation Tabs
    elements.tabExplorerBtn.addEventListener('click', () => switchTab('explorer'));
    elements.tabAnalyticsBtn.addEventListener('click', () => switchTab('analytics'));
    
    // Mobile Sidebar Toggle
    elements.toggleSidebar.addEventListener('click', () => {
        elements.sidebar.classList.toggle('w-full');
        elements.sidebar.classList.toggle('h-screen');
        elements.sidebar.classList.toggle('absolute');
    });
}

// Tab switcher
function switchTab(tab) {
    state.activeTab = tab;
    
    if (tab === 'explorer') {
        elements.tabExplorerBtn.classList.add('active');
        elements.tabAnalyticsBtn.classList.remove('active');
        elements.mainViewTitle.textContent = 'Danh sách cập nhật';
        elements.explorerView.classList.remove('hidden');
        elements.metricsSection.classList.remove('hidden');
        elements.analyticsView.classList.add('hidden');
        updateSearchStatus();
    } else {
        elements.tabExplorerBtn.classList.remove('active');
        elements.tabAnalyticsBtn.classList.add('active');
        elements.mainViewTitle.textContent = 'Phân tích & Xu hướng';
        elements.explorerView.classList.add('hidden');
        elements.metricsSection.classList.add('hidden');
        elements.analyticsView.classList.remove('hidden');
        elements.searchStatus.textContent = 'Bảng phân tích xu hướng tích hợp';
        renderCharts();
    }
}

// Fetch Data from Server
async function fetchReleaseNotes(forceRefresh = false) {
    elements.refreshIcon.classList.add('spinning');
    elements.refreshFeedBtn.disabled = true;
    
    try {
        const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Lỗi phản hồi mạng');
        
        const result = await response.json();
        allReleases = result.entries;
        
        // Parse raw string dates to Javascript dates once
        allReleases.forEach(item => {
            item.dateObj = new Date(item.updated);
        });
        
        // Update Sync Timestamp
        const syncDate = new Date(result.lastUpdated * 1000);
        elements.syncTime.textContent = syncDate.toLocaleTimeString('vi-VN') + ' (' + syncDate.toLocaleDateString('vi-VN') + ')';
        
        // Refresh sidebar total count of starred
        updateStarredTotalCount();
        
        // Apply filters & render
        applyFilters();
        
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu bản phát hành:', error);
        elements.releaseNotesContainer.innerHTML = `
            <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl text-center max-w-lg mx-auto mt-10">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-4"></i>
                <h3 class="font-bold font-outfit text-lg mb-2">Lỗi Kết Nối Đồng Bộ</h3>
                <p class="text-sm">Không thể tải dữ liệu bản cập nhật từ máy chủ. Vui lòng kiểm tra lại kết nối internet hoặc đảm bảo dịch vụ Flask đang chạy.</p>
                <button onclick="window.location.reload()" class="mt-4 px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/30 text-xs font-bold transition-all">Thử lại đồng bộ</button>
            </div>
        `;
    } finally {
        elements.refreshIcon.classList.remove('spinning');
        elements.refreshFeedBtn.disabled = false;
    }
}

// Filtering Engine
function applyFilters() {
    const now = new Date();
    
    filteredReleases = allReleases.filter(item => {
        // 1. Release Type Filter
        if (!state.selectedTypes.has(item.type)) return false;
        
        // 2. Starred Filter
        const isStarred = starredIds.includes(item.id);
        if (state.starredOnly && !isStarred) return false;
        
        // 3. Time Range Filter
        if (state.timeRange !== 'all') {
            const daysLimit = parseInt(state.timeRange);
            const daysAgo = new Date(now.getTime() - (daysLimit * 24 * 60 * 60 * 1000));
            if (item.dateObj < daysAgo) return false;
        }
        
        // 4. Search Filter
        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            const inTitle = item.date.toLowerCase().includes(query);
            const inType = item.type.toLowerCase().includes(query);
            const inContent = item.content.toLowerCase().includes(query);
            if (!inTitle && !inType && !inContent) return false;
        }
        
        return true;
    });
    
    // Sort
    filteredReleases.sort((a, b) => {
        return state.sortOrder === 'desc' 
            ? b.dateObj - a.dateObj 
            : a.dateObj - b.dateObj;
    });
    
    // Update DOM Metrics and Render
    updateSidebarCounts();
    updateDashboardMetrics();
    updateSearchStatus();
    
    if (state.activeTab === 'explorer') {
        renderExplorerList();
    } else {
        renderCharts();
    }
}

// Recalculate and update Sidebar filter count badges
function updateSidebarCounts() {
    const types = ['Feature', 'Change', 'Breaking', 'Issue', 'Announcement', 'Deprecated', 'Fixed', 'General'];
    
    types.forEach(type => {
        const count = allReleases.filter(item => item.type === type).length;
        const badge = document.getElementById(`count-${type}`);
        if (badge) badge.textContent = count;
    });
    
    elements.starredTotal.textContent = starredIds.length;
}

// Update Top Dashboard Metrics Card Displays
function updateDashboardMetrics() {
    elements.totalCountDisplay.textContent = filteredReleases.length;
    
    const features = filteredReleases.filter(item => item.type === 'Feature').length;
    elements.featureCountDisplay.textContent = features;
    
    const breaking = filteredReleases.filter(item => item.type === 'Breaking' || item.type === 'Issue').length;
    elements.breakingCountDisplay.textContent = breaking;
    
    const starred = filteredReleases.filter(item => starredIds.includes(item.id)).length;
    elements.starredCountDisplay.textContent = starred;
}

// Update Header Subtext Search Status summary
function updateSearchStatus() {
    if (state.activeTab === 'analytics') return;
    
    let text = `Đang hiển thị ${filteredReleases.length} cập nhật`;
    if (state.searchQuery) {
        text += ` khớp với "${state.searchQuery}"`;
    }
    if (state.timeRange !== 'all') {
        text += ` trong ${state.timeRange} ngày qua`;
    }
    if (state.starredOnly) {
        text += ` (đã lưu)`;
    }
    elements.searchStatus.textContent = text;
}

// Render Feed list inside Explorer tab
function renderExplorerList() {
    if (filteredReleases.length === 0) {
        elements.releaseNotesContainer.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted);"></i>
                <h3 class="font-bold text-slate-300 font-outfit text-base">Không Tìm Thấy Bản Cập Nhật Nào</h3>
                <p class="text-xs text-slate-500" style="max-width: 300px; line-height: 1.5;">Không có cập nhật nào khớp với tiêu chí tìm kiếm của bạn. Hãy thử thay đổi bộ lọc, khoảng thời gian hoặc đặt lại từ khóa tìm kiếm.</p>
                <button id="reset-filters-btn" class="btn-secondary">Đặt lại bộ lọc</button>
            </div>
        `;
        
        document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);
        return;
    }
    
    let html = '';
    
    filteredReleases.forEach(item => {
        const isStarred = starredIds.includes(item.id);
        const highlightedContent = highlightText(item.content, state.searchQuery);
        
        // Translate title or keep date string. Date strings fetched are like "June 16, 2026".
        // Let's translate month names for a Vietnamese UI!
        let translatedDate = item.date;
        const monthsMap = {
            'January': 'Tháng 1', 'February': 'Tháng 2', 'March': 'Tháng 3', 'April': 'Tháng 4',
            'May': 'Tháng 5', 'June': 'Tháng 6', 'July': 'Tháng 7', 'August': 'Tháng 8',
            'September': 'Tháng 9', 'October': 'Tháng 10', 'November': 'Tháng 11', 'December': 'Tháng 12'
        };
        for (const [enMonth, viMonth] of Object.entries(monthsMap)) {
            if (translatedDate.includes(enMonth)) {
                translatedDate = translatedDate.replace(enMonth, viMonth);
                break;
            }
        }
        
        const viType = typeTranslations[item.type] || item.type;
        
        html += `
            <div class="release-card border-glow-${item.type}" data-id="${item.id}">
                <!-- Card Header -->
                <div class="card-header">
                    <div class="card-meta">
                        <span class="badge badge-${item.type.toLowerCase()}">${viType}</span>
                        <h4 class="card-date">${translatedDate}</h4>
                    </div>
                    
                    <div class="card-actions">
                        <!-- Copy Anchor Link -->
                        <button onclick="copyAnchorLink('${item.link}', this)" class="icon-btn-sm" title="Sao chép liên kết">
                            <i class="fa-solid fa-link"></i>
                        </button>
                        <!-- Star / Bookmark Button -->
                        <button onclick="toggleBookmark('${item.id}', this)" class="star-btn icon-btn-sm ${isStarred ? 'star-active' : ''}" title="${isStarred ? 'Bỏ đánh dấu' : 'Lưu cập nhật'}">
                            <i class="fa-solid fa-star"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Card Content -->
                <div class="release-notes-content">
                    ${highlightedContent}
                </div>
                
                <!-- Card Footer Link -->
                <div class="card-footer">
                    <span class="card-id">Mã: ${item.id.substring(0, 8)}...</span>
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="card-link">
                        Xem tài liệu gốc <i class="fa-solid fa-up-right-from-square"></i>
                    </a>
                </div>
            </div>
        `;
    });
    
    elements.releaseNotesContainer.innerHTML = html;
}

// Star / Bookmark toggle action
function toggleBookmark(id, button) {
    const index = starredIds.indexOf(id);
    if (index === -1) {
        starredIds.push(id);
        button.classList.add('star-active');
        button.title = "Bỏ đánh dấu";
    } else {
        starredIds.splice(index, 1);
        button.classList.remove('star-active');
        button.title = "Lưu cập nhật";
    }
    
    localStorage.setItem('starred_releases', JSON.stringify(starredIds));
    updateStarredTotalCount();
    updateSidebarCounts();
    updateDashboardMetrics();
    
    if (state.starredOnly) {
        applyFilters();
    }
}

function updateStarredTotalCount() {
    elements.starredTotal.textContent = starredIds.length;
}

// Copy source link to Clipboard
function copyAnchorLink(link, button) {
    navigator.clipboard.writeText(link).then(() => {
        const icon = button.querySelector('i');
        const originalColor = icon.style.color;
        const originalBorderColor = button.style.borderColor;
        
        icon.className = 'fa-solid fa-check';
        icon.style.color = 'var(--type-feature)';
        button.style.borderColor = 'var(--type-feature)';
        
        setTimeout(() => {
            icon.className = 'fa-solid fa-link';
            icon.style.color = originalColor;
            button.style.borderColor = originalBorderColor;
        }, 1500);
    });
}

// Reset filters to default
function resetFilters() {
    state.searchQuery = '';
    elements.searchInput.value = '';
    
    state.selectedTypes = new Set(['Feature', 'Change', 'Breaking', 'Issue', 'Announcement', 'Deprecated', 'Fixed', 'General']);
    const checkboxes = elements.typeFilterGroup.querySelectorAll('.filter-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    elements.clearTypesBtn.textContent = 'Xóa tất cả';
    
    state.timeRange = 'all';
    elements.dateRangeSelect.value = 'all';
    
    state.starredOnly = false;
    elements.bookmarkFilterToggle.checked = false;
    
    applyFilters();
}

// HTML Highlighting DOM Nodes safely
function highlightText(text, query) {
    if (!query) return text;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    highlightDOMNode(tempDiv, query);
    return tempDiv.innerHTML;
}

function highlightDOMNode(node, query) {
    if (node.nodeType === 3) { // Text node
        const text = node.nodeValue;
        const escapedQuery = escapeRegExp(query);
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        if (regex.test(text)) {
            const span = document.createElement('span');
            span.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
            node.parentNode.replaceChild(span, node);
        }
    } else if (node.nodeType === 1 && node.childNodes && !/(style|script|a)/i.test(node.tagName)) {
        for (let i = 0; i < node.childNodes.length; i++) {
            highlightDOMNode(node.childNodes[i], query);
        }
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Chart Render Engine (Chart.js)
function renderCharts() {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(51, 65, 85, 0.15)' : 'rgba(226, 232, 240, 0.5)';
    
    if (charts.frequency) charts.frequency.destroy();
    if (charts.type) charts.type.destroy();
    if (charts.keyword) charts.keyword.destroy();
    
    // ----------------------------------------------------
    // Chart 1: Release Frequency (Stacked Bar by Month)
    // ----------------------------------------------------
    const monthlyData = {};
    filteredReleases.forEach(item => {
        const dateObj = new Date(item.updated);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        
        if (!monthlyData[key]) {
            monthlyData[key] = {
                Feature: 0, Change: 0, Breaking: 0, Issue: 0, Announcement: 0, Deprecated: 0, Fixed: 0, General: 0
            };
        }
        if (item.type in monthlyData[key]) {
            monthlyData[key][item.type]++;
        } else {
            monthlyData[key]['General']++;
        }
    });
    
    const months = Object.keys(monthlyData).sort();
    
    // Stacked datasets (translated labels)
    const datasets = [
        { label: 'Tính năng mới', data: months.map(m => monthlyData[m].Feature), backgroundColor: '#10b981' },
        { label: 'Thay đổi', data: months.map(m => monthlyData[m].Change), backgroundColor: '#3b82f6' },
        { label: 'Thay đổi đột phá', data: months.map(m => monthlyData[m].Breaking), backgroundColor: '#f43f5e' },
        { label: 'Lỗi phát sinh', data: months.map(m => monthlyData[m].Issue), backgroundColor: '#f59e0b' },
        { label: 'Thông báo', data: months.map(m => monthlyData[m].Announcement), backgroundColor: '#8b5cf6' },
        { label: 'Không hỗ trợ nữa', data: months.map(m => monthlyData[m].Deprecated), backgroundColor: '#f97316' },
        { label: 'Đã sửa lỗi', data: months.map(m => monthlyData[m].Fixed), backgroundColor: '#14b8a6' }
    ];
    
    // Translate month names for the X-axis keys (e.g. 2026-06 -> Th6/2026)
    const translatedMonths = months.map(m => {
        const parts = m.split('-');
        return `Th${parseInt(parts[1])}/${parts[0]}`;
    });
    
    const ctxFreq = document.getElementById('frequencyChart').getContext('2d');
    charts.frequency = new Chart(ctxFreq, {
        type: 'bar',
        data: { labels: translatedMonths, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { color: 'transparent' }, ticks: { color: textColor, font: { family: 'Inter' } } },
                y: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter' } } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: textColor, font: { family: 'Outfit', size: 11 } } }
            }
        }
    });
    
    // ----------------------------------------------------
    // Chart 2: Update Types Distribution (Doughnut)
    // ----------------------------------------------------
    const typeCounts = {};
    filteredReleases.forEach(item => {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });
    
    const typeLabels = Object.keys(typeCounts);
    const translatedTypeLabels = typeLabels.map(label => typeTranslations[label] || label);
    const typeValues = Object.values(typeCounts);
    
    const typeColors = {
        Feature: '#10b981', Change: '#3b82f6', Breaking: '#f43f5e', Issue: '#f59e0b',
        Announcement: '#8b5cf6', Deprecated: '#f97316', Fixed: '#14b8a6', General: '#6b7280'
    };
    const doughnutColors = typeLabels.map(label => typeColors[label] || '#6b7280');
    
    const ctxType = document.getElementById('typeChart').getContext('2d');
    charts.type = new Chart(ctxType, {
        type: 'doughnut',
        data: {
            labels: translatedTypeLabels,
            datasets: [{ data: typeValues, backgroundColor: doughnutColors, borderWidth: 0 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: textColor, font: { family: 'Outfit', size: 11 } } }
            },
            cutout: '65%'
        }
    });
    
    // ----------------------------------------------------
    // Chart 3: Frequently Tagged Tech (Horizontal Bar)
    // ----------------------------------------------------
    const keywords = [
        { label: 'Gemini AI & Trợ lý', regex: /gemini|code assist|cloud assist/i },
        { label: 'UDF & Python UDF', regex: /udf|user-defined/i },
        { label: 'Vector Index & Embeddings', regex: /vector|embedding/i },
        { label: 'Bảo mật & Chính sách IAM', regex: /iam|deny|organization policy|constraints/i },
        { label: 'Cơ sở dữ liệu Đồ thị (Graph DB)', regex: /graph|schema/i },
        { label: 'Data Lakehouse (BigLake/Iceberg)', regex: /lakehouse|biglake|iceberg/i },
        { label: 'Dịch vụ truyền dữ liệu (DTS)', regex: /transfer|connector/i },
        { label: 'Trình điều khiển Drivers (JDBC/ODBC)', regex: /jdbc|odbc|driver/i },
        { label: 'Bảng ảo Materialized Views', regex: /materialized view/i },
        { label: 'Dataform & Workflows', regex: /dataform/i }
    ];
    
    const keywordCounts = keywords.map(kw => {
        const count = filteredReleases.filter(item => kw.regex.test(item.content)).length;
        return { label: kw.label, count: count };
    });
    
    keywordCounts.sort((a, b) => b.count - a.count);
    
    const ctxKw = document.getElementById('keywordChart').getContext('2d');
    charts.keyword = new Chart(ctxKw, {
        type: 'bar',
        data: {
            labels: keywordCounts.map(k => k.label),
            datasets: [{
                label: 'Tần suất xuất hiện',
                data: keywordCounts.map(k => k.count),
                backgroundColor: 'rgba(14, 165, 233, 0.75)',
                hoverBackgroundColor: '#0ea5e9',
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 } },
                y: { grid: { color: 'transparent' }, ticks: { color: textColor, font: { family: 'Outfit', size: 10 } } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}
