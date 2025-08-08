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
            // Electron desktop app - use configured port or default to 3001
            const port = window.electronAPI?.getConfig?.()?.PORT || '3001';
            const wsUrl = `ws://localhost:${port}/ws`;
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

                // Attempt to reconnect after configured delay
                const reconnectDelay = window.electronAPI?.getConfig?.()?.WS_RECONNECT_DELAY || 3000;
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, reconnectDelay);
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