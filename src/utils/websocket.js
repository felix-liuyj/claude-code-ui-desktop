import { useEffect, useRef, useState } from 'react';

export function useWebSocket() {
    const [ws, setWs] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (ws) {
                ws.close();
            }
        };
    }, []);

    const connect = async () => {
        try {
            // Get authentication token
            const token = localStorage.getItem('auth-token');
            if (!token) {
                console.warn('No authentication token found for WebSocket connection');
                return;
            }

            // Determine WebSocket URL based on environment
            let wsBaseUrl;

            // In Electron, always connect to localhost:3001
            if (typeof window !== 'undefined' && window.electronAPI) {
                wsBaseUrl = 'ws://localhost:3001';
            } else {
                // In web mode, fetch server configuration
                try {
                    const baseUrl = window.location.protocol === 'https:' ?
                        `https://${ window.location.host }` :
                        `http://${ window.location.host }`;

                    const configResponse = await fetch(`${ baseUrl }/api/config`, {
                        headers: {
                            'Authorization': `Bearer ${ token }`
                        }
                    });
                    const config = await configResponse.json();
                    wsBaseUrl = config.wsUrl;

                    // If the config returns localhost but we're not on localhost, use current host
                    if (wsBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
                        console.warn('Config returned localhost, using current host with API server port instead');
                        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                        const apiPort = window.location.port === '5173' ? '3001' : window.location.port;
                        wsBaseUrl = `${ protocol }//${ window.location.hostname }:${ apiPort }`;
                    }
                } catch (error) {
                    console.warn('Could not fetch server config, falling back to current host');
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const apiPort = window.location.port === '5173' ? '3001' : window.location.port;
                    wsBaseUrl = `${ protocol }//${ window.location.hostname }:${ apiPort }`;
                }
            }

            // Include token in WebSocket URL as query parameter
            const wsUrl = `${ wsBaseUrl }/ws?token=${ encodeURIComponent(token) }`;
            console.log('Connecting to WebSocket:', wsUrl);
            const websocket = new WebSocket(wsUrl);

            websocket.onopen = () => {
                setIsConnected(true);
                setWs(websocket);
            };

            websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setMessages(prev => [...prev, data]);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            websocket.onclose = () => {
                setIsConnected(false);
                setWs(null);

                // Attempt to reconnect after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, 3000);
            };

            websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
        }
    };

    const sendMessage = (message) => {
        if (ws && isConnected) {
            ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected');
        }
    };

    return {
        ws,
        sendMessage,
        messages,
        isConnected
    };
}