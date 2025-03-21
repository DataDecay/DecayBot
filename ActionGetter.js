const path = require('path');

class ActionGetter {
    constructor(bot) {
        this.bot = bot;
    }

    getAction(actionName, args) {
        try {
            const actionPath = path.join(__dirname, '.', 'actions', `${actionName.charAt(0).toUpperCase() + actionName.slice(1)}Action.js`);
            const ActionClass = require(actionPath);
            const actionInstance = new ActionClass(this.bot, args);
            
            if (actionInstance instanceof require('./Action.js')) {
                return actionInstance;
            } else {
                throw new Error(`Action "${actionName}" does not extend the base Action class.`);
            }
        } catch (error) {
            throw new Error(`Action "${actionName}" not found: ${error.message}`);
        }
    }
}

module.exports = ActionGetter;
