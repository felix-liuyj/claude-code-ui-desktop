const net = require('net');

/**
 * Find an available port in the specified range
 * @param {number} startPort - Starting port number (default: 30000)
 * @param {number} endPort - Ending port number (default: 39999)
 * @returns {Promise<number>} Available port number
 */
async function findAvailablePort(startPort = 30000, endPort = 39999) {
    for (let port = startPort; port <= endPort; port++) {
        const isAvailable = await checkPort(port);
        if (isAvailable) {
            return port;
        }
    }
    throw new Error(`No available port found in range ${startPort}-${endPort}`);
}

/**
 * Check if a specific port is available
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if port is available
 */
function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });
        
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        
        server.listen(port, '127.0.0.1');
    });
}

module.exports = { findAvailablePort, checkPort };