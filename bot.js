var Vec3 = require('vec3');
if (process.argv.length != 7) {
    console.log('Usage : node bot.js <hash-prefix-owner> <hash-prefix-trusted> <host> <port> <username>')
    process.exit(1)
}
const CommandCore = require("./commandcore.js")

process.argv.forEach(function(val, index, array) {
    console.log(index + ': ' + val);
});
var http = require('http').createServer(handler); //require http server, and create server with function handler()
var fs = require('fs'); //require filesystem module
var io = require('socket.io')(http) //require socket.io module and pass the http object (server)
var port = process.argv[5]
http.listen(port); //listen to port 8080

function handler(req, res) { //create server
    console.log(req.url)
    if(req.url=="/hash"){
    fs.readFile(__dirname + '/public/hash.html', function(err, data) { //read file index.html in public folder
        if (err) {
            res.writeHead(404, {
                'Content-Type': 'text/html'
            }); //display 404 on error
            return res.end("404 Not Found");
        }
        res.writeHead(200, {
            'Content-Type': 'text/html'
        }); //write HTML
        res.write(data); //write data from index.html
        return res.end();
    });
    } else {
        fs.readFile(__dirname + '/public/index.html', function(err, data) { //read file index.html in public folder
        if (err) {
            res.writeHead(404, {
                'Content-Type': 'text/html'
            }); //display 404 on error
            return res.end("404 Not Found");
        }
        res.writeHead(200, {
            'Content-Type': 'text/html'
        }); //write HTML
        res.write(data); //write data from index.html
        return res.end();
    });
    }
}
io.sockets.on('connection', function(socket) { // WebSocket Connection
    var lightvalue = 0; //static variable for current status
    socket.on('light', function(data) { //get light switch status from client
        lightvalue = data;
        if (lightvalue) {
            console.log(lightvalue); //turn LED on or off, for now we will just show it in console.log
        }
    });
});




//bot
require('node:crypto');



// Prints:
//   6a2da20943931e9834fc12cfe5bb47bbd9ae43489a30726962b576f4e3993e50
const mineflayer = require('mineflayer')

var bot = mineflayer.createBot({
    host: process.argv[4], // minecraft server ip
    username: process.argv[6], // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
    auth: 'offline' // for offline mode servers, you can set this to 'offline'
    ///port: 35254,              // set if you need a port that isn't 25565
    // version: false,           // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
    // password: '12345678'      // set if you want to use password-based auth (may be unreliable). If specified, the `username` must be an email
})
var core;
bot.on('spawn', () => {
    core = new CommandCore(bot.entity.position, {x: bot.entity.position.x + 16, y: bot.entity.position.y + 1, z: bot.entity.position.z + 16}, bot);
});
io.on('connection', (socket) => {
    bot.on('message', (message, pos, sender) => {
        socket.emit("msg", sender + ': ' + message.toString())  //send button status to client
        console.log(pos + "; " + sender + ": " + message.toString())
    })
    socket.on('trusted', (msg) => {
        io.emit('gen', generateTrusted(msg));
    });
    socket.on('owner', (msg) => {
        io.emit('gen', generateOwner(msg));
    });
})

const {
    randomInt,
} = require('node:crypto');
//   §
hash_counter = randomInt(999);
console.log(hash_counter);

function validateOwner(hashin) {
    const {
        createHash,
    } = require('node:crypto');
    hash = createHash('sha256');
    hash.update(process.argv[2] + hash_counter.toString());
    if (hash.digest('hex').substring(0,5) == hashin) {
        return true;
    } else {
        return false;
    }
}
function validateTrusted(hashin) {
    const {
        createHash,
    } = require('node:crypto');
    hash = createHash('sha256');
    hash.update(process.argv[3] + hash_counter.toString());
    if (hash.digest('hex').substring(0,5) == hashin) {
        return true;
    } else {
        return false;
    }
}
function generateOwner() {
    const {
        createHash,
    } = require('node:crypto');
    hash = createHash('sha256');
    hash.update(process.argv[2] + hash_counter.toString());
    return hash.digest('hex').substring(0,5);
}
function generateTrusted() {
    const {
        createHash,
    } = require('node:crypto');
    hash = createHash('sha256');
    hash.update(process.argv[3] + hash_counter.toString());
    return hash.digest('hex').substring(0,5);
}

bot.on('spawn', (username, message) => {
    //bot.chat("This is DataDecay's Bot")
    bot.chat('/tp DecayBot 6000 8 6000');
    bot.chatAddPattern(
        /db:(\S+) ?(.+)?/,
        "command",
        "Command Sent"
    )
    bot.chatAddPattern(
        /(\S+): \/(kick|ban) DecayBot/,
        "kick",
        "Ban Sent"
    )

    function say(what) {
        core.run('tellraw @a ["DecayBot: ' + what + '"]')
    }
    core.run('gamemode creative DecayBot'); 
    bot.chat('/god'); 
    core.run('vanish DecayBot'); 
    var loops;
    function cloop(what){
    	core.run(what)
    	}
    bot.on('kickban', (kicker) => {
        bot.chat("fuck you, " + kicker);
    })
    bot.on('command', (command, argsraw)=> {
        var args = argsraw.split(" ");
        switch (command) {
            case "help":
                core.run('tellraw @a [{"text":"hello, code, creator, ","color":"blue"},{"text":"cloop, stop-cloops, web-chat,","color":"green"},{"text":" stop","color":"dark_red"}]')
                break;
            case "hello":
                say('Hello World!')
                break;
            case "core":
                switch (args[1]){
                    case "refill":
                        core.refillCore();
                        break;
                    case "run":
                        let cmd = args.slice(2, args.length);
                        core.run(cmd.join(" ")
                        break;
                    default:
                        say("Invalid argument for 'core' command.");
                        break;
                }
                break;
            case "code":
                say('https://github.com/DataDecay/DecayBot')
                break;
            case "creator":
                say("DecayBot V1: Creator: DataDecay.")
                break;
            case "web-chat":
                if (validateOwner(args[0])) {
                    say("Go to https://datadecay.dev:8888")
                    hash_counter++;
                    console.log(hash_counter);
                } else if (validateTrusted(args[0])) {
                    say("Go to https://datadecay.dev:8888")
                    hash_counter++;
                    console.log(hash_counter);
                } else {
                    say('Invalid Hash')
                }
                break;
            case "cloop":
                let cmd = args.slice(1, args.length);
            if (validateOwner(args[0])) {
                    loops = setInterval(cloop,1, cmd);
                    say("Started cloop.")
                    hash_counter++;
                    console.log(hash_counter);
                } else if (validateTrusted(args[0])) {
                    loops = setInterval(cloop,500, cmd);
                    say("Started cloop.")
                    hash_counter++;
                    console.log(hash_counter);
                } else {
                    say('Invalid Hash')
                }
                
                break;
            case "stop-cloops":
            	
            	if (validateOwner(arg)) {
                    clearInterval(loops);
            	say("Stopped all cloops")
            	hash_counter++;
                    console.log(hash_counter);
                    
                } else if (validateTrusted(arg)) {
                    clearInterval(loops);
                    hash_counter++;
                    console.log(hash_counter);
            	say("Stopped all cloops")
            	break;
                    hash_counter++;
                    console.log(hash_counter);
                } else {
                    say('Invalid Hash')
                }
            case "hash-test":
                if (validateOwner(arg)) {
                    say('Valid owner hash')
                    hash_counter++;
                    console.log(hash_counter);
                } else if (validateTrusted(arg)) {
                    say("Valid trusted hash")
                    hash_counter++;
                    console.log(hash_counter);
                } else {
                    say('Invalid Hash')
                }
                break;
            case "stop":
                if (validateOwner(arg)) {
                    say('Stopping Bot...')
                    hash_counter++;
                    bot.quit("db:stop")
                } else {
                    say('Invalid Hash')
                }
                break;
            default:
                say('Unknown Command!')
                break;
        }
    })
})

// Log errors and kick reasons:
bot.on('kicked', () => {
    bot = mineflayer.createBot({
    host: process.argv[4], // minecraft server ip
    username: process.argv[6], // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
    auth: 'offline' // for offline mode servers, you can set this to 'offline'
    ///port: 35254,              // set if you need a port that isn't 25565
    // version: false,           // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
    // password: '12345678'      // set if you want to use password-based auth (may be unreliable). If specified, the `username` must be an email
})
})
bot.on('error', console.log)
io.on('connection', (socket) => {
    socket.on('send', (msg) => {
        bot.chat(msg)
    });
});
//web server
io.on('connection', (socket) => {
    socket.on('send', (msg) => {
        console.log('message: ' + msg);
    });
});
io.on('connection', (socket) => {
    socket.on('send', (msg) => {
        io.emit('msg', msg);
    });
});
