const vm = require('vm');

class evalWorker {
  constructor(bot) {
    this.bot = bot;
    this.resetWorker();
  }

  resetWorker() {
    // Create a secure context with limited access to safe functions
    this.context = {
      console: {
        log: (...args) => {
          const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          this.say(`${message}`);
          return message;
        },
        error: (...args) => {
          const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          this.say(`[Error]: ${message}`, "red");
          return message;
        }
      },
      // Add direct access to say function in the global context
      say: (message) => {
        this.say(String(message));
        return message;
      },
      Math: Object.create(Math),
      Date: Date,
      RegExp: RegExp,
      String: String,
      Number: Number,
      Array: Array,
      Boolean: Boolean,
      Object: Object,
      JSON: JSON,
      Buffer: Buffer,
      Promise: Promise,
      setTimeout: (callback, ms) => {
        if (ms > 10000) ms = 10000; // Maximum 10 second timeout
        return setTimeout(() => {
          try {
            callback();
          } catch (error) {
            this.say(`Timeout callback error: ${error.message}`, "red");
          }
        }, ms);
      },
      clearTimeout: clearTimeout,
      send: (message) => { 
        this.say(String(message)); 
        return message;
      },
      bot: {
        // Provide a safe subset of bot functionality
        position: this.bot.position ? { ...this.bot.position } : null,
        entities: this.bot.entities ? Object.keys(this.bot.entities).length : 0,
        health: this.bot.health,
        food: this.bot.food,
        time: {
          day: this.bot.time ? this.bot.time.day : null,
          age: this.bot.time ? this.bot.time.age : null,
        },
        say: (message) => this.say(String(message))
      }
    };
    
    // Make the context more secure
    vm.createContext(this.context);
    this.code = '';
  }

  say(text, colour = "white") {
    try {
      // Escape JSON characters to prevent injection
      const safeText = String(text).replace(/"/g, '\\"').replace(/\n/g, '\\n');
      this.bot.core.run(`tellraw @a [{"text":"${safeText}","color":"${colour}"}]`);
    } catch (error) {
      console.error('Error in say method:', error);
    }
  }

  SandboxedEval(input, silentMode = false) {
    return new Promise((resolve, reject) => {
      if (!input || typeof input !== 'string') {
        reject('Invalid input');
        return;
      }

      // Store the code for debugging
      this.code = input;
      
      try {
        // Check if the input is a simple expression that needs to be evaluated
        const isSimpleExpression = !input.includes(';') && !input.includes('function') && 
          !input.includes('return') && !input.includes('class');
        
        let scriptContent;
        if (isSimpleExpression) {
          // For simple expressions like "2+2", directly return the result
          scriptContent = `
            (function() {
              try {
                return { success: true, result: ${input} };
              } catch (e) {
                return { success: false, error: e.message };
              }
            })()
          `;
        } else {
          // For more complex code with statements, wrap in a function
          scriptContent = `
            (function() {
              try {
                const result = (function() { 
                  ${input}
                })();
                return { success: true, result: result };
              } catch (e) {
                return { success: false, error: e.message };
              }
            })()
          `;
        }
        
        // Execute with timeout
        const timeoutMs = 2000; // 2 seconds max execution time
        const script = new vm.Script(scriptContent, { timeout: timeoutMs });
        
        const result = script.runInContext(this.context);
        
        if (result.success) {
          const output = result.result !== undefined ? String(result.result) : 'undefined';
          resolve(output);
        } else {
          if (!silentMode) {
            this.say(`Evaluation error: ${result.error}`, "red");
          }
          reject(`Error: ${result.error}`);
        }
      } catch (error) {
        if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
          if (!silentMode) {
            this.say('Script execution timed out (max 2 seconds)', "red");
          }
          reject('Execution timed out');
        } else {
          if (!silentMode) {
            this.say(`Execution error: ${error.message}`, "red");
          }
          reject(`Error: ${error.message}`);
        }
        
        // Reset the context to clean up after errors
        this.resetWorker();
      }
    });
  }
}

module.exports = evalWorker;
