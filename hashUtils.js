const { createHash, randomInt } = require('crypto');

class HashUtils {
    hash_counter = 0;
    constructor() {
        hash_counter = randomInt(999);
    }
    validateOwner(hashin, prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        let digest = hash.digest('hex').substring(0, 5);
        console.log(digest);
        console.log(hashin);
        let allowed = digest === hashin;
        if (allowed){
            this.hash_counter++;
        }
        return allowed;
        
    }

    validateTrusted(hashin, prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        let digest = hash.digest('hex').substring(0, 5);
        console.log(digest);
        console.log(hashin);
        let allowed = digest === hashin;
        if (allowed){
            this.hash_counter++;
        }
        return allowed;
    }

    generateOwner(prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        return hash.digest('hex').substring(0, 5);
    }

    generateTrusted(prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        return hash.digest('hex').substring(0, 5);
    }
}

module.exports = HashUtils;
