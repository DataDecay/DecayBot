/**
 * @fileoverview
 * Main entry point for starting the bot and initializing its functionality.
 * This file creates an instance of the Bot class and starts it.
 */

const Bot = require('./bot.js');  // Import the Bot class
const bot = new Bot();  // Create an instance of the Bot

/**
 * Starts the bot.
 * This initializes the bot and begins its operations.
 */
bot.start();
