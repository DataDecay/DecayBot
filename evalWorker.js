const vm = require('vm');

class evalWorker {
// Create a sandboxed environment
  
  constructor(bot){
    this.bot=bot;
    this.sandbox = this.createNewSandbox();
    

// Compile the script for repeated execution
this.script = new vm.Script(`
  try {
    result = eval(this.input);  // Evaluate the user input within the sandbox context  // Update the persistent state (e.g., a counter that increments)
  } catch (e) {
    result = "Error: " + e.message;
  }
`);
  }
  createNewSandbox() {
  return {
    result: null,
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
    this.sandbox.input = input;  // Set the user input
    try {
      this.script.runInNewContext(this.sandbox, { timeout: 5000 });  // Set a timeout for execution
      resolve(this.sandbox.result);
    } catch (error) {
      reject('Execution failed: ' + error.message);
    }
  });
}
  ResetWorker(){
    this.sandbox = createNewSandbox();
    this.say("Worker Reset", "green")
  }
}
module.exports = evalWorker;
