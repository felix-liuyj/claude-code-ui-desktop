// hooks/useVersionCheck.js
import { useEffect, useState } from 'react';

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;
const CACHE_KEY_PREFIX = 'version-check-';

const getFromCache = (key) => {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                return data;
            }
        }
    } catch (error) {
        console.warn('Failed to read version cache:', error);
    }
    return null;
};

const setToCache = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.warn('Failed to write version cache:', error);
    }
};

export const useVersionCheck = (owner, repo) => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [latestVersion, setLatestVersion] = useState(null);
    const [currentVersion, setCurrentVersion] = useState(null);

    useEffect(() => {
        const getCurrentVersion = async () => {
            try {
                if (window.electronAPI?.getVersion) {
                    // In Electron, get version from main process
                    const version = await window.electronAPI.getVersion();
                    setCurrentVersion(version);
                    return version;
                } else {
                    // Fallback for web mode - try to get from server
                    try {
                        const response = await fetch('/api/version');
                        const data = await response.json();
                        setCurrentVersion(data.version);
                        return data.version;
                    } catch {
                        // If no server endpoint, use unknown version
                        setCurrentVersion('unknown');
                        return 'unknown';
                    }
                }
            } catch (error) {
                console.error('Failed to get current version:', error);
                setCurrentVersion('unknown');
                return 'unknown';
            }
        };

        const checkVersion = async (currentVer) => {
            const cacheKey = `${CACHE_KEY_PREFIX}${owner}-${repo}`;
            
            // Try to get from cache first
            const cached = getFromCache(cacheKey);
            if (cached) {
                console.log('Using cached version data:', cached);
                setLatestVersion(cached.latest);
                const hasUpdate = currentVer && currentVer !== 'unknown' && currentVer !== cached.latest;
                setUpdateAvailable(hasUpdate);
                return;
            }
            
            try {
                const response = await fetch(`https://api.github.com/repos/${ owner }/${ repo }/releases/latest`);
                
                // Check if the response is successful
                if (!response.ok) {
                    if (response.status === 404) {
                        console.info('No releases found for this repository yet');
                    } else if (response.status === 403) {
                        console.warn('GitHub API rate limit exceeded. Version check will retry later.');
                    } else {
                        console.error('GitHub API error:', response.status, response.statusText);
                    }
                    // No releases found or API error, don't show update notification
                    setUpdateAvailable(false);
                    setLatestVersion(null);
                    return;
                }

                const data = await response.json();

                // Handle the case where there might not be any releases
                if (data.tag_name) {
                    const latest = data.tag_name.replace(/^v/, '');
                    setLatestVersion(latest);
                    
                    // Cache the result
                    setToCache(cacheKey, { latest });
                    
                    // Use the passed current version for comparison
                    const hasUpdate = currentVer && currentVer !== 'unknown' && currentVer !== latest;
                    setUpdateAvailable(hasUpdate);
                    
                    console.log('Version check:', { current: currentVer, latest, hasUpdate });
                } else {
                    // No releases found, don't show update notification
                    setUpdateAvailable(false);
                    setLatestVersion(null);
                }
            } catch (error) {
                console.error('Version check failed:', error);
                // On error, don't show update notification
                setUpdateAvailable(false);
                setLatestVersion(null);
            }
        };

        const initVersionCheck = async () => {
            const currentVer = await getCurrentVersion();
            await checkVersion(currentVer);
        };

        initVersionCheck();

        const interval = setInterval(() => checkVersion(currentVersion), 30 * 60 * 1000); // Check every 30 minutes to avoid rate limits
        return () => clearInterval(interval);
    }, [owner, repo]); // Remove currentVersion from dependencies

    return { updateAvailable, latestVersion, currentVersion };
}; 