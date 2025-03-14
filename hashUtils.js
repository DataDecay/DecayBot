const { createHash, randomInt } = require('crypto');

class HashUtils {
    hash_counter = 0;
    HashUtils() {
        hash_counter = randomInt(999);
    }
    function validateOwner(hashin, prefix) {
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

    function validateTrusted(hashin, prefix) {
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

    function generateOwner(prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        return hash.digest('hex').substring(0, 5);
    }

    function generateTrusted(prefix) {
        let hash = createHash('sha256');
        hash.update(prefix + hash_counter.toString());
        return hash.digest('hex').substring(0, 5);
    }
}

module.exports = HashUtils;
