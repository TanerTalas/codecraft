import { world } from "@minecraft/server";

const RULES = [
  "1. Baskasinin evini yikma",
  "2. Sohbette kufur yok",
  "3. Iyi eglenceler",
];

world.afterEvents.playerSpawn.subscribe((event) => {
  for (const line of RULES) {
    event.player.sendMessage(line);
  }
});
