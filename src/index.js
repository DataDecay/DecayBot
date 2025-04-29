const Bot = require('./bot.js');
const bot = new Bot();
var argv = require('minimist')(process.argv.slice(2));
if(argv.verbose){
    global.v = true;
    console.warn("Verbose enabled -- potentially sensitive information in STDOUT!")
} else {
    global.v = false;
}
if(argv.godlike){
    global.g = true;
    console.warn("Godlike enabled -- be careful and remember to have fun :D")
} else {
    global.g = false;
}
bot.start();

//hey people dont edit here, edit in the respective module. If you wanna add commands go to config/commands.json
