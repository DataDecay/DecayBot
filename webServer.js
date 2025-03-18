const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');
const HashUtilsLib = require('./hashUtils.js');

class WebServer {

    constructor(port, bot) {
        this.port = port;
        this.bot = bot;
        this.HashUtils = new HashUtilsLib();
    }

    start() {
        const server = http.createServer(this.handler.bind(this));
        const io = socketIO(server);

        server.listen(this.port, () => {
            console.log(`Server running on port ${this.port}`);
        });

        io.on('connection', (socket) => {
            this.handleSocketConnection(socket);
        });
    }

    // Serve files, strip query strings and handle MIME types
    handler(req, res) {
        let pathname = req.url.split('?')[0]; // Remove query string
        if (pathname === '/') pathname = '/index.html'; // Default page

        const filePath = pathname;

        fs.readFile(filePath, (err, data) => {
            if (err) {
                // If file not found, fallback to index.html (SPA style)
                fs.readFile(__dirname + '/public' + pathname, (error, fallbackData) => {
                    if (error) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        return res.end("404 Not Found");
                    }

                    res.writeHead(200, { 'Content-Type': this.getMimeType('index.html') });
                    res.end(fallbackData);
                });
                return;
            }

            res.writeHead(200, { 'Content-Type': this.getMimeType(filePath) });
            res.end(data);
        });
    }

    // Simple MIME type detection
    getMimeType(filePath) {
        const ext = path.extname(filePath).slice(1); // Get file extension without the dot
        const mimeTypes = {
            'html': 'text/html',
            'js': 'application/javascript',
            'css': 'text/css',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon'
        };
        return mimeTypes[ext] || 'application/octet-stream'; // Default to binary stream
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
         socket.on('restart', () => {
             const pm2 = require('pm2');

pm2.connect(err => {
  if (err) return console.error(err);

  pm2.list((err, list) => {
    if (err) return console.error(err);

    const me = list.find(p => p.pid === process.pid);
    if (!me) return console.error('Process not found in PM2 list.');

    pm2.restart(me.pm_id, err => {
      pm2.disconnect();
      if (err) console.error('Restart failed:', err);
      else console.log('Restarted!');
    });
  });
});

});

        socket.on('owner', (msg) => {
            socket.emit('gen', this.HashUtils.generateOwner(process.argv[1]));
        });
    }
}

module.exports = WebServer;
