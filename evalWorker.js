const vm = require('vm');

class evalWorker {
  constructor(bot) {
    this.bot = bot;
this.context = { };
vm.createContext(this.context); // Contextify the object.

this.code = '';

  }

  createNewSandbox() {
    return {
      result: null,
      input: null,
      send: (message) => { this.say(message); },
      counter: 0,
      Math: Math,
    };
  }

  say(text, colour = "white") {
    this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
  }

  SandboxedEval(input) {
    return new Promise((resolve, reject) => {

      try {
        this.code = input;
        vm.runInContext(this.code, this.context);
      } catch (error) {
        reject('Execution failed: ' + error.message);
      }
    });
  }

  ResetWorker() {
    this.context = { };
vm.createContext(this.context); // Contextify the object.
this.code = '';
  }
}

module.exports = evalWorker;
