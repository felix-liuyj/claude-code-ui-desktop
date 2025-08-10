import { apiFetch } from './api.js';

/**
 * Claude Doctor utility for managing system status information
 */
class ClaudeDoctorService {
    constructor() {
        this.data = null;
        this.loading = false;
        this.error = null;
        this.initialized = false;
        
        // Load cached data from localStorage
        this.loadCachedData();
    }
    
    loadCachedData() {
        try {
            const cached = localStorage.getItem('claude-doctor-data');
            if (cached) {
                this.data = JSON.parse(cached);
                const cacheTime = new Date(this.data?.timestamp);
                const now = new Date();
                const hoursSinceCache = (now - cacheTime) / (1000 * 60 * 60);
                
                // If cache is older than 24 hours, clear it
                if (hoursSinceCache > 24) {
                    console.log('Claude doctor cache is stale, clearing...');
                    this.clearCache();
                }
            }
        } catch (error) {
            console.warn('Failed to load cached Claude doctor data:', error);
            this.clearCache();
        }
    }
    
    clearCache() {
        this.data = null;
        localStorage.removeItem('claude-doctor-data');
    }
    
    async fetchData() {
        if (this.loading) {
            console.log('Claude doctor fetch already in progress, skipping...');
            return this.data;
        }
        
        this.loading = true;
        this.error = null;
        
        let controller = null;
        let timeoutId = null;
        
        try {
            console.log('🔧 Fetching Claude doctor data...');
            
            // Create an abort controller for timeout
            controller = new AbortController();
            timeoutId = setTimeout(() => {
                if (controller && !controller.signal.aborted) {
                    controller.abort('Request timeout after 30 seconds');
                }
            }, 30000); // Reduced timeout to 30 seconds

            const response = await apiFetch('/api/claude/doctor', {
                signal: controller.signal
            });
            
            // Clear timeout if request completes successfully
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.data = data;
                this.error = null;
                
                // Cache the data to localStorage
                try {
                    localStorage.setItem('claude-doctor-data', JSON.stringify(data));
                } catch (error) {
                    console.warn('Failed to cache Claude doctor data:', error);
                }
                
                console.log('✅ Claude doctor data fetched and cached successfully');
            } else {
                this.error = data.error || 'Failed to get Claude doctor information';
                console.warn('⚠️ Claude doctor returned error:', this.error);
            }
            
        } catch (error) {
            console.error('❌ Error fetching Claude doctor data:', error);
            
            // Provide more specific error messages
            let errorMessage = error.message || 'Unknown error';
            if (error.name === 'AbortError') {
                errorMessage = 'Claude 状态检查超时，请稍后重试';
            } else if (error.message && error.message.includes('Failed to fetch')) {
                errorMessage = '网络连接失败，请检查连接状态';
            } else if (error.message && error.message.includes('ECONNREFUSED')) {
                errorMessage = '无法连接到 Claude 服务';
            }
            
            this.error = errorMessage;
        } finally {
            // Clean up timeout if it still exists
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            this.loading = false;
        }
        
        return this.data;
    }
    
    // Initialize on app startup (only if no valid cache exists)
    async initializeOnStartup() {
        if (this.initialized) {
            console.log('Claude doctor already initialized, skipping...');
            return;
        }
        
        this.initialized = true;
        
        // Only fetch if we don't have valid cached data
        if (!this.data) {
            console.log('🚀 Initializing Claude doctor on app startup...');
            await this.fetchData();
        } else {
            console.log('📋 Using cached Claude doctor data from previous session');
        }
    }
    
    // Get current data (used by components)
    getData() {
        return {
            data: this.data,
            loading: this.loading,
            error: this.error
        };
    }
    
    // Force refresh (for manual refresh button)
    async refresh() {
        console.log('🔄 Manually refreshing Claude doctor data...');
        return await this.fetchData();
    }
}

// Create singleton instance
const claudeDoctorService = new ClaudeDoctorService();

export default claudeDoctorService;