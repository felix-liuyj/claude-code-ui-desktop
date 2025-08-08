import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    // Theme modes: 'light', 'dark', 'auto'
    const [themeMode, setThemeMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme-mode');
        return savedTheme || 'auto';
    });

    // Current effective dark mode state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (themeMode === 'auto') {
            // Check system preference
            if (window.matchMedia) {
                return window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
            return false;
        }
        return themeMode === 'dark';
    });

    // Update theme mode based on current setting
    useEffect(() => {
        if (themeMode === 'auto') {
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                setIsDarkMode(mediaQuery.matches);
            }
        } else {
            setIsDarkMode(themeMode === 'dark');
        }
        localStorage.setItem('theme-mode', themeMode);
    }, [themeMode]);

    // Update document class when dark mode changes
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');

            // Update iOS status bar style and theme color for dark mode
            const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
            if (statusBarMeta) {
                statusBarMeta.setAttribute('content', 'black-translucent');
            }

            const themeColorMeta = document.querySelector('meta[name="theme-color"]');
            if (themeColorMeta) {
                themeColorMeta.setAttribute('content', '#0c1117'); // Dark background color (hsl(222.2 84% 4.9%))
            }
        } else {
            document.documentElement.classList.remove('dark');

            // Update iOS status bar style and theme color for light mode
            const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
            if (statusBarMeta) {
                statusBarMeta.setAttribute('content', 'default');
            }

            const themeColorMeta = document.querySelector('meta[name="theme-color"]');
            if (themeColorMeta) {
                themeColorMeta.setAttribute('content', '#ffffff'); // Light background color
            }
        }
    }, [isDarkMode]);

    // Listen for system theme changes (only when in auto mode)
    useEffect(() => {
        if (!window.matchMedia || themeMode !== 'auto') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            setIsDarkMode(e.matches);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [themeMode]);

    const setTheme = (mode) => {
        setThemeMode(mode);
    };

    const toggleDarkMode = () => {
        // Cycle through: auto -> light -> dark -> auto
        if (themeMode === 'auto') {
            setThemeMode('light');
        } else if (themeMode === 'light') {
            setThemeMode('dark');
        } else {
            setThemeMode('auto');
        }
    };

    const value = {
        isDarkMode,
        themeMode,
        setTheme,
        toggleDarkMode,
    };

    return (
        <ThemeContext.Provider value={ value }>
            { children }
        </ThemeContext.Provider>
    );
};