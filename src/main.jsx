// React 应用入口

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Add macOS Electron class to body for styling
if (window.electronAPI && window.environment?.platform === 'darwin') {
    document.body.classList.add('electron-macos');
}

// Error boundary to catch React errors
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('❌ React Error Boundary caught error:', error);
        console.error('Error Info:', errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={ { padding: '20px', fontFamily: 'Arial' } }>
                    <h1>React Application Error</h1>
                    <details style={ { whiteSpace: 'pre-wrap' } }>
                        <summary>Error Details</summary>
                        { this.state.error?.toString() || 'Unknown error' }
                        <br/>
                        { this.state.errorInfo?.componentStack || '' }
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

// Mount React app
const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <ErrorBoundary>
            <App/>
        </ErrorBoundary>
    );
}