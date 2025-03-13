const mineflayer = require('mineflayer');
const CommandCore = require('./commandCore.js');
const HashUtils = require('./hashUtils.js');
const WebServer = require('./webServer.js');

class Bot {
    constructor() {
        this.bot = null;
    }

    start() {
        if (process.argv.length !== 7) {
            console.log('Usage : node index.js <hash-prefix-owner> <hash-prefix-trusted> <host> <port> <username>');
            process.exit(1);
        }

        this.bot = mineflayer.createBot({
            host: process.argv[4],
            username: process.argv[6],
            auth: 'offline'
        });

        let core;
        this.bot.on('spawn', () => {
            core = new CommandCore(this.bot.entity.position, { x: this.bot.entity.position.x + 16, y: this.bot.entity.position.y + 1, z: this.bot.entity.position.z + 16 }, this.bot);
            
            bot.chatAddPattern(
        /db:(\S+) ?(.+)?/,
        "command",
        "Command Sent"
    )

        const io = new WebServer(process.argv[5], this.bot);
        io.start();

        this.bot.on('command', (command, argsraw) => {
            handleCommand(command,argsraw)
        });
        this.bot.on('error', console.log);
        this.bot.on('kicked', () => {
            this.bot = mineflayer.createBot({
                host: process.argv[4],
                username: process.argv[6],
                auth: 'offline'
            });
        });
   

    handleCommand(command, argsraw) {
            if (argsraw){
        let args = argsraw.split(" ");
            }
        switch (command) {
            case 'help':
                this.handleHelp();
                break;
            case 'core':
                this.handleCore(args);
                break;
            case 'cloop':
                this.handleCloop(args);
                break;
            case 'stop':
                this.handleStop();
                break;
            default:
                this.handleUnknown();
                break;
        }
    }

    handleHelp() {
        core.run('tellraw @a [{"text":"hello, code, creator, ","color":"blue"},{"text":"cloop, stop-cloops, web-chat,","color":"green"},{"text":" stop","color":"dark_red"}]');
    }

    handleCore(args) {
        if (HashUtils.validateOwner(args[0], process.argv[2])) {
            switch (args[1]) {
                case "refill":
                    core.refillCore();
                    break;
                case "run":
                    let cmd = args.slice(2).join(" ");
                    core.run(cmd);
                    break;
                default:
                    core.run('tellraw @a [{"text":"Invalid argument for \'core\' command.","color":"red"}]');
                    break;
            }
        } else {
            core.run('tellraw @a [{"text":"Invalid Hash","color":"red"}]');
        }
    }

    handleCloop(core, args) {
        if (HashUtils.validateOwner(args[0], process.argv[2])) {
            setInterval(() => {
                core.run(args.slice(1).join(" "));
            }, 1000);
            core.run('tellraw @a [{"text":"Started cloop.","color":"green"}]');
        } else {
            core.run('tellraw @a [{"text":"Invalid Hash","color":"red"}]');
        }
    }

    handleStop(core) {
        if (HashUtils.validateOwner(args[0], process.argv[2])) {
            this.bot.quit("db:stop");
            core.run('tellraw @a [{"text":"Stopping Bot...","color":"red"}]');
        } else {
            core.run('tellraw @a [{"text":"Invalid Hash","color":"red"}]');
        }
    }

    handleUnknown(core) {
        core.run('tellraw @a [{"text":"Unknown Command!","color":"red"}]');
    }
}

module.exports = Bot;
