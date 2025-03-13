const { createHash, randomInt } = require('crypto');

let hash_counter = randomInt(999);

class HashUtils {
    static validateOwner(hashin, prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        return hash.digest('hex').substring(0, 5) === hashin;
    }

    static validateTrusted(hashin, prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        return hash.digest('hex').substring(0, 5) === hashin;
    }

    static generateOwner(prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        return hash.digest('hex').substring(0, 5);
    }

    static generateTrusted(prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        return hash.digest('hex').substring(0, 5);
    }
}

module.exports = HashUtils;
