export const WAVES = Object.freeze([
  Object.freeze({
    id: "wave-1",
    label: "WAVE 1",
    kind: "normal",
    durationMs: 15_000,
    openingCount: 4,
    spawnIntervalMs: 2_500,
  }),
  Object.freeze({
    id: "wave-2",
    label: "WAVE 2",
    kind: "normal",
    durationMs: 15_000,
    openingCount: 6,
    spawnIntervalMs: 1_800,
  }),
  Object.freeze({
    id: "wave-3",
    label: "WAVE 3",
    kind: "normal",
    durationMs: 20_000,
    openingCount: 8,
    spawnIntervalMs: 1_200,
  }),
  Object.freeze({
    id: "boss",
    label: "BOSS",
    kind: "boss",
    durationMs: null,
  }),
]);

export const BOSS = Object.freeze({
  hp: 3_000,
  speed: 0.9,
  enragedSpeed: 1.35,
  collisionRadius: 1.45,
  attackRange: 3.2,
  attack1Radius: 3.4,
  attack1Damage: 22,
  attack2Radius: 5.2,
  attack2Damage: 14,
  enragedDamageMultiplier: 1.5,
});

const BOSS_STATE_DURATION_MS = Object.freeze({
  idle: 900,
  attack1: 700,
  attack2: 900,
  cooldown: 1_100,
  enrage: 1_200,
});

export function waveAtElapsed(elapsedMs) {
  const safeElapsed = Math.max(0, elapsedMs);
  let startsAt = 0;

  for (let index = 0; index < WAVES.length; index += 1) {
    const wave = WAVES[index];
    if (wave.durationMs === null || safeElapsed < startsAt + wave.durationMs) {
      const elapsedInWave = safeElapsed - startsAt;
      return {
        index,
        wave,
        elapsedInWave,
        remainingMs:
          wave.durationMs === null
            ? null
            : Math.max(0, wave.durationMs - elapsedInWave),
      };
    }
    startsAt += wave.durationMs;
  }

  throw new Error("WAVES must end with an unlimited phase");
}

function enterBossState(boss, state, now) {
  boss.bossState = state;
  boss.attackApplied = false;
  const duration = BOSS_STATE_DURATION_MS[state];
  boss.stateUntil = duration === undefined ? Infinity : now + duration;
  boss.attackAt =
    state === "attack1" || state === "attack2"
      ? now + duration * 0.55
      : Infinity;
}

export function advanceBossState(boss, now, targetDistance) {
  if (!boss.enraged && boss.hp <= boss.maxHp * 0.5) {
    boss.enraged = true;
    enterBossState(boss, "enrage", now);
    return true;
  }

  if (boss.bossState === "chase") {
    if (targetDistance <= BOSS.attackRange) {
      enterBossState(boss, "attack1", now);
      return true;
    }
    return false;
  }

  if (now < boss.stateUntil) return false;

  const nextState = {
    idle: "chase",
    attack1: "attack2",
    attack2: "cooldown",
    cooldown: "chase",
    enrage: "chase",
  }[boss.bossState];

  if (!nextState) return false;
  enterBossState(boss, nextState, now);
  if (nextState === "cooldown" && boss.enraged) {
    boss.stateUntil = now + BOSS_STATE_DURATION_MS.cooldown * 0.65;
  }
  return true;
}

export function initializeBossState(boss, now) {
  boss.enraged = false;
  enterBossState(boss, "idle", now);
  return boss;
}
