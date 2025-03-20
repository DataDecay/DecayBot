/**
 * @fileoverview
 * Provides utility methods for hash generation and validation using SHA-256.
 * The class `HashUtils` offers functions to generate and validate hashes for owners and trusted users.
 */

const { createHash, randomInt } = require('crypto');

/**
 * HashUtils class provides methods to generate and validate hashes for owners and trusted users.
 * It uses SHA-256 hashing to create short hashes for validation.
 * The hash counter is incremented each time a validation or generation method is used.
 */
class HashUtils {
    /**
     * @static
     * @type {number}
     * Keeps track of the current hash counter. This is used as part of the hash input.
     */
    static hash_counter = 0;

    /**
     * Creates a new HashUtils instance.
     * Initializes the `hash_counter` to a random number between 0 and 999.
     */
    constructor() {
        this.constructor.hash_counter = randomInt(999);
    }

    /**
     * Validates if the provided hash is valid for the owner.
     * It compares the hash against the generated hash based on the current `hash_counter` and prefix.
     * If valid, it increments the `hash_counter`.
     *
     * @param {string} hashin - The hash to validate.
     * @param {string} prefix - The prefix to use for generating the hash.
     * @returns {boolean} Returns true if the provided hash matches the generated hash, otherwise false.
     */
    validateOwner(hashin, prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + this.constructor.hash_counter.toString());
        let digest = hash.digest('hex').substring(0, 5);
        console.log(digest);
        console.log(hashin);
        let allowed = digest === hashin;
        if (allowed) {
            this.constructor.hash_counter++;
        }
        return allowed;
    }

    /**
     * Validates if the provided hash is valid for a trusted user.
     * It compares the hash against the generated hash based on the current `hash_counter` and prefix.
     * If valid, it increments the `hash_counter`.
     *
     * @param {string} hashin - The hash to validate.
     * @param {string} prefix - The prefix to use for generating the hash.
     * @returns {boolean} Returns true if the provided hash matches the generated hash, otherwise false.
     */
    validateTrusted(hashin, prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + this.constructor.hash_counter.toString());
        let digest = hash.digest('hex').substring(0, 5);
        console.log(digest);
        console.log(hashin);
        let allowed = digest === hashin;
        if (allowed) {
            this.constructor.hash_counter++;
        }
        return allowed;
    }

    /**
     * Generates an owner hash using the provided prefix and the current `hash_counter`.
     * The generated hash is a short 5-character substring of the full SHA-256 digest.
     *
     * @param {string} prefix - The prefix to use for generating the hash.
     * @returns {string} The generated owner hash (first 5 characters of the SHA-256 digest).
     */
    generateOwner(prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + this.constructor.hash_counter.toString());
        return hash.digest('hex').substring(0, 5);
    }

    /**
     * Generates a trusted user hash using the provided prefix and the current `hash_counter`.
     * The generated hash is a short 5-character substring of the full SHA-256 digest.
     *
     * @param {string} prefix - The prefix to use for generating the hash.
     * @returns {string} The generated trusted user hash (first 5 characters of the SHA-256 digest).
     */
    generateTrusted(prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + this.constructor.hash_counter.toString());
        return hash.digest('hex').substring(0, 5);
    }
}

module.exports = HashUtils;
