var http = require('http').createServer(handler); //require http server, and create server with function handler()
var fs = require('fs'); //require filesystem module
var io = require('socket.io')(http) //require socket.io module and pass the http object (server)

http.listen(8888); //listen to port 8080

function handler (req, res) { //create server
  fs.readFile(__dirname + '/public/index.html', function(err, data) { //read file index.html in public folder
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/html'}); //display 404 on error
      return res.end("404 Not Found");
    }
    res.writeHead(200, {'Content-Type': 'text/html'}); //write HTML
    res.write(data); //write data from index.html
    return res.end();
  });
}
io.sockets.on('connection', function (socket) {// WebSocket Connection
  var lightvalue = 0; //static variable for current status
  socket.on('light', function(data) { //get light switch status from client
    lightvalue = data;
    if (lightvalue) {
      console.log(lightvalue); //turn LED on or off, for now we will just show it in console.log
    }
  });
}); 


var http2 = require('http').createServer(handler2); //require http server, and create server with function handler()
var fs2 = require('fs'); //require filesystem module
var io2 = require('socket.io')(http2) //require socket.io module and pass the http object (server)

http2.listen(6666); //listen to port 8080

function handler2 (req, res) { //create server
  fs2.readFile(__dirname + '/public/hash.html', function(err, data) { //read file index.html in public folder
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/html'}); //display 404 on error
      return res.end("404 Not Found");
    }
    res.writeHead(200, {'Content-Type': 'text/html'}); //write HTML
    res.write(data); //write data from index.html
    return res.end();
  });
}

//bot
require('node:crypto');



// Prints:
//   6a2da20943931e9834fc12cfe5bb47bbd9ae43489a30726962b576f4e3993e50
const mineflayer = require('mineflayer')

const bot = mineflayer.createBot({
  host: 'kaboom.pw', // minecraft server ip
  username: 'DecayBot', // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
  auth: 'offline' // for offline mode servers, you can set this to 'offline'
  ///port: 35254,              // set if you need a port that isn't 25565
  // version: false,           // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
  // password: '12345678'      // set if you want to use password-based auth (may be unreliable). If specified, the `username` must be an email
})

io.on('connection', (socket) => {
bot.on('message', (message, pos, sender) => {
  socket.emit(sender + ': ' + message.toString()); //send button status to client
  console.log(sender + ": " + message.toString())
})
})


//   §
hash_counter = 0;
hash_prefix = "insert prefix";

bot.on('spawn', (username, message) => {
  //bot.chat("This is DataDecay's Bot")
  bot.chatAddPattern(
  /db:(.+) (.+)/,
  "command",
  "Command Sent"
)
bot.on('command', (command, arg) => {
  switch(command){
    case "help":
      bot.chat('Commands: hello, code')
      break;
    case "hello":
      bot.chat('Hello World!')
      break;
    case "code":
      bot.chat('https://github.com/DataDecay/DecayBot')
      break;
    case "hash-test":
      const {
  createHash,
} = require('node:crypto');
      hash = createHash('sha256');
      hash.update(hash_prefix + hash_counter.toString());
      validHash = hash.digest('hex');
        if(arg==validHash){
          bot.chat('Valid Hash')
          hash_counter++;
          } else {
          bot.chat('Invalid Hash')
          }
      break;
      case "stop":
      const {
  createHash,
} = require('node:crypto');
      hash = createHash('sha256');
      hash.update(hash_prefix + hash_counter.toString());
      validHash = hash.digest('hex');
        if(arg==validHash){
        bot.chat('Stopping bot')
          throw new Error();
          hash_counter++;
          } else {
          bot.chat('Invalid Hash')
          }
      break;
    default:
      bot.chat('Unknown Command!')
      break;
  }
})
})

// Log errors and kick reasons:
bot.on('kicked', console.log)
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
