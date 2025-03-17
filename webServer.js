const http = require('http');
const fs = require('fs');
const socketIO = require('socket.io');
const HashUtilsLib = require('./hashUtils.js');

class WebServer {
    
    constructor(port, bot) {
        this.port = port;
        this.bot = bot;
        this.HashUtils = new HashUtilsLib;
    }

    start() {
        const server = http.createServer(this.handler.bind(this));
        const io = socketIO(server);

        server.listen(this.port);

        io.on('connection', (socket) => {
            this.handleSocketConnection(socket);
        });
    }

    handler(req, res) {

        fs.readFile(__dirname + req.url, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                return res.end("404 Not Found");
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(data);
            return res.end();
        });
    }

    handleSocketConnection(socket) {
        this.bot.on('message', (message, pos, sender) => {
            console.log("MESSAGE: [" + pos + "] " + sender + ': ' + message.toString());
            socket.emit("msg", "[" + pos + "] " + sender + ': ' + message.toString());
        });

        socket.on('send', (msg) => {
            this.bot.chat(msg);
        });
        socket.on('trusted', (msg) => {
        socket.emit('gen', this.HashUtils.generateTrusted(process.argv[2]));
    });
    socket.on('owner', (msg) => {
        socket.emit('gen', this.HashUtils.generateOwner(process.argv[1]));
    });
    }
}

module.exports = WebServer;
