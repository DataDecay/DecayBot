/**
 * @fileoverview
 * This file defines the Bot class, which initializes and manages a Minecraft bot using Mineflayer.
 * It integrates the CommandCore, CommandParser, HashUtils, and a WebServer to handle in-game and external commands.
 */

const mineflayer = require('mineflayer');
const CommandCore = require('./commandCore.js');
const HashUtilsLib = require('./hashUtils.js');
const WebServer = require('./webServer.js');
const CommandParser = require('./commandParser.js');
const config = require('config');

/**
 * Bot is the main class that sets up and manages the Mineflayer bot,
 * including command parsing, web server integration, and command block control.
 */
class Bot {
    /**
     * Creates a new Bot instance.
     */
    constructor() {
        /**
         * @type {mineflayer.Bot|null}
         * The Mineflayer bot instance, initialized in start().
         */
        this.bot = null;

        /**
         * @type {HashUtilsLib}
         * Utility library for handling hashes.
         */
        this.HashUtils = new HashUtilsLib();
    }

    /**
     * Starts the Mineflayer bot and sets up all event listeners, command processing, and the web server.
     * @returns {void}
     */
    start() {
        // Create the Mineflayer bot instance with configuration parameters
        this.bot = mineflayer.createBot({
            host: config.get("connection.serverName"),
            username: config.get("connection.botName"),
            auth: 'offline',
            version: '' // Auto-detect version
        });

        /**
         * @type {any}
         * The bot's client connection (low-level).
         */
        this.client = this.bot._client;

        // When the bot spawns in the game world
        this.bot.on('spawn', () => {
            /**
             * Adds a custom chat pattern listener for commands.
             * Matches messages that start with "db:" followed by a command and optional arguments.
             * Example: db:help or db:command arg1 arg2
             */
            this.bot.chatAddPattern(/db:(\S+) ?(.+)?/, "command", "Command Sent");

            // Initialize the web server and pass bot + HashUtils for external interactions
            const io = new WebServer(config.get("webServer.port"), this.bot, this.HashUtils);
            io.start();

            // Put the bot in creative flying mode and teleport it to a specific position
            this.bot.creative.startFlying();
            this.client.chat("/tp " + config.get("connection.botName") + " 6000 -49 6000");

            // Initialize Command Core to control command blocks
            this.bot.core = new CommandCore(
                { x: 6000, y: -50, z: 6000 },
                { x: 6010, y: -52, z: 6010 },
                this.bot
            );

            // Fill the command block region
            this.bot.core.refillCore(
                { x: 6000, y: -50, z: 6000 },
                { x: 6010, y: -52, z: 6010 }
            );

            // Initialize the command parser to handle in-game commands
            this.commandParser = new CommandParser(this.bot, this.HashUtils);

            // Notify players in-game that the bot is initialized
            this.say("DecayBot core initialized");

            /**
             * Event listener for commands sent via chat that match the `db:` pattern.
             * @event Bot#command
             * @param {string} command - The command name.
             * @param {string} argsraw - The raw argument string.
             */
            this.bot.on('command', async (command, argsraw) => {
                console.log(`${command}, ${argsraw}`);
                if (command === "help") {
                    this.commandParser.showHelp();
                } else {
                    await this.commandParser.handleCommand(
                        command,
                        argsraw ? argsraw.split(" ") : []
                    );
                }
            });

            /**
             * Event listener for when the bot dies in-game.
             * Automatically teleports the bot back to its spawn location.
             */
            this.bot.on('death', () => {
                this.client.chat("/tp " + config.get("connection.botName") + " 6000 -49 6000");
            });

            // Log any errors encountered by the bot
            this.bot.on('error', console.log);
        });
    }

    /**
     * Sends a tellraw message to all players in the game.
     * @param {string} text - The message text to display.
     * @param {string} [colour="white"] - The color of the message text.
     * @returns {void}
     */
    say(text, colour = "white") {
        this.bot.core.run(`tellraw @a [{"text":"${text}","color":"${colour}"}]`);
    }
}

module.exports = Bot;
