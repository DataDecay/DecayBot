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
        this.sessions = {};
        
        const userconfig = require("../config/users.json");
        config.util.extendDeep(config, userconfig); 
        this.users = config.get('users'); 

        this.sessionTimeout = 1000 * 60 * 60; 
        this.cleanupInterval = 1000 * 60 * 10; 
    }
    
    start() {
        if (this.isRunning) {
            console.warn(`WebServer already running on port ${this.port}`);
            return;
        }

        // SSL setup
        if (config.get("webServer.ssl")) {
            this.httpOptions = {
                key: fs.readFileSync("keys/privkey.pem"),
                cert: fs.readFileSync("keys/fullchain.pem")
            };
            console.log("SSL enabled");
            this.server = https.createServer(this.httpOptions, this.handler.bind(this));
        } else {
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
                if(global.v){
                console.log("Unauthorized socket connection attempt.");
            }
                socket.emit('error', 'Unauthorized. Please log in.');
                //socket.disconnect(true);
                return;
            }

            this.handleSocketConnection(socket, token);
        });

        // Start session cleanup
        setInterval(this.cleanupSessions.bind(this), this.cleanupInterval);
    }
    uuidToName(uuid, bot) {
  for (const username in bot.players) {
    const player = bot.players[username];
    if (player && player.uuid === uuid) {
      return player.username;
    }
  }

  return null;
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
                    const expiresAt = Date.now() + this.sessionTimeout;

                    this.sessions[token] = { username, level: user.level, expiresAt };
                    if(global.v){
                    console.log(`User "${username}" logged in. Level: ${user.level}`);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ token }));
                } else {
                    console.log(`Failed login for user "${username}"`);
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid credentials' }));
                }
            });
        }  else if (req.method === 'POST' && req.url === '/signup') {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        const parsed = querystring.parse(body);
        const username = parsed.username;
        const password = parsed.password;

        const user = this.users[username];

        if (!user) {
            const newUser = { password: password, level: 1 };

            this.users[username] = newUser;

            const usersFilePath = path.join(__dirname, 'config', 'users.json');
            const token = crypto.randomBytes(16).toString('hex');
            const expiresAt = Date.now() + this.sessionTimeout;
            this.sessions[token] = { username, level: 1, expiresAt };

            fs.readFile(usersFilePath, 'utf8', (err, data) => {
                if (err) {
                    console.error('Error reading users.json:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Internal server error' }));
                }

                let usersObj;
                try {
                    usersObj = JSON.parse(data);
                } catch (parseErr) {
                    console.error('Error parsing users.json:', parseErr);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Internal server error' }));
                }

                usersObj.users[username] = newUser;

                fs.writeFile(usersFilePath, JSON.stringify(usersObj, null, 4), 'utf8', (writeErr) => {
                    if (writeErr) {
                        console.error('Error writing to users.json:', writeErr);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Internal server error' }));
                    }

                    if(global.v){
                    console.log(`New user "${username}" registered.`);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ token }));
                });
            });
        } else {
            if (global.v){
            console.log(`Failed signup for user "${username}"`);
            }
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'User exists' }));
        }
    });
        } else if (req.method === 'POST' && req.url === '/logout') {
            const token = req.headers['authorization'];

            if (token && this.sessions[token]) {
                delete this.sessions[token];
                if (global.v){
                console.log(`User with token "${token}" logged out.`);}
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
            }
        } else {
            let pathname = req.url.split('?')[0];
            if (pathname === '/') pathname = '/index.html';

            const filePath = path.join(__dirname, '..', 'public', pathname);

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
        if (global.v){

        console.log(`Socket connection from ${username} (Level ${level})`);

        }
        const hashLevels = config.get('hashLevels');

        const visibleRoles = {};
        Object.keys(hashLevels).forEach(roleKey => {
            const role = hashLevels[roleKey];

            if (role.visible && role.requiredLevel <= level) {
                visibleRoles[roleKey] = role;
            }
        });
        const visibleUsers = {};
        Object.keys(this.users).forEach(roleKey => {
            const role = this.users[roleKey];
            /*console.log("--ROLE??--");
            console.log(roleKey);
            console.log(role.level);
            console.log("--USER--");
            console.log(level);
            console.log("==NEXT==");*/
            if (role.level < level) {
                visibleUsers[roleKey] = role;
            }
        });

        socket.emit('roles', visibleRoles);
        socket.emit('users', visibleUsers);
        socket.on('disconnect', () => {
            if (global.v){

    console.log(`${username} disconnected.`);
            }
    this.bot.removeListener('message', messageHandler);
});

        const messageHandler = (message, pos, sender) => {
            console.log(`MESSAGE: [${pos}] ${sender}: ${message.toString()}`);
            if (pos=="chat"){
                socket.emit('msg', `${this.uuidToName(sender, this.bot)}: ${message.toString()}`);

            } else {
                socket.emit('msg', `[${pos}]: ${message.toString()}`);
            }
        };

        this.bot.on('message', messageHandler);


        socket.on('generateHash', (roleKey) => {
            const roleConfig = hashLevels[roleKey];

            if (!roleConfig) {
                socket.emit('error', `Role "${roleKey}" not found.`);
                return;
            }

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
            //this.bot.chat(msg);
            
            const token = socket.handshake.query.token;
            if(!token || !this.sessions[token]){
                socket.emit('msg', `Sorry, you need to be logged in to send messages.`);
                if (global.v){

                console.log(`Received message: ${msg}, not logged in`);
                }
            } else {
                const username = this.sessions[token].username;
                this.bot.core.run(`/tellraw @p [{"text":"${username} "},{"text":" [DecayBot Webchat] ","color":"dark_red","bold":true,"underlined":false,"hoverEvent":{"action":"show_text","value":[{"text":"Open DecayBot Webchat","color":"blue","bold":true,"italic":true}]},"clickEvent":{"action":"open_url","value":"https://datadecay.dev/"}},{"text":": ${msg}","hoverEvent":{"action":"show_text","value":[{"text":"","color":"blue","bold":true,"italic":true}]}}]`);
                if (global.v){

                console.log(`Received message: ${msg}, from ${username}`);
                }
            }
            
        });
        socket.on('console_command', (msg) => {
            //this.bot.chat(msg);
            this.client = this.bot._client;
            const token = socket.handshake.query.token;
            if(!token || !this.sessions[token]){
                socket.emit('msg', `Sorry, you need to be logged in to use the terminal.`);
                if (global.v){

                console.log(`Received term: ${msg.command} & denied due to login issue`);
                }
            } else {
                const {username, level} = this.sessions[token];
                if (level < 3){
                socket.emit('msg', `Sorry ${username}, your access level, ${level}, is too low to use the terminal. Please ask an admin to grant you a higher trust level to use this if you need to.`);
                if (global.v){

                console.log(`Received term: ${msg.command} & denied due to low level`);
                }
                } else {
                    if (msg.chat){
                this.client.chat(`/${msg.command}`);
                    } else {
                        this.bot.core.run(msg.command);
                    }
            }
            }
        });
    socket.on('deleteuser', (targetUser) => {
        if (!targetUser) return socket.emit('error', 'No user specified.');

        if (!this.users[targetUser]) {
            socket.emit('error', `User "${targetUser}" does not exist.`);
            return;
        }
        if (this.users[targetUser].level >= level || level <= 2) {
            socket.emit('error', 'You do not have permission to delete this user.');
            return;
        }

        delete this.users[targetUser];

        const usersFilePath = path.join(__dirname, '..', 'config', 'users.json');
        fs.readFile(usersFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading users.json:', err);
                socket.emit('error', 'Internal server error.');
                return;
            }

            let usersObj;
            try {
                usersObj = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing users.json:', parseErr);
                socket.emit('error', 'Internal server error.');
                return;
            }

            delete usersObj.users[targetUser];

            fs.writeFile(usersFilePath, JSON.stringify(usersObj, null, 4), 'utf8', (writeErr) => {
                if (writeErr) {
                    console.error('Error writing users.json:', writeErr);
                    socket.emit('error', 'Internal server error.');
                    return;
                }

                console.log(`User "${targetUser}" deleted by "${username}"`);
                socket.emit('users', this.filterVisibleUsers(level));
            });
        });
    });

    socket.on('passwordchange', ({ username: targetUser, password: newPassword }) => {
        if (!targetUser || !newPassword) {
            socket.emit('error', 'Missing user or password.');
            return;
        }

        if (!this.users[targetUser]) {
            socket.emit('error', `User "${targetUser}" does not exist.`);
            return;
        }

        if (this.users[targetUser].level >= level || level <= 2) {
            socket.emit('error', 'You do not have permission to change password for this user.');
            return;
        }

        this.users[targetUser].password = newPassword;

        const usersFilePath = path.join(__dirname, 'config', 'users.json');
        fs.readFile(usersFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading users.json:', err);
                socket.emit('error', 'Internal server error.');
                return;
            }

            let usersObj;
            try {
                usersObj = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing users.json:', parseErr);
                socket.emit('error', 'Internal server error.');
                return;
            }

            usersObj.users[targetUser].password = newPassword;

            fs.writeFile(usersFilePath, JSON.stringify(usersObj, null, 4), 'utf8', (writeErr) => {
                if (writeErr) {
                    console.error('Error writing users.json:', writeErr);
                    socket.emit('error', 'Internal server error.');
                    return;
                }
                if (global.v){

                console.log(`Password for user "${targetUser}" changed by "${username}"`);
                }
                socket.emit('users', this.filterVisibleUsers(level));
            });
        });
    });

    socket.on('levelchange', ({ username: targetUser, level: newLevel }) => {
        if (!targetUser || newLevel === undefined) {
            socket.emit('error', 'Missing user or level.');
            return;
        }

        newLevel = parseInt(newLevel);
        if (isNaN(newLevel)) {
            socket.emit('error', 'Invalid level.');
            return;
        }

        if (!this.users[targetUser]) {
            socket.emit('error', `User "${targetUser}" does not exist.`);
            return;
        }

        if (this.users[targetUser].level >= level || level <= 2) {
            socket.emit('error', 'You do not have permission to change this user\'s level.');
            return;
        }

        if (newLevel >= level) {
            socket.emit('error', 'Cannot set user level equal to or higher than your own.');
            return;
        }

        this.users[targetUser].level = newLevel;

        const usersFilePath = path.join(__dirname, 'config', 'users.json');
        fs.readFile(usersFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading users.json:', err);
                socket.emit('error', 'Internal server error.');
                return;
            }

            let usersObj;
            try {
                usersObj = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing users.json:', parseErr);
                socket.emit('error', 'Internal server error.');
                return;
            }

            usersObj.users[targetUser].level = newLevel;

            fs.writeFile(usersFilePath, JSON.stringify(usersObj, null, 4), 'utf8', (writeErr) => {
                if (writeErr) {
                    console.error('Error writing users.json:', writeErr);
                    socket.emit('error', 'Internal server error.');
                    return;
                }
                if (global.v){

                console.log(`Level for user "${targetUser}" changed to ${newLevel} by "${username}"`);
                }
                socket.emit('users', this.filterVisibleUsers(level));
            });
        });
    });

    }

    cleanupSessions() {
        const now = Date.now();
        for (const token in this.sessions) {
            if (this.sessions[token].expiresAt < now) {
                if (global.v){

                console.log(`Session expired for user ${this.sessions[token].username}`);
                }
                delete this.sessions[token];
            }
        }
    }
    filterVisibleUsers(level) {
    const visibleUsers = {};
    Object.keys(this.users).forEach(userKey => {
        const user = this.users[userKey];
        if (user.level < level) {
            visibleUsers[userKey] = user;
        }
    });
    return visibleUsers;
}

}

module.exports = WebServer;
