const config = require('config');
const evalWorkerLib = require('./evalWorker.js');
const vm = require('vm');

class CommandParser {
    constructor(bot, hashUtils) {
        this.bot = bot;
        this.HashUtils = hashUtils;
        this.evalWorker = new evalWorkerLib(this.bot);
        this.loops = [];
        this.cooldowns = {};
        this.variables = {};

        const commandconfig = require("../config/commands.json");
        config.util.extendDeep(config, commandconfig);
        this.commandsConfig = config.get('commands');
    }

    async handleCommand(command, args) {
        const cmdConfig = this.commandsConfig.find(c => c.name === command);

        if (!cmdConfig) {
            this.say("Unknown Command!", "red");
            return;
        }

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

    async executeActions(actions, args) {
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
                    const conditionResult = this.safeEvaluateExpression(action.condition, { args, bot: this.bot });
                    if (conditionResult && action.then) {
                        this.executeActions(action.then, args);
                    } else if (!conditionResult && action.else) {
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
                        }, action.delayMs || 1000);
                    } else {
                        console.warn("delayedAction missing 'then' actions array");
                    }
                    break;

                case "eval":
                    if (!action.eval) {
                        this.say("Missing eval expression", "red");
                        break;
                    }
                    
                    try {
                        const evalCode = this.safeEvaluateExpression(action.eval, { args });
                        
                        if (typeof evalCode !== 'string') {
                            this.say("Invalid eval code (not a string)", "red");
                            break;
                        }

                        // Check if the first argument is a silent mode flag
                        const isSilentMode = args.length > 1 && 
                            (args[1].toLowerCase() === "silent" || 
                             args[1].toLowerCase() === "true" || 
                             args[1] === "1");
                        
                        // If silent mode is enabled, don't show the result - but still run the code with all output functions enabled
                        const actualCode = isSilentMode ? args.slice(2).join(' ') : args.slice(1).join(' ');
                        
                        this.evalresult = await this.evalWorker.SandboxedEval(actualCode, false); // Always use false for silentMode to allow output functions
                        
                        // Only show the result if not in silent mode
                        if (!isSilentMode && this.evalresult) {
                            this.say(this.evalresult, "blue");
                        } else if (!isSilentMode && this.evalresult === undefined) {
                            this.say("Result returned undefined.", "red");
                        }
                        
                        // No longer display "Evaluated silently" message
                        
                        if (!isSilentMode) {
                            console.log("Evaluating:", actualCode);
                        }
                    } catch (error) {
                        this.say(`Eval error: ${error.message || error}`, "red");
                        console.error("Eval error:", error);
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

                case "executeCommand":
                    if (action.command === "setname") {
                        const newName = args[0];
                        this.bot.core.run(`/username ${newName}`);
                    }
                    break;

                case "ping":
                    const ping = this.bot.player.ping || "err"; // Check if bot has a ping value
                    this.say(`Pong! ${ping}ms.`, "green");
                    break;

                case "teleport":
                    const x = parseFloat(args[0]);
                    const y = parseFloat(args[1]);
                    const z = parseFloat(args[2]);
                   
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        this.bot.teleport({ x, y, z });
                        this.say(`Teleported to coordinates (${x}, ${y}, ${z}).`, "green");
                    } else {
                        this.say("Invalid coordinates!", "red");
                    }
                    break;

                case "sethome":
                    const homePosition = this.bot.entity.position;
                    this.bot.home = homePosition; // Store the home position
                    this.say("Home position has been set.", "green");
                    break;

                case "home":
                    if (this.bot.home) {
                        this.bot.teleport(this.bot.home);
                        this.say("Teleported to home.", "green");
                    } else {
                        this.say("Home position is not set.", "red");
                    }
                    break;

                case "setVariable":
                    const variable = args[0];
                    const value = args[1];
                    this.bot[variable] = value;  // Set the variable dynamically
                    this.say(`${variable} set to ${value}.`, "green");
                    break;

                default:
                    console.error(`Unknown action type: ${action.type}`);
            }
        }
    }

    evaluateArg(expression, args) {
        if (!expression) return "";
        return this.safeEvaluateExpression(expression, { args });
    }

    safeEvaluateExpression(expression, context = {}) {
        if (typeof expression !== 'string') {
            return expression;
        }

        if (expression.includes('args.slice')) {
            const match = expression.match(/args\.slice\((\d+)\)\.join\(['"](.*)["']\)/);
            if (match) {
                const startIndex = parseInt(match[1], 10);
                const separator = match[2];
                return context.args.slice(startIndex).join(separator);
            }
        }

        if (expression === '{bot.position}') {
            return context.bot ? context.bot.position : null;
        }
        
        const argIndexMatch = expression.match(/^args\[(\d+)\]$/);
        if (argIndexMatch && context.args) {
            const index = parseInt(argIndexMatch[1], 10);
            return context.args[index];
        }

        try {
            const sandbox = {
                args: context.args || [],
                bot: context.bot ? {
                    position: context.bot.position,
                    health: context.bot.health,
                    food: context.bot.food,
                    name: context.bot.name
                } : {},
                ...this.variables
            };
            
            const vmContext = vm.createContext(sandbox);
            
            const script = new vm.Script(`(function() { return ${expression}; })()`, { 
                timeout: 500
            });
            
            return script.runInContext(vmContext);
        } catch (error) {
            console.error(`Failed to evaluate expression: ${expression}`, error);
            return "";
        }
    }

    showHelp(commandName = null) {
        const commands = this.commandsConfig;
        if (!commandName) {
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

            if (roleMeta) {
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
        return;
    }

    const commandused = commands.find(c => c.name === commandName);
    if (!commandused) {
        this.bot.chat(`Command "${commandName}" not found.`);
        return;
    }
    if (!commandused) {
        this.bot.chat(`Command "${commandName}" not found.`);
        return;
    }

    let roles = commandused.roles.join(", ");
    let description = commandused.description || "No description available.";
    let actions = commandused.actions
        .map(action => `- ${action.type}: ${JSON.stringify(action)}`)
        .join("\n");

    let message = `Command: ${commandused.name} Description: ${description} Roles: ${roles}`;
this.bot.core.run(`tellraw @a [{"text":"${message}","color":"blue"}]`)
        
        
    }

    say(text, colour = "white") {
        this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
    }

    validateHash(hash, role) {
        const roleMeta = config.get(`hashLevels.${role}`);
        if (!roleMeta) {
            console.error(`Role "${role}" not found in hashLevels config.`);
            return false;
        }

        const prefix = roleMeta.prefix;
        return this.HashUtils.validateHash(hash, prefix);
    }
}

module.exports = CommandParser;
