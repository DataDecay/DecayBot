// commandcore.js
class CommandCore {
  constructor(xyz, toxyz, bot) {
    this.useBlockxyz = {x: xyz.x, y: xyz.y, z: xyz.z};
    this.client = bot._client;
    this.i = 1;
    this.refillCore();
  }

  refillCore(_xyz = this.xyz, _toxyz = this.toxyz) {
    this.xyz = _xyz = {x: Math.round(_xyz.x), y: Math.round(_xyz.y), z: Math.round(_xyz.z)};
    this.toxyz = _toxyz = {x: Math.round(_toxyz.x), y: Math.round(_toxyz.y), z: Math.round(_toxyz.z)};
    this.client.chat(`/fill ${_xyz.x} ${_xyz.y} ${_xyz.z} ${_toxyz.x} ${_toxyz.y} ${_toxyz.z} repeating_command_block`);
  }

  run(command) {
    console.log("cmd")
    console.log(command.slice(0, 32767))
    this.client.write("update_command_block", { location: this.useBlockxyz, command: command.slice(0, 32767), mode: 1, flags: 0x04 });
    //console.log("choosing cmdblock: ", this.useBlockxyz);

    let coords = indexToCoords(this.i++, this.xyz, this.toxyz);
    //console.log(coords)
    this.useBlockxyz = coords;
  }
}

function indexToCoords(i, start={x:0, y:0, z:0}, end={x: 0, y: 0, z:0}) {
 let sizeX = Math.abs(end.x - start.x) + 1;
 let sizeY = Math.abs(end.y - start.y) + 1;
 let sizeZ = Math.abs(end.z - start.z) + 1;

 let x = i % sizeX;
 let y = Math.floor(i / (sizeX * sizeZ)) % sizeY;
 let z = Math.floor(i / sizeX) % sizeZ;

 return {
  x: start.x + x,
  y: start.y + y,
  z: start.z + z
 };
}

module.exports = CommandCore;
