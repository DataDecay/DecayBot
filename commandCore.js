class CommandCore {
  constructor(xyz, toxyz, bot) {
    this.bot = bot;
    this.client = bot._client;

    this.xyz = {
      x: Math.round(bot.entity.position.x),
      y: Math.round(bot.entity.position.y),
      z: Math.round(bot.entity.position.z)
    };

    this.toxyz = {
      x: this.xyz.x + 16,
      y: this.xyz.y + 1,
      z: this.xyz.z + 16
    };

    this.useBlockxyz = { x: xyz.x, y: xyz.y, z: xyz.z };
    this.i = 1;

    this.refillCore(); // Prepare the blocks when initializing
  }

  refillCore(_xyz = this.xyz, _toxyz = this.toxyz) {
    this.xyz = {
      x: Math.round(_xyz.x),
      y: Math.round(_xyz.y),
      z: Math.round(_xyz.z)
    };

    this.toxyz = {
      x: Math.round(_toxyz.x),
      y: Math.round(_toxyz.y),
      z: Math.round(_toxyz.z)
    };

    const sizeX = Math.abs(this.toxyz.x - this.xyz.x) + 1;
    const sizeY = Math.abs(this.toxyz.y - this.xyz.y) + 1;
    const sizeZ = Math.abs(this.toxyz.z - this.xyz.z) + 1;

    let blockCount = 0;

    // Place always-active repeating command blocks using /setblock
    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
          const px = this.xyz.x + x;
          const py = this.xyz.y + y;
          const pz = this.xyz.z + z;

          const cmd = `/setblock ${px} ${py} ${pz} repeating_command_block[facing=up]{auto:1b}`;
          this.client.chat(cmd);

          blockCount++;
        }
      }
    }

    console.log(`Refilled ${blockCount} command blocks from (${this.xyz.x}, ${this.xyz.y}, ${this.xyz.z}) to (${this.toxyz.x}, ${this.toxyz.y}, ${this.toxyz.z})`);
  }

  run(command) {
    const trimmedCommand = command.slice(0, 32767); // Just in case it’s huge

    console.log("Running command:", trimmedCommand);
    console.log("At location:", this.useBlockxyz);

    this.client.write("update_command_block", {
      location: this.useBlockxyz,
      command: trimmedCommand,
      mode: 2,        // Auto Mode
      flags: 0x05     // Track Output + Auto
    });

    const coords = indexToCoords(this.i++, this.xyz, this.toxyz);
    this.useBlockxyz = coords;
  }
}

// Coordinate math to find where in the grid the next block is
function indexToCoords(i, start = { x: 0, y: 0, z: 0 }, end = { x: 0, y: 0, z: 0 }) {
  const sizeX = Math.abs(end.x - start.x) + 1;
  const sizeY = Math.abs(end.y - start.y) + 1;
  const sizeZ = Math.abs(end.z - start.z) + 1;

  const x = i % sizeX;
  const y = Math.floor(i / (sizeX * sizeZ)) % sizeY;
  const z = Math.floor(i / sizeX) % sizeZ;

  return {
    x: start.x + x,
    y: start.y + y,
    z: start.z + z
  };
}

module.exports = CommandCore;
