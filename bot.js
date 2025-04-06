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
    }

    start() {
        this.createBotInstance();
        this.setupAutoRestart();
    }

    createBotInstance() {
        this.bot = mineflayer.createBot({
            host: config.get("connection.serverName"),
            username: config.get("connection.botName"),
            auth: 'offline',
            version: '',
            port: config.get("connection.port"),
        });

        this.client = this.bot._client;

        this.bot.on('spawn', () => {
            this.bot.chatAddPattern(/db:(\S+) ?(.+)?/, "command", "Command Sent");
            const io = new WebServer(config.get("webServer.port"), this.bot, this.HashUtils);
            io.start();
            this.bot.creative.startFlying();
            try {
                this.client.chat("/tp " + config.get("connection.botName") + " 6000 -49 6000");
            } catch {
                this.client = this.bot._client;
                this.client.chat("/tp " + config.get("connection.botName") + " 6000 -49 6000");
            }

            this.bot.core = new CommandCore({ x: 6000, y: -50, z: 6000 }, { x: 6010, y: -52, z: 6010 }, this.bot);
            this.commandParser = new CommandParser(this.bot, this.HashUtils);
            setTimeout(() => {
                this.bot.core.refillCore({ x: 6000, y: -50, z: 6000 }, { x: 6010, y: -52, z: 6010 }, this.bot);
            }, 1000);

            this.bot.on('command', async (command, argsraw) => {
                console.log(command + ", " + argsraw);
                if (command === "help") {
                    this.commandParser.showHelp(argsraw);
                } else {
                    await this.commandParser.handleCommand(command, argsraw ? argsraw.split(" ") : []);
                }
            });

            this.bot.on('death', () => {
                this.client.chat("/tp " + config.get("connection.botName") + " 6000 -49 6000");
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

            const flags = JSON.parse(data);
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
