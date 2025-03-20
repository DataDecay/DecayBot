const vm = require('vm');

class evalWorker {
  constructor(bot) {
    this.bot = bot;
    this.sandbox = this.createNewSandbox();
    this.context = vm.createContext(this.sandbox);  // Persistent context

    const scriptCode = `
      try {
        result = eval(input);
      } catch (e) {
        result = "Error: " + e.message;
      }
    `;

    this.script = new vm.Script(scriptCode);
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
      this.sandbox.input = input;

      try {
        // Reuse the same context!
        this.script.runInContext(this.context, { timeout: 5000 });
        resolve(this.sandbox.result);
      } catch (error) {
        reject('Execution failed: ' + error.message);
      }
    });
  }

  ResetWorker() {
    this.sandbox = this.createNewSandbox();
    this.context = vm.createContext(this.sandbox);
    this.say("Worker Reset", "green");
  }
}

module.exports = evalWorker;
