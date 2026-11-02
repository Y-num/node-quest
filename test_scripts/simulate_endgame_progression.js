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

async function runEndgameSimulation() {
  console.log('================================================================');
  console.log('🎮 NODE QUEST END-GAME PROGRESSION & BALANCE TESTPLAY');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,900'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      try {
        const json = await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:9222/json/version', res => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => resolve(buf));
          }).on('error', reject);
        });
        wsUrl = JSON.parse(json).webSocketDebuggerUrl;
        break;
      } catch (e) {}
    }

    if (!wsUrl) throw new Error('Failed to connect to Headless Chrome');
    const cdp = new SimpleCDP(wsUrl);
    await cdp.connect();

    const fileUrl = 'file:///Users/antigravity/Desktop/pdf変換/node-quest/index.html?debug=1';
    const target = await cdp.send('Target.createTarget', { url: fileUrl });
    const pageCdp = new SimpleCDP(`ws://127.0.0.1:9222/devtools/page/${target.targetId}`);
    await pageCdp.connect();

    await pageCdp.send('Page.enable');
    await pageCdp.send('Runtime.enable');
    await pageCdp.send('DOM.enable');

    await new Promise(r => setTimeout(r, 1200));

    // Reset game via clean newGame()
    await pageCdp.eval(`
      localStorage.clear();
      resetting = false;
      newGame();
      applyView(); renderBoard();
    `);

    console.log('✅ Clean game state initialized via newGame().');

    // Run progressive automated playtest across all 5 phases
    const simulationReport = await pageCdp.eval(`(async () => {
      const logs = [];
      const phaseMetrics = {};
      const log = (phase, msg, data = {}) => {
        const entry = { phase, timeSec: Math.round(S.playT || 0), msg, data };
        logs.push(entry);
      };

      // Fast forward helper
      const advanceTime = (seconds, step = 1.0) => {
        const steps = Math.ceil(seconds / step);
        for(let i=0; i<steps; i++) {
          tick(step, true);
        }
      };

      const hero = S.nodes.find(n => n.type === 'hero');
      const dive1 = S.nodes.find(n => n.type === 'dive1' || (TYPES[n.type] && TYPES[n.type].effect === 'dive'));

      // =======================================================================
      // PHASE 1: Early Game (0 ~ 45m) - Cave 1 (Mossy Cave) & Era 1 Setup
      // =======================================================================
      log('Phase 1', 'Starting Phase 1: Early Game Base Setup (Mine, Smelt, Shop, Lab)');
      
      const mine1 = addNode('mine1', 260, 150);
      addLink(hero.id, 'sta', mine1.id);
      
      const shop1 = addNode('shop1', 460, 280);
      const dump1 = addNode('dump1', 260, 280);
      const lab1  = addNode('lab1',  260, 420);
      
      addLink(hero.id, 'sta', shop1.id);
      addLink(hero.id, 'sta', dump1.id);
      addLink(hero.id, 'sta', lab1.id);
      
      addLink(mine1.id, 'ore1', shop1.id);
      addLink(mine1.id, 'ore1', lab1.id);
      addLink(mine1.id, 'waste', dump1.id);
      
      const cgen1 = addNode('cgen1', 80, 280);
      addLink(cgen1.id, 'sta', mine1.id);
      addLink(cgen1.id, 'sta', dive1.id);

      // Advance 15 mins of simulated play
      advanceTime(900);
      log('Phase 1', '15 mins passed. Mining & Lab producing RP/Gold', {
        gold: Math.round(S.gold), rp: Math.round(gotRp()), stock: Math.round(gotMat()), atk: Math.round(atk())
      });

      // Unlock smelt1, forge1, equip1
      S.dev.smelt1 = 1; S.dev.forge1 = 1; S.dev.equip1 = 1; devDirty();
      const smelt1 = addNode('smelt1', 460, 150);
      const forge1 = addNode('forge1', 660, 150);
      const equip1 = addNode('equip1', 860, 150);
      
      addLink(hero.id, 'sta', smelt1.id);
      addLink(hero.id, 'sta', forge1.id);
      addLink(hero.id, 'sta', equip1.id);
      
      addLink(mine1.id, 'ore1', smelt1.id);
      addLink(smelt1.id, 'ing1', forge1.id);
      addLink(smelt1.id, 'ing1', equip1.id);
      addLink(forge1.id, 'prt1', equip1.id);
      addLink(smelt1.id, 'waste', dump1.id);
      addLink(forge1.id, 'waste', dump1.id);

      // Advance time until Cave 1 cleared
      let c1Tries = 0;
      while(caveClearsOf('cave1') === 0 && c1Tries++ < 40) {
        advanceTime(120);
      }
      
      phaseMetrics['Phase 1'] = {
        cave: 'cave1',
        timeSec: Math.round(S.playT),
        clears: caveClearsOf('cave1'),
        atk: Math.round(atk()),
        gold: Math.round(S.gold),
        rp: Math.round(gotRp()),
        stock: Math.round(gotMat()),
        mcore: (homeOf() && homeOf().mcore) || 0
      };

      log('Phase 1', 'Cave 1 (Mossy Cave) Cleared!', phaseMetrics['Phase 1']);

      // =======================================================================
      // PHASE 2: Mid-Early Game - Companions & Cave 2 (Underground Canal)
      // =======================================================================
      log('Phase 2', 'Starting Phase 2: Companion Recruitment & Cave 2');
      
      // Give gold & materials for scout
      S.gold += 1200;
      homeOf().mcore = (homeOf().mcore || 0) + 4;
      
      const comp1 = scoutCompanion('warrior'); // Specialized warrior
      const comp2 = scoutCompanion('standard'); // Standard companion
      
      // Relocate deployed companions to structured coordinates
      if(comp1 && comp1.deployedNodeId && N(comp1.deployedNodeId)){
        const nd1 = N(comp1.deployedNodeId);
        nd1.x = 80; nd1.y = 420; rebuildNodeEl(nd1);
        addLink(nd1.id, 'sta', dive1.id);
      }
      if(comp2 && comp2.deployedNodeId && N(comp2.deployedNodeId)){
        const nd2 = N(comp2.deployedNodeId);
        nd2.x = 80; nd2.y = 560; rebuildNodeEl(nd2);
        addLink(nd2.id, 'sta', lab1.id);
      }

      // Raise affection to achieve wage reduction (-50% ~ -80%)
      if(comp1) setCompanionAffection(comp1, 500);
      if(comp2) setCompanionAffection(comp2, 500);

      // Unlock Turret (support cannon)
      S.dev.turret1 = 1; devDirty();
      const turret1 = addNode('turret1', 660, 280);
      addLink(hero.id, 'sta', turret1.id);
      addLink(turret1.id, 'sta', dive1.id);

      // Unlock and switch to Cave 2
      S.caveUnlocked['cave2'] = 1;
      selectCave('cave2');
      
      let c2Tries = 0;
      while(caveClearsOf('cave2') === 0 && c2Tries++ < 40) {
        advanceTime(120);
      }

      phaseMetrics['Phase 2'] = {
        cave: 'cave2',
        timeSec: Math.round(S.playT),
        clears: caveClearsOf('cave2'),
        atk: Math.round(atk()),
        gold: Math.round(S.gold),
        rp: Math.round(gotRp()),
        stock: Math.round(gotMat()),
        afang: (homeOf() && homeOf().afang) || 0
      };

      log('Phase 2', 'Cave 2 (Underground Canal) Cleared!', phaseMetrics['Phase 2']);

      // =======================================================================
      // PHASE 3: Mid Game - Era 2 Evolution & Caves 3 & 4
      // =======================================================================
      log('Phase 3', 'Starting Phase 3: Era 2 (High Voltage Evolution) & Caves 3, 4');
      
      // Simulate accumulation of Era 2 requirement (18,000 RP + 800 Mat)
      advanceTime(3600);
      S.rp = Math.max(S.rp || 0, 22000);
      S.stock = Math.max(S.stock || 0, 1200);
      S.gold += 15000;
      S.era = 2; // Evolve to Era 2
      
      // Upgrade gear & stats
      S.stats.str = 35; S.stats.int = 30; S.stats.vit = 35;
      hero.gear = [{item:'eqp2'}, {item:'eqp2'}, {item:'qstl'}];
      gearDirty();

      // Unlock and clear Cave 3
      S.caveUnlocked['cave3'] = 1;
      selectCave('cave3');
      let c3Tries = 0;
      while(caveClearsOf('cave3') === 0 && c3Tries++ < 40) {
        advanceTime(120);
      }

      log('Phase 3', 'Cave 3 (Ancient Ruins) Cleared!', {
        clears: caveClearsOf('cave3'), atk: Math.round(atk()), arelic: (homeOf() && homeOf().arelic) || 0
      });

      // Unlock and clear Cave 4 (Lava Cave) with CRYO tactical support
      S.caveUnlocked['cave4'] = 1;
      selectCave('cave4');
      
      // Deploy CRYO reaction support into dive1
      const coldGen = addNode('cgen1', 660, 420);
      addLink(coldGen.id, 'sta', dive1.id);
      
      let c4Tries = 0;
      while(caveClearsOf('cave4') === 0 && c4Tries++ < 45) {
        advanceTime(120);
      }

      phaseMetrics['Phase 3'] = {
        cave: 'cave4',
        timeSec: Math.round(S.playT),
        clears: caveClearsOf('cave4'),
        atk: Math.round(atk()),
        gold: Math.round(S.gold),
        rp: Math.round(gotRp()),
        stock: Math.round(gotMat()),
        fheart: (homeOf() && homeOf().fheart) || 0
      };

      log('Phase 3', 'Cave 4 (Lava Cave) Cleared!', phaseMetrics['Phase 3']);

      // =======================================================================
      // PHASE 4: Late Game - Era 3 (Supercritical) & Caves 5 & 6
      // =======================================================================
      log('Phase 4', 'Starting Phase 4: Era 3 (Supercritical Evolution) & Caves 5, 6');
      
      // Simulate accumulation of Era 3 requirement (650,000 RP + 25,000 Mat)
      advanceTime(7200);
      S.rp = Math.max(S.rp || 0, 750000);
      S.stock = Math.max(S.stock || 0, 35000);
      S.gold += 120000;
      S.era = 3; // Evolve to Era 3
      
      // Upgrade gear & stats
      S.stats.str = 65; S.stats.int = 60; S.stats.vit = 65;
      hero.gear = [{item:'eqp3'}, {item:'eqp4'}, {item:'bdia'}];
      gearDirty();

      // Unlock and clear Cave 5 (Crystal Cave)
      S.caveUnlocked['cave5'] = 1;
      selectCave('cave5');
      let c5Tries = 0;
      while(caveClearsOf('cave5') === 0 && c5Tries++ < 40) {
        advanceTime(120);
      }

      log('Phase 4', 'Cave 5 (Crystal Cave) Cleared!', {
        clears: caveClearsOf('cave5'), atk: Math.round(atk()), fcryst: (homeOf() && homeOf().fcryst) || 0
      });

      // Unlock and clear Cave 6 (Starlit Abyss)
      S.caveUnlocked['cave6'] = 1;
      selectCave('cave6');
      let c6Tries = 0;
      while(caveClearsOf('cave6') === 0 && c6Tries++ < 50) {
        advanceTime(120);
      }

      phaseMetrics['Phase 4'] = {
        cave: 'cave6',
        timeSec: Math.round(S.playT),
        clears: caveClearsOf('cave6'),
        atk: Math.round(atk()),
        gold: Math.round(S.gold),
        rp: Math.round(gotRp()),
        stock: Math.round(gotMat()),
        acore: (homeOf() && homeOf().acore) || 0
      };

      log('Phase 4', 'Cave 6 (Starlit Abyss) Cleared! Unlocking Infinite Tower!', phaseMetrics['Phase 4']);

      // =======================================================================
      // PHASE 5: End Game - Infinite Tower (Tower of Infinity)
      // =======================================================================
      log('Phase 5', 'Starting Phase 5: Infinite Tower (Floor 165+ End-Game Push)');
      
      // Final end-game build
      hero.gear = [{item:'eqp5'}, {item:'eqp5'}, {item:'acore'}];
      S.stats.str = 90; S.stats.int = 85; S.stats.vit = 90;
      gearDirty();

      // Unlock Infinite Tower
      S.caveUnlocked['tower'] = 1;
      selectCave('tower');
      const startTowerFloor = S.caveFloor || 1;
      
      // Push through multiple floors in the Infinite Tower
      const towerSamples = [];
      for(let f = 0; f < 25; f++) {
        advanceTime(120);
        towerSamples.push({
          caveFloor: S.caveFloor,
          globalFloor: S.floor,
          enemyHp: S.enemy ? S.enemy.max : 0,
          enemyArm: S.enemy ? S.enemy.arm : 0,
          dmgDealt: dmg(),
          hitsToKill: hitsLeft(),
          recAtk: curCave().recAtk
        });
      }

      const towerProgress = {
        startFloor: startTowerFloor,
        endFloor: S.caveFloor,
        best: S.best,
        effFloor: S.floor,
        atk: Math.round(atk()),
        enemyHp: S.enemy ? S.enemy.max : 0,
        enemyArm: S.enemy ? S.enemy.arm : 0,
        dmgDealt: dmg(),
        hitsToKill: hitsLeft(),
        gold: Math.round(S.gold),
        totalTimeSec: Math.round(S.playT),
        samples: towerSamples
      };

      phaseMetrics['Phase 5'] = towerProgress;
      log('Phase 5', 'Infinite Tower Deep Run Completed!', towerProgress);

      render();
      renderInsp();
      return { logs, phaseMetrics };
    })()`);

    console.log('\n📊 TESTPLAY EXECUTION LOGS:');
    for(const l of simulationReport.logs) {
      const h = Math.floor(l.timeSec / 3600);
      const m = Math.floor((l.timeSec % 3600) / 60);
      const s = l.timeSec % 60;
      const timeStr = `${h}h ${m}m ${s}s`;
      console.log(`[${l.phase}] (${timeStr}) ${l.msg}`);
      if(Object.keys(l.data).length > 0) {
        console.log('   ↳ Metrics:', l.data);
      }
    }

    console.log('\n🗼 ALL PHASES PROGRESSION METRICS:');
    console.log(JSON.stringify(simulationReport.phaseMetrics, null, 2));

    // Capture endgame state screenshots
    await pageCdp.eval(`
      sel = S.nodes.find(n => (TYPES[n.type] && TYPES[n.type].effect === 'dive') || n.type === 'dive1').id;
      renderInsp();
      render();
    `);
    await new Promise(r => setTimeout(r, 500));
    await pageCdp.screenshot('endgame_01_tower_combat.png');

    // Switch to bestiary / menu modal
    await pageCdp.eval(`
      openMenuModal();
    `);
    await new Promise(r => setTimeout(r, 500));
    await pageCdp.screenshot('endgame_02_menu_overview.png');

    // Save testplay report to JSON
    fs.writeFileSync(
      path.join(RESULTS_DIR, 'endgame_testplay_report.json'),
      JSON.stringify(simulationReport, null, 2)
    );
    console.log(`\n✅ Report saved to: ${path.join(RESULTS_DIR, 'endgame_testplay_report.json')}`);

    pageCdp.close();
    cdp.close();
  } catch (err) {
    console.error('💥 Simulation Fatal Error:', err);
  } finally {
    chrome.kill();
    console.log('Chrome terminated.');
  }
}

runEndgameSimulation();
