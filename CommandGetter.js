const path = require('path');

class CommandGetter {
    constructor(bot) {
        this.bot = bot;
    }

    getCommand(commandName, args) {
        try {
            const commandPath = path.join(__dirname, '..', 'commands', `${commandName.charAt(0).toUpperCase() + commandName.slice(1)}Command.js`);
            const CommandClass = require(commandPath);
            const commandInstance = new CommandClass(this.bot, args);
            
            if (commandInstance instanceof require('../Command')) {
                return commandInstance;
            } else {
                throw new Error(`Command "${commandName}" does not extend the base Command class.`);
            }
        } catch (error) {
            throw new Error(`Command "${commandName}" not found: ${error.message}`);
        }
    }
}

module.exports = CommandGetter;
