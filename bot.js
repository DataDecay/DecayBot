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

        var core;
        this.bot.on('spawn', () => {
            this.bot.core = new CommandCore(this.bot.entity.position, { x: this.bot.entity.position.x + 16, y: this.bot.entity.position.y + 1, z: this.bot.entity.position.z + 16 }, this.bot);
            this.say("DecayBot core initialised");
            this.bot.chatAddPattern(
                /db:(\S+) ?(.+)?/,
                "command",
                "Command Sent"
            );
            var loop;

            const io = new WebServer(process.argv[5], this.bot);
            io.start();

            this.bot.on('command', (command, argsraw) => {
                this.handleCommand(command, argsraw);
            });
            this.bot.on('error', console.log);
            this.bot.on('kicked', () => {
                this.bot = mineflayer.createBot({
                    host: process.argv[4],
                    username: process.argv[6],
                    auth: 'offline'
                });
            });
        });
    }
    say(text, colour="white"){
        const core = this.bot.core;
        core.run('tellraw @a [{"text":"' + text + '","color":"' + colour + '"}]');
    }
    handleCommand(command, argsraw) {
        let args = argsraw ? argsraw.split(" ") : [];
        switch (command) {
            case 'help':
                this.handleHelp();
                break;
            case 'hello':
                this.handleHello();
                break;
            case 'creator':
                this.handleCreator();
                break;
            case 'stop-cloops':
                this.handleStopCloop(args);
                break;
            case 'core':
                this.handleCore(args);
                break;
            case 'cloop':
                this.handleCloop(args);
                break;
            case 'stop':
                this.handleStop(args);
                break;
            default:
                this.handleUnknown();
                break;
        }
    }

    handleHelp() {
        const core = this.bot.core; // Assuming core is set at the bot level
        core.run('tellraw @a [{"text":"Public ","color":"blue"},{"text":"Trusted ","color":"green"},{"text":"Owner\n","color":"red"},{"text":"hello, code, creator, hash-test, ","color":"blue"},{"text":"cloop, stop-cloops, ","color":"green"},{"text":"stop, core","color":"dark_red"}]');

    }
     handleHello() {
        const core = this.bot.core; // Assuming core is set at the bot level
        this.say("Hello World!");
    }
    handleCreator() {
        const core = this.bot.core; // Assuming core is set at the bot level
        this.say("Made by DataDecay!");
    }
    handleCode() {
        const core = this.bot.core; // Assuming core is set at the bot level
        core.run('tellraw @a ["",{"text":"Github Repo","color":"red","bold":true,"underlined":false,"clickEvent":{"action":"open_url","value":"https://github.com/DataDecay/DecayBot"}}]');
    }
    handleCore(args) {
        const core = this.bot.core; // Assuming core is set at the bot level
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

    handleCloop(args) {
        const core = this.bot.core; // Assuming core is set at the bot level
        if (HashUtils.validateOwner(args[0], process.argv[2])) {
            this.loops.push(setInterval(() => {
                core.run(args.slice(1).join(" "));
            }, 1000));
            core.run('tellraw @a [{"text":"Started cloop.","color":"green"}]');
        } else {
            core.run('tellraw @a [{"text":"Invalid Hash","color":"red"}]');
        }
    }

    handleStop(args) {
        const core = this.bot.core; // Assuming core is set at the bot level
        if (HashUtils.validateOwner(args[0], process.argv[2])) {
            
            core.run('tellraw @a [{"text":"Stopping Bot...","color":"red"}]');
            this.bot.quit("db:stop");
        } else {
            core.run('tellraw @a [{"text":"Invalid Hash","color":"red"}]');
        }
    }

    handleUnknown() {
        const core = this.bot.core; // Assuming core is set at the bot level
        core.run('tellraw @a [{"text":"Unknown Command!","color":"red"}]');
    }
}

module.exports = Bot;
