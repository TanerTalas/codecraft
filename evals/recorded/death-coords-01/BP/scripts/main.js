import { Player, world } from "@minecraft/server";

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (!(dead instanceof Player)) return;

  const { x, y, z } = dead.location;
  dead.sendMessage(
    "Oldugun yer: " + Math.floor(x) + " " + Math.floor(y) + " " + Math.floor(z),
  );
});
