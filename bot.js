const mineflayer = require('mineflayer');
const CommandCore = require('./commandCore.js');
const HashUtilsLib = require('./hashUtils.js');
const WebServer = require('./webServer.js');
const config = require('config');

class Bot {
    constructor() {
        this.bot = null;
        this.HashUtils = new HashUtilsLib();
        this.loops = [];

        // Grab commands directly from config
        const commandconfig = require("./config/commands.json");
        config.util.extendDeep(config, commandconfig);
        this.commandsConfig = config.get('commands');
        console.log(this.commandsConfig);
    }

    start() {
        this.bot = mineflayer.createBot({
            host: config.get("connection.serverName"),
            username: config.get("connection.botName"),
            auth: 'offline'
        });

        this.bot.on('spawn', () => {
            this.bot.chatAddPattern(/db:(\S+) ?(.+)?/, "command", "Command Sent");

            const io = new WebServer(config.get("webServer.port"), this.bot, this.HashUtils);
            io.start();
            this.bot.chat('/op ' + config.get("connection.botName"));
            this.bot.chat("/tp "+config.get("connection.botName")+" 6000 110 6000");
            
            
            

            this.bot.on('command', (command, argsraw) => {
                console.log(command + ", " + argsraw)
                if (command == "help") {
                    this.showHelp();
                } else {
                    this.handleCommand(command, argsraw ? argsraw.split(" ") : []);
                }
            });

            this.bot.on('error', console.log);
            this.bot.core = new CommandCore({ x: 6000, y: -50, z: 6000 }, { x: 6010, y: -52, z: 6010 }, this.bot);
            this.bot.core.refillCore({ x: 6000, y: -50, z: 6000 }, { x: 6010, y: -52, z: 6010 }, this.bot);
            this.say("DecayBot core initialized");
        });
    }

    say(text, colour = "white") {
        this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
    }

    showHelp() {
        const roles = {
            public: [],
            trusted: [],
            owner: []
        };

        this.commandsConfig.forEach(cmd => {
            cmd.roles.forEach(role => {
                if (!roles[role]) roles[role] = [];
                roles[role].push(cmd.name);
            });
        });

        const messageParts = [];

        if (roles.public.length > 0) {
            messageParts.push({
                text: `Public: ${roles.public.join(", ")} `,
                color: "blue"
            });
        }

        if (roles.trusted.length > 0) {
            messageParts.push({
                text: `Trusted: ${roles.trusted.join(", ")} `,
                color: "green"
            });
        }

        if (roles.owner.length > 0) {
            messageParts.push({
                text: `Owner: ${roles.owner.join(", ")}`,
                color: "red"
            });
        }
        console.log("help shown")
        this.bot.core.run(`tellraw @a ${JSON.stringify(messageParts)}`);
    }

    handleCommand(command, args) {
        const cmdConfig = this.commandsConfig.find(c => c.name === command);

        if (!cmdConfig) {
            this.say("Unknown Command!", "red");
            return;
        }

        this.executeActions(cmdConfig.actions, args);
    }

    executeActions(actions, args) {
        for (const action of actions) {
            switch (action.type) {
                case "chat":
                    this.say(action.message);
                    break;

                case "tellraw":
                    this.bot.core.run(`tellraw @a ${JSON.stringify(action.json)}`);
                    break;

                case "coreCommand":
                    if (action.command === "refillCore") {
                        this.bot.core.refillCore();
                    } else if (action.command === "run") {
                        const cmd = this.evaluateArg(action.args, args);
                        this.bot.core.run(cmd);
                    }
                    break;

                case "validateHash":
                    const hash = args[action.hashArgIndex];
                    const prefix = config.get(`prefixes.${action.hashType}Prefix`);
                    const isValid = this.HashUtils.validateOwner(hash, prefix);

                    if (isValid && action.then) {
                        this.executeActions(action.then, args);
                    } else if (!isValid && action.else) {
                        this.executeActions(action.else, args);
                    }
                    break;

                case "startLoop":
                    const loopCommand = this.evaluateArg(action.command, args);
                    this.loops.push(setInterval(() => {
                        this.bot.core.run(loopCommand);
                    }, action.intervalMs));
                    break;

                case "stopLoops":
                    this.loops.forEach(loop => clearInterval(loop));
                    this.loops = [];
                    break;

                case "stopBot":
                    this.bot.quit("db:stop");
                    break;

                case "conditional":
                    const condition = eval(action.condition); // ⚠️ risky, sanitize before prod
                    if (condition && action.then) {
                        this.executeActions(action.then, args);
                    } else if (!condition && action.else) {
                        this.executeActions(action.else, args);
                    }
                    break;

                default:
                    this.say(`Unknown action type: ${action.type}`, "red");
            }
        }
    }

    evaluateArg(expression, args) {
        try {
            return eval(expression); // ⚠️ be careful with eval!
        } catch (error) {
            console.error("Failed to evaluate expression:", expression);
            return "";
        }
    }
}

module.exports = Bot;
