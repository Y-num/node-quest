const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/antigravity/Desktop/pdf変換/node-quest';
const RESULTS_DIR = path.join(ARTIFACT_DIR, 'test_results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
    this.events = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = evt => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        } else if (msg.method) {
          const handler = this.events.get(msg.method);
          if (handler) handler(msg.params);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    this.events.set(method, handler);
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error in [${expression}]: ` + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(RESULTS_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`[Screenshot Saved] -> ${fullPath}`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 NODE QUEST: 4 PARADIGM SYSTEMS (A, B, C, D) VERIFICATION');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,900'
  ]);

  const jsErrors = [];

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      try {
        const json = await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:9225/json/version', res => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => resolve(buf));
          }).on('error', reject);
        });
        wsUrl = JSON.parse(json).webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch (e) {}
    }
    if (!wsUrl) throw new Error('Failed to connect to headless Chrome');

    const browserCdp = new SimpleCDP(wsUrl);
    await browserCdp.connect();

    const fileUrl = 'file:///Users/antigravity/Desktop/pdf変換/node-quest/index.html?debug=1';
    const target = await browserCdp.send('Target.createTarget', { url: fileUrl });
    const cdp = new SimpleCDP(`ws://127.0.0.1:9225/devtools/page/${target.targetId}`);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    cdp.on('Runtime.exceptionThrown', params => {
      jsErrors.push(params.exceptionDetails);
      console.error('❌ JS Exception:', JSON.stringify(params.exceptionDetails));
    });

    await new Promise(r => setTimeout(r, 1200));

    // Start fresh game
    await cdp.eval(`
      localStorage.clear();
      resetting = false;
      newGame();
      S.gold = 50000;
      S.rp = 50000;
      S.stock = 5000;
      S.best = 200;
      S.stats.str = 25;
      S.stats.int = 25;
      S.stats.vit = 25;
      S.tutDone = 1;
      const tutEl = document.getElementById('tut');
      if (tutEl) tutEl.style.display = 'none';
      for (const k of ORDER) { if (TYPES[k]) S.dev[k] = 1; }
      for (const c of CAVES) {
        S.caveUnlocked = S.caveUnlocked || {};
        S.caveUnlocked[c.id] = 1;
        S.caveClears = S.caveClears || {};
        S.caveClears[c.id] = 1;
      }
      applyView(); renderBoard(); render();
    `);

    const report = { tests: [], jsErrors: 0 };

    // =========================================================================
    // TEST A: Cave Backflow Resource & Environmental Pipeline (cave_backflow)
    // =========================================================================
    console.log('--- [Test A] Cave Backflow Resource & Environmental Pipeline ---');
    const resA = await cdp.eval(`(() => {
      const dive = S.nodes.find(n => TYPES[n.type] && TYPES[n.type].effect === 'dive');
      dive.x = 200; dive.y = 200;
      // Create a smelter and a lab next to dive
      const smelt = addNode('smelt1', 420, 150);
      const lab = addNode('lab1', 420, 300);

      // Connect dive -> smelt (sta) and dive -> lab (waste)
      addLink(dive.id, 'sta', smelt.id);
      addLink(dive.id, 'waste', lab.id);

      // Test Cave 2 (Cryo) + HEAT on smelt -> Quench reaction without separate cryo node!
      S.caveId = 'cave2';
      dive.caveId = 'cave2';
      const wood = addNode('wood1', 200, 50);
      addLink(wood.id, 'wood', smelt.id);
      updateReactionEngine(1.0);
      const cave2Quench = !!smelt._rxQuench;
      const cave2Backflow = !!smelt._rxCaveBackflow;

      // Test Cave 4 (Lava / Geothermal HEAT + geothermal sta backflow)
      S.caveId = 'cave4';
      dive.caveId = 'cave4';
      smelt.inBuf.sta = 0;
      updateReactionEngine(1.0);
      const cave4HeatTag = !!(smelt.inTags && smelt.inTags.HEAT);
      const cave4GeothermalSta = (smelt.inBuf.sta || 0) > 0;
      const smeltSpdMul = rxSpeedMul(smelt);

      // Test Cave 3 (Ancient Ruins -> CATALYST_RESEARCH backflow into lab)
      const baseRp = rpGain({ type: 'lab1', level: 1 });
      S.caveId = 'cave3';
      dive.caveId = 'cave3';
      updateReactionEngine(1.0);
      const boostedRp = rpGain(lab);
      const rpRatio = +(boostedRp / baseRp).toFixed(2);

      // Test doDive backflow output generation (sta & waste)
      dive.outBuf.sta = 0;
      dive.outBuf.waste = 0;
      doDive(dive);
      const outStaAfterDive = dive.outBuf.sta || 0;
      const outWasteAfterDive = dive.outBuf.waste || 0;

      return {
        diveOutsHasSta: !!outsOf(dive).sta,
        diveOutsHasWaste: !!outsOf(dive).waste,
        cave2Quench,
        cave2Backflow,
        cave4HeatTag,
        cave4GeothermalSta,
        smeltSpdMul: +smeltSpdMul.toFixed(2),
        rpRatio,
        outStaAfterDive,
        outWasteAfterDive
      };
    })()`);
    console.log('Test A Result:', resA);
    const passA = resA.diveOutsHasSta && resA.diveOutsHasWaste && resA.cave2Quench && resA.cave2Backflow && resA.cave4HeatTag && resA.cave4GeothermalSta && resA.rpRatio === 2.5 && resA.outStaAfterDive >= 1 && resA.outWasteAfterDive >= 1;
    report.tests.push({ id: 'System A: Cave Backflow Pipeline', pass: passA, metrics: resA });

    // =========================================================================
    // TEST B: Era 2 Wireless Power & Era 3 Quantum Grid + Auto-Warp
    // =========================================================================
    console.log('\n--- [Test B] Era 2 High-Voltage Wireless & Era 3 Quantum Grid ---');
    const resB = await cdp.eval(`(() => {
      // Clear extra nodes and place a generator and an unwired mine nearby (within 280px) and far away (800px)
      S.nodes = S.nodes.filter(n => n.type === 'hero' || n.type === 'dive1');
      S.links = [];
      const gen = addNode('cgen2', 500, 500);
      const nearMine = addNode('mine1', 650, 500); // dist = 150px <= 280px
      const farForge = addNode('forge1', 1300, 500); // dist = 800px > 280px

      // Era 1: No wireless power
      S.era = 1;
      nearMine.inBuf.sta = 0;
      updateReactionEngine(1.0);
      const era1Wireless = !!nearMine._wirelessEra2;

      // Era 2: Near node receives wireless power, far node does not
      S.era = 2;
      nearMine.inBuf.sta = 0;
      farForge.inBuf.sta = 0;
      updateReactionEngine(1.0);
      const era2NearWireless = !!nearMine._wirelessEra2 && (nearMine.inBuf.sta || 0) > 0;
      const era2FarWireless = !!farForge._wirelessEra2;

      // Era 3: Full-board Quantum Wireless + Home Auto-Warp of raw materials + Infinite Human Range
      S.era = 3;
      homeOf().ing1 = 50;
      farForge.item = 'prt1'; // requires ing1
      farForge.inBuf.sta = 0;
      farForge.inBuf.ing1 = 0;
      updateReactionEngine(1.0);
      const era3QuantumActive = !!farForge._quantumEra3;
      const era3FarSta = farForge.inBuf.sta || 0;
      const era3WarpedIng1 = farForge.inBuf.ing1 || 0;
      const hero = S.nodes.find(n => n.type === 'hero');
      const era3InfiniteHumanRange = inHumanRange(hero, farForge);

      return {
        era1Wireless,
        era2NearWireless,
        era2FarWireless,
        era3QuantumActive,
        era3FarSta,
        era3WarpedIng1,
        era3InfiniteHumanRange
      };
    })()`);
    console.log('Test B Result:', resB);
    const passB = !resB.era1Wireless && resB.era2NearWireless && !resB.era2FarWireless && resB.era3QuantumActive && resB.era3FarSta > 0 && resB.era3WarpedIng1 > 0 && resB.era3InfiniteHumanRange;
    report.tests.push({ id: 'System B: Era 2/3 Wireless & Quantum Warp', pass: passB, metrics: resB });

    // =========================================================================
    // TEST C: 4 Geometric Formation Resonances (Formation Resonance)
    // =========================================================================
    console.log('\n--- [Test C] 4 Geometric Formation Resonances ---');
    const resC = await cdp.eval(`(() => {
      S.era = 2;
      S.nodes = S.nodes.filter(n => n.type === 'hero' || n.type === 'dive1');
      S.links = [];

      // 1. Triangle Plasma Resonance (lab surrounded by 3 power sources within 340px)
      const lab = addNode('lab1', 280, 220);
      const g1 = addNode('cgen1', 180, 130);
      const g2 = addNode('cgen1', 380, 130);
      const g3 = addNode('cgen1', 280, 340);

      // 2. Thermal Reactor Formation (smelt with heat source & cryo companion within 300px, no wires needed!)
      const smelt = addNode('smelt1', 720, 220);
      const burner = addNode('fuel1', 600, 220); // heat source
      const cryoComp = generateCompanion('spec', 'scholar');
      cryoComp.traits = ['cryo'];
      S.companionRoster.push(cryoComp);
      const cryoMate = addNode('mate3', 840, 220);
      cryoMate.compId = cryoComp.id;
      cryoComp.deployedNodeId = cryoMate.id;

      // 3. Expedition Frontline Camp Formation (dive with hero + turret + companion within 350px)
      const dive = S.nodes.find(n => TYPES[n.type] && TYPES[n.type].effect === 'dive');
      dive.x = 280; dive.y = 560;
      const hero = S.nodes.find(n => n.type === 'hero');
      hero.x = 2000; hero.y = 2000; // move far first to measure base HP
      updateReactionEngine(1.0);
      const baseHpBeforeCamp = calcPartyMaxHp();
      hero.x = 160; hero.y = 560;
      const turret = addNode('turret1', 400, 560);
      const campComp = generateCompanion('std', 'warrior');
      campComp.basePay = 20;
      campComp.traits = [];
      S.companionRoster.push(campComp);
      const campMate = addNode('mate1', 280, 680);
      campMate.compId = campComp.id;
      campComp.deployedNodeId = campMate.id;

      // 4. Industrial Straight-Line Formation (3 production nodes horizontally aligned within Y±60px)
      const m1 = addNode('mine1', 640, 560);
      const m2 = addNode('forge1', 800, 570);
      const m3 = addNode('equip1', 960, 555);

      updateReactionEngine(1.0);
      renderBoard();
      render();

      const hpAfterCamp = calcPartyMaxHp();
      const campWage = payOf(campMate);
      const lineOuts = modOuts(m1, { ore1: 1 });

      return {
        formTriangle: !!lab._formTriangle,
        labRxList: lab._rxList,
        formThermal: !!smelt._formThermal,
        thermalAutoQuench: !!smelt._rxQuench,
        formCamp: !!dive._formCamp,
        hpRatio: +(hpAfterCamp / baseHpBeforeCamp).toFixed(2),
        campWage,
        campWageDiscounted: campWage <= 10,
        formLine: !!(m1._formLine && m2._formLine && m3._formLine),
        lineBonusOut: lineOuts.ore1
      };
    })()`);
    console.log('Test C Result:', resC);
    await cdp.screenshot('paradigm_01_formations_and_wireless.png');
    const passC = resC.formTriangle && resC.formThermal && resC.thermalAutoQuench && resC.formCamp && resC.hpRatio === 2 && resC.campWageDiscounted && resC.formLine && resC.lineBonusOut === 2;
    report.tests.push({ id: 'System C: 4 Geometric Formation Resonances', pass: passC, metrics: resC });

    // =========================================================================
    // TEST D: Infinite Tower Puzzle Gimmick Bosses & Deep Soft-Caps
    // =========================================================================
    console.log('\n--- [Test D] Infinite Tower Puzzle Gimmick Bosses & Deep Soft-Caps ---');
    const resD = await cdp.eval(`(() => {
      const dive = S.nodes.find(n => TYPES[n.type] && TYPES[n.type].effect === 'dive');
      S.caveId = 'tower';
      dive.caveId = 'tower';
      const towerCave = caveById('tower');

      // Check 4 milestone floors: 5F (mirror), 10F (trash), 15F (thunder), 20F (greed)
      const g5 = towerGimmickOf(5, towerCave);
      const g10 = towerGimmickOf(10, towerCave);
      const g15 = towerGimmickOf(15, towerCave);
      const g20 = towerGimmickOf(20, towerCave);

      // Test Floor 10 Trash Counter (dive -> dump1 connected)
      const dump = addNode('dump1', dive.x + 160, dive.y + 110);
      addLink(dive.id, 'waste', dump.id);
      updateReactionEngine(1.0);
      const backflowTrashReady = !!(S.battleRx && S.battleRx.trashCounter);

      S.caveFloor = 10;
      S.floor = effFloorOf(10, towerCave);
      spawnEnemy();
      const f10BossHasGimmick = !!(S.enemy && S.enemy.gimmick && S.enemy.gimmick.k === 'trash');
      const hpBefore = S.enemy.hp;
      doDive(dive);
      const dmgDealt = hpBefore - S.enemy.hp;

      // Test deep floor soft-cap (e.g., Floor 100, 1000 & 10000) to verify NO Infinity or NaN!
      S.caveFloor = 100;
      const hpFloor100 = enemyHp(100);
      S.caveFloor = 1000;
      const hpFloor1000 = enemyHp(1000);
      S.caveFloor = 10000;
      const hpFloor10000 = enemyHp(10000);
      const goldFloor10000 = enemyGold(10000);
      S.best = 10000;
      const depthBonus10000 = depthBonus();
      S.best = 420;
      S.caveFloor = 10;
      spawnEnemy();
      renderBoard();
      render();

      return {
        g5: g5 && g5.k,
        g10: g10 && g10.k,
        g15: g15 && g15.k,
        g20: g20 && g20.k,
        backflowTrashReady,
        f10BossHasGimmick,
        dmgDealt,
        finite10000: Number.isFinite(hpFloor10000) && Number.isFinite(goldFloor10000) && Number.isFinite(depthBonus10000),
        hpFloor100,
        hpFloor1000,
        hpFloor10000
      };
    })()`);
    console.log('Test D Result:', resD);
    await cdp.screenshot('paradigm_02_tower_gimmick_boss.png');
    const passD = resD.g5 === 'mirror' && resD.g10 === 'trash' && resD.g15 === 'thunder' && resD.g20 === 'greed' && resD.backflowTrashReady && resD.f10BossHasGimmick && resD.dmgDealt > 0 && resD.finite10000;
    report.tests.push({ id: 'System D: Tower Puzzle Gimmick Bosses & Soft-Cap', pass: passD, metrics: resD });

    report.jsErrors = jsErrors.length;
    fs.writeFileSync(path.join(RESULTS_DIR, 'paradigm_4systems_report.json'), JSON.stringify(report, null, 2));

    console.log('\n================================================================');
    console.log('✅ VERIFICATION SUMMARY:');
    for (const t of report.tests) {
      console.log(`  [${t.pass ? 'PASS' : 'FAIL'}] ${t.id}`);
    }
    console.log(`  JS Errors: ${jsErrors.length}`);
    console.log('================================================================');

    cdp.close();
    browserCdp.close();
  } finally {
    chrome.kill();
  }
}

runVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
