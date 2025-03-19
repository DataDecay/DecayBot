const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');
const HashUtilsLib = require('./hashUtils.js');
const config = require('config');

class WebServer {

    constructor(port, bot, hashlib) {
        this.port = port;
        this.bot = bot;
        this.HashUtils = hashlib;
    }

    start() {
        const server = http.createServer(this.handler.bind(this));
        const io = socketIO(server);

        server.listen(this.port, () => {
            console.log(`Server running on port ${this.port}`);
        });

        io.on('connection', (socket) => {
            this.handleSocketConnection(socket);
        });
    }

    // Serve files, strip query strings and handle MIME types
    handler(req, res) {
        let pathname = req.url.split('?')[0]; // Remove query string
        if (pathname === '/') pathname = '/index.html'; // Default page

        const filePath = pathname;

        fs.readFile(filePath, (err, data) => {
            if (err) {
                // If file not found, fallback to index.html (SPA style)
                fs.readFile(__dirname + '/public' + pathname, (error, fallbackData) => {
                    if (error) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        return res.end("404 Not Found");
                    }

                    res.writeHead(200, { 'Content-Type': this.getMimeType('index.html') });
                    res.end(fallbackData);
                });
                return;
            }

            res.writeHead(200, { 'Content-Type': this.getMimeType(filePath) });
            res.end(data);
        });
    }

    // Simple MIME type detection
    getMimeType(filePath) {
        const ext = path.extname(filePath).slice(1); // Get file extension without the dot
        const mimeTypes = {
            'html': 'text/html',
            'js': 'application/javascript',
            'css': 'text/css',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon'
        };
        return mimeTypes[ext] || 'application/octet-stream'; // Default to binary stream
    }

    
    handleSocketConnection(socket) {
    const hashLevels = config.get('hashLevels');  // Fetch hashLevels from config

    // Send list of roles to the frontend
    socket.emit('roles', Object.keys(hashLevels));  // Send just the role keys

    // Listen for role requests to generate hashes
    socket.on('generateHash', (roleKey) => {
        const roleConfig = hashLevels[roleKey];  // Get role configuration from hashLevels

        if (roleConfig) {
            let hash;
            // Generate hash based on role key
            
                    hash = this.HashUtils.generateOwner(roleConfig.prefix);
            }

            // Send the generated hash back to the frontend along with the role key
            socket.emit('gen', {
                hash: hash
            });
        } else {
            socket.emit('error', `Role "${roleKey}" not found.`);
        }
    });
}
}

module.exports = WebServer;
