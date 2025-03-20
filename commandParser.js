const config = require('config');
const evalWorkerLib = require('./evalWorker.js');

/**
 * CommandParser handles parsing and execution of commands for the bot.
 * It supports features like cooldowns, hash validation, loops, and dynamic command execution.
 */
class CommandParser {
    /**
     * Creates a new instance of CommandParser.
     * @param {Object} bot - The bot instance that exposes core methods to run commands and manage state.
     * @param {Object} hashUtils - Utility class used for hash validation and other hash-related operations.
     */
    constructor(bot, hashUtils) {
        /**
         * @type {Object}
         * @description The bot instance.
         */
        this.bot = bot;

        /**
         * @type {Object}
         * @description Utility methods for working with hashes.
         */
        this.HashUtils = hashUtils;

        /**
         * @type {Object}
         * @description Instance of the eval worker library.
         */
        this.evalWorker = new evalWorkerLib(this.bot);

        /**
         * @type {Array<NodeJS.Timeout>}
         * @description Stores active loops that are executing periodically.
         */
        this.loops = [];

        /**
         * @type {Object.<string, number>}
         * @description Stores timestamps of last command executions for cooldown enforcement.
         */
        this.cooldowns = {};

        // Load and merge custom command configuration.
        const commandconfig = require("./config/commands.json");
        config.util.extendDeep(config, commandconfig);

        /**
         * @type {Array<Object>}
         * @description The loaded command configurations from the JSON and config modules.
         */
        this.commandsConfig = config.get('commands');
    }

    /**
     * Handles an incoming command and triggers its associated actions.
     * @async
     * @param {string} command - The name of the command to handle.
     * @param {Array<string>} args - Arguments passed to the command.
     * @returns {Promise<void>}
     */
    async handleCommand(command, args) {
        const cmdConfig = this.commandsConfig.find(c => c.name === command);

        if (!cmdConfig) {
            this.say("Unknown Command!", "red");
            return;
        }

        // Cooldown handling
        if (cmdConfig.cooldown) {
            const lastUsed = this.cooldowns[command] || 0;
            const now = Date.now();

            if (now - lastUsed < cmdConfig.cooldown) {
                this.say(`Please wait before using ${command} again.`, "yellow");
                return;
            }

            this.cooldowns[command] = now;
        }

        await this.executeActions(cmdConfig.actions, args);
    }

    /**
     * Executes a series of actions defined in a command configuration.
     * @async
     * @param {Array<Object>} actions - Array of action objects to execute.
     * @param {Array<string>} args - Arguments passed to the command.
     * @returns {Promise<void>}
     */
    async executeActions(actions, args) {
        for (const action of actions) {
            switch (action.type) {
                /**
                 * Sends a chat message.
                 */
                case "chat":
                    this.say(action.message);
                    break;

                /**
                 * Sends a raw JSON tellraw message to all players.
                 */
                case "tellraw":
                    this.bot.core.run(`tellraw @a ${JSON.stringify(action.json)}`);
                    break;

                /**
                 * Executes a core bot command.
                 */
                case "coreCommand":
                    if (action.command === "refillCore") {
                        this.bot.core.refillCore();
                    } else if (action.command === "run") {
                        const cmd = this.evaluateArg(action.args, args);
                        this.bot.core.run(cmd);
                    }
                    break;

                /**
                 * Validates a hash against defined hash types and executes conditional actions.
                 */
                case "validateHash":
                    var results = [];
                    for (const htype of action.hashType) {
                        const hash = args[action.hashArgIndex];
                        const roleMeta = config.get(`hashLevels.${htype}`);
                        
                        if (!roleMeta) {
                            console.error(`Role "${htype}" not found in hashLevels.`);
                            continue;
                        }

                        const prefix = roleMeta.prefix;
                        const isValid = this.HashUtils.validateOwner(hash, prefix);
                        results.push(isValid);

                        this.rslt = results.some(result => result);
                        if (this.rslt && action.then) {
                            await this.executeActions(action.then, args);
                        } else if (!this.rslt && action.else) {
                            await this.executeActions(action.else, args);
                        }

                        return results.some(result => result);
                    }
                    break;

                /**
                 * Starts a repeating loop that runs a command at a specified interval.
                 */
                case "startLoop":
                    const loopCommand = this.evaluateArg(action.command, args);
                    this.loops.push(setInterval(() => {
                        this.bot.core.run(loopCommand);
                    }, action.intervalMs));
                    break;

                /**
                 * Stops all active loops.
                 */
                case "stopLoops":
                    this.loops.forEach(loop => clearInterval(loop));
                    this.loops = [];
                    break;

                /**
                 * Stops the bot and disconnects.
                 */
                case "stopBot":
                    this.bot.quit("db:stop");
                    break;

                /**
                 * Runs conditional actions based on an evaluated JavaScript expression.
                 */
                case "conditional":
                    const condition = eval(action.condition); // ⚠️ Use caution!
                    if (condition && action.then) {
                        await this.executeActions(action.then, args);
                    } else if (!condition && action.else) {
                        await this.executeActions(action.else, args);
                    }
                    break;

                /**
                 * Sends a random message from a provided list.
                 */
                case "randomMessage":
                    if (Array.isArray(action.messages) && action.messages.length > 0) {
                        const randomIndex = Math.floor(Math.random() * action.messages.length);
                        const message = action.messages[randomIndex];
                        this.say(message);
                    } else {
                        console.warn("randomMessage action missing valid messages array");
                    }
                    break;

                /**
                 * Executes actions after a specified delay.
                 */
                case "delayedAction":
                    if (Array.isArray(action.then)) {
                        setTimeout(() => {
                            this.executeActions(action.then, args);
                        }, action.delayMs || 1000);
                    } else {
                        console.warn("delayedAction missing 'then' actions array");
                    }
                    break;

                /**
                 * Runs code inside an eval sandbox.
                 */
                case "eval":
                    const what = action.eval;
                    this.evalresult = await this.evalWorker.SandboxedEval(what);
                    this.say(this.evalresult, "blue");
                    break;

                /**
                 * Enforces a cooldown on a specific command and executes actions if allowed.
                 */
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
                        await this.executeActions(action.then, args);
                    }
                    break;

                /**
                 * Mutes a player for a specific duration, then unmutes them automatically.
                 */
                case "mute":
                    const playerToMute = args[0];
                    const muteDuration = action.duration || 300000;

                    this.bot.core.run(`mute ${playerToMute}`);
                    this.say(`${playerToMute} has been muted for ${muteDuration / 1000} seconds.`);

                    setTimeout(() => {
                        this.bot.core.run(`unmute ${playerToMute}`);
                        this.say(`${playerToMute} has been unmuted.`);
                    }, muteDuration);
                    break;

                /**
                 * Displays user statistics.
                 */
                case "userStats":
                    const playerName = args[0];
                    const stats = this.bot.core.getUserStats(playerName);

                    if (stats) {
                        this.say(`${playerName}'s stats - Health: ${stats.health}, Score: ${stats.score}`);
                    } else {
                        this.say(`Could not find stats for ${playerName}.`);
                    }
                    break;

                /**
                 * Handles unknown action types.
                 */
                default:
                    this.say(`Unknown action type: ${action.type}`, "red");
            }
        }
    }

    /**
     * Evaluates a JavaScript expression within the current context.
     * @param {string} expression - The expression to evaluate.
     * @param {Array<string>} args - Arguments passed to the command, available in the evaluation scope.
     * @returns {*} The result of the evaluation, or an empty string if evaluation fails.
     */
    evaluateArg(expression, args) {
        try {
            return eval(expression);
        } catch (error) {
            console.error("Failed to evaluate expression:", expression);
            return "";
        }
    }

    /**
     * Displays help information about available commands categorized by role.
     * @returns {void}
     */
    showHelp() {
        const hashLevels = config.get('hashLevels');
        const roles = {};

        Object.keys(hashLevels).forEach(level => {
            roles[level] = [];
        });

        this.commandsConfig.forEach(cmd => {
            cmd.roles.forEach(role => {
                if (!roles[role]) roles[role] = [];
                roles[role].push(cmd.name);
            });
        });

        const messageParts = [];

        Object.keys(roles).forEach(role => {
            const commands = roles[role];
            const roleMeta = hashLevels[role];

            if (roleMeta && commands.length > 0) {
                messageParts.push({
                    text: `${roleMeta.name}: ${commands.join(", ")}`,
                    color: roleMeta.color
                });
            }
        });

        this.bot.core.run(`tellraw @a ${JSON.stringify(messageParts)}`);
    }

    /**
     * Sends a chat message to all players.
     * @param {string} text - The message content.
     * @param {string} [colour="white"] - The text color.
     * @returns {void}
     */
    say(text, colour = "white") {
        this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
    }

    /**
     * Validates a hash against the prefix for a given role.
     * @param {string} hash - The hash to validate.
     * @param {string} role - The role whose prefix should be used for validation.
     * @returns {boolean} True if the hash is valid, false otherwise.
     */
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
