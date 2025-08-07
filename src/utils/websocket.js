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
            // Electron desktop app - always connect to localhost:3001
            const wsUrl = 'ws://localhost:3001/ws';
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