const mineflayer = require('mineflayer');
const CommandCore = require('./commandCore.js');
const HashUtilsLib = require('./hashUtils.js');
const WebServer = require('./webServer.js');
const CommandParser = require('./commandParser.js');
const config = require('config');
const fs = require('fs');
const path = require('path');

class Bot {
    constructor() {
        this.bot = null;
        this.HashUtils = new HashUtilsLib();
        this.reconnectDelay = 5000;
        this.flagPath = path.join(__dirname, 'flag.json');
        this.teleportCoordinates = config.get("connection.core");
    }

    generateRandomizedName() {
        const baseName = config.get("connection.botName");
        return baseName.replace(/#/g, () => {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            return chars.charAt(Math.floor(Math.random() * chars.length));
        });
    }

    start() {
        this.createBotInstance();
        this.setupAutoRestart();
    }

    createBotInstance() {
        // Always use the configured name, with any '#' characters replaced with random alphanumeric characters
        const botName = this.generateRandomizedName();
        console.log(`Using bot name: ${botName}`);
        
        this.bot = mineflayer.createBot({
            host: config.get("connection.serverName"),
            username: botName,
            auth: 'offline',
            version: ''
        });

        this.client = this.bot._client;

        this.bot.on('spawn', () => {
            this.bot.chatAddPattern(/db:(\S+) ?(.+)?/, "command", "Command Sent");
            const io = new WebServer(config.get("webServer.port"), this.bot, this.HashUtils);
            io.start();
            this.bot.creative.startFlying();
            
            // Use coordinates from config for teleport
            try {
                this.client.chat(`/tp ${botName} ${this.teleportCoordinates.x} ${this.teleportCoordinates.y} ${this.teleportCoordinates.z}`);
            } catch {
                this.client = this.bot._client;
                this.client.chat(`/tp ${botName} ${this.teleportCoordinates.x} ${this.teleportCoordinates.y} ${this.teleportCoordinates.z}`);
            }
            this.client.chat(`/vanish ${botName} true`);
            this.client.chat(`/gamemode creative`);
            // Use same coordinates for core setup
            const coreStartPos = { 
                x: this.teleportCoordinates.x, 
                y: this.teleportCoordinates.y - 1, // Core is 1 block below spawn
                z: this.teleportCoordinates.z 
            };
            const coreEndPos = { 
                x: this.teleportCoordinates.x + 10, 
                y: this.teleportCoordinates.y - 3, // Core extends down
                z: this.teleportCoordinates.z + 10 
            };
            
            this.bot.core = new CommandCore(coreStartPos, coreEndPos, this.bot);
            this.commandParser = new CommandParser(this.bot, this.HashUtils);
            setTimeout(() => {
                this.bot.core.refillCore(coreStartPos, coreEndPos, this.bot);
            }, 1000);

            this.bot.on('command', async (command, argsraw) => {
                console.log(command + ", " + argsraw);
                if (command === "help") {
                    this.commandParser.showHelp(argsraw);
                } else {
                    await this.commandParser.handleCommand(command, argsraw ? argsraw.split(" ") : []);
                }
            });

            // Use stored coordinates on death
            this.bot.on('death', () => {
                this.client.chat(`/tp ${botName} ${this.teleportCoordinates.x} ${this.teleportCoordinates.y} ${this.teleportCoordinates.z}`);
                this.client.chat("/gamemode creative");
                this.client.chat(`/vanish ${botName} true`);
            });
        });

        this.bot.on('error', (errrrr) => {
            console.log(errrrr);
            this.updateFlag('restart', true);
            this.reconnect();
        });

        this.bot.on('end', () => {
            console.log('Bot disconnected');
            this.updateFlag('restart', true);
            this.reconnect();
        });
    }

    reconnect() {
        console.log(`Reconnecting...`);
        setTimeout(() => {
            this.start();
        }, this.reconnectDelay);
    }

    updateFlag(key, value) {
        fs.readFile(this.flagPath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading flag.json:', err);
                return;
            }
            
            let flags;
            try {
                flags = JSON.parse(data);
            } catch (e) {
                return;
            }
            flags[key] = value;
            flags.last = new Date().toISOString();
            fs.writeFile(this.flagPath, JSON.stringify(flags, null, 2), (err) => {
                if (err) console.error('Error writing flag.json:', err);
            });
        });
    }

    setupAutoRestart() {
        const fiveHoursInMs = 5 * 60 * 60 * 1000;
    
        if (this.autoRestartInterval) return;
    
        this.autoRestartInterval = setInterval(() => {
            const currentTime = new Date();
    
            fs.readFile(this.flagPath, 'utf8', (err, data) => {
                if (err) return;
    
                let flags;
                try {
                    flags = JSON.parse(data);
                } catch (e) {
                    return;
                }
    
                if (flags.last) {
                    const last = new Date(flags.last);
                    if (currentTime - last >= fiveHoursInMs) {
                        this.updateFlag('restart', true);
                    }
                }
            });
        }, 60 * 1000);
    }


    say(text, colour = "white") {
        if (this.bot && this.bot.core) {
            this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
        }
    }
}

module.exports = Bot;
