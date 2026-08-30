import { ItemStack, world } from "@minecraft/server";

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;

  const inventory = event.player.getComponent("minecraft:inventory");
  const container = inventory?.container;
  if (container === undefined) return;

  container.addItem(new ItemStack("minecraft:iron_sword", 1));
  event.player.sendMessage("Baslangic esyan verildi.");
});
