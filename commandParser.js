const config = require('config');
const ActionFactory = require('./ActionFactory'); // Import ActionFactory

class CommandParser {
    constructor(bot, hashUtils) {
        this.bot = bot;
        this.HashUtils = hashUtils;
        this.actionFactory = new ActionFactory(this.bot); // Initialize ActionFactory
        this.cooldowns = {}; // Store cooldowns for commands

        // Loading the custom command config from the command JSON
        const commandconfig = require("./config/commands.json");
        config.util.extendDeep(config, commandconfig); // Merge custom command config into the main config
        this.commandsConfig = config.get('commands'); // Get all commands
    }

    async handleCommand(command, args) {
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

    async executeActions(actions, args) {
        for (const action of actions) {
            try {
                // Dynamically use the ActionFactory to get the corresponding action class
                const actionInstance = this.actionFactory.getAction(action.type, args);
                await actionInstance.execute(); // Execute the action
            } catch (error) {
                console.error("Error executing action:", error);
                this.say("An error occurred while executing the action.", "red");
            }
        }
    }

    say(text, colour = "white") {
        this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
    }
}

module.exports = CommandParser;
