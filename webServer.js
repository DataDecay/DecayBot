const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');
const config = require('config');

class WebServer {
    constructor(port, bot, hashlib) {
        this.port = port;
        this.bot = bot;
        this.HashUtils = hashlib;
        this.server = null; // Track server instance
        this.io = null;     // Track socket instance
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) {
            console.warn(`WebServer already running on port ${this.port}`);
            return;
        }
        if (config.get("webServer.ssl")){
        this.httpOptions = {
 
 key: fs.readFileSync("keys/fullchain.pem"),
 
 cert: fs.readFileSync("keys/privkey.pem")
}
        console.log("SSL on");
        this.server = http.createServer(this.httpOptions, this.handler.bind(this));
        } else {
        this.server = http.createServer(this.handler.bind(this));
            console.log("SSL off");
        }
        this.io = socketIO(this.server);

        this.server.listen(this.port, () => {
            console.log(`Server running on port ${this.port}`);
            this.isRunning = true;
        });

        this.io.on('connection', (socket) => {
            this.handleSocketConnection(socket);
        });

        console.error("STARTED");
    }

    stop() {
        if (!this.isRunning) {
            console.warn(`WebServer is not running!`);
            return;
        }

        this.io.close(() => {
            console.log('Socket.IO server closed.');
        });

        this.server.close(() => {
            console.log(`Server on port ${this.port} stopped.`);
            this.isRunning = false;
        });
    }

    // Serve files, strip query strings and handle MIME types
    handler(req, res) {
        let pathname = req.url.split('?')[0]; // Remove query string
        if (pathname === '/') pathname = '/index.html'; // Default page

        const filePath = pathname;

        fs.readFile(filePath, (err, data) => {
            if (err) {
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

    getMimeType(filePath) {
        const ext = path.extname(filePath).slice(1);
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
        return mimeTypes[ext] || 'application/octet-stream';
    }

    handleSocketConnection(socket) {
        const hashLevels = config.get('hashLevels');

        const visibleRoles = {};
        Object.keys(hashLevels).forEach(roleKey => {
            if (hashLevels[roleKey].visible) {
                visibleRoles[roleKey] = hashLevels[roleKey];
            }
        });

        socket.emit('roles', visibleRoles);

        // Avoid multiple listeners!
        const messageHandler = (message, pos, sender) => {
            console.log(`MESSAGE: [${pos}] ${sender}: ${message.toString()}`);
            socket.emit('msg', `[${pos}] ${sender}: ${message.toString()}`);
        };

        this.bot.on('message', messageHandler);

        socket.on('disconnect', () => {
            console.log('Socket disconnected, removing listener.');
            this.bot.removeListener('message', messageHandler);
        });

        socket.on('generateHash', (roleKey) => {
            const roleConfig = hashLevels[roleKey];

            if (roleConfig) {
                const hash = this.HashUtils.generateOwner(roleConfig.prefix);

                socket.emit('gen', {
                    roleKey: roleKey,
                    roleConfig: roleConfig,
                    hash: hash
                });
            } else {
                socket.emit('error', `Role "${roleKey}" not found.`);
            }
        });

        socket.on('send', (msg) => {
            this.bot.chat(msg);
        });
    }
}

module.exports = WebServer;
