import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceBossState,
  BOSS,
  initializeBossState,
  WAVES,
  waveAtElapsed,
} from "../src/game-rules.js";

test("wave schedule advances from three timed waves into the boss phase", () => {
  assert.deepEqual(
    [0, 14_999, 15_000, 29_999, 30_000, 49_999, 50_000].map(
      (elapsed) => waveAtElapsed(elapsed).wave.id,
    ),
    ["wave-1", "wave-1", "wave-2", "wave-2", "wave-3", "wave-3", "boss"],
  );
  assert.equal(waveAtElapsed(15_000).remainingMs, WAVES[1].durationMs);
  assert.equal(waveAtElapsed(500_000).remainingMs, null);
});

test("boss state machine cycles attacks and enrages once below half health", () => {
  const boss = initializeBossState(
    { hp: BOSS.hp, maxHp: BOSS.hp },
    1_000,
  );
  assert.equal(boss.bossState, "idle");

  advanceBossState(boss, boss.stateUntil, 10);
  assert.equal(boss.bossState, "chase");
  advanceBossState(boss, 2_000, BOSS.attackRange);
  assert.equal(boss.bossState, "attack1");
  advanceBossState(boss, boss.stateUntil, 1);
  assert.equal(boss.bossState, "attack2");
  advanceBossState(boss, boss.stateUntil, 1);
  assert.equal(boss.bossState, "cooldown");
  advanceBossState(boss, boss.stateUntil, 1);
  assert.equal(boss.bossState, "chase");

  boss.hp = boss.maxHp / 2;
  advanceBossState(boss, 10_000, 10);
  assert.equal(boss.bossState, "enrage");
  assert.equal(boss.enraged, true);
  advanceBossState(boss, boss.stateUntil, 10);
  assert.equal(boss.bossState, "chase");
});
