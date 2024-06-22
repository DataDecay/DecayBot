const mineflayer = require('mineflayer')
function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}
if (process.argv.length < 3 || process.argv.length > 5) {
  console.log('Usage : node multiple.js <host> <port>')
  process.exit(1)
}

let i = 0
function next () {
  if (i < 10) {
    i++
    setTimeout(() => {
      createBot(`spambot${i}`)
      sleep(6000)
      next()
    }, 100)
  }
}
next()

function createBot (name) {
  mineflayer.createBot({
    host: process.argv[2],
    port: parseInt(process.argv[3]),
    username: name
  })
}
