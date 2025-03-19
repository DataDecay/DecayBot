const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');
const config = require('config');
const crypto = require('crypto');
const querystring = require('querystring');

class WebServer {
    constructor(port, bot, hashlib) {
        this.port = port;
        this.bot = bot;
        this.HashUtils = hashlib;
        this.server = null;
        this.io = null;
        this.isRunning = false;
        this.sessions = {}; // Session token -> { username, level }

        // Users should be stored in a database, but hardcoded here for demo
        this.users = {
            'admin': { password: 'adminpass', level: 3 },
            'moderator': { password: 'modpass', level: 2 },
            'user': { password: 'userpass', level: 1 }
        };
    }

    start() {
        if (this.isRunning) {
            console.warn(`WebServer already running on port ${this.port}`);
            return;
        }

        if (config.get("webServer.ssl")) {
            this.httpOptions = {
                key: fs.readFileSync("keys/privkey.pem"),
                cert: fs.readFileSync("keys/fullchain.pem")
            };
            console.log("SSL enabled");
            this.server = https.createServer(this.httpOptions, this.handler.bind(this));
        } else {
            console.log("SSL disabled");
            this.server = http.createServer(this.handler.bind(this));
        }

        this.io = socketIO(this.server);

        this.server.listen(this.port, () => {
            console.log(`Server running on port ${this.port}`);
            this.isRunning = true;
        });

        this.io.on('connection', (socket) => {
            const token = socket.handshake.query.token;

            if (!token || !this.sessions[token]) {
                console.log("Unauthorized socket connection attempt.");
                socket.emit('error', 'Unauthorized. Please log in.');
                socket.disconnect(true);
                return;
            }

            this.handleSocketConnection(socket, token);
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

    handler(req, res) {
        if (req.method === 'POST' && req.url === '/login') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                const parsed = querystring.parse(body);
                const username = parsed.username;
                const password = parsed.password;

                const user = this.users[username];

                if (user && user.password === password) {
                    const token = crypto.randomBytes(16).toString('hex');
                    this.sessions[token] = { username, level: user.level };

                    console.log(`User "${username}" logged in. Level: ${user.level}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ token }));
                } else {
                    console.log(`Failed login for user "${username}"`);
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid credentials' }));
                }
            });
        } else {
            let pathname = req.url.split('?')[0];
            if (pathname === '/') pathname = '/index.html';

            const filePath = path.join(__dirname, 'public', pathname);

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    return res.end("404 Not Found");
                }

                res.writeHead(200, { 'Content-Type': this.getMimeType(filePath) });
                res.end(data);
            });
        }
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

    handleSocketConnection(socket, sessionToken) {
        const session = this.sessions[sessionToken];

        if (!session) {
            socket.emit('error', 'Unauthorized access. Please log in again.');
            socket.disconnect(true);
            return;
        }

        const { username, level } = session;
        console.log(`Socket connection from ${username} (Level ${level})`);

        const hashLevels = config.get('hashLevels');

        // Show roles at user's level or lower
        const visibleRoles = {};
        Object.keys(hashLevels).forEach(roleKey => {
            const role = hashLevels[roleKey];

            if (role.visible && role.requiredLevel <= level) {
                visibleRoles[roleKey] = role;
            }
        });

        socket.emit('roles', visibleRoles);

        const messageHandler = (message, pos, sender) => {
            console.log(`MESSAGE: [${pos}] ${sender}: ${message.toString()}`);
            socket.emit('msg', `[${pos}] ${sender}: ${message.toString()}`);
        };

        this.bot.on('message', messageHandler);

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id} (${username})`);
            this.bot.removeListener('message', messageHandler);
            delete this.sessions[sessionToken];
        });

        socket.on('generateHash', (roleKey) => {
            const roleConfig = hashLevels[roleKey];

            if (!roleConfig) {
                socket.emit('error', `Role "${roleKey}" not found.`);
                return;
            }

            // User can generate for their level or lower
            if (level < roleConfig.requiredLevel) {
                socket.emit('error', `You do not have permission to generate hash for "${roleKey}". Your level: ${level}, required: ${roleConfig.requiredLevel}`);
                console.warn(`Unauthorized hash attempt by ${username} for ${roleKey}`);
                return;
            }

            const hash = this.HashUtils.generateOwner(roleConfig.prefix);

            socket.emit('gen', {
                roleKey: roleKey,
                roleConfig: roleConfig,
                hash: hash
            });

            console.log(`Hash generated by ${username} for ${roleKey}`);
        });

        socket.on('send', (msg) => {
            this.bot.chat(msg);
        });
    }
}

module.exports = WebServer;
