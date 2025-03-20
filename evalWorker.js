const vm = require('vm');

const sandbox = {
  input: '2 + 2',
  result: null,
};

const context = vm.createContext(sandbox);

const code = `
  try {
    result = eval(input);
  } catch (e) {
    result = "Error: " + e.message;
  }
`;

const script = new vm.Script(code);
script.runInContext(context);

console.log('Result:', sandbox.result);  // Should log: 4
