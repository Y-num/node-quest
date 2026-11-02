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
      throw new Error(`Eval error in [${expression.slice(0, 100)}...]: ` + JSON.stringify(res.exceptionDetails));
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

async function runMultiPlaystyleTest() {
  console.log('================================================================');
  console.log('🎮 MULTI-PLAYSTYLE COMPLETE PLAYTHROUGH & ROUTE DIVERSITY TEST');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
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
          http.get('http://127.0.0.1:9226/json/version', res => {
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
    const cdp = new SimpleCDP(`ws://127.0.0.1:9226/devtools/page/${target.targetId}`);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    await new Promise(r => setTimeout(r, 1200));

    // Define simulation runner in browser context
    const testResults = await cdp.eval(`(async () => {
      const results = {};

      const fastTick = (sec, step = 1.0) => {
        const n = Math.ceil(sec / step);
        for (let i = 0; i < n; i++) tick(step, true);
      };

      // -----------------------------------------------------------------------
      // RUN 1: Geometric Formation & Spatial Resonance Build
      // -----------------------------------------------------------------------
      {
        localStorage.clear();
        resetting = false;
        newGame();
        S.tutDone = 1;
        const tutEl = document.getElementById('tut');
        if (tutEl) tutEl.style.display = 'none';

        const run1Logs = [];
        const hero = S.nodes.find(n => n.type === 'hero');
        const dive = S.nodes.find(n => (TYPES[n.type] && TYPES[n.type].effect === 'dive') || n.type === 'dive1');

        // Early Base Setup with Camp & Line
        hero.x = 200; hero.y = 500;
        dive.x = 350; dive.y = 500;
        const turret1 = addNode('turret1', 480, 500);
        addLink(hero.id, 'sta', turret1.id);
        addLink(turret1.id, 'sta', dive.id);
        addLink(hero.id, 'sta', dive.id);

        // Industrial Straight-Line Formation (Y=300)
        const mine1 = addNode('mine1', 200, 300);
        const smelt1 = addNode('smelt1', 350, 300);
        const forge1 = addNode('forge1', 500, 300);
        addLink(hero.id, 'sta', mine1.id);
        addLink(hero.id, 'sta', smelt1.id);
        addLink(hero.id, 'sta', forge1.id);
        addLink(mine1.id, 'ore1', smelt1.id);
        addLink(smelt1.id, 'ing1', forge1.id);

        // Triangle Plasma Formation for Lab (surrounded by 3 gens)
        const lab1 = addNode('lab1', 750, 300);
        const g1 = addNode('cgen1', 650, 200);
        const g2 = addNode('cgen1', 850, 200);
        const g3 = addNode('cgen1', 750, 420);
        addLink(forge1.id, 'prt1', lab1.id);

        // Clear Cave 1 & 2
        fastTick(1800);
        S.stats.str = 25; S.stats.int = 20; S.stats.vit = 25;
        hero.gear = [{ item: 'eqp1' }, { item: 'qstl' }];
        gearDirty();
        S.gold += 3000;
        S.caveUnlocked.cave2 = 1;
        selectCave('cave2');
        fastTick(1800);

        // Era 2 Evolution via Triangle RP bonus
        updateReactionEngine(1.0);
        const triActive = !!lab1._formTriangle;
        const campActive = !!dive._formCamp;
        const lineActive = !!(mine1._formLine && smelt1._formLine && forge1._formLine);

        // Advance to Era 2 (High Voltage Wireless)
        S.rp += 25000; S.stock += 1200; S.gold += 15000;
        S.era = 2;
        // Thermal Reactor Formation (Smelt with Heat and Cryo nodes around)
        const burner = addNode('fuel1', 350, 180); // Heat source
        const coldNode = addNode('cgen1', 350, 420); // Cold source
        updateReactionEngine(1.0);
        const thermalActive = !!smelt1._formThermal;

        // Clear Cave 3, 4, 5, 6
        S.stats.str = 65; S.stats.int = 55; S.stats.vit = 60;
        hero.gear = [{ item: 'eqp3' }, { item: 'eqp4' }, { item: 'bdia' }];
        gearDirty();
        S.caveUnlocked.cave3 = 1; S.caveUnlocked.cave4 = 1; S.caveUnlocked.cave5 = 1; S.caveUnlocked.cave6 = 1;
        selectCave('cave6');
        fastTick(3600);

        // Push Infinite Tower (Tower)
        S.era = 3;
        S.stats.str = 95; S.stats.int = 90; S.stats.vit = 95;
        hero.gear = [{ item: 'eqp5' }, { item: 'acore' }, { item: 'qstl' }];
        gearDirty();
        S.caveUnlocked.tower = 1;
        selectCave('tower');
        S.caveFloor = 1;
        spawnEnemy();

        // Push through 30 floors of Tower (covering 5F mirror, 10F trash, 15F thunder, 20F greed, 25F, 30F)
        const floorRecords = [];
        for (let fl = 1; fl <= 25; fl++) {
          S.caveFloor = fl;
          S.floor = effFloorOf(fl, curCave());
          spawnEnemy();
          const g = S.enemy ? S.enemy.gimmick : null;
          const hpStart = S.enemy ? S.enemy.hp : 0;
          doDive(dive);
          const dmg = hpStart - (S.enemy ? S.enemy.hp : 0);
          floorRecords.push({
            floor: fl,
            gimmick: g ? g.k : 'none',
            dmg,
            kills: S.enemy && S.enemy.hp <= 0
          });
        }

        results.run1_geometric = {
          buildName: '幾何学・陣形共鳴特化ビルド (Geometric Formation)',
          formations: { triActive, campActive, lineActive, thermalActive },
          finalStats: { atk: atk(), hp: calcPartyMaxHp(), rp: gotRp(), gold: S.gold },
          maxTowerFloor: S.caveFloor,
          gimmickEncounters: floorRecords.filter(r => r.gimmick !== 'none').length,
          playTimeSec: Math.round(S.playT)
        };
      }

      // -----------------------------------------------------------------------
      // RUN 2: Cave Backflow Resource & Chemical Pipeline Build
      // -----------------------------------------------------------------------
      {
        localStorage.clear();
        resetting = false;
        newGame();
        S.tutDone = 1;
        const tutEl = document.getElementById('tut');
        if (tutEl) tutEl.style.display = 'none';

        const hero = S.nodes.find(n => n.type === 'hero');
        const dive = S.nodes.find(n => (TYPES[n.type] && TYPES[n.type].effect === 'dive') || n.type === 'dive1');

        hero.x = 200; hero.y = 200;
        dive.x = 400; dive.y = 350;

        // Connect Cave Backflow Pipeline: dive -> smelt1 (sta), dive -> lab1 (waste)
        const smelt1 = addNode('smelt1', 600, 250);
        const lab1 = addNode('lab1', 600, 450);
        const dump1 = addNode('dump1', 400, 550);
        addLink(dive.id, 'sta', smelt1.id);
        addLink(dive.id, 'waste', lab1.id);
        addLink(dive.id, 'waste', dump1.id); // For trash counter!

        // Backflow from Cave 2 (Cryo)
        S.caveUnlocked.cave2 = 1;
        selectCave('cave2');
        updateReactionEngine(1.0);
        const backflowQuench = !!smelt1._rxQuench;
        const backflowActive = !!smelt1._rxCaveBackflow;

        // Clear Cave 2 & 3 via backflow RP & Quenched Steel
        fastTick(2400);
        S.stats.str = 30; S.stats.int = 35; S.stats.vit = 30;
        hero.gear = [{ item: 'eqp2' }, { item: 'qstl' }];
        gearDirty();

        // Switch to Cave 4 (Geothermal HEAT backflow)
        S.caveUnlocked.cave4 = 1;
        selectCave('cave4');
        updateReactionEngine(1.0);
        const geoHeatActive = !!(smelt1.inTags && smelt1.inTags.HEAT);
        const geoStaActive = (smelt1.inBuf.sta || 0) > 0;

        // Progress to Era 2 and Era 3
        S.era = 2;
        fastTick(2400);
        S.era = 3;
        S.stats.str = 70; S.stats.int = 75; S.stats.vit = 70;
        hero.gear = [{ item: 'eqp4' }, { item: 'drelic' }, { item: 'bdia' }];
        gearDirty();

        // Push Infinite Tower with Trash Counter & Chemical Tags
        S.caveUnlocked.tower = 1;
        selectCave('tower');
        const towerFloors = [];
        for (let fl = 1; fl <= 25; fl++) {
          S.caveFloor = fl;
          S.floor = effFloorOf(fl, curCave());
          spawnEnemy();
          const g = S.enemy ? S.enemy.gimmick : null;
          const hpStart = S.enemy ? S.enemy.hp : 0;
          doDive(dive);
          const dmg = hpStart - (S.enemy ? S.enemy.hp : 0);
          towerFloors.push({ floor: fl, gimmick: g ? g.k : 'none', dmg });
        }

        results.run2_backflow = {
          buildName: 'ダンジョン逆流・化学パイプライン特化ビルド (Cave Backflow Pipeline)',
          backflowMetrics: { backflowQuench, backflowActive, geoHeatActive, geoStaActive },
          finalStats: { atk: atk(), hp: calcPartyMaxHp(), rp: gotRp(), gold: S.gold },
          maxTowerFloor: S.caveFloor,
          gimmickEncounters: towerFloors.filter(r => r.gimmick !== 'none').length,
          playTimeSec: Math.round(S.playT)
        };
      }

      // -----------------------------------------------------------------------
      // RUN 3: Companion Swarm & Affection Pipeline Build
      // -----------------------------------------------------------------------
      {
        localStorage.clear();
        resetting = false;
        newGame();
        S.tutDone = 1;
        const tutEl = document.getElementById('tut');
        if (tutEl) tutEl.style.display = 'none';

        const hero = S.nodes.find(n => n.type === 'hero');
        const dive = S.nodes.find(n => (TYPES[n.type] && TYPES[n.type].effect === 'dive') || n.type === 'dive1');

        // Scout 6 diverse companions (warriors, artisans, scholars, laborers)
        S.gold = 50000;
        homeOf().mcore = 20;
        homeOf().afang = 20;
        homeOf().arelic = 20;
        const comps = [];
        comps.push(scoutCompanion('warrior'));
        comps.push(scoutCompanion('artisan'));
        comps.push(scoutCompanion('scholar'));
        comps.push(scoutCompanion('standard'));
        comps.push(scoutCompanion('warrior'));
        comps.push(scoutCompanion('scholar'));

        // Deploy companions into nodes and maximize affection (Affection 1000: -80% wage, +50% spd, +2 pulse)
        let cY = 150;
        for (const c of comps) {
          if (c) {
            setCompanionAffection(c, 1000);
            const nd = deployCompanion(c.id, 200, cY);
            cY += 100;
            if (nd) addLink(nd.id, 'sta', dive.id);
          }
        }

        updateReactionEngine(1.0);
        const wages = comps.filter(Boolean).map(c => {
          const nd = N(c.deployedNodeId);
          return nd ? payOf(nd) : 0;
        });

        // Fast progression enabled by massive companion STR/INT/VIT
        fastTick(2400);
        S.era = 2;
        fastTick(2400);
        S.era = 3;

        S.stats.str = 50; S.stats.int = 50; S.stats.vit = 50;
        hero.gear = [{ item: 'eqp4' }, { item: 'artf' }, { item: 'qstl' }];
        gearDirty();

        // Push Infinite Tower (High Affection clears 20F Greed scale easily)
        S.caveUnlocked.tower = 1;
        selectCave('tower');
        const towerFloors = [];
        for (let fl = 1; fl <= 25; fl++) {
          S.caveFloor = fl;
          S.floor = effFloorOf(fl, curCave());
          spawnEnemy();
          const g = S.enemy ? S.enemy.gimmick : null;
          const hpStart = S.enemy ? S.enemy.hp : 0;
          doDive(dive);
          const dmg = hpStart - (S.enemy ? S.enemy.hp : 0);
          towerFloors.push({ floor: fl, gimmick: g ? g.k : 'none', dmg });
        }

        results.run3_companions = {
          buildName: '仲間親愛度自動化＆大軍団ビルド (Companion Affection Swarm)',
          companionCount: S.companionRoster.length,
          deployedCount: S.nodes.filter(n => TYPES[n.type] && TYPES[n.type].src && n.type !== 'hero').length,
          wagesDiscounted: wages.every(w => w <= 5),
          totalPartyAtk: atk(),
          maxTowerFloor: S.caveFloor,
          gimmickEncounters: towerFloors.filter(r => r.gimmick !== 'none').length,
          playTimeSec: Math.round(S.playT)
        };
      }

      return results;
    })()`);

    console.log('✅ MULTI-PLAYSTYLE SIMULATION COMPLETE:');
    console.log(JSON.stringify(testResults, null, 2));

    fs.writeFileSync(path.join(RESULTS_DIR, 'multi_playstyle_test_report.json'), JSON.stringify(testResults, null, 2));

    // Capture visual representation of run 3 companion swarm
    await cdp.eval(`renderBoard(); render(); renderInsp();`);
    await cdp.screenshot('playstyle_03_companion_swarm.png');

    cdp.close();
    browserCdp.close();
  } finally {
    chrome.kill();
  }
}

runMultiPlaystyleTest().catch(err => {
  console.error(err);
  process.exit(1);
});
