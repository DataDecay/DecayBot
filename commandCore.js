/**
 * CommandCore is responsible for managing a region of repeating command blocks,
 * allowing commands to be dynamically sent to them and executed in sequence.
 */
class CommandCore {
  /**
   * Creates an instance of CommandCore.
   * @param {Object} xyz - The starting coordinates (x, y, z) for the command block grid.
   * @param {Object} toxyz - The ending coordinates (x, y, z) defining the opposite corner of the command block grid.
   * @param {Object} bot - The bot instance, expected to have a `client` and `entity.position`.
   */
  constructor(xyz, toxyz, bot) {
    /**
     * @type {Object}
     * @description The starting position for the command block grid.
     */
    this.xyz = bot.entity.position;

    /**
     * @type {Object}
     * @description The ending position for the command block grid. Offset from xyz by +16 on x and z axes.
     */
    this.toxyz = {
      x: bot.entity.position.x + 16,
      y: this.xyz.y + 1,
      z: bot.entity.position.z + 16
    };

    /**
     * @type {Object}
     * @description The current block coordinates being used to run the next command.
     */
    this.useBlockxyz = {
      x: xyz.x,
      y: xyz.y,
      z: xyz.z
    };

    /**
     * @type {Object}
     * @description The bot's client interface for sending packets.
     */
    this.client = bot._client;

    /**
     * @type {number}
     * @description Internal counter for indexing through the command block grid.
     */
    this.i = 1;

    // Initialize the command block region with repeating command blocks
    this.refillCore();
  }

  /**
   * Refills (or resets) the command block region with repeating command blocks.
   * @param {Object} [_xyz=this.xyz] - The new starting coordinates.
   * @param {Object} [_toxyz=this.toxyz] - The new ending coordinates.
   * @returns {void}
   */
  refillCore(_xyz = this.xyz, _toxyz = this.toxyz) {
    // Round positions to nearest integers
    this.xyz = _xyz = {
      x: Math.round(_xyz.x),
      y: Math.round(_xyz.y),
      z: Math.round(_xyz.z)
    };

    this.toxyz = _toxyz = {
      x: Math.round(_toxyz.x),
      y: Math.round(_toxyz.y),
      z: Math.round(_toxyz.z)
    };

    // Issue the /fill command to create repeating command blocks in the specified region
    this.client.chat(`/fill ${_xyz.x} ${_xyz.y} ${_xyz.z} ${_toxyz.x} ${_toxyz.y} ${_toxyz.z} repeating_command_block`);
  }

  /**
   * Sends a command to the next available command block in the region.
   * @param {string} command - The Minecraft command to run (must be ≤ 32767 characters).
   * @returns {void}
   */
  run(command) {
    // Write the command to the current command block
    this.client.write("update_command_block", {
      location: this.useBlockxyz,
      command: command.slice(0, 32767),
      mode: 1,      // Mode 1: Redstone (needsRedstone == false)
      flags: 0x04   // Conditional bitmask, 0x04 usually means "auto-execute"
    });

    // Get next block coordinates in the sequence and update useBlockxyz
    const coords = indexToCoords(this.i++, this.xyz, this.toxyz);
    this.useBlockxyz = coords;
  }
}

/**
 * Converts a linear index to a 3D coordinate within the bounds defined by start and end points.
 * @param {number} i - The index of the command block in the grid (1-based).
 * @param {Object} start - The starting coordinates of the region ({ x, y, z }).
 * @param {Object} end - The ending coordinates of the region ({ x, y, z }).
 * @returns {Object} The 3D coordinates corresponding to the index within the region.
 */
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
