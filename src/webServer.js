const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');
const config = require('config');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');

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

        // Initialize Express app
        this.app = express();
        this.setupExpressMiddleware();
        this.setupRoutes();
    }
    
    setupExpressMiddleware() {
        // Static file serving
        this.app.use(express.static(path.join(__dirname, '..', 'public')));
        
        // Request parsing middleware
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(bodyParser.json());
        this.app.use(cookieParser());
        
        // Session middleware (not used directly, but keeping for future expansion)
        this.app.use(session({
            secret: crypto.randomBytes(16).toString('hex'),
            resave: false,
            saveUninitialized: false,
            cookie: { secure: config.get("webServer.ssl"), maxAge: this.sessionTimeout }
        }));
    }
    
    setupRoutes() {
        // Login route
        this.app.post('/login', (req, res) => {
            const username = req.body.username;
            const password = req.body.password;

            const user = this.users[username];

            if (user) {
                let authenticated = false;
                
                if (user.hash && user.salt) {
                    // Verify with hash and salt
                    authenticated = this.HashUtils.verifyPassword(password, user.hash, user.salt);
                } else if (user.password) {
                    // Legacy password check (plain text)
                    authenticated = user.password === password;
                    
                    // Upgrade to hashed password if using legacy
                    if (authenticated) {
                        const hashedData = this.HashUtils.hashPassword(password);
                        user.hash = hashedData.hash;
                        user.salt = hashedData.salt;
                        delete user.password; // Remove plaintext password
                        
                        // Save the updated user data
                        this.saveUsers();
                        
                        if (global.v) {
                            console.log(`Upgraded password for user "${username}" to bcrypt hash`);
                        }
                    }
                }

                if (authenticated) {
                    const token = crypto.randomBytes(16).toString('hex');
                    const expiresAt = Date.now() + this.sessionTimeout;

                    this.sessions[token] = { username, level: user.level, expiresAt };
                    if(global.v){
                        console.log(`User "${username}" logged in. Level: ${user.level}`);
                    }
                    res.status(200).json({ token });
                } else {
                    console.log(`Failed login for user "${username}"`);
                    res.status(401).json({ error: 'Invalid credentials' });
                }
            } else {
                console.log(`Failed login for user "${username}"`);
                res.status(401).json({ error: 'Invalid credentials' });
            }
        });
        
        // Signup route
        this.app.post('/signup', (req, res) => {
            const username = req.body.username;
            const password = req.body.password;

            const user = this.users[username];

            if (!user) {
                // Hash the password with bcrypt
                const hashedData = this.HashUtils.hashPassword(password);
                
                const newUser = { 
                    level: 1,
                    hash: hashedData.hash,
                    salt: hashedData.salt
                };

                this.users[username] = newUser;

                const usersFilePath = path.join(__dirname, '..', 'config', 'users.json');
                const token = crypto.randomBytes(16).toString('hex');
                const expiresAt = Date.now() + this.sessionTimeout;
                this.sessions[token] = { username, level: 1, expiresAt };

                fs.readFile(usersFilePath, 'utf8', (err, data) => {
                    if (err) {
                        console.error('Error reading users.json:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    let usersObj;
                    try {
                        usersObj = JSON.parse(data);
                    } catch (parseErr) {
                        console.error('Error parsing users.json:', parseErr);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    usersObj.users[username] = newUser;

                    fs.writeFile(usersFilePath, JSON.stringify(usersObj, null, 4), 'utf8', (writeErr) => {
                        if (writeErr) {
                            console.error('Error writing to users.json:', writeErr);
                            return res.status(500).json({ error: 'Internal server error' });
                        }

                        if(global.v){
                            console.log(`New user "${username}" registered with bcrypt hash.`);
                        }
                        res.status(200).json({ token });
                    });
                });
            } else {
                if (global.v){
                    console.log(`Failed signup for user "${username}"`);
                }
                res.status(401).json({ error: 'User exists' });
            }
        });
        
        // Logout route
        this.app.post('/logout', (req, res) => {
            const token = req.headers['authorization'];

            if (token && this.sessions[token]) {
                delete this.sessions[token];
                if (global.v){
                    console.log(`User with token "${token}" logged out.`);
                }
                res.status(200).json({ success: true });
            } else {
                res.status(401).json({ error: 'Unauthorized' });
            }
        });
        
        // Fallback route for serving index.html
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
        });
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
            this.server = https.createServer(this.httpOptions, this.app);
        } else {
            this.server = http.createServer(this.app);
        }

        this.io = socketIO(this.server);

        this.server.listen(this.port, () => {
            console.log(`Express server running on port ${this.port}`);
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
            console.log(`Express server on port ${this.port} stopped.`);
            this.isRunning = false;
        });
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

        // Hash the new password with bcrypt
        const hashedData = this.HashUtils.hashPassword(newPassword);
        
        // Update user with hashed password
        this.users[targetUser].hash = hashedData.hash;
        this.users[targetUser].salt = hashedData.salt;
        
        // Remove plaintext password if it exists
        if (this.users[targetUser].password) {
            delete this.users[targetUser].password;
        }

        // Save the updated user data
        if (this.saveUsers()) {
            if (global.v) {
                console.log(`Password for user "${targetUser}" changed by "${username}" (using bcrypt)`);
            }
            socket.emit('users', this.filterVisibleUsers(level));
        } else {
            socket.emit('error', 'Error saving password changes.');
        }
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

        // Save changes using the saveUsers method
        if (this.saveUsers()) {
            if (global.v) {
                console.log(`Level for user "${targetUser}" changed to ${newLevel} by "${username}"`);
            }
            socket.emit('users', this.filterVisibleUsers(level));
        } else {
            socket.emit('error', 'Error saving level changes.');
        }
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

    saveUsers() {
        const usersFilePath = path.join(__dirname, '..', 'config', 'users.json');
        try {
            const usersObj = { users: this.users };
            fs.writeFileSync(usersFilePath, JSON.stringify(usersObj, null, 4), 'utf8');
            return true;
        } catch (err) {
            console.error('Error saving users.json:', err);
            return false;
        }
    }
}

module.exports = WebServer;
