import { Player, world } from "@minecraft/server";

const KEY = "codecraft:kills";

world.afterEvents.entityDie.subscribe((event) => {
  const killer = event.damageSource.damagingEntity;
  if (!(killer instanceof Player)) return;

  const stored = killer.getDynamicProperty(KEY);
  const count = typeof stored === "number" ? stored + 1 : 1;

  killer.setDynamicProperty(KEY, count);
  killer.sendMessage("Toplam " + count + " mob oldurdun.");
});
