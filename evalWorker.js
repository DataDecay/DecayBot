const vm = require('vm');

class evalWorker {
  constructor(bot) {
    this.bot = bot;
    this.sandbox = this.createNewSandbox();

    // Compile the script for repeated execution
    this.script = new vm.Script(`
      result = (function() {
        try {
          return eval(input);
        } catch (e) {
          return "Error: " + e.message;
        }
      })();
    `);
  }

  createNewSandbox() {
    return {
      result: null,
      input: null,  // You need to declare this so it's clear.
      send: (message) => { this.say(message); },
      counter: 0,
      Math: Math,
    };
  }

  say(text, colour = "white") {
    this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
  }

  // Function to run code in the sandboxed worker
  SandboxedEval(input) {
    return new Promise((resolve, reject) => {
      this.sandbox.input = input;  // Set the user input
      try {
        this.script.runInNewContext(this.sandbox, { timeout: 5000 });
        resolve(this.sandbox.result);
      } catch (error) {
        reject('Execution failed: ' + error.message);
      }
    });
  }

  ResetWorker() {
    this.sandbox = this.createNewSandbox();
    this.say("Worker Reset", "green");
  }
}

module.exports = evalWorker;
