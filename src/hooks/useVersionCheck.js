// hooks/useVersionCheck.js
import { useEffect, useState } from 'react';

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
                } else {
                    // Fallback for web mode - try to get from server
                    try {
                        const response = await fetch('/api/version');
                        const data = await response.json();
                        setCurrentVersion(data.version);
                    } catch {
                        // If no server endpoint, use unknown version
                        setCurrentVersion('unknown');
                    }
                }
            } catch (error) {
                console.error('Failed to get current version:', error);
                setCurrentVersion('unknown');
            }
        };

        const checkVersion = async () => {
            try {
                const response = await fetch(`https://api.github.com/repos/${ owner }/${ repo }/releases/latest`);
                
                // Check if the response is successful
                if (!response.ok) {
                    if (response.status === 404) {
                        console.info('No releases found for this repository yet');
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
                    setUpdateAvailable(currentVersion && currentVersion !== 'unknown' && currentVersion !== latest);
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

        getCurrentVersion().then(() => {
            checkVersion();
        });

        const interval = setInterval(checkVersion, 5 * 60 * 1000); // Check every 5 minutes
        return () => clearInterval(interval);
    }, [owner, repo, currentVersion]);

    return { updateAvailable, latestVersion, currentVersion };
}; 