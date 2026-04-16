"use strict";
(() => {
  // src/map.ts
  var WORLD_W = 2400;
  var WORLD_H = 2400;
  var CANVAS_W = 1280;
  var CANVAS_H = 720;
  var LANE_WIDTH = 160;
  var LANE_WAYPOINTS = [
    { x: 220, y: 2180 },
    { x: 600, y: 1800 },
    { x: 1e3, y: 1400 },
    { x: 1200, y: 1200 },
    { x: 1400, y: 1e3 },
    { x: 1800, y: 600 },
    { x: 2180, y: 220 }
  ];
  var RADIANT_PATH = [...LANE_WAYPOINTS];
  var DIRE_PATH = [...LANE_WAYPOINTS].reverse();
  var TOWER_POSITIONS = {
    radiant: {
      t1: { x: 600, y: 1800 },
      t2: { x: 1050, y: 1350 },
      t3: { x: 1750, y: 650 },
      hq: { x: 220, y: 2180 }
    },
    dire: {
      t1: { x: 1800, y: 600 },
      t2: { x: 1350, y: 1050 },
      t3: { x: 650, y: 1750 },
      ancient: { x: 2180, y: 220 }
    }
  };
  function screenToWorld(pos, cam) {
    return { x: pos.x + cam.x, y: pos.y + cam.y };
  }
  function dist(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
  }
  function uniqueId(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
  }
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function updateCamera(state2, dt) {
    const cam = state2.camera;
    const hero = state2.hero;
    cam.targetX = hero.pos.x - CANVAS_W / 2;
    cam.targetY = hero.pos.y - CANVAS_H / 2;
    cam.targetX = clamp(cam.targetX, 0, WORLD_W - CANVAS_W);
    cam.targetY = clamp(cam.targetY, 0, WORLD_H - CANVAS_H);
    cam.x += (cam.targetX - cam.x) * cam.LERP_SPEED * dt * 60;
    cam.y += (cam.targetY - cam.y) * cam.LERP_SPEED * dt * 60;
  }
  function renderMap(ctx2, cam) {
    ctx2.fillStyle = "#0d1a0d";
    ctx2.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx2.strokeStyle = "#0f1f0f";
    ctx2.lineWidth = 1;
    const gridSize = 120;
    const startX = Math.floor(cam.x / gridSize) * gridSize;
    const endX = cam.x + CANVAS_W + gridSize;
    const startY = Math.floor(cam.y / gridSize) * gridSize;
    const endY = cam.y + CANVAS_H + gridSize;
    for (let x = startX; x <= endX; x += gridSize) {
      ctx2.beginPath();
      ctx2.moveTo(x, startY);
      ctx2.lineTo(x, endY);
      ctx2.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx2.beginPath();
      ctx2.moveTo(startX, y);
      ctx2.lineTo(endX, y);
      ctx2.stroke();
    }
    const wps = LANE_WAYPOINTS;
    ctx2.save();
    ctx2.lineWidth = LANE_WIDTH;
    ctx2.lineCap = "round";
    ctx2.lineJoin = "round";
    ctx2.strokeStyle = "#1c2c1c";
    ctx2.beginPath();
    ctx2.moveTo(wps[0].x, wps[0].y);
    for (let i = 1; i < wps.length; i++) {
      ctx2.lineTo(wps[i].x, wps[i].y);
    }
    ctx2.stroke();
    ctx2.lineWidth = LANE_WIDTH + 12;
    ctx2.strokeStyle = "#0a150a";
    ctx2.globalAlpha = 0.5;
    ctx2.beginPath();
    ctx2.moveTo(wps[0].x, wps[0].y);
    for (let i = 1; i < wps.length; i++) {
      ctx2.lineTo(wps[i].x, wps[i].y);
    }
    ctx2.stroke();
    ctx2.globalAlpha = 1;
    ctx2.setLineDash([20, 20]);
    ctx2.lineWidth = 2;
    ctx2.strokeStyle = "#2a4a2a";
    ctx2.beginPath();
    ctx2.moveTo(wps[0].x, wps[0].y);
    for (let i = 1; i < wps.length; i++) {
      ctx2.lineTo(wps[i].x, wps[i].y);
    }
    ctx2.stroke();
    ctx2.setLineDash([]);
    ctx2.restore();
    const radHQ = TOWER_POSITIONS.radiant.hq;
    const radGrad = ctx2.createRadialGradient(radHQ.x, radHQ.y, 0, radHQ.x, radHQ.y, 320);
    radGrad.addColorStop(0, "rgba(76,175,80,0.18)");
    radGrad.addColorStop(1, "rgba(76,175,80,0)");
    ctx2.fillStyle = radGrad;
    ctx2.beginPath();
    ctx2.arc(radHQ.x, radHQ.y, 320, 0, Math.PI * 2);
    ctx2.fill();
    const dirAncient = TOWER_POSITIONS.dire.ancient;
    const dirGrad = ctx2.createRadialGradient(dirAncient.x, dirAncient.y, 0, dirAncient.x, dirAncient.y, 320);
    dirGrad.addColorStop(0, "rgba(255,87,34,0.18)");
    dirGrad.addColorStop(1, "rgba(255,87,34,0)");
    ctx2.fillStyle = dirGrad;
    ctx2.beginPath();
    ctx2.arc(dirAncient.x, dirAncient.y, 320, 0, Math.PI * 2);
    ctx2.fill();
  }
  var MM_X = 16;
  var MM_Y = CANVAS_H - 196;
  var MM_W = 180;
  var MM_H = 180;
  function renderMinimap(ctx2, state2) {
    const { hero, radiantCreeps, direCreeps, radiantTowers, direTowers } = state2;
    ctx2.fillStyle = "rgba(0,0,0,0.75)";
    ctx2.fillRect(MM_X, MM_Y, MM_W, MM_H);
    ctx2.strokeStyle = "#333";
    ctx2.lineWidth = 1;
    ctx2.strokeRect(MM_X, MM_Y, MM_W, MM_H);
    function toMM(pos) {
      return {
        x: MM_X + pos.x / WORLD_W * MM_W,
        y: MM_Y + pos.y / WORLD_H * MM_H
      };
    }
    ctx2.strokeStyle = "#2a4a2a";
    ctx2.lineWidth = 4;
    ctx2.beginPath();
    const wps = LANE_WAYPOINTS;
    const mm0 = toMM(wps[0]);
    ctx2.moveTo(mm0.x, mm0.y);
    for (let i = 1; i < wps.length; i++) {
      const mm = toMM(wps[i]);
      ctx2.lineTo(mm.x, mm.y);
    }
    ctx2.stroke();
    for (const t of radiantTowers) {
      if (!t.destroyed) {
        const mm = toMM(t.pos);
        ctx2.fillStyle = t.team === "radiant" /* Radiant */ ? "#4CAF50" : "#FF5722";
        ctx2.fillRect(mm.x - 3, mm.y - 3, 6, 6);
      }
    }
    for (const t of direTowers) {
      if (!t.destroyed) {
        const mm = toMM(t.pos);
        ctx2.fillStyle = "#FF5722";
        ctx2.fillRect(mm.x - 3, mm.y - 3, 6, 6);
      }
    }
    for (const c of radiantCreeps) {
      if (!c.alive) continue;
      const mm = toMM(c.pos);
      ctx2.fillStyle = "#66BB6A";
      ctx2.beginPath();
      ctx2.arc(mm.x, mm.y, 2, 0, Math.PI * 2);
      ctx2.fill();
    }
    for (const c of direCreeps) {
      if (!c.alive) continue;
      const mm = toMM(c.pos);
      ctx2.fillStyle = "#FF7043";
      ctx2.beginPath();
      ctx2.arc(mm.x, mm.y, 2, 0, Math.PI * 2);
      ctx2.fill();
    }
    const cam = state2.camera;
    ctx2.strokeStyle = "rgba(255,255,255,0.4)";
    ctx2.lineWidth = 1;
    ctx2.strokeRect(
      MM_X + cam.x / WORLD_W * MM_W,
      MM_Y + cam.y / WORLD_H * MM_H,
      CANVAS_W / WORLD_W * MM_W,
      CANVAS_H / WORLD_H * MM_H
    );
    const mmH = toMM(hero.pos);
    ctx2.fillStyle = "#FFEB3B";
    ctx2.beginPath();
    ctx2.arc(mmH.x, mmH.y, 4, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = "rgba(255,255,255,0.5)";
    ctx2.font = "10px sans-serif";
    ctx2.fillText("KARTE", MM_X + 4, MM_Y + MM_H - 4);
  }

  // src/eventbus.ts
  var listeners = /* @__PURE__ */ new Map();
  var queue = [];
  var EventBus = {
    on(type, handler) {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    emit(type, payload) {
      queue.push({ type, payload });
    },
    /** Drain the queue — called once per frame AFTER all systems have updated */
    dispatch() {
      let i = 0;
      while (i < queue.length) {
        const ev = queue[i++];
        const handlers = listeners.get(ev.type);
        if (handlers) {
          for (const h of handlers) h(ev.payload);
        }
      }
      queue.length = 0;
    },
    clear() {
      queue.length = 0;
      listeners.clear();
    }
  };

  // src/entities/hero.ts
  var XP_TABLE = [
    0,
    200,
    500,
    900,
    1400,
    2e3,
    2700,
    3500,
    4400,
    5400,
    6500,
    7700,
    9e3,
    10400,
    11900,
    13500,
    15200,
    17e3,
    18900,
    20900,
    23e3,
    25200,
    27500,
    29900,
    32400
  ];
  var SHOP_ITEMS = [
    { id: "kaffee", name: "Kaffee", description: "+15 Bewegungsgeschw.", cost: 75, purchased: false, hpBonus: 0, attackBonus: 0, moveSpeedBonus: 15, passiveLohnBonus: 0, hpRegenBonus: 0 },
    { id: "token", name: "Feierabend-Token", description: "+150 Max-HP", cost: 200, purchased: false, hpBonus: 150, attackBonus: 0, moveSpeedBonus: 0, passiveLohnBonus: 0, hpRegenBonus: 0 },
    { id: "excel", name: "Excel-Masterkurs", description: "+15 Angriffschaden", cost: 450, purchased: false, hpBonus: 0, attackBonus: 15, moveSpeedBonus: 0, passiveLohnBonus: 0, hpRegenBonus: 0 },
    { id: "steuer", name: "Steuerberater", description: "+2 \u20B2/sek Passivlohn", cost: 900, purchased: false, hpBonus: 0, attackBonus: 0, moveSpeedBonus: 0, passiveLohnBonus: 2, hpRegenBonus: 0 },
    { id: "ue_paket", name: "\xDCberstunden-Paket", description: "+25 ATK, +200 HP", cost: 1200, purchased: false, hpBonus: 200, attackBonus: 25, moveSpeedBonus: 0, passiveLohnBonus: 0, hpRegenBonus: 0 },
    { id: "bav", name: "Betr. Altersvorsorge", description: "+500 HP, +5 HP-Regen", cost: 2500, purchased: false, hpBonus: 500, attackBonus: 0, moveSpeedBonus: 0, passiveLohnBonus: 0, hpRegenBonus: 5 }
  ];
  var HERO_SPAWN_POS = { x: 320, y: 2080 };
  function createHero() {
    return {
      id: uniqueId("hero"),
      type: "hero" /* Hero */,
      team: "radiant" /* Radiant */,
      pos: { ...HERO_SPAWN_POS },
      radius: 22,
      hp: 800,
      maxHp: 800,
      hpRegen: 4,
      alive: true,
      markedForDeletion: false,
      attackDamage: 55,
      attackRange: 500,
      attackCooldown: 1,
      attackTimer: 0,
      attackTarget: null,
      moveSpeed: 300,
      baseSpeed: 300,
      armor: 5,
      name: "Der Buchhalter",
      level: 1,
      xp: 0,
      xpToNext: 200,
      skillPoints: 1,
      lohn: 200,
      passiveLohnRate: 1,
      abilities: [
        {
          id: "Q" /* Zeitbuchung */,
          name: "Zeitbuchung",
          description: "N\xE4chster Angriff: 1.5\xD7 DMG + Audit-Debuff (20% mehr Schaden f\xFCr 0.5s)",
          cooldownMax: [8, 7, 6, 5],
          timer: 0,
          state: "ready" /* Ready */,
          level: 0,
          isPassive: false
        },
        {
          id: "W" /* Ueberstunden */,
          name: "\xDCberstunden",
          description: "AoE 300px: Schaden + 40% Slow 3s",
          cooldownMax: [16, 14, 12, 10],
          timer: 0,
          state: "ready" /* Ready */,
          level: 0,
          isPassive: false
        },
        {
          id: "E" /* Gehaltserhöhung */,
          name: "Gehaltserh\xF6hung",
          description: "PASSIV: +18 \u20B2 pro Last-Hit",
          cooldownMax: [0, 0, 0, 0],
          timer: 0,
          state: "ready" /* Ready */,
          level: 1,
          isPassive: true
        },
        {
          id: "R" /* PayrollRun */,
          name: "Payroll Run",
          description: "AoE 450px Riesenschaden (ab Lv 6)",
          cooldownMax: [120, 100, 80],
          timer: 0,
          state: "ready" /* Ready */,
          level: 0,
          isPassive: false
        }
      ],
      items: SHOP_ITEMS.map((i) => ({ ...i })),
      moveTarget: null,
      isAttackMoving: false,
      zeitbuchungReady: false,
      ueberstundenActive: false,
      ueberstundenTimer: 0,
      payrollRunActive: false,
      payrollRunTimer: 0,
      slowTimer: 0,
      facingAngle: -Math.PI / 4
    };
  }
  function heroLevelUp(hero) {
    if (hero.level >= 25) return;
    hero.level++;
    hero.skillPoints++;
    hero.maxHp += 18;
    hero.hp = Math.min(hero.hp + 18, hero.maxHp);
    hero.attackDamage += 2;
    hero.xpToNext = hero.level < 25 ? XP_TABLE[hero.level] - XP_TABLE[hero.level - 1] : 0;
  }

  // src/entities/projectile.ts
  function createProjectile(kind, source, targetId, damage, fromAbility) {
    const speedMap = {
      hero_basic: 800,
      hero_zeitbuchung: 900,
      tower_bolt: 1100,
      creep_ranged: 700,
      payroll_coin: 400
    };
    const dir = Math.atan2(0, 1);
    return {
      id: uniqueId("proj"),
      type: "projectile" /* Projectile */,
      team: source.team,
      pos: { x: source.pos.x, y: source.pos.y },
      radius: kind === "payroll_coin" ? 8 : 5,
      hp: 1,
      maxHp: 1,
      hpRegen: 0,
      alive: true,
      markedForDeletion: false,
      kind,
      targetId,
      speed: speedMap[kind],
      damage,
      isLastHit: source.type === "hero" /* Hero */,
      fromAbility,
      angle: dir,
      orbitAngle: Math.random() * Math.PI * 2
    };
  }
  function updateProjectiles(state2, dt) {
    for (const proj of state2.projectiles) {
      if (!proj.alive) continue;
      const target = findEntity(proj.targetId, state2);
      if (!target || !target.alive) {
        proj.alive = false;
        proj.markedForDeletion = true;
        continue;
      }
      const dx = target.pos.x - proj.pos.x;
      const dy = target.pos.y - proj.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < target.radius + proj.radius) {
        onProjectileHit(proj, target, state2);
        proj.alive = false;
        proj.markedForDeletion = true;
        continue;
      }
      const nx = dx / d;
      const ny = dy / d;
      proj.pos.x += nx * proj.speed * dt;
      proj.pos.y += ny * proj.speed * dt;
      proj.angle = Math.atan2(ny, nx);
      if (proj.kind === "payroll_coin") {
        proj.orbitAngle += dt * 6;
      }
    }
  }
  function onProjectileHit(proj, target, state2) {
    const effective = Math.max(1, proj.damage - target.armor);
    target.hp -= effective;
    spawnDamageFloat(target.pos, effective, proj.isLastHit, state2);
    if (target.hp <= 0) {
      target.hp = 0;
      if (target.type === "hero" /* Hero */) return;
      target.alive = false;
      target.markedForDeletion = true;
      if (proj.isLastHit && target.team === "dire" /* Dire */) {
        if (target.type === "creep" /* Creep */) {
          EventBus.emit("LAST_HIT", { lohn: target.lohnBounty, xp: target.xpBounty });
        } else if (target.type === "tower" /* Tower */ || target.type === "ancient" /* Ancient */) {
          EventBus.emit("TOWER_DESTROYED", { tower: target, lohn: target.lohnBounty, xp: target.xpBounty });
          if (target.type === "ancient" /* Ancient */) {
            EventBus.emit("ANCIENT_DESTROYED", {});
          }
        }
      } else if (!proj.isLastHit && target.team === "dire" /* Dire */) {
        const xpBounty = target.type === "creep" /* Creep */ ? target.xpBounty : target.type === "tower" /* Tower */ || target.type === "ancient" /* Ancient */ ? target.xpBounty : 0;
        EventBus.emit("ENTITY_KILLED", { targetId: target.id, killerId: proj.id, isHeroKill: false, lohnBounty: 0, xpBounty: Math.round(xpBounty * 0.4) });
      }
      if (target.type === "ancient" /* Ancient */ && target.team === "radiant" /* Radiant */) {
        EventBus.emit("RADIANT_HQ_DESTROYED", {});
      }
      if (target.type === "tower" /* Tower */ || target.type === "ancient" /* Ancient */) {
        target.destroyed = true;
      }
    }
  }
  function spawnDamageFloat(pos, amount, isHero, state2) {
    state2.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y - 20 },
      text: `-${amount}`,
      color: isHero ? "#FFFFFF" : "#888888",
      alpha: 1,
      vy: -60,
      life: 0.8,
      size: isHero ? 16 : 12
    });
  }
  function renderProjectile(ctx2, proj) {
    if (!proj.alive) return;
    const { pos, kind, orbitAngle } = proj;
    ctx2.save();
    ctx2.translate(Math.round(pos.x), Math.round(pos.y));
    switch (kind) {
      case "hero_basic":
        ctx2.fillStyle = "#FFFFFF";
        ctx2.beginPath();
        ctx2.arc(0, 0, 4, 0, Math.PI * 2);
        ctx2.fill();
        break;
      case "hero_zeitbuchung":
        ctx2.shadowColor = "#00BCD4";
        ctx2.shadowBlur = 12;
        ctx2.fillStyle = "#00BCD4";
        ctx2.beginPath();
        ctx2.arc(0, 0, 6, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.shadowBlur = 0;
        break;
      case "tower_bolt":
        ctx2.strokeStyle = "#FFD700";
        ctx2.lineWidth = 3;
        ctx2.beginPath();
        ctx2.moveTo(-8 * Math.cos(proj.angle), -8 * Math.sin(proj.angle));
        ctx2.lineTo(8 * Math.cos(proj.angle), 8 * Math.sin(proj.angle));
        ctx2.stroke();
        ctx2.fillStyle = "#FFFFFF";
        ctx2.beginPath();
        ctx2.arc(0, 0, 3, 0, Math.PI * 2);
        ctx2.fill();
        break;
      case "creep_ranged":
        ctx2.fillStyle = proj.team === "radiant" /* Radiant */ ? "#66BB6A" : "#FF7043";
        ctx2.beginPath();
        ctx2.arc(0, 0, 3, 0, Math.PI * 2);
        ctx2.fill();
        break;
      case "payroll_coin":
        ctx2.fillStyle = "#FFD700";
        ctx2.font = "bold 14px monospace";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.rotate(orbitAngle);
        ctx2.fillText("\u20B2", 0, 0);
        break;
    }
    ctx2.restore();
  }

  // src/entities/creep.ts
  var ARRIVAL_THRESHOLD = 28;
  var AGGRO_RANGE = 260;
  var LEASH_RANGE = 400;
  function createCreep(team, variant, startOffset, waveNumber, stage = 1) {
    const stageMult = team === "dire" /* Dire */ ? 1 + (stage - 1) * 0.45 : 1 + (stage - 1) * 0.2;
    const stageDmgMult = team === "dire" /* Dire */ ? 1 + (stage - 1) * 0.35 : 1 + (stage - 1) * 0.15;
    const scale = (1 + waveNumber * 0.05) * stageMult;
    const dmgScale = (1 + waveNumber * 0.04) * stageDmgMult;
    const basePath = team === "radiant" /* Radiant */ ? RADIANT_PATH : DIRE_PATH;
    const spawnPos = { x: basePath[0].x + startOffset.x, y: basePath[0].y + startOffset.y };
    let hp = 420, dmg = 15, speed = 290, bounty = 40 + waveNumber * 2, radius = 16;
    if (variant === "ranged" /* Ranged */) {
      hp = 300;
      dmg = 12;
      speed = 290;
      bounty = 42 + waveNumber * 2;
      radius = 14;
    }
    if (variant === "siege" /* Siege */) {
      hp = 900;
      dmg = 10;
      speed = 200;
      bounty = 90 + waveNumber * 3;
      radius = 20;
    }
    return {
      id: uniqueId(`creep_${team}`),
      type: "creep" /* Creep */,
      team,
      pos: { ...spawnPos },
      radius,
      hp: Math.round(hp * scale),
      maxHp: Math.round(hp * scale),
      hpRegen: 0,
      alive: true,
      markedForDeletion: false,
      attackDamage: Math.round(dmg * dmgScale),
      attackRange: variant === "ranged" /* Ranged */ || variant === "siege" /* Siege */ ? 500 : 100,
      attackCooldown: variant === "siege" /* Siege */ ? 1.8 : 1.1,
      attackTimer: Math.random() * 1,
      // stagger attacks in wave
      attackTarget: null,
      moveSpeed: speed,
      baseSpeed: speed,
      armor: 1,
      variant,
      waypointPath: {
        points: basePath,
        currentIdx: 1
      },
      lohnBounty: Math.round(bounty * stageMult),
      xpBounty: Math.round(bounty * 0.6 * stageMult),
      isLastHitWindow: false,
      slowTimer: 0,
      aggroCheckTimer: Math.random() * 0.5
    };
  }
  function updateCreeps(state2, dt) {
    for (const creep of state2.radiantCreeps) updateSingleCreep(creep, state2, dt);
    for (const creep of state2.direCreeps) updateSingleCreep(creep, state2, dt);
  }
  function updateSingleCreep(creep, state2, dt) {
    if (!creep.alive) return;
    creep.hp = Math.min(creep.maxHp, creep.hp + creep.hpRegen * dt);
    creep.isLastHitWindow = creep.hp < creep.maxHp * 0.15;
    if (creep.slowTimer > 0) {
      creep.slowTimer -= dt;
      if (creep.slowTimer <= 0) {
        creep.slowTimer = 0;
        creep.moveSpeed = creep.baseSpeed;
      }
    }
    if (creep.attackTimer > 0) creep.attackTimer -= dt;
    creep.aggroCheckTimer -= dt;
    if (creep.aggroCheckTimer <= 0) {
      creep.aggroCheckTimer = 0.4;
      resolveCreepAggro(creep, state2);
    }
    if (creep.attackTarget !== null) {
      const target = findEntity(creep.attackTarget, state2);
      if (!target || !target.alive) {
        creep.attackTarget = null;
      } else {
        const d = dist(creep.pos, target.pos);
        const leashWp = creep.waypointPath.points[Math.min(
          creep.waypointPath.currentIdx,
          creep.waypointPath.points.length - 1
        )];
        const leashDist = dist(creep.pos, leashWp);
        if (d > LEASH_RANGE || leashDist > LEASH_RANGE * 1.5) {
          creep.attackTarget = null;
        } else if (d <= creep.attackRange + target.radius) {
          if (creep.attackTimer <= 0) {
            creep.attackTimer = creep.attackCooldown;
            spawnCreepAttack(creep, target, state2);
          }
        } else {
          moveToward(creep, target.pos, dt);
        }
      }
    }
    if (creep.attackTarget === null) {
      followWaypoints(creep, state2, dt);
    }
  }
  function resolveCreepAggro(creep, state2) {
    if (creep.attackTarget !== null) {
      const target = findEntity(creep.attackTarget, state2);
      if (target && target.alive && dist(creep.pos, target.pos) <= AGGRO_RANGE + 50) return;
      creep.attackTarget = null;
    }
    const enemies = getEnemies(creep, state2);
    let closest = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist(creep.pos, e.pos);
      if (d <= AGGRO_RANGE) {
        if (!closest || d < closest.d) closest = { id: e.id, d };
      }
    }
    creep.attackTarget = closest?.id ?? null;
  }
  function followWaypoints(creep, state2, dt) {
    const path = creep.waypointPath;
    if (path.currentIdx >= path.points.length) {
      const target = getEnemyBase(creep, state2);
      if (target && target.alive) {
        target.hp -= creep.attackDamage * 0.5;
      }
      creep.alive = false;
      creep.markedForDeletion = true;
      return;
    }
    const wp = path.points[path.currentIdx];
    const d = dist(creep.pos, wp);
    if (d <= ARRIVAL_THRESHOLD) {
      path.currentIdx++;
    } else {
      moveToward(creep, wp, dt);
    }
  }
  function moveToward(creep, target, dt) {
    const dir = normalize({ x: target.x - creep.pos.x, y: target.y - creep.pos.y });
    creep.pos.x += dir.x * creep.moveSpeed * dt;
    creep.pos.y += dir.y * creep.moveSpeed * dt;
  }
  function spawnCreepAttack(creep, target, state2) {
    if (creep.variant === "melee" /* Melee */) {
      applyDamage(target.id, creep.attackDamage, creep.id, false, state2);
    } else {
      state2.projectiles.push(
        createProjectile("creep_ranged", creep, target.id, creep.attackDamage, null)
      );
    }
  }
  function applyDamage(targetId, amount, sourceId, isHero, state2) {
    const target = findEntity(targetId, state2);
    if (!target || !target.alive) return;
    const effective = Math.max(1, amount - target.armor);
    target.hp -= effective;
    if (target.hp <= 0) {
      target.hp = 0;
      if (target.type === "hero" /* Hero */) return;
      target.alive = false;
      target.markedForDeletion = true;
      const lohnBounty = target.type === "creep" /* Creep */ ? target.lohnBounty : target.type === "tower" /* Tower */ || target.type === "ancient" /* Ancient */ ? target.lohnBounty : 0;
      const xpBounty = target.type === "creep" /* Creep */ ? target.xpBounty : target.type === "tower" /* Tower */ || target.type === "ancient" /* Ancient */ ? target.xpBounty : 0;
      EventBus.emit("ENTITY_KILLED", { killerId: sourceId, targetId, isHeroKill: isHero, lohnBounty, xpBounty });
    }
  }
  function findEntity(id, state2) {
    if (state2.hero.id === id) return state2.hero;
    for (const c of state2.radiantCreeps) if (c.id === id) return c;
    for (const c of state2.direCreeps) if (c.id === id) return c;
    for (const t of state2.radiantTowers) if (t.id === id) return t;
    for (const t of state2.direTowers) if (t.id === id) return t;
    return null;
  }
  function getEnemies(creep, state2) {
    if (creep.team === "radiant" /* Radiant */) {
      return [...state2.direCreeps, ...state2.direTowers, state2.hero.team !== "radiant" /* Radiant */ ? state2.hero : null].filter(Boolean);
    }
    return [...state2.radiantCreeps, ...state2.radiantTowers, state2.hero];
  }
  function getEnemyBase(creep, state2) {
    if (creep.team === "radiant" /* Radiant */) {
      return state2.direTowers[state2.direTowers.length - 1] ?? null;
    }
    return state2.radiantTowers[state2.radiantTowers.length - 1] ?? null;
  }

  // src/entities/tower.ts
  function makeTower(team, tier, label, pos, isAncient = false, stage = 1) {
    const tierStats = {
      1: { hp: 1200, dmg: 55, range: 550, cd: 1.1, bounty: 150 },
      2: { hp: 1600, dmg: 75, range: 580, cd: 1.05, bounty: 200 },
      3: { hp: 2e3, dmg: 95, range: 600, cd: 1, bounty: 250 },
      4: { hp: 4e3, dmg: 110, range: 620, cd: 0.95, bounty: 400 }
    };
    const s = tierStats[tier];
    const hpMult = team === "dire" /* Dire */ ? 1 + (stage - 1) * 0.5 : 1;
    const dmgMult = team === "dire" /* Dire */ ? 1 + (stage - 1) * 0.3 : 1;
    const bountyMult = team === "dire" /* Dire */ ? 1 + (stage - 1) * 0.4 : 1;
    const hp = Math.round(s.hp * hpMult);
    const dmg = Math.round(s.dmg * dmgMult);
    const bounty = Math.round(s.bounty * bountyMult);
    return {
      id: uniqueId(`tower_${team}_t${tier}`),
      type: isAncient ? "ancient" /* Ancient */ : "tower" /* Tower */,
      team,
      pos: { ...pos },
      radius: isAncient ? 55 : 38,
      hp,
      maxHp: hp,
      hpRegen: 0,
      alive: true,
      markedForDeletion: false,
      destroyed: false,
      attackDamage: dmg,
      attackRange: s.range,
      attackCooldown: s.cd,
      attackTimer: 0,
      attackTarget: null,
      moveSpeed: 0,
      armor: 8,
      tier,
      label,
      lohnBounty: bounty,
      xpBounty: Math.round(bounty * 0.5),
      aggroCheckTimer: 0,
      attackFlashTimer: 0
    };
  }
  function createAllTowers(stage = 1) {
    const p = TOWER_POSITIONS;
    return {
      radiantTowers: [
        makeTower("radiant" /* Radiant */, 1, "HR-Abt. T1", p.radiant.t1, false, stage),
        makeTower("radiant" /* Radiant */, 2, "Finance T2", p.radiant.t2, false, stage),
        makeTower("radiant" /* Radiant */, 3, "IT-Kern T3", p.radiant.t3, false, stage),
        makeTower("radiant" /* Radiant */, 4, "Unternehmens-HQ", p.radiant.hq, true, stage)
      ],
      direTowers: [
        makeTower("dire" /* Dire */, 1, "Kontroll-T1", p.dire.t1, false, stage),
        makeTower("dire" /* Dire */, 2, "Chaos-T2", p.dire.t2, false, stage),
        makeTower("dire" /* Dire */, 3, "B\xFCrokratie-T3", p.dire.t3, false, stage),
        makeTower("dire" /* Dire */, 4, "Direktionszentrale", p.dire.ancient, true, stage)
      ]
    };
  }
  function rebuildDireTowers(stage) {
    const p = TOWER_POSITIONS;
    return [
      makeTower("dire" /* Dire */, 1, "Kontroll-T1", p.dire.t1, false, stage),
      makeTower("dire" /* Dire */, 2, "Chaos-T2", p.dire.t2, false, stage),
      makeTower("dire" /* Dire */, 3, "B\xFCrokratie-T3", p.dire.t3, false, stage),
      makeTower("dire" /* Dire */, 4, "Direktionszentrale", p.dire.ancient, true, stage)
    ];
  }
  function updateTowers(state2, dt) {
    for (const tower of state2.radiantTowers) updateSingleTower(tower, state2, dt);
    for (const tower of state2.direTowers) updateSingleTower(tower, state2, dt);
  }
  function updateSingleTower(tower, state2, dt) {
    if (!tower.alive || tower.destroyed) return;
    if (tower.attackFlashTimer > 0) tower.attackFlashTimer -= dt;
    if (tower.attackTimer > 0) tower.attackTimer -= dt;
    tower.aggroCheckTimer -= dt;
    if (tower.aggroCheckTimer <= 0) {
      tower.aggroCheckTimer = 0.5;
      resolveTowerAggro(tower, state2);
    }
    if (tower.attackTarget !== null) {
      const target = findEntity(tower.attackTarget, state2);
      if (!target || !target.alive) {
        tower.attackTarget = null;
        return;
      }
      const d = dist(tower.pos, target.pos);
      if (d > tower.attackRange + target.radius + 20) {
        tower.attackTarget = null;
        return;
      }
      if (tower.attackTimer <= 0 && d <= tower.attackRange + target.radius) {
        tower.attackTimer = tower.attackCooldown;
        tower.attackFlashTimer = 0.15;
        spawnTowerBolt(tower, target.id, state2);
      }
    }
  }
  function resolveTowerAggro(tower, state2) {
    const enemies = getTowerEnemies(tower, state2);
    if (enemies.length === 0) {
      tower.attackTarget = null;
      return;
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      if (dist(tower.pos, e.pos) > tower.attackRange) continue;
      const asCreep = e;
      if (asCreep.attackTarget) {
        const tgt = findEntity(asCreep.attackTarget, state2);
        if (tgt && tgt.team === tower.team) {
          tower.attackTarget = e.id;
          return;
        }
      }
    }
    let closest = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist(tower.pos, e.pos);
      if (d <= tower.attackRange) {
        if (!closest || d < closest.d) closest = { id: e.id, d };
      }
    }
    tower.attackTarget = closest?.id ?? null;
  }
  function getTowerEnemies(tower, state2) {
    if (tower.team === "radiant" /* Radiant */) {
      return [...state2.direCreeps];
    }
    return [...state2.radiantCreeps, state2.hero];
  }
  function spawnTowerBolt(tower, targetId, state2) {
    state2.projectiles.push(createProjectile("tower_bolt", tower, targetId, tower.attackDamage, null));
  }
  function renderTower(ctx2, tower) {
    if (tower.destroyed) return;
    const { pos, radius, team, tier, hp, maxHp, attackFlashTimer, label } = tower;
    const isAncient = tier === 4;
    const baseColor = team === "radiant" /* Radiant */ ? "#4CAF50" : "#FF5722";
    const flashColor = "#FFFFFF";
    ctx2.save();
    ctx2.translate(Math.round(pos.x), Math.round(pos.y));
    const glowAlpha = isAncient ? 0.22 + 0.08 * Math.sin(Date.now() / 600) : 0.1;
    const glow = ctx2.createRadialGradient(0, 0, 0, 0, 0, radius * 2.2);
    glow.addColorStop(0, team === "radiant" /* Radiant */ ? `rgba(76,175,80,${glowAlpha})` : `rgba(255,87,34,${glowAlpha})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx2.fillStyle = glow;
    ctx2.beginPath();
    ctx2.arc(0, 0, radius * 2.2, 0, Math.PI * 2);
    ctx2.fill();
    const sides = isAncient ? 6 : 5;
    const color = attackFlashTimer > 0 ? flashColor : baseColor;
    ctx2.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = i / sides * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
    }
    ctx2.closePath();
    ctx2.fillStyle = color + "33";
    ctx2.strokeStyle = color;
    ctx2.lineWidth = isAncient ? 4 : 3;
    ctx2.fill();
    ctx2.stroke();
    ctx2.fillStyle = color;
    ctx2.font = `bold ${isAncient ? 18 : 13}px monospace`;
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(isAncient ? "\u2605" : `T${tier}`, 0, 0);
    ctx2.restore();
    const bw = radius * 3;
    const bh = 5;
    const bx = pos.x - bw / 2;
    const by = pos.y - radius - 12;
    const pct = hp / maxHp;
    ctx2.fillStyle = "#111";
    ctx2.fillRect(Math.round(bx), Math.round(by), bw, bh);
    ctx2.fillStyle = team === "radiant" /* Radiant */ ? "#4CAF50" : "#FF5722";
    ctx2.fillRect(Math.round(bx), Math.round(by), Math.round(bw * pct), bh);
    ctx2.fillStyle = "rgba(255,255,255,0.7)";
    ctx2.font = "10px sans-serif";
    ctx2.textAlign = "center";
    ctx2.fillText(label, Math.round(pos.x), Math.round(by - 4));
  }

  // src/constants.ts
  var SLOW_FACTOR = 0.6;
  var ABILITY_STATS = {
    ueberstunden: {
      radius: 300,
      damage: [80, 120, 160, 200],
      slowDuration: 3
    },
    payrollRun: {
      radius: 450,
      damage: [200, 350, 500],
      castTime: 1.5,
      coinCount: 8
    },
    gehaltserh\u00F6hung: {
      bonusPerLevel: [18, 24, 30, 36]
    }
  };

  // src/systems/combat.ts
  function updateHeroCombat(state2, dt) {
    const hero = state2.hero;
    if (!hero.alive) return;
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.hpRegen * dt);
    if (hero.slowTimer > 0) hero.slowTimer -= dt;
    if (hero.attackTimer > 0) hero.attackTimer -= dt;
    if (hero.payrollRunActive) {
      hero.payrollRunTimer -= dt;
      if (hero.payrollRunTimer <= 0) {
        executePayrollRun(state2);
        hero.payrollRunActive = false;
      }
    }
    if (hero.ueberstundenActive) {
      hero.ueberstundenTimer -= dt;
      if (hero.ueberstundenTimer <= 0) hero.ueberstundenActive = false;
    }
    if (hero.attackTarget !== null) {
      const target = findEntity(hero.attackTarget, state2);
      if (!target || !target.alive) {
        hero.attackTarget = null;
        hero.isAttackMoving = false;
        return;
      }
      const d = dist(hero.pos, target.pos);
      if (d <= hero.attackRange + target.radius) {
        hero.moveTarget = null;
        hero.facingAngle = Math.atan2(target.pos.y - hero.pos.y, target.pos.x - hero.pos.x);
        if (hero.attackTimer <= 0) {
          hero.attackTimer = hero.attackCooldown;
          fireHeroAttack(hero, target, state2);
        }
      } else if (hero.isAttackMoving) {
        hero.moveTarget = { x: target.pos.x, y: target.pos.y };
      }
    }
    const keys = state2.input.keys;
    let arrowDx = 0;
    let arrowDy = 0;
    if (keys.has("ARROWUP")) arrowDy -= 1;
    if (keys.has("ARROWDOWN")) arrowDy += 1;
    if (keys.has("ARROWLEFT")) arrowDx -= 1;
    if (keys.has("ARROWRIGHT")) arrowDx += 1;
    if (arrowDx !== 0 || arrowDy !== 0) {
      const dir = normalize({ x: arrowDx, y: arrowDy });
      const speed = hero.slowTimer > 0 ? hero.moveSpeed * SLOW_FACTOR : hero.moveSpeed;
      hero.pos.x += dir.x * speed * dt;
      hero.pos.y += dir.y * speed * dt;
      hero.pos.x = clamp(hero.pos.x, hero.radius, WORLD_W - hero.radius);
      hero.pos.y = clamp(hero.pos.y, hero.radius, WORLD_H - hero.radius);
      hero.facingAngle = Math.atan2(dir.y, dir.x);
      hero.moveTarget = null;
      hero.attackTarget = null;
      hero.isAttackMoving = false;
    } else if (hero.moveTarget !== null) {
      const dx = hero.moveTarget.x - hero.pos.x;
      const dy = hero.moveTarget.y - hero.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 8) {
        hero.moveTarget = null;
      } else {
        const speed = hero.slowTimer > 0 ? hero.moveSpeed * SLOW_FACTOR : hero.moveSpeed;
        const nx = dx / d;
        const ny = dy / d;
        hero.pos.x += nx * speed * dt;
        hero.pos.y += ny * speed * dt;
        hero.facingAngle = Math.atan2(ny, nx);
      }
    }
  }
  function fireHeroAttack(hero, target, state2) {
    let kind = "hero_basic";
    let damage = hero.attackDamage;
    let abilityId = null;
    if (hero.zeitbuchungReady) {
      kind = "hero_zeitbuchung";
      damage = Math.round(damage * 1.5);
      abilityId = "Q" /* Zeitbuchung */;
      hero.zeitbuchungReady = false;
    }
    const proj = createProjectile(kind, hero, target.id, damage, abilityId);
    proj.isLastHit = true;
    state2.projectiles.push(proj);
  }
  function executePayrollRun(state2) {
    const hero = state2.hero;
    const RADIUS = ABILITY_STATS.payrollRun.radius;
    state2.aoeEffects.push({
      id: uniqueId("aoe"),
      pos: { ...hero.pos },
      radius: RADIUS,
      maxLife: 1,
      life: 1,
      color: "#FFD700",
      kind: "ring"
    });
    const abilityLevel = hero.abilities.find((a) => a.id === "R" /* PayrollRun */)?.level ?? 1;
    const dmg = ABILITY_STATS.payrollRun.damage[Math.min(abilityLevel - 1, 2)];
    for (const creep of state2.direCreeps) {
      if (!creep.alive) continue;
      const d = dist(hero.pos, creep.pos);
      if (d <= RADIUS) {
        const armor = creep.armor ?? 0;
        const eff = Math.max(1, dmg - armor);
        creep.hp -= eff;
        state2.floatingTexts.push({
          id: uniqueId("ft"),
          pos: { x: creep.pos.x, y: creep.pos.y - 20 },
          text: `-${eff}`,
          color: "#FFD700",
          alpha: 1,
          vy: -50,
          life: 0.9,
          size: 14
        });
        if (creep.hp <= 0) {
          creep.hp = 0;
          creep.alive = false;
          creep.markedForDeletion = true;
          const lohn = creep.lohnBounty * 2;
          EventBus.emit("LAST_HIT", { lohn, xp: creep.xpBounty });
        }
      }
    }
    for (const tower of state2.direTowers) {
      if (!tower.alive || tower.destroyed) continue;
      if (dist(hero.pos, tower.pos) <= RADIUS) {
        tower.hp -= Math.round(dmg * 0.5);
        if (tower.hp <= 0) {
          tower.hp = 0;
          tower.alive = false;
          tower.destroyed = true;
          tower.markedForDeletion = true;
          EventBus.emit("TOWER_DESTROYED", { tower, lohn: tower.lohnBounty, xp: tower.xpBounty });
          if (tower.type === "ancient" /* Ancient */) {
            EventBus.emit("ANCIENT_DESTROYED", {});
          }
        }
      }
    }
  }
  function handleHeroRightClick(state2) {
    const hero = state2.hero;
    const { mouseWorld } = state2.input;
    for (const creep of state2.direCreeps) {
      if (!creep.alive) continue;
      if (dist(mouseWorld, creep.pos) <= creep.radius + 12) {
        hero.attackTarget = creep.id;
        hero.isAttackMoving = true;
        hero.moveTarget = null;
        return;
      }
    }
    for (const tower of state2.direTowers) {
      if (!tower.alive || tower.destroyed) continue;
      if (dist(mouseWorld, tower.pos) <= tower.radius + 15) {
        hero.attackTarget = tower.id;
        hero.isAttackMoving = true;
        hero.moveTarget = null;
        return;
      }
    }
    for (const creep of state2.radiantCreeps) {
      if (!creep.alive) continue;
      if (creep.hp > creep.maxHp * 0.5) continue;
      if (dist(mouseWorld, creep.pos) <= creep.radius + 12) {
        hero.attackTarget = creep.id;
        hero.isAttackMoving = true;
        hero.moveTarget = null;
        return;
      }
    }
    hero.attackTarget = null;
    hero.isAttackMoving = false;
    hero.moveTarget = { x: mouseWorld.x, y: mouseWorld.y };
  }
  function entityCleanup(state2) {
    state2.radiantCreeps = state2.radiantCreeps.filter((c) => !c.markedForDeletion);
    state2.direCreeps = state2.direCreeps.filter((c) => !c.markedForDeletion);
    state2.projectiles = state2.projectiles.filter((p) => !p.markedForDeletion);
  }

  // src/systems/economy.ts
  var RESPAWN_BASE_TIME = 5;
  var RESPAWN_PER_LEVEL = 2;
  var DEATH_GOLD_LOSS = 0.15;
  var MAX_STAGE = 6;
  function initEconomyListeners(state2) {
    EventBus.on("LAST_HIT", (payload) => {
      const { lohn, xp } = payload;
      const gAbility = state2.hero.abilities.find((a) => a.id === "E" /* Gehaltserhöhung */);
      const bonus = gAbility && gAbility.level > 0 ? ABILITY_STATS.gehaltserh\u00F6hung.bonusPerLevel[gAbility.level - 1] : 0;
      const totalLohn = lohn + bonus;
      state2.hero.lohn += totalLohn;
      state2.economy.lohnHistory.push(totalLohn);
      if (state2.economy.lohnHistory.length > 30) state2.economy.lohnHistory.shift();
      addXp(state2, xp);
      state2.floatingTexts.push({
        id: uniqueId("ft"),
        pos: { x: state2.hero.pos.x, y: state2.hero.pos.y - 40 },
        text: `+${totalLohn} \u20B2`,
        color: "#FFD700",
        alpha: 1,
        vy: -70,
        life: 1.2,
        size: 18
      });
    });
    EventBus.on("TOWER_DESTROYED", (payload) => {
      const { lohn, xp } = payload;
      state2.hero.lohn += lohn;
      addXp(state2, xp);
      state2.floatingTexts.push({
        id: uniqueId("ft"),
        pos: { x: state2.hero.pos.x, y: state2.hero.pos.y - 50 },
        text: `+${lohn} \u20B2 BONUS!`,
        color: "#FF8C00",
        alpha: 1,
        vy: -80,
        life: 1.5,
        size: 22
      });
    });
    EventBus.on("ENTITY_KILLED", (payload) => {
      const { xpBounty } = payload;
      if (xpBounty > 0) addXp(state2, xpBounty);
    });
    EventBus.on("ANCIENT_DESTROYED", () => {
      if (state2.stage >= MAX_STAGE) {
        state2.phase = "victory" /* Victory */;
        state2.victoryTime = state2.totalTime;
        return;
      }
      state2.stage++;
      state2.direTowers = rebuildDireTowers(state2.stage);
      state2.direCreeps = [];
      state2.projectiles = state2.projectiles.filter((p) => p.kind !== "tower_bolt" && p.kind !== "creep_ranged");
      state2.wave.nextWaveTimer = 8;
      state2.stageBannerTimer = 5;
      state2.hero.hp = state2.hero.maxHp;
      const stageReward = 500 * state2.stage;
      state2.hero.lohn += stageReward;
      state2.floatingTexts.push({
        id: uniqueId("ft"),
        pos: { x: state2.hero.pos.x, y: state2.hero.pos.y - 60 },
        text: `+${stageReward} \u20B2 Akt-Bonus!`,
        color: "#FFD700",
        alpha: 1,
        vy: -90,
        life: 2.5,
        size: 22
      });
    });
    EventBus.on("RADIANT_HQ_DESTROYED", () => {
      state2.phase = "defeat" /* Defeat */;
    });
    EventBus.on("HERO_KILLED", () => {
      state2.deathCount++;
      const respawnTime = RESPAWN_BASE_TIME + (state2.hero.level - 1) * RESPAWN_PER_LEVEL;
      state2.respawnTimer = respawnTime;
      const lostGold = Math.floor(state2.hero.lohn * DEATH_GOLD_LOSS);
      state2.hero.lohn -= lostGold;
      state2.floatingTexts.push({
        id: uniqueId("ft"),
        pos: { x: state2.hero.pos.x, y: state2.hero.pos.y - 30 },
        text: `-${lostGold} \u20B2 Verlust!`,
        color: "#FF5722",
        alpha: 1,
        vy: -50,
        life: 2,
        size: 16
      });
    });
  }
  function updateEconomy(state2, dt) {
    state2.economy.passiveTimer += dt;
    if (state2.economy.passiveTimer >= 1) {
      state2.economy.passiveTimer -= 1;
      state2.hero.lohn += state2.hero.passiveLohnRate;
    }
    if (state2.stageBannerTimer > 0) state2.stageBannerTimer -= dt;
    if (state2.hero.hp <= 0 && state2.hero.alive) {
      state2.hero.alive = false;
      state2.hero.attackTarget = null;
      state2.hero.moveTarget = null;
      EventBus.emit("HERO_KILLED", {});
    }
    if (state2.respawnTimer > 0 && !state2.hero.alive) {
      state2.respawnTimer -= dt;
      if (state2.respawnTimer <= 0) {
        state2.respawnTimer = 0;
        respawnHero(state2);
      }
    }
  }
  function respawnHero(state2) {
    const hero = state2.hero;
    hero.alive = true;
    hero.hp = hero.maxHp;
    hero.pos = { ...HERO_SPAWN_POS };
    hero.attackTarget = null;
    hero.moveTarget = null;
    hero.isAttackMoving = false;
    hero.slowTimer = 0;
    hero.payrollRunActive = false;
    hero.ueberstundenActive = false;
    hero.zeitbuchungReady = false;
    hero.markedForDeletion = false;
    state2.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: hero.pos.x, y: hero.pos.y - 40 },
      text: "RESPAWN!",
      color: "#4CAF50",
      alpha: 1,
      vy: -80,
      life: 2,
      size: 22
    });
  }
  function addXp(state2, xp) {
    if (state2.hero.level >= 25) return;
    state2.hero.xp += xp;
    while (state2.hero.xp >= state2.hero.xpToNext && state2.hero.level < 25) {
      state2.hero.xp -= state2.hero.xpToNext;
      heroLevelUp(state2.hero);
      EventBus.emit("LEVEL_UP", { level: state2.hero.level });
      state2.floatingTexts.push({
        id: uniqueId("ft"),
        pos: { x: state2.hero.pos.x, y: state2.hero.pos.y - 60 },
        text: `LEVEL ${state2.hero.level}!`,
        color: "#00E5FF",
        alpha: 1,
        vy: -90,
        life: 2,
        size: 24
      });
    }
  }

  // src/systems/waves.ts
  function updateWaves(state2, dt) {
    state2.wave.nextWaveTimer -= dt;
    if (state2.wave.nextWaveTimer <= 0) {
      state2.wave.nextWaveTimer = state2.wave.WAVE_INTERVAL;
      state2.wave.waveNumber++;
      spawnWave(state2);
    }
  }
  function spawnWave(state2) {
    const w = state2.wave.waveNumber;
    let melee = 3;
    let ranged = 1;
    let siege = 0;
    if (w >= 6) {
      ranged = 2;
      siege = 1;
    }
    if (w >= 11) {
      melee = 4;
    }
    let idx = 0;
    for (let i = 0; i < melee; i++) {
      const offset = creepOffset(idx++);
      spawnOne(state2, "radiant" /* Radiant */, "melee" /* Melee */, offset, w);
      spawnOne(state2, "dire" /* Dire */, "melee" /* Melee */, offset, w);
    }
    for (let i = 0; i < ranged; i++) {
      const offset = creepOffset(idx++);
      spawnOne(state2, "radiant" /* Radiant */, "ranged" /* Ranged */, offset, w);
      spawnOne(state2, "dire" /* Dire */, "ranged" /* Ranged */, offset, w);
    }
    for (let i = 0; i < siege; i++) {
      const offset = creepOffset(idx++);
      spawnOne(state2, "radiant" /* Radiant */, "siege" /* Siege */, offset, w);
      spawnOne(state2, "dire" /* Dire */, "siege" /* Siege */, offset, w);
    }
  }
  function creepOffset(index) {
    const along = index * 50;
    return { x: along * 0.3, y: along * 0.3 };
  }
  function spawnOne(state2, team, variant, offset, waveNumber) {
    const creep = createCreep(team, variant, offset, waveNumber, state2.stage);
    if (team === "radiant" /* Radiant */) {
      state2.radiantCreeps.push(creep);
    } else {
      state2.direCreeps.push(creep);
    }
  }

  // src/systems/abilities.ts
  function updateAbilities(state2, dt) {
    const hero = state2.hero;
    for (const ability of hero.abilities) {
      if (ability.isPassive) continue;
      if (ability.state === "cooldown" /* OnCooldown */) {
        ability.timer -= dt;
        if (ability.timer <= 0) {
          ability.timer = 0;
          ability.state = "ready" /* Ready */;
        }
      }
    }
  }
  function tryUseAbility(state2, abilityId) {
    const hero = state2.hero;
    const ability = hero.abilities.find((a) => a.id === abilityId);
    if (!ability || ability.level === 0 || ability.isPassive) return;
    if (ability.state !== "ready" /* Ready */) return;
    switch (abilityId) {
      case "Q" /* Zeitbuchung */:
        activateZeitbuchung(state2, ability);
        break;
      case "W" /* Ueberstunden */:
        activateUeberstunden(state2, ability);
        break;
      case "R" /* PayrollRun */:
        activatePayrollRun(state2, ability);
        break;
    }
  }
  function tryLevelAbility(state2, abilityId) {
    const hero = state2.hero;
    if (hero.skillPoints <= 0) {
      spawnLevelHint(state2, "Keine Skillpunkte verf\xFCgbar", "#FFB300");
      return;
    }
    const ability = hero.abilities.find((a) => a.id === abilityId);
    if (!ability) return;
    const maxLevel = abilityId === "R" /* PayrollRun */ ? 3 : 4;
    if (ability.level >= maxLevel) {
      spawnLevelHint(state2, `${ability.name} bereits maximal`, "#FFB300");
      return;
    }
    if (abilityId === "R" /* PayrollRun */ && hero.level < 6) {
      spawnLevelHint(state2, `Payroll Run erst ab Level 6 (aktuell ${hero.level})`, "#FF5722");
      return;
    }
    ability.level++;
    hero.skillPoints--;
  }
  function spawnLevelHint(state2, text, color) {
    state2.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: state2.hero.pos.x, y: state2.hero.pos.y - 60 },
      text,
      color,
      alpha: 1,
      vy: -50,
      life: 2,
      size: 16
    });
  }
  function activateZeitbuchung(state2, ability) {
    const hero = state2.hero;
    hero.zeitbuchungReady = true;
    ability.state = "cooldown" /* OnCooldown */;
    ability.timer = ability.cooldownMax[ability.level - 1];
    state2.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: hero.pos.x + 30, y: hero.pos.y - 20 },
      text: "\u23F1 Zeitbuchung bereit!",
      color: "#00BCD4",
      alpha: 1,
      vy: -40,
      life: 1,
      size: 14
    });
  }
  function activateUeberstunden(state2, ability) {
    const hero = state2.hero;
    const RADIUS = ABILITY_STATS.ueberstunden.radius;
    const dmg = ABILITY_STATS.ueberstunden.damage[ability.level - 1];
    state2.aoeEffects.push({
      id: uniqueId("aoe"),
      pos: { ...hero.pos },
      radius: RADIUS,
      maxLife: 0.6,
      life: 0.6,
      color: "#FF9800",
      kind: "fill"
    });
    hero.ueberstundenActive = true;
    hero.ueberstundenTimer = 0.3;
    for (const creep of state2.direCreeps) {
      if (!creep.alive) continue;
      if (dist(hero.pos, creep.pos) <= RADIUS) {
        const eff = Math.max(1, dmg - creep.armor);
        creep.hp -= eff;
        creep.slowTimer = ABILITY_STATS.ueberstunden.slowDuration;
        creep.moveSpeed = creep.baseSpeed * SLOW_FACTOR;
        state2.floatingTexts.push({
          id: uniqueId("ft"),
          pos: { x: creep.pos.x, y: creep.pos.y - 15 },
          text: `-${eff}`,
          color: "#FF9800",
          alpha: 1,
          vy: -50,
          life: 0.7,
          size: 14
        });
        if (creep.hp <= 0) {
          creep.hp = 0;
          creep.alive = false;
          creep.markedForDeletion = true;
          EventBus.emit("LAST_HIT", { lohn: creep.lohnBounty, xp: creep.xpBounty });
        }
      }
    }
    ability.state = "cooldown" /* OnCooldown */;
    ability.timer = ability.cooldownMax[ability.level - 1];
  }
  function activatePayrollRun(state2, ability) {
    const hero = state2.hero;
    hero.payrollRunActive = true;
    hero.payrollRunTimer = ABILITY_STATS.payrollRun.castTime;
    for (let i = 0; i < ABILITY_STATS.payrollRun.coinCount; i++) {
      const angle = i / ABILITY_STATS.payrollRun.coinCount * Math.PI * 2;
      state2.projectiles.push({
        id: uniqueId("coin"),
        type: "projectile" /* Projectile */,
        team: hero.team,
        pos: { x: hero.pos.x + Math.cos(angle) * 60, y: hero.pos.y + Math.sin(angle) * 60 },
        radius: 8,
        hp: 1,
        maxHp: 1,
        hpRegen: 0,
        alive: true,
        markedForDeletion: false,
        kind: "payroll_coin",
        targetId: hero.id,
        // orbitet um Hero
        speed: 200,
        damage: 0,
        isLastHit: false,
        fromAbility: "R" /* PayrollRun */,
        angle,
        orbitAngle: angle
      });
    }
    ability.state = "cooldown" /* OnCooldown */;
    ability.timer = ability.cooldownMax[ability.level - 1];
    state2.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: hero.pos.x, y: hero.pos.y - 50 },
      text: "\u{1F4B0} PAYROLL RUN!",
      color: "#FFD700",
      alpha: 1,
      vy: -100,
      life: 2,
      size: 26
    });
  }
  function updatePayrollCoins(state2, dt) {
    for (const proj of state2.projectiles) {
      if (proj.kind !== "payroll_coin") continue;
      if (!proj.alive) continue;
      if (!state2.hero.payrollRunActive) {
        proj.alive = false;
        proj.markedForDeletion = true;
        continue;
      }
      proj.orbitAngle += dt * 4;
      const r = 80;
      proj.pos.x = state2.hero.pos.x + Math.cos(proj.orbitAngle) * r;
      proj.pos.y = state2.hero.pos.y + Math.sin(proj.orbitAngle) * r;
    }
  }
  function updateAoEEffects(state2, dt) {
    for (const effect of state2.aoeEffects) {
      effect.life -= dt;
    }
    state2.aoeEffects = state2.aoeEffects.filter((e) => e.life > 0);
  }

  // src/ui/hud.ts
  var infoPanelVisible = true;
  function toggleInfoPanel() {
    infoPanelVisible = !infoPanelVisible;
  }
  var COL = {
    hpBar: "#4CAF50",
    hpBg: "#1a1a1a",
    xpBar: "#00BCD4",
    lohn: "#FFD700",
    text: "#E0E0E0",
    dimText: "#666",
    panel: "rgba(0,0,0,0.65)",
    border: "#333",
    ready: "#FFFFFF",
    cooldown: "#555555",
    passive: "#9E9E9E"
  };
  function renderHUD(ctx2, state2) {
    const hero = state2.hero;
    ctx2.fillStyle = COL.panel;
    ctx2.fillRect(0, 0, CANVAS_W, 36);
    ctx2.strokeStyle = COL.border;
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.moveTo(0, 36);
    ctx2.lineTo(CANVAS_W, 36);
    ctx2.stroke();
    ctx2.fillStyle = COL.lohn;
    ctx2.font = "bold 18px monospace";
    ctx2.textAlign = "left";
    ctx2.textBaseline = "middle";
    ctx2.fillText(`\u20B2 ${Math.floor(hero.lohn).toLocaleString("de-DE")}`, 16, 18);
    ctx2.fillStyle = COL.dimText;
    ctx2.font = "12px monospace";
    ctx2.fillText(`+${hero.passiveLohnRate}/s`, 180, 18);
    ctx2.fillStyle = COL.text;
    ctx2.textAlign = "center";
    ctx2.font = "bold 14px monospace";
    ctx2.fillText(`LVL ${hero.level}`, CANVAS_W / 2, 12);
    ctx2.fillStyle = COL.dimText;
    ctx2.font = "11px monospace";
    if (hero.level < 25) {
      ctx2.fillText(`${hero.xp}/${hero.xpToNext} XP`, CANVAS_W / 2, 28);
    } else {
      ctx2.fillText("MAX", CANVAS_W / 2, 28);
    }
    ctx2.fillStyle = COL.text;
    ctx2.textAlign = "right";
    ctx2.font = "13px monospace";
    const waveText = `Akt ${state2.stage}/6  \u2022  Welle ${state2.wave.waveNumber}`;
    ctx2.fillText(waveText, CANVAS_W - 120, 12);
    ctx2.fillStyle = COL.dimText;
    ctx2.font = "11px monospace";
    ctx2.fillText(`N\xE4chste: ${Math.ceil(state2.wave.nextWaveTimer)}s`, CANVAS_W - 120, 28);
    ctx2.fillStyle = COL.dimText;
    ctx2.textAlign = "right";
    ctx2.font = "12px monospace";
    const mins = Math.floor(state2.totalTime / 60);
    const secs = Math.floor(state2.totalTime % 60);
    ctx2.fillText(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`, CANVAS_W - 16, 18);
    if (hero.skillPoints > 0) {
      ctx2.fillStyle = "#FFD700";
      ctx2.font = "bold 13px monospace";
      ctx2.textAlign = "center";
      ctx2.fillText(`\u2B06 ${hero.skillPoints} Skillpunkte verf\xFCgbar (SHIFT+Q/W/E/R)`, CANVAS_W / 2, 52);
    }
    const barY = CANVAS_H - 80;
    ctx2.fillStyle = COL.panel;
    ctx2.fillRect(0, barY, CANVAS_W, 80);
    ctx2.strokeStyle = COL.border;
    ctx2.beginPath();
    ctx2.moveTo(0, barY);
    ctx2.lineTo(CANVAS_W, barY);
    ctx2.stroke();
    const hpBarX = CANVAS_W / 2 - 180;
    const hpBarW = 360;
    const hpBarH = 16;
    const hpBarY = barY + 10;
    const hpPct = Math.max(0, hero.hp / hero.maxHp);
    ctx2.fillStyle = COL.hpBg;
    ctx2.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx2.fillStyle = hpPct < 0.3 ? "#f44336" : COL.hpBar;
    ctx2.fillRect(hpBarX, hpBarY, Math.round(hpBarW * hpPct), hpBarH);
    ctx2.strokeStyle = "#555";
    ctx2.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx2.fillStyle = COL.text;
    ctx2.font = "bold 11px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText(`${Math.round(hero.hp)} / ${hero.maxHp}`, CANVAS_W / 2, hpBarY + hpBarH / 2 + 1);
    const xpBarY = hpBarY + hpBarH + 2;
    const xpBarH = 5;
    const xpPct = hero.level < 25 ? hero.xp / hero.xpToNext : 1;
    ctx2.fillStyle = COL.hpBg;
    ctx2.fillRect(hpBarX, xpBarY, hpBarW, xpBarH);
    ctx2.fillStyle = COL.xpBar;
    ctx2.fillRect(hpBarX, xpBarY, Math.round(hpBarW * xpPct), xpBarH);
    const abilityY = barY + 42;
    const abilitySize = 34;
    const abilityGap = 6;
    const totalW = 4 * abilitySize + 3 * abilityGap;
    const startX = CANVAS_W / 2 - totalW / 2;
    const abilityKeys = ["Q", "W", "E", "R"];
    for (let i = 0; i < 4; i++) {
      const ability = hero.abilities[i];
      const x = startX + i * (abilitySize + abilityGap);
      let bgColor = COL.hpBg;
      let textColor = COL.ready;
      if (ability.level === 0) {
        bgColor = "#0a0a0a";
        textColor = "#333";
      } else if (ability.isPassive) {
        bgColor = "#1a2a1a";
        textColor = COL.passive;
      } else if (ability.state === "cooldown" /* OnCooldown */) {
        bgColor = "#1a1a1a";
        textColor = COL.cooldown;
      } else {
        bgColor = "#1a2a1a";
      }
      ctx2.fillStyle = bgColor;
      ctx2.fillRect(x, abilityY, abilitySize, abilitySize);
      ctx2.strokeStyle = ability.level > 0 && ability.state === "ready" /* Ready */ ? "#4CAF50" : "#444";
      ctx2.lineWidth = ability.level > 0 && ability.state === "ready" /* Ready */ ? 2 : 1;
      ctx2.strokeRect(x, abilityY, abilitySize, abilitySize);
      if (ability.state === "cooldown" /* OnCooldown */ && ability.level > 0) {
        const cdMax = ability.cooldownMax[ability.level - 1];
        const cdPct = cdMax > 0 ? ability.timer / cdMax : 0;
        ctx2.fillStyle = "rgba(0,0,0,0.6)";
        ctx2.fillRect(x, abilityY, abilitySize, Math.round(abilitySize * cdPct));
        ctx2.fillStyle = "#FF5722";
        ctx2.font = "bold 12px monospace";
        ctx2.textAlign = "center";
        ctx2.fillText(Math.ceil(ability.timer).toString(), x + abilitySize / 2, abilityY + abilitySize / 2 + 4);
      }
      ctx2.fillStyle = textColor;
      ctx2.font = "bold 13px monospace";
      ctx2.textAlign = "center";
      ctx2.fillText(abilityKeys[i], x + abilitySize / 2, abilityY + abilitySize / 2 + (ability.state === "cooldown" /* OnCooldown */ ? -8 : 4));
      if (ability.isPassive && ability.level > 0) {
        ctx2.fillStyle = "#9E9E9E";
        ctx2.font = "8px monospace";
        ctx2.fillText("PASSIV", x + abilitySize / 2, abilityY + abilitySize - 4);
      }
      const maxLvl = ability.id === "R" /* PayrollRun */ ? 3 : 4;
      for (let lvl = 0; lvl < maxLvl; lvl++) {
        const dotX = x + 5 + lvl * 8;
        const dotY = abilityY - 4;
        ctx2.fillStyle = lvl < ability.level ? "#FFD700" : "#333";
        ctx2.beginPath();
        ctx2.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx2.fill();
      }
    }
    const itemSize = 30;
    const itemGap = 4;
    const itemsX = CANVAS_W - 6 * (itemSize + itemGap) - 16;
    const itemsY = barY + 14;
    ctx2.fillStyle = COL.dimText;
    ctx2.font = "10px monospace";
    ctx2.textAlign = "left";
    ctx2.fillText("Ausr\xFCstung:", itemsX, itemsY - 4);
    for (let i = 0; i < hero.items.length; i++) {
      const item = hero.items[i];
      const x = itemsX + i * (itemSize + itemGap);
      ctx2.fillStyle = item.purchased ? "#2a3a2a" : "#0d0d0d";
      ctx2.fillRect(x, itemsY, itemSize, itemSize);
      ctx2.strokeStyle = item.purchased ? "#4CAF50" : "#222";
      ctx2.lineWidth = 1;
      ctx2.strokeRect(x, itemsY, itemSize, itemSize);
      if (item.purchased) {
        ctx2.fillStyle = COL.lohn;
        ctx2.font = "bold 10px monospace";
        ctx2.textAlign = "center";
        ctx2.fillText(item.name.charAt(0), x + itemSize / 2, itemsY + itemSize / 2 + 3);
      }
    }
    ctx2.fillStyle = COL.dimText;
    ctx2.font = "11px monospace";
    ctx2.textAlign = "right";
    ctx2.fillText("[B] Kantine", CANVAS_W - 16, barY + itemsY + itemSize + 14 - barY);
    ctx2.fillStyle = COL.text;
    ctx2.font = "bold 12px monospace";
    ctx2.textAlign = "left";
    ctx2.fillText(`\u{1F4CB} ${hero.name}`, 210, barY + 18);
    ctx2.fillStyle = COL.dimText;
    ctx2.font = "11px monospace";
    ctx2.fillText(`ATK: ${hero.attackDamage} | SPD: ${hero.moveSpeed} | ARM: ${hero.armor}`, 210, barY + 34);
    renderMinimap(ctx2, state2);
    if (infoPanelVisible) {
      renderInfoPanel(ctx2, state2);
    } else {
      ctx2.fillStyle = "rgba(255,255,255,0.3)";
      ctx2.font = "10px monospace";
      ctx2.textAlign = "right";
      ctx2.fillText("[H] Info einblenden", CANVAS_W - 12, 56);
      ctx2.textAlign = "left";
    }
  }
  function renderInfoPanel(ctx2, state2) {
    const hero = state2.hero;
    const panelW = 210;
    const panelX = CANVAS_W - panelW - 10;
    const panelY = 44;
    const panelH = 370;
    ctx2.fillStyle = "rgba(0,0,0,0.55)";
    ctx2.fillRect(panelX, panelY, panelW, panelH);
    ctx2.strokeStyle = "#333";
    ctx2.lineWidth = 1;
    ctx2.strokeRect(panelX, panelY, panelW, panelH);
    const x = panelX + 10;
    let y = panelY + 18;
    const lineH = 15;
    ctx2.fillStyle = "#FFD700";
    ctx2.font = "bold 11px monospace";
    ctx2.textAlign = "left";
    ctx2.fillText("STEUERUNG", x, y);
    y += lineH + 2;
    ctx2.fillStyle = COL.dimText;
    ctx2.font = "10px monospace";
    const controls = [
      ["Rechtsklick", "Bewegen / Angriff"],
      ["Pfeiltasten", "Held bewegen"],
      ["Q / W / E / R", "Faehigkeit nutzen"],
      ["SHIFT+Q/W/E/R", "Faehigkeit leveln"],
      ["B", "Kantine oeffnen"],
      ["ESC", "Kantine schliessen"]
    ];
    for (const [key, desc] of controls) {
      ctx2.fillStyle = "#AAAAAA";
      ctx2.fillText(key, x, y);
      ctx2.fillStyle = COL.dimText;
      ctx2.fillText(desc, x + 95, y);
      y += lineH;
    }
    y += 6;
    ctx2.strokeStyle = "#333";
    ctx2.beginPath();
    ctx2.moveTo(panelX + 8, y);
    ctx2.lineTo(panelX + panelW - 8, y);
    ctx2.stroke();
    y += 12;
    ctx2.fillStyle = "#FFD700";
    ctx2.font = "bold 11px monospace";
    ctx2.fillText("FAEHIGKEITEN", x, y);
    y += lineH + 4;
    const abilityKeys = ["Q", "W", "E", "R"];
    for (let i = 0; i < hero.abilities.length; i++) {
      const ability = hero.abilities[i];
      const key = abilityKeys[i];
      ctx2.fillStyle = ability.level > 0 ? "#FFFFFF" : "#555";
      ctx2.font = "bold 10px monospace";
      ctx2.fillText(`[${key}] ${ability.name}`, x, y);
      const maxLvl = ability.id === "R" /* PayrollRun */ ? 3 : 4;
      ctx2.fillStyle = "#FFD700";
      ctx2.font = "10px monospace";
      ctx2.textAlign = "right";
      ctx2.fillText(`Lv ${ability.level}/${maxLvl}`, panelX + panelW - 10, y);
      ctx2.textAlign = "left";
      y += lineH - 2;
      ctx2.fillStyle = COL.dimText;
      ctx2.font = "9px monospace";
      const desc = ability.description;
      const maxChars = 28;
      ctx2.fillText(desc.length > maxChars ? desc.substring(0, maxChars - 1) + ".." : desc, x, y);
      y += lineH + 4;
    }
  }
  function renderEntityHPBars(ctx2, state2) {
    const hero = state2.hero;
    for (const creep of state2.radiantCreeps) renderCreepHPBar(ctx2, creep);
    for (const creep of state2.direCreeps) renderCreepHPBar(ctx2, creep);
    if (hero.alive) {
      const bw = 50;
      const bh = 5;
      const bx = hero.pos.x - bw / 2;
      const by = hero.pos.y - hero.radius - 14;
      const pct = hero.hp / hero.maxHp;
      ctx2.fillStyle = "#111";
      ctx2.fillRect(Math.round(bx), Math.round(by), bw, bh);
      ctx2.fillStyle = pct < 0.3 ? "#f44336" : "#4CAF50";
      ctx2.fillRect(Math.round(bx), Math.round(by), Math.round(bw * pct), bh);
      ctx2.strokeStyle = "#555";
      ctx2.lineWidth = 0.5;
      ctx2.strokeRect(Math.round(bx), Math.round(by), bw, bh);
    }
  }
  function renderCreepHPBar(ctx2, creep) {
    if (!creep.alive) return;
    const bw = 32;
    const bh = 4;
    const bx = creep.pos.x - bw / 2;
    const by = creep.pos.y - creep.radius - 10;
    const pct = creep.hp / creep.maxHp;
    ctx2.fillStyle = "#111";
    ctx2.fillRect(Math.round(bx), Math.round(by), bw, bh);
    if (creep.isLastHitWindow && creep.team === "dire" /* Dire */) {
      ctx2.fillStyle = Math.floor(Date.now() / 200) % 2 === 0 ? "#FF1744" : "#FF5722";
    } else {
      ctx2.fillStyle = creep.team === "radiant" /* Radiant */ ? "#4CAF50" : "#FF5722";
    }
    ctx2.fillRect(Math.round(bx), Math.round(by), Math.round(bw * pct), bh);
    if (creep.variant === "siege" /* Siege */) {
      ctx2.fillStyle = "#FFD700";
      ctx2.font = "8px monospace";
      ctx2.textAlign = "center";
      ctx2.fillText("\u25A3", creep.pos.x, by - 3);
    }
  }
  function updateFloatingTexts(state2, dt) {
    for (const ft of state2.floatingTexts) {
      ft.life -= dt;
      ft.pos.y += ft.vy * dt;
      ft.alpha = Math.max(0, ft.life / 1.5);
    }
    state2.floatingTexts = state2.floatingTexts.filter((f) => f.life > 0);
  }
  function renderFloatingTexts(ctx2, state2) {
    for (const ft of state2.floatingTexts) {
      if (ft.alpha <= 0) continue;
      ctx2.save();
      ctx2.globalAlpha = ft.alpha;
      ctx2.fillStyle = ft.color;
      ctx2.font = `bold ${ft.size}px monospace`;
      ctx2.textAlign = "center";
      ctx2.fillText(ft.text, Math.round(ft.pos.x), Math.round(ft.pos.y));
      ctx2.restore();
    }
  }
  function renderAoEEffects(ctx2, state2) {
    for (const effect of state2.aoeEffects) {
      const alpha = effect.life / effect.maxLife * 0.35;
      ctx2.save();
      ctx2.globalAlpha = alpha;
      if (effect.kind === "ring") {
        ctx2.strokeStyle = effect.color;
        ctx2.lineWidth = 4;
        const expandedR = effect.radius * (1 - effect.life / effect.maxLife * 0.3);
        ctx2.beginPath();
        ctx2.arc(effect.pos.x, effect.pos.y, expandedR, 0, Math.PI * 2);
        ctx2.stroke();
      } else {
        ctx2.fillStyle = effect.color;
        ctx2.beginPath();
        ctx2.arc(effect.pos.x, effect.pos.y, effect.radius, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.restore();
    }
  }

  // src/ui/shop.ts
  var SHOP_W = 520;
  var SHOP_H = 420;
  var SHOP_X = (CANVAS_W - SHOP_W) / 2;
  var SHOP_Y = (CANVAS_H - SHOP_H) / 2;
  var ITEM_W = 230;
  var ITEM_H = 55;
  var ITEM_GAP = 8;
  var COLS = 2;
  var GRID_X = SHOP_X + 20;
  var GRID_Y = SHOP_Y + 70;
  function renderShop(ctx2, state2) {
    if (!state2.shopOpen) return;
    const hero = state2.hero;
    ctx2.fillStyle = "rgba(0,0,0,0.6)";
    ctx2.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx2.fillStyle = "rgba(15,20,15,0.96)";
    ctx2.fillRect(SHOP_X, SHOP_Y, SHOP_W, SHOP_H);
    ctx2.strokeStyle = "#4CAF50";
    ctx2.lineWidth = 2;
    ctx2.strokeRect(SHOP_X, SHOP_Y, SHOP_W, SHOP_H);
    ctx2.fillStyle = "#FFD700";
    ctx2.font = "bold 22px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText("\u{1F37D}  K A N T I N E", CANVAS_W / 2, SHOP_Y + 30);
    ctx2.fillStyle = "#FFD700";
    ctx2.font = "bold 14px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText(`Verf\xFCgbar: \u20B2 ${Math.floor(hero.lohn).toLocaleString("de-DE")}`, CANVAS_W / 2, SHOP_Y + 52);
    for (let i = 0; i < hero.items.length; i++) {
      const item = hero.items[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GRID_X + col * (ITEM_W + ITEM_GAP);
      const y = GRID_Y + row * (ITEM_H + ITEM_GAP);
      renderShopItem(ctx2, item, x, y, hero.lohn);
    }
    ctx2.fillStyle = "#666";
    ctx2.font = "11px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText("Klicke ein Item zum Kaufen  |  [B] oder [ESC] zum Schlie\xDFen", CANVAS_W / 2, SHOP_Y + SHOP_H - 14);
  }
  function renderShopItem(ctx2, item, x, y, currentLohn) {
    const affordable = currentLohn >= item.cost && !item.purchased;
    const purchased = item.purchased;
    ctx2.fillStyle = purchased ? "#1a2a1a" : affordable ? "#1a1a2a" : "#1a1a1a";
    ctx2.fillRect(x, y, ITEM_W, ITEM_H);
    ctx2.strokeStyle = purchased ? "#4CAF50" : affordable ? "#1565C0" : "#333";
    ctx2.lineWidth = purchased ? 2 : 1;
    ctx2.strokeRect(x, y, ITEM_W, ITEM_H);
    if (purchased) {
      ctx2.fillStyle = "rgba(76,175,80,0.15)";
      ctx2.fillRect(x, y, ITEM_W, ITEM_H);
      ctx2.fillStyle = "#4CAF50";
      ctx2.font = "bold 14px monospace";
      ctx2.textAlign = "right";
      ctx2.fillText("\u2713", x + ITEM_W - 8, y + 18);
    }
    ctx2.fillStyle = purchased ? "#4CAF50" : affordable ? "#FFFFFF" : "#666";
    ctx2.font = "bold 13px monospace";
    ctx2.textAlign = "left";
    ctx2.fillText(item.name, x + 8, y + 18);
    ctx2.fillStyle = purchased ? "#666" : "#AAAAAA";
    ctx2.font = "11px monospace";
    ctx2.fillText(item.description, x + 8, y + 34);
    if (!purchased) {
      ctx2.fillStyle = affordable ? "#FFD700" : "#FF5722";
      ctx2.font = "bold 12px monospace";
      ctx2.textAlign = "right";
      ctx2.fillText(`\u20B2 ${item.cost}`, x + ITEM_W - 8, y + 46);
    }
  }
  function handleShopClick(state2) {
    if (!state2.shopOpen) return false;
    const mx = state2.input.mouseScreen.x;
    const my = state2.input.mouseScreen.y;
    if (mx < SHOP_X || mx > SHOP_X + SHOP_W || my < SHOP_Y || my > SHOP_Y + SHOP_H) {
      state2.shopOpen = false;
      return true;
    }
    for (let i = 0; i < state2.hero.items.length; i++) {
      const item = state2.hero.items[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GRID_X + col * (ITEM_W + ITEM_GAP);
      const y = GRID_Y + row * (ITEM_H + ITEM_GAP);
      if (mx >= x && mx <= x + ITEM_W && my >= y && my <= y + ITEM_H) {
        if (!item.purchased && state2.hero.lohn >= item.cost) {
          purchaseItem(state2, item);
          return true;
        }
      }
    }
    return true;
  }
  function purchaseItem(state2, item) {
    const hero = state2.hero;
    hero.lohn -= item.cost;
    item.purchased = true;
    hero.maxHp += item.hpBonus;
    hero.hp += item.hpBonus;
    hero.attackDamage += item.attackBonus;
    hero.moveSpeed += item.moveSpeedBonus;
    hero.baseSpeed += item.moveSpeedBonus;
    hero.passiveLohnRate += item.passiveLohnBonus;
    hero.hpRegen += item.hpRegenBonus;
    state2.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: hero.pos.x, y: hero.pos.y - 50 },
      text: `\u{1F4E6} ${item.name}!`,
      color: "#4CAF50",
      alpha: 1,
      vy: -60,
      life: 1.5,
      size: 16
    });
    EventBus.emit("ITEM_PURCHASED", { itemId: item.id, name: item.name });
  }

  // src/game.ts
  var FIXED_DT = 1 / 60;
  function createGameState(canvas2, ctx2) {
    const hero = createHero();
    const { radiantTowers, direTowers } = createAllTowers();
    const state2 = {
      phase: "mainmenu" /* MainMenu */,
      hero,
      radiantCreeps: [],
      direCreeps: [],
      radiantTowers,
      direTowers,
      projectiles: [],
      floatingTexts: [],
      aoeEffects: [],
      wave: {
        waveNumber: 0,
        nextWaveTimer: 5,
        // Erste Welle nach 5s
        WAVE_INTERVAL: 30
      },
      economy: {
        passiveTimer: 0,
        lohnHistory: []
      },
      camera: {
        x: hero.pos.x - CANVAS_W / 2,
        y: hero.pos.y - CANVAS_H / 2,
        targetX: 0,
        targetY: 0,
        LERP_SPEED: 0.08
      },
      input: {
        mouseWorld: { x: 0, y: 0 },
        mouseScreen: { x: 0, y: 0 },
        keys: /* @__PURE__ */ new Set(),
        rightClickDown: false,
        leftClickDown: false,
        rightClickFired: false,
        leftClickFired: false,
        pendingAbility: null
      },
      canvas: canvas2,
      ctx: ctx2,
      totalTime: 0,
      shopOpen: false,
      victoryTime: 0,
      logoImage: null,
      respawnTimer: 0,
      deathCount: 0,
      stage: 1,
      stageBannerTimer: 0
    };
    EventBus.clear();
    initEconomyListeners(state2);
    return state2;
  }
  function resetForNewGame(state2) {
    const hero = createHero();
    const { radiantTowers, direTowers } = createAllTowers();
    state2.hero = hero;
    state2.radiantCreeps = [];
    state2.direCreeps = [];
    state2.radiantTowers = radiantTowers;
    state2.direTowers = direTowers;
    state2.projectiles = [];
    state2.floatingTexts = [];
    state2.aoeEffects = [];
    state2.wave = { waveNumber: 0, nextWaveTimer: 5, WAVE_INTERVAL: 30 };
    state2.economy = { passiveTimer: 0, lohnHistory: [] };
    state2.camera.x = hero.pos.x - CANVAS_W / 2;
    state2.camera.y = hero.pos.y - CANVAS_H / 2;
    state2.totalTime = 0;
    state2.shopOpen = false;
    state2.phase = "ingame" /* InGame */;
    state2.respawnTimer = 0;
    state2.deathCount = 0;
    state2.stage = 1;
    state2.stageBannerTimer = 0;
    EventBus.clear();
    initEconomyListeners(state2);
  }
  function update(state2, dt) {
    if (state2.phase !== "ingame" /* InGame */) return;
    state2.totalTime += dt;
    updateWaves(state2, dt);
    updateEconomy(state2, dt);
    updateHeroCombat(state2, dt);
    updateCreeps(state2, dt);
    updateTowers(state2, dt);
    updateProjectiles(state2, dt);
    updateAbilities(state2, dt);
    updatePayrollCoins(state2, dt);
    updateAoEEffects(state2, dt);
    EventBus.dispatch();
    updateCamera(state2, dt);
    updateFloatingTexts(state2, dt);
    entityCleanup(state2);
    state2.input.rightClickFired = false;
    state2.input.leftClickFired = false;
  }
  function render(state2) {
    const ctx2 = state2.ctx;
    const cam = state2.camera;
    ctx2.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (state2.phase === "mainmenu" /* MainMenu */) {
      renderMainMenu(ctx2, state2);
      return;
    }
    ctx2.save();
    ctx2.translate(Math.round(-cam.x), Math.round(-cam.y));
    renderMap(ctx2, cam);
    for (const t of state2.radiantTowers) renderTower(ctx2, t);
    for (const t of state2.direTowers) renderTower(ctx2, t);
    renderAoEEffects(ctx2, state2);
    const allCreeps = [...state2.radiantCreeps, ...state2.direCreeps].filter((c) => c.alive).sort((a, b) => a.pos.y - b.pos.y);
    for (const creep of allCreeps) renderCreep(ctx2, creep);
    if (state2.hero.alive) renderHero(ctx2, state2);
    for (const p of state2.projectiles) {
      if (p.alive) renderProjectile(ctx2, p);
    }
    renderEntityHPBars(ctx2, state2);
    renderFloatingTexts(ctx2, state2);
    if (state2.hero.moveTarget && state2.hero.alive) {
      const mt = state2.hero.moveTarget;
      ctx2.strokeStyle = "rgba(76,175,80,0.4)";
      ctx2.lineWidth = 1.5;
      ctx2.beginPath();
      ctx2.arc(mt.x, mt.y, 10, 0, Math.PI * 2);
      ctx2.stroke();
    }
    ctx2.restore();
    renderHUD(ctx2, state2);
    renderShop(ctx2, state2);
    if (state2.respawnTimer > 0 && !state2.hero.alive) {
      renderRespawnOverlay(ctx2, state2);
    }
    if (state2.stageBannerTimer > 0) {
      renderStageBanner(ctx2, state2);
    }
    if (state2.phase === "victory" /* Victory */) renderVictory(ctx2, state2);
    if (state2.phase === "defeat" /* Defeat */) renderDefeat(ctx2, state2);
  }
  function renderStageBanner(ctx2, state2) {
    const t = state2.stageBannerTimer;
    const alpha = t > 4 ? 5 - t : t > 1 ? 1 : t;
    ctx2.save();
    ctx2.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx2.fillStyle = "rgba(0,0,0,0.7)";
    ctx2.fillRect(0, CANVAS_H / 2 - 80, CANVAS_W, 160);
    ctx2.fillStyle = "#FFD700";
    ctx2.font = "bold 42px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText(`AKT ${state2.stage} / 6`, CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx2.fillStyle = "#FF7043";
    ctx2.font = "bold 18px monospace";
    ctx2.fillText("Die Direktion verst\xE4rkt sich!", CANVAS_W / 2, CANVAS_H / 2 + 25);
    ctx2.fillStyle = "#FFFFFF";
    ctx2.font = "14px monospace";
    ctx2.fillText("Volles Leben + Akt-Bonus erhalten", CANVAS_W / 2, CANVAS_H / 2 + 55);
    ctx2.restore();
  }
  function renderCreep(ctx2, creep) {
    const { pos, radius, team, variant, alive, isLastHitWindow, slowTimer } = creep;
    if (!alive) return;
    const baseColor = team === "radiant" /* Radiant */ ? "#66BB6A" : "#FF7043";
    ctx2.save();
    ctx2.translate(Math.round(pos.x), Math.round(pos.y));
    if (slowTimer > 0) {
      ctx2.strokeStyle = "rgba(255,152,0,0.4)";
      ctx2.lineWidth = 2;
      ctx2.beginPath();
      ctx2.arc(0, 0, radius + 6, 0, Math.PI * 2);
      ctx2.stroke();
    }
    ctx2.beginPath();
    if (variant === "melee") {
      ctx2.arc(0, 0, radius, 0, Math.PI * 2);
    } else if (variant === "ranged") {
      ctx2.moveTo(0, -radius);
      ctx2.lineTo(radius, 0);
      ctx2.lineTo(0, radius);
      ctx2.lineTo(-radius, 0);
      ctx2.closePath();
    } else {
      ctx2.rect(-radius, -radius, radius * 2, radius * 2);
    }
    ctx2.fillStyle = isLastHitWindow && team === "dire" /* Dire */ ? Math.floor(Date.now() / 150) % 2 === 0 ? "#FF1744" : baseColor : baseColor;
    ctx2.fill();
    ctx2.strokeStyle = "#222";
    ctx2.lineWidth = 1.5;
    ctx2.stroke();
    ctx2.fillStyle = team === "radiant" /* Radiant */ ? "#1B5E20" : "#BF360C";
    ctx2.beginPath();
    ctx2.arc(0, 0, 4, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.restore();
  }
  function renderHero(ctx2, state2) {
    const hero = state2.hero;
    const { pos, radius, facingAngle, zeitbuchungReady, payrollRunActive } = hero;
    ctx2.save();
    ctx2.translate(Math.round(pos.x), Math.round(pos.y));
    const glow = ctx2.createRadialGradient(0, 0, 0, 0, 0, radius * 2.5);
    glow.addColorStop(0, payrollRunActive ? "rgba(255,215,0,0.35)" : "rgba(76,175,80,0.2)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx2.fillStyle = glow;
    ctx2.beginPath();
    ctx2.arc(0, 0, radius * 2.5, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(0, 0, radius, 0, Math.PI * 2);
    ctx2.fillStyle = "#4CAF50";
    ctx2.fill();
    ctx2.strokeStyle = zeitbuchungReady ? "#00BCD4" : "#1B5E20";
    ctx2.lineWidth = zeitbuchungReady ? 3 : 2;
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.moveTo(0, 0);
    ctx2.lineTo(Math.cos(facingAngle) * (radius + 10), Math.sin(facingAngle) * (radius + 10));
    ctx2.strokeStyle = "#FFFFFF";
    ctx2.lineWidth = 2;
    ctx2.stroke();
    ctx2.fillStyle = "#FFFFFF";
    ctx2.font = "bold 16px monospace";
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText("\u20B2", 0, 0);
    if (zeitbuchungReady) {
      ctx2.strokeStyle = "#00BCD4";
      ctx2.lineWidth = 2;
      ctx2.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 200);
      ctx2.beginPath();
      ctx2.arc(0, 0, radius + 5, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.globalAlpha = 1;
    }
    ctx2.restore();
  }
  function renderRespawnOverlay(ctx2, state2) {
    ctx2.fillStyle = "rgba(30,0,0,0.4)";
    ctx2.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const secs = Math.ceil(state2.respawnTimer);
    ctx2.fillStyle = "#FF5722";
    ctx2.font = "bold 28px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText("GEFALLEN!", CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx2.fillStyle = "#FFFFFF";
    ctx2.font = "bold 22px monospace";
    ctx2.fillText(`Respawn in ${secs}s`, CANVAS_W / 2, CANVAS_H / 2 + 15);
    ctx2.fillStyle = "#FFD700";
    ctx2.font = "14px monospace";
    ctx2.fillText(`Tod #${state2.deathCount}  |  -15% Lohn`, CANVAS_W / 2, CANVAS_H / 2 + 45);
  }
  function renderMainMenu(ctx2, state2) {
    ctx2.fillStyle = "#0a0f0a";
    ctx2.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx2.strokeStyle = "#1a2a1a";
    ctx2.lineWidth = 1;
    for (let i = 0; i < CANVAS_W; i += 60) {
      ctx2.beginPath();
      ctx2.moveTo(i, 0);
      ctx2.lineTo(i, CANVAS_H);
      ctx2.stroke();
    }
    if (state2.logoImage && state2.logoImage.complete) {
      const logoH = 80;
      const logoW = state2.logoImage.width / state2.logoImage.height * logoH;
      ctx2.drawImage(state2.logoImage, (CANVAS_W - logoW) / 2, 140, logoW, logoH);
    } else {
      ctx2.fillStyle = "#4CAF50";
      ctx2.font = "bold 48px monospace";
      ctx2.textAlign = "center";
      ctx2.fillText("sp_dota", CANVAS_W / 2, 190);
    }
    ctx2.fillStyle = "#666";
    ctx2.font = "16px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText("P A Y R O L L   W A R S", CANVAS_W / 2, 260);
    ctx2.fillStyle = "#FFD700";
    ctx2.font = "bold 14px monospace";
    ctx2.fillText("Dein Held:", CANVAS_W / 2, 320);
    ctx2.fillStyle = "#FFFFFF";
    ctx2.font = "bold 20px monospace";
    ctx2.fillText("\u{1F4CB} Der Buchhalter", CANVAS_W / 2, 350);
    ctx2.fillStyle = "#AAAAAA";
    ctx2.font = "13px monospace";
    ctx2.fillText("620 HP  |  55 ATK  |  300 SPD  |  Ranged", CANVAS_W / 2, 375);
    const btnW = 260;
    const btnH = 50;
    const btnX = (CANVAS_W - btnW) / 2;
    const btnY = 420;
    const hover = state2.input.mouseScreen.x >= btnX && state2.input.mouseScreen.x <= btnX + btnW && state2.input.mouseScreen.y >= btnY && state2.input.mouseScreen.y <= btnY + btnH;
    ctx2.fillStyle = hover ? "#388E3C" : "#2E7D32";
    ctx2.fillRect(btnX, btnY, btnW, btnH);
    ctx2.strokeStyle = "#4CAF50";
    ctx2.lineWidth = 2;
    ctx2.strokeRect(btnX, btnY, btnW, btnH);
    ctx2.fillStyle = "#FFFFFF";
    ctx2.font = "bold 18px monospace";
    ctx2.fillText("\u25B6  SPIEL STARTEN", CANVAS_W / 2, btnY + btnH / 2 + 6);
    ctx2.fillStyle = "#555";
    ctx2.font = "11px monospace";
    const controlY = 520;
    ctx2.fillText("Rechtsklick: Bewegen / Angreifen  |  Q/W/E/R: F\xE4higkeiten  |  B: Kantine", CANVAS_W / 2, controlY);
    ctx2.fillText("SHIFT+Q/W/E/R: F\xE4higkeit leveln  |  Ziel: Dire Direktionszentrale zerst\xF6ren!", CANVAS_W / 2, controlY + 18);
  }
  function renderVictory(ctx2, state2) {
    ctx2.fillStyle = "rgba(0,30,0,0.85)";
    ctx2.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx2.fillStyle = "#4CAF50";
    ctx2.font = "bold 36px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText("\u2705 DIREKTIONSZENTRALE ZERST\xD6RT!", CANVAS_W / 2, 200);
    ctx2.fillStyle = "#FFD700";
    ctx2.font = "bold 24px monospace";
    ctx2.fillText("SIEG!", CANVAS_W / 2, 250);
    const mins = Math.floor(state2.victoryTime / 60);
    const secs = Math.floor(state2.victoryTime % 60);
    ctx2.fillStyle = "#FFFFFF";
    ctx2.font = "16px monospace";
    ctx2.fillText(`Spielzeit: ${mins}:${String(secs).padStart(2, "0")}`, CANVAS_W / 2, 310);
    ctx2.fillText(`Level: ${state2.hero.level}`, CANVAS_W / 2, 340);
    ctx2.fillText(`Lohn verdient: \u20B2 ${Math.floor(state2.hero.lohn).toLocaleString("de-DE")}`, CANVAS_W / 2, 370);
    renderRestartButton(ctx2, state2);
  }
  function renderDefeat(ctx2, state2) {
    ctx2.fillStyle = "rgba(30,0,0,0.85)";
    ctx2.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx2.fillStyle = "#FF5722";
    ctx2.font = "bold 36px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText("\u{1F480} GEHALTSK\xDCRZUNG FATAL!", CANVAS_W / 2, 220);
    ctx2.fillStyle = "#FF8A80";
    ctx2.font = "bold 20px monospace";
    ctx2.fillText("NIEDERLAGE", CANVAS_W / 2, 260);
    ctx2.fillStyle = "#FFFFFF";
    ctx2.font = "16px monospace";
    const mins = Math.floor(state2.totalTime / 60);
    const secs = Math.floor(state2.totalTime % 60);
    ctx2.fillText(`Spielzeit: ${mins}:${String(secs).padStart(2, "0")}`, CANVAS_W / 2, 320);
    ctx2.fillText(`Level: ${state2.hero.level}`, CANVAS_W / 2, 350);
    renderRestartButton(ctx2, state2);
  }
  function renderRestartButton(ctx2, state2) {
    const btnW = 220;
    const btnH = 44;
    const btnX = (CANVAS_W - btnW) / 2;
    const btnY = 430;
    const hover = state2.input.mouseScreen.x >= btnX && state2.input.mouseScreen.x <= btnX + btnW && state2.input.mouseScreen.y >= btnY && state2.input.mouseScreen.y <= btnY + btnH;
    ctx2.fillStyle = hover ? "#333" : "#222";
    ctx2.fillRect(btnX, btnY, btnW, btnH);
    ctx2.strokeStyle = "#666";
    ctx2.lineWidth = 1;
    ctx2.strokeRect(btnX, btnY, btnW, btnH);
    ctx2.fillStyle = "#FFFFFF";
    ctx2.font = "bold 16px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText("\u{1F504} NOCHMAL SPIELEN", CANVAS_W / 2, btnY + btnH / 2 + 5);
  }
  function isStartButtonClicked(state2) {
    const btnW = 260;
    const btnH = 50;
    const btnX = (CANVAS_W - btnW) / 2;
    const btnY = 420;
    const mx = state2.input.mouseScreen.x;
    const my = state2.input.mouseScreen.y;
    return mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH;
  }
  function isRestartButtonClicked(state2) {
    const btnW = 220;
    const btnH = 44;
    const btnX = (CANVAS_W - btnW) / 2;
    const btnY = 430;
    const mx = state2.input.mouseScreen.x;
    const my = state2.input.mouseScreen.y;
    return mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH;
  }

  // src/main.ts
  var canvas = document.getElementById("gameCanvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var state = createGameState(canvas, ctx);
  var logo = new Image();
  logo.src = "assets/sp_dota_logo.png";
  logo.onload = () => {
    state.logoImage = logo;
  };
  var ABILITY_KEYS = {
    "Q": "Q" /* Zeitbuchung */,
    "W": "W" /* Ueberstunden */,
    "E": "E" /* Gehaltserhöhung */,
    "R": "R" /* PayrollRun */
  };
  function updateMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const sy = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    state.input.mouseScreen = { x: sx, y: sy };
    state.input.mouseWorld = screenToWorld(state.input.mouseScreen, state.camera);
  }
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    updateMousePos(e);
    if (e.button === 0) {
      state.input.leftClickDown = true;
      state.input.leftClickFired = true;
      if (state.phase === "mainmenu" /* MainMenu */) {
        if (isStartButtonClicked(state)) {
          state.phase = "ingame" /* InGame */;
        }
        return;
      }
      if (state.phase === "victory" /* Victory */ || state.phase === "defeat" /* Defeat */) {
        if (isRestartButtonClicked(state)) {
          resetForNewGame(state);
        }
        return;
      }
      if (state.phase === "ingame" /* InGame */) {
        if (state.shopOpen) {
          handleShopClick(state);
          return;
        }
      }
    }
    if (e.button === 2) {
      state.input.rightClickDown = true;
      state.input.rightClickFired = true;
      if (state.phase === "ingame" /* InGame */ && !state.shopOpen) {
        handleHeroRightClick(state);
      }
    }
  });
  canvas.addEventListener("mouseup", (e) => {
    if (e.button === 0) state.input.leftClickDown = false;
    if (e.button === 2) state.input.rightClickDown = false;
  });
  canvas.addEventListener("mousemove", (e) => {
    updateMousePos(e);
  });
  window.addEventListener("keydown", (e) => {
    const key = e.key.toUpperCase();
    state.input.keys.add(key);
    if (state.phase !== "ingame" /* InGame */) return;
    if (key === "H") {
      toggleInfoPanel();
      e.preventDefault();
      return;
    }
    if (key === "B") {
      state.shopOpen = !state.shopOpen;
      e.preventDefault();
      return;
    }
    if (key === "ESCAPE" && state.shopOpen) {
      state.shopOpen = false;
      e.preventDefault();
      return;
    }
    if (e.shiftKey) {
      if (ABILITY_KEYS[key]) {
        tryLevelAbility(state, ABILITY_KEYS[key]);
        e.preventDefault();
        return;
      }
    }
    if (ABILITY_KEYS[key]) {
      tryUseAbility(state, ABILITY_KEYS[key]);
      e.preventDefault();
    }
    if (key.startsWith("ARROW")) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    state.input.keys.delete(e.key.toUpperCase());
  });
  var lastTime = 0;
  var accumulator = 0;
  function gameLoop(timestamp) {
    const rawDt = Math.min((timestamp - lastTime) / 1e3, 0.1);
    lastTime = timestamp;
    accumulator += rawDt;
    while (accumulator >= FIXED_DT2) {
      update(state, FIXED_DT2);
      accumulator -= FIXED_DT2;
    }
    render(state);
    requestAnimationFrame(gameLoop);
  }
  var FIXED_DT2 = 1 / 60;
  requestAnimationFrame((ts) => {
    lastTime = ts;
    requestAnimationFrame(gameLoop);
  });
})();
//# sourceMappingURL=main.js.map
