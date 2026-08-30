import { world } from "@minecraft/server";

world.afterEvents.itemCompleteUse.subscribe((event) => {
  if (event.itemStack.typeId !== "minecraft:apple") return;

  const health = event.source.getComponent("minecraft:health");
  if (health === undefined) return;

  health.setCurrentValue(health.effectiveMax);
});
