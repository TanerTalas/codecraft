import { system, world } from "@minecraft/server";

const RADIUS = 8;
const TARGET = "minecraft:diamond_ore";

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const origin = player.location;

    for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
      for (let dy = -RADIUS; dy <= RADIUS; dy += 1) {
        for (let dz = -RADIUS; dz <= RADIUS; dz += 1) {
          const block = player.dimension.getBlock({
            x: origin.x + dx,
            y: origin.y + dy,
            z: origin.z + dz,
          });
          if (block?.typeId !== TARGET) continue;

          player.sendMessage("Yakinlarda elmas cevheri var.");
          return;
        }
      }
    }
  }
}, 100);
