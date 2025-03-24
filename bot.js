const mineflayer = require('mineflayer');
const CommandCore = require('./commandCore.js');
const HashUtilsLib = require('./hashUtils.js');
const WebServer = require('./webServer.js');
const CommandParser = require('./commandParser.js');
const config = require('config');

class Bot {
    constructor() {
        this.bot = null;
        this.HashUtils = new HashUtilsLib();
        this.reconnectDelay = 5000; // yeh this delay sucks
    }

    start() {
        this.createBotInstance();
    }

    createBotInstance() {
        this.bot = mineflayer.createBot({
            host: config.get("connection.serverName"),
            username: config.get("connection.botName"),
            auth: 'offline',
            version: ''
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
            setTimeout(()=>{
            this.bot.core.refillCore({ x: 6000, y: -50, z: 6000 }, { x: 6010, y: -52, z: 6010 }, this.bot);
            }, 1000);
            this.bot.on('command', async (command, argsraw) => {
                
                console.log(command + ", " + argsraw);
                if (command === "help") {
                    this.commandParser.showHelp(argsraw);  //todo combine
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
            this.reconnect();
        });

        this.bot.on('end', () => {
            this.reconnect();
        });
    }

    reconnect() {
        console.log(`Reconnecting`);
        setTimeout(() => {
            this.start();
        }, this.reconnectDelay);
    }

    say(text, colour = "white") {
        if (this.bot && this.bot.core) {
            this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
        }
    }
}

module.exports = Bot;
