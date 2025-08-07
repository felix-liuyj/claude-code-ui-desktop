import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('🚀 main.jsx loading...');
console.log('electronAPI available:', !!window.electronAPI);

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
                        { this.state.error && this.state.error.toString() }
                        <br/>
                        { this.state.errorInfo.componentStack }
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

try {
    console.log('🎯 Mounting React app...');
    const root = ReactDOM.createRoot(document.getElementById('root'));

    root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <App/>
            </ErrorBoundary>
        </React.StrictMode>
    );

    console.log('✅ React app mounted successfully');
} catch (error) {
    console.error('❌ Failed to mount React app:', error);
    document.getElementById('root').innerHTML = `
    <div style="padding: 20px; font-family: Arial;">
      <h1>Failed to Start Application</h1>
      <p>Error: ${ error.message }</p>
      <pre>${ error.stack }</pre>
    </div>
  `;
}