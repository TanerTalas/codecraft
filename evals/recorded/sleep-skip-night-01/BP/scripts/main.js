import { system, world } from "@minecraft/server";

const MORNING = 0;

system.runInterval(() => {
  const sleeping = world.getPlayers().some((player) => player.isSleeping);
  if (!sleeping) return;

  world.setTimeOfDay(MORNING);
  world.sendMessage("Gece gecti.");
}, 20);
