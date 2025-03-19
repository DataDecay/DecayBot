const config = require('config');

class CommandParser {
    constructor(bot, hashUtils) {
        this.bot = bot;
        this.HashUtils = hashUtils;
        this.loops = [];

        const commandconfig = require("./config/commands.json");
        config.util.extendDeep(config, commandconfig);
        this.commandsConfig = config.get('commands');
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
                    var results = [];
                    for (const htype of action.hashType){
                    const hash = args[action.hashArgIndex];
                    const prefix = config.get(`prefixes.${htype}Prefix`);
                    const isValid = this.HashUtils.validateOwner(hash, prefix);
                    if (isValid && action.then) {
                        this.executeActions(action.then, args);
                    } else if (!isValid && action.else) {
                        this.executeActions(action.else, args);
                    }
                    var correct=false;
                        for (const result of results){
                            correct = correct || result;
                        }
                        
                    return correct 
                    break;
                    }

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
                    const condition = eval(action.condition); // risky, sanitize before prod
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
            return eval(expression);
        } catch (error) {
            console.error("Failed to evaluate expression:", expression);
            return "";
        }
    }

    showHelp() {
    const hashLevels = config.get('hashLevels');
    const roles = {};

    // Initialize empty arrays for each role
    Object.keys(hashLevels).forEach(level => {
        roles[level] = [];
    });

    // Populate roles with command names
    this.commandsConfig.forEach(cmd => {
        cmd.roles.forEach(role => {
            if (!roles[role]) roles[role] = [];
            roles[role].push(cmd.name);
        });
    });

    const messageParts = [];

    // Iterate over each role to build the message
    Object.keys(roles).forEach(role => {
        const commands = roles[role];
        const roleMeta = hashLevels[role];

        // Only proceed if roleMeta exists
        if (roleMeta) {
            if (commands.length > 0) {
                messageParts.push({
                    text: `${roleMeta.name}: ${commands.join(", ")} `,
                    color: roleMeta.color
                });
            }
        } else {
            console.warn(`Role "${role}" not found in hashLevels.`);
        }
    });

    this.bot.core.run(`tellraw @a ${JSON.stringify(messageParts)}`);
}

    say(text, colour = "white") {
        this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
    }
}

module.exports = CommandParser;
