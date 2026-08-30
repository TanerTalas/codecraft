import { world } from "@minecraft/server";

world.events.tick.subscribe((event) => {
  if (event.currentTick % 600 !== 0) return;

  for (const player of world.getPlayers()) {
    player.dimension.spawnEntity("minecraft:zombie", player.location);
  }
});
