const config = require('config');

class CommandParser {
    constructor(bot, hashUtils) {
        this.bot = bot;
        this.HashUtils = hashUtils;
        this.loops = [];
        this.cooldowns = {}; // Store cooldowns for commands

        // Loading the custom command config from the command JSON
        const commandconfig = require("./config/commands.json");
        config.util.extendDeep(config, commandconfig); // Merge custom command config into the main config
        this.commandsConfig = config.get('commands'); // Get all commands
    }

    handleCommand(command, args) {
        const cmdConfig = this.commandsConfig.find(c => c.name === command);

        if (!cmdConfig) {
            this.say("Unknown Command!", "red");
            return;
        }

        // Handle cooldown if applicable
        if (cmdConfig.cooldown) {
            const lastUsed = this.cooldowns[command] || 0;
            const now = Date.now();

            if (now - lastUsed < cmdConfig.cooldown) {
                this.say(`Please wait before using ${command} again.`, "yellow");
                return;
            }

            this.cooldowns[command] = now;
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
                    for (const htype of action.hashType) {
                        const hash = args[action.hashArgIndex];  // Get hash from args
                        const roleMeta = config.get(`hashLevels.${htype}`);  // Get role metadata from config
                        
                        if (!roleMeta) {
                            console.error(`Role "${htype}" not found in hashLevels.`);
                            continue;
                        }

                        const prefix = roleMeta.prefix;  // Get the prefix for the role
                        const isValid = this.HashUtils.validateOwner(hash, prefix);  // Validate hash with prefix
                        results.push(isValid);

                        this.rslt = results.some(result => result);
                        if (this.rslt && action.then) {
                            this.executeActions(action.then, args);
                        } else if (!this.rslt && action.else) {
                            this.executeActions(action.else, args);
                        }

                        return results.some(result => result);
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
                    const condition = eval(action.condition); // risky, sanitize before prod
                    if (condition && action.then) {
                        this.executeActions(action.then, args);
                    } else if (!condition && action.else) {
                        this.executeActions(action.else, args);
                    }
                    break;

                

                case "randomMessage":
                    if (Array.isArray(action.messages) && action.messages.length > 0) {
                        const randomIndex = Math.floor(Math.random() * action.messages.length);
                        const message = action.messages[randomIndex];
                        this.say(message);
                    } else {
                        console.warn("randomMessage action missing valid messages array");
                    }
                    break;

                case "delayedAction":
                    if (Array.isArray(action.then)) {
                        setTimeout(() => {
                            this.executeActions(action.then, args);
                        }, action.delayMs || 1000); // Default delay 1 second
                    } else {
                        console.warn("delayedAction missing 'then' actions array");
                    }
                    break;

                case "cooldown":
                    const commandName = action.commandName;
                    const duration = action.durationMs;

                    if (!commandName || !duration) {
                        console.warn("cooldown action missing commandName or durationMs");
                        break;
                    }

                    const now = Date.now();
                    const lastUsed = this.cooldowns[commandName] || 0;

                    if (now - lastUsed < duration) {
                        this.say(`You must wait before using ${commandName} again.`);
                        break;
                    }

                    this.cooldowns[commandName] = now;

                    if (action.then) {
                        this.executeActions(action.then, args);
                    }

                    break;

                case "mute":
                    const playerToMute = args[0];
                    const muteDuration = action.duration || 300000;  // 5 min default

                    this.bot.core.run(`mute ${playerToMute}`);
                    this.say(`${playerToMute} has been muted for ${muteDuration / 1000} seconds.`);

                    setTimeout(() => {
                        this.bot.core.run(`unmute ${playerToMute}`);
                        this.say(`${playerToMute} has been unmuted.`);
                    }, muteDuration);
                    break;

                case "userStats":
                    const playerName = args[0];
                    const stats = this.bot.core.getUserStats(playerName);  // Example stub method

                    if (stats) {
                        this.say(`${playerName}'s stats - Health: ${stats.health}, Score: ${stats.score}`);
                    } else {
                        this.say(`Could not find stats for ${playerName}.`);
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
        const hashLevels = config.get('hashLevels'); // Get hashLevels configuration
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
            const roleMeta = hashLevels[role]; // Fetch the role metadata

            if (roleMeta && roleMeta.visible !== false) {
                if (commands.length > 0) {
                    messageParts.push({
                        text: `${roleMeta.name}: ${commands.join(", ")}`,
                        color: roleMeta.color
                    });
                }
            } else {
                console.warn(`Role "${role}" not found or hidden in hashLevels.`);
            }
        });

        this.bot.core.run(`tellraw @a ${JSON.stringify(messageParts)}`);
    }

    say(text, colour = "white") {
        this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
    }

    validateHash(hash, role) {
        const roleMeta = config.get(`hashLevels.${role}`);
        if (!roleMeta) {
            console.error(`Role "${role}" not found in hashLevels.`);
            return false;
        }

        const prefix = roleMeta.prefix;
        return this.HashUtils.validateHash(hash, prefix);
    }
}

module.exports = CommandParser;
