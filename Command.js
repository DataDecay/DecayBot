class Command {
    constructor(bot, args) {
        this.bot = bot;
        this.args = args;
    }

    // A method to be overridden by individual commands for execution logic
    execute() {
        throw new Error("execute method must be implemented in the child class.");
    }

    // Common helper method to send messages
    say(text, colour = "white") {
        this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
    }
}

module.exports = Command;
