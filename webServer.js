const http = require('http');
const fs = require('fs');
const socketIO = require('socket.io');

class WebServer {
    constructor(port, bot) {
        this.port = port;
        this.bot = bot;
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
        const filePath = req.url === "/hash" ? '/public/hash.html' : '/public/index.html';
        fs.readFile(__dirname + filePath, (err, data) => {
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
            socket.emit("msg", sender + ': ' + message.toString());
        });

        socket.on('send', (msg) => {
            this.bot.chat(msg);
        });
    }
}

module.exports = WebServer;
