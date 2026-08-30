import { world } from "@minecraft/server";

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const { x, y, z } = event.block.location;
  world.sendMessage(
    event.player.name + " " + event.block.typeId + " koydu (" + x + " " + y + " " + z + ")",
  );
});
