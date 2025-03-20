/**
 * @fileoverview
 * Defines the evalWorker class, which provides a sandboxed environment to safely evaluate JavaScript code 
 * within a virtual machine (VM) context. It integrates with a Mineflayer bot to send outputs in-game.
 */

const vm = require('vm');

/**
 * evalWorker creates and manages a sandboxed VM environment for evaluating arbitrary code.
 * It exposes methods for running code, resetting the sandbox, and sending output to the game chat.
 */
class evalWorker {
  /**
   * Creates a new evalWorker instance.
   * @param {mineflayer.Bot} bot - The Mineflayer bot instance used to send messages in-game.
   */
  constructor(bot) {
    /**
     * @type {mineflayer.Bot}
     * The Mineflayer bot associated with this worker.
     */
    this.bot = bot;

    /**
     * @type {Object}
     * The sandboxed environment context for code evaluation.
     */
    this.sandbox = this.createNewSandbox();

    /**
     * @type {vm.Script}
     * The precompiled script that evaluates user input inside the sandbox.
     */
    this.script = new vm.Script(`
      try {
        result = eval(input);  
      } catch (e) {
        result = "Error: " + e.message;
      }
    `);
  }

  /**
   * Creates a new sandbox environment for the VM context.
   * Includes basic globals and stateful properties like a counter.
   * @returns {Object} The sandbox object.
   */
  createNewSandbox() {
    return {
      result: null,   // Stores the evaluation result
      send: (message) => { this.say(message); },  // Callback to send output
      counter: 0,     // Example state that can be modified by user code
      Math: Math      // Expose Math functions inside the sandbox
    };
  }

  /**
   * Sends a tellraw message to all players in the game.
   * @param {string} text - The message text.
   * @param {string} [colour="white"] - The color of the text.
   * @returns {void}
   */
  say(text, colour = "white") {
    this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
  }

  /**
   * Runs JavaScript code inside the sandboxed VM environment.
   * @param {string} input - The code to evaluate.
   * @returns {Promise<*>} Resolves with the result of the evaluation or rejects if execution fails.
   */
  SandboxedEval(input) {
    return new Promise((resolve, reject) => {
      this.sandbox.input = input; // Set the user input in the sandbox
      try {
        this.script.runInNewContext(this.sandbox, { timeout: 5000 }); // Execute with timeout
        resolve(this.sandbox.result);
      } catch (error) {
        reject('Execution failed: ' + error.message);
      }
    });
  }

  /**
   * Resets the sandboxed environment, clearing all previous state.
   * @returns {void}
   */
  ResetWorker() {
    this.sandbox = this.createNewSandbox();
    this.say("Worker Reset", "green");
  }
}

module.exports = evalWorker;
