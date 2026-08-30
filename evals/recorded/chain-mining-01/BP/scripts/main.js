import { system, world } from "@minecraft/server";

/** Tek seferde kirilacak azami blok. Sinirsiz zincir sunucuyu kilitler. */
const LIMIT = 32;

const OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const targetId = event.brokenBlockPermutation.type.id;
  const dimension = event.dimension;
  const queue = [event.block.location];
  const seen = new Set();
  let broken = 0;

  system.run(() => {
    while (queue.length > 0 && broken < LIMIT) {
      const at = queue.shift();
      if (at === undefined) break;

      for (const offset of OFFSETS) {
        const next = { x: at.x + offset.x, y: at.y + offset.y, z: at.z + offset.z };
        const key = next.x + "," + next.y + "," + next.z;
        if (seen.has(key)) continue;
        seen.add(key);

        const block = dimension.getBlock(next);
        if (block === undefined || block.typeId !== targetId) continue;

        dimension.setBlockType(next, "minecraft:air");
        queue.push(next);
        broken += 1;
      }
    }
  });
});
