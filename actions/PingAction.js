const Action = require('../Action');

class PingAction extends Action {
    constructor(bot, args) {
        super(bot, args);
    }

    execute() {
        const ping = this.bot.ping || 0;
        this.say(`Pong! ${ping}ms.`, "green");
    }
}

module.exports = PingAction;
