import { EntityDamageCause, Player, world } from "@minecraft/server";

world.afterEvents.entityHurt.subscribe((event) => {
  if (event.damageSource.cause !== EntityDamageCause.fall) return;

  const hurt = event.hurtEntity;
  if (!(hurt instanceof Player)) return;

  const health = hurt.getComponent("minecraft:health");
  if (health === undefined) return;

  health.setCurrentValue(health.currentValue + event.damage);
});
