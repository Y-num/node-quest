const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = '/Users/antigravity/Desktop/pdf変換/node-quest';
const RESULTS_DIR = path.join(WORKSPACE_DIR, 'test_results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
      throw new Error(`Eval error in [${expression.slice(0, 140)}...]: ` + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(RESULTS_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`  📸 [Screenshot Saved] -> ${path.basename(fullPath)}`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

const ARCHETYPES = [
  { id: 1,  name: 'Clean Energy & Human Power (自然エネルギー・人力特化)' },
  { id: 2,  name: 'Thermal Industrial Rush (火力発電・工業ラッシュ)' },
  { id: 3,  name: 'Combat & Equipment Forge (武闘派・装備鍛造速攻)' },
  { id: 4,  name: 'Scholar & Laboratory Tech (学者・研究ツリー最速突破)' },
  { id: 5,  name: 'Merchant & Commerce Tycoon (商業・露店売却富豪)' },
  { id: 6,  name: 'Reaction Alchemy Crafter (創発リアクション・錬金術師)' },
  { id: 7,  name: 'Balanced Factory Standard (標準バランス型)' },
  { id: 8,  name: 'Companion Swarm & Affection (仲間親愛度・スウォーム型)' },
  { id: 9,  name: 'High-Density Compression (高密度圧縮・省スペース型)' },
  { id: 10, name: 'Deep Abyss Delver (高難度深淵侵攻・魔神眼覚醒型)' }
];

async function run200AuditSimulation() {
  console.log('================================================================');
  console.log('🚀 NODE QUEST: 200-RUN AUTOMATED PROGRESSION & VARIANCE AUDIT');
  console.log('   Testing 10 Archetypes x 20 Runs = 200 Independent Runs');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9244;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1600,900'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 25; i++) {
      await sleep(250);
      try {
        const json = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${port}/json/version`, res => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => resolve(buf));
          }).on('error', reject);
        });
        wsUrl = JSON.parse(json).webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch (e) {}
    }
    if (!wsUrl) throw new Error(`Failed to connect to headless Chrome on port ${port}`);

    const browserCdp = new SimpleCDP(wsUrl);
    await browserCdp.connect();

    const fileUrl = 'file:///Users/antigravity/Desktop/pdf変換/node-quest/index.html?debug=1';
    const target = await browserCdp.send('Target.createTarget', { url: fileUrl });
    const cdp = new SimpleCDP(`ws://127.0.0.1:${port}/devtools/page/${target.targetId}`);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await sleep(2000);

    const allRunResults = [];
    let globalRunIndex = 0;

    for (const arch of ARCHETYPES) {
      console.log(`\n────────────────────────────────────────────────────────────────`);
      console.log(`▶ Archetype ${arch.id}/10: ${arch.name}`);
      console.log(`────────────────────────────────────────────────────────────────`);

      for (let runInArch = 1; runInArch <= 20; runInArch++) {
        globalRunIndex++;
        const runNum = globalRunIndex;
        const seed = runInArch * 17 + arch.id * 101;

        const runData = await cdp.eval(`(async () => {
          localStorage.clear();
          newGame();
          S.tutDone = 1;
          tutFinish('Audit Run ${runNum}');

          const hero = S.nodes.find(n => n.type === 'hero');
          const dive = S.nodes.find(n => (TYPES[n.type] && TYPES[n.type].effect === 'dive') || n.type === 'dive');
          hero.x = 200; hero.y = 400;
          dive.x = 420; dive.y = 400;
          addLink(hero.id, 'sta', dive.id);

          hero.gear = [{item:'eqp1'}, {item:null}, {item:null}];
          gearDirty();

          const archId = ${arch.id};
          const seed = ${seed};

          // Setup starting condition based on archetype
          if (archId === 1) { // Clean Energy & Human Power
            S.gold = 3500;
            const cg1 = addNode('cgen1', 200, 260);
            const cg2 = addNode('cgen1', 200, 540);
            addLink(hero.id, 'sta', cg1.id);
            addLink(hero.id, 'sta', cg2.id);
            const mn = addNode('mine1', 350, 400);
            const sm = addNode('smelt1', 500, 400);
            const dp = addNode('dump1', 500, 260);
            dp.item = 'waste';
            addLink(cg1.id, 'sta', mn.id);
            addLink(cg2.id, 'sta', sm.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);

          } else if (archId === 2) { // Thermal Industrial Rush
            S.gold = 4000;
            const wd = addNode('wood1', 200, 540);
            addLink(hero.id, 'sta', wd.id);
            const gn = addNode('gen1', 350, 540);
            addLink(wd.id, 'wood', gn.id);
            const mn = addNode('mine1', 500, 400);
            const sm = addNode('smelt1', 650, 400);
            const dp = addNode('dump1', 500, 540);
            dp.item = 'waste';
            addLink(gn.id, 'sta', mn.id);
            addLink(gn.id, 'sta', sm.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(gn.id, 'waste', dp.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);

          } else if (archId === 3) { // Combat & Equipment Forge
            S.gold = 5000;
            const mn = addNode('mine1', 350, 280);
            const sm = addNode('smelt1', 500, 280);
            const fg = addNode('forge1', 650, 280);
            const eq = addNode('equip1', 800, 280);
            const dp = addNode('dump1', 500, 150);
            dp.item = 'waste';
            const cg = addNode('cgen1', 200, 280);
            addLink(hero.id, 'sta', cg.id);
            addLink(cg.id, 'sta', mn.id);
            addLink(cg.id, 'sta', sm.id);
            addLink(cg.id, 'sta', fg.id);
            addLink(cg.id, 'sta', eq.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(sm.id, 'ing1', fg.id);
            addLink(fg.id, 'prt1', eq.id);
            addLink(sm.id, 'ing1', eq.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);
            addLink(fg.id, 'waste', dp.id);
            addLink(eq.id, 'waste', dp.id);

          } else if (archId === 4) { // Scholar & Lab Tech
            S.gold = 4500;
            const mn = addNode('mine1', 350, 300);
            const sm = addNode('smelt1', 500, 300);
            const lb = addNode('lab1', 650, 300);
            lb.item = 'ing1';
            const dp = addNode('dump1', 500, 160);
            dp.item = 'waste';
            const cg = addNode('cgen1', 200, 300);
            addLink(hero.id, 'sta', cg.id);
            addLink(cg.id, 'sta', mn.id);
            addLink(cg.id, 'sta', sm.id);
            addLink(cg.id, 'sta', lb.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(sm.id, 'ing1', lb.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);

          } else if (archId === 5) { // Merchant & Commerce
            S.gold = 4500;
            const mn = addNode('mine1', 350, 300);
            const sm = addNode('smelt1', 500, 300);
            const sh = addNode('shop1', 650, 300);
            setStoreItem(sh, 0, 'ing1');
            const dp = addNode('dump1', 500, 160);
            dp.item = 'waste';
            const cg = addNode('cgen1', 200, 300);
            addLink(hero.id, 'sta', cg.id);
            addLink(cg.id, 'sta', mn.id);
            addLink(cg.id, 'sta', sm.id);
            addLink(cg.id, 'sta', sh.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(sm.id, 'ing1', sh.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);

          } else if (archId === 6) { // Reaction Alchemy Crafter
            S.gold = 6000;
            const sm = addNode('smelt1', 500, 350);
            const pu = addNode('purify1', 500, 220);
            const bx = addNode('box1', 680, 350);
            const gn = addNode('gen1', 350, 350);
            const wd = addNode('wood1', 200, 350);
            const dp = addNode('dump1', 350, 220);
            dp.item = 'waste';
            addLink(hero.id, 'sta', wd.id);
            addLink(wd.id, 'wood', gn.id);
            addLink(gn.id, 'sta', sm.id);
            addLink(gn.id, 'sta', pu.id);
            addLink(gn.id, 'waste', dp.id);
            sm.inTags = { HEAT: 1, CRYO: 1 };
            sm._rxQuench = true;
            addLink(sm.id, 'ing1', bx.id);

          } else if (archId === 7) { // Balanced Factory Standard
            S.gold = 5000;
            const cg = addNode('cgen1', 200, 260);
            addLink(hero.id, 'sta', cg.id);
            const mn = addNode('mine1', 350, 260);
            const sm = addNode('smelt1', 500, 260);
            const lb = addNode('lab1', 650, 260);
            lb.item = 'ing1';
            const dp = addNode('dump1', 500, 140);
            dp.item = 'waste';
            addLink(cg.id, 'sta', mn.id);
            addLink(cg.id, 'sta', sm.id);
            addLink(cg.id, 'sta', lb.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(sm.id, 'ing1', lb.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);

          } else if (archId === 8) { // Companion Swarm & Affection
            S.gold = 5000 + seed * 50;
            const c1 = scoutCompanion('standard');
            const c2 = scoutCompanion('artisan') || scoutCompanion('standard');
            deployCompanion(c1.id, 200, 260);
            deployCompanion(c2.id, 200, 540);
            const n1 = N(c1.deployedNodeId), n2 = N(c2.deployedNodeId);
            if(n1) addLink(n1.id, 'sta', dive.id);
            if(n2) addLink(n2.id, 'sta', dive.id);
            const mn = addNode('mine1', 350, 260);
            const sm = addNode('smelt1', 500, 260);
            const dp = addNode('dump1', 350, 140);
            dp.item = 'waste';
            if(n1) addLink(n1.id, 'sta', mn.id);
            if(n2) addLink(n2.id, 'sta', sm.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);

          } else if (archId === 9) { // High-Density Compression
            S.gold = 6000;
            const mn = addNode('mine1', 350, 300);
            const cp = addNode('comp1', 500, 300);
            cp.item = 'ore1';
            const bx = addNode('box1', 650, 300);
            const dp = addNode('dump1', 350, 160);
            dp.item = 'waste';
            const cg = addNode('cgen1', 200, 300);
            addLink(hero.id, 'sta', cg.id);
            addLink(cg.id, 'sta', mn.id);
            addLink(cg.id, 'sta', cp.id);
            addLink(mn.id, 'ore1', cp.id);
            addLink(cp.id, 'ore1@1', bx.id);
            addLink(mn.id, 'waste', dp.id);

          } else if (archId === 10) { // Deep Abyss Delver
            S.gold = 7000; S.rp = 3000;
            for(const g of DEMON_GEMS) homeOf()[g] = 1;
            const sm = addNode('smelt1', 500, 350);
            const fg = addNode('forge1', 650, 350);
            const lb = addNode('lab1', 800, 350);
            slotDemonGem(sm, 'gem_ruby');
            slotDemonGem(fg, 'gem_obsidian');
            slotDemonGem(lb, 'gem_amethyst');
            const cg = addNode('cgen1', 350, 350);
            addLink(hero.id, 'sta', cg.id);
            addLink(cg.id, 'sta', sm.id);
            addLink(cg.id, 'sta', fg.id);
            addLink(cg.id, 'sta', lb.id);
            // Push dive to deeper level
            S.floor = 15; S.best = 15;
          }

          // Advance stats and skills if affordable
          if (S.stats) {
            S.stats.str = Math.min(50, Math.floor(seed % 35));
            S.stats.int = Math.min(50, Math.floor((seed * 3) % 35));
            S.stats.vit = Math.min(30, Math.floor((seed * 7) % 25));
          }
          if (typeof SKILLS !== 'undefined') {
            for (const sk of SKILLS) {
              if (canLearn(sk.k)) learnSkill(sk.k);
            }
          }

          // Run high-speed simulation: 120 seconds of gameplay (60 ticks x 2.0s dt)
          const simSteps = 60;
          const dt = 2.0;
          for (let s = 0; s < simSteps; s++) {
            tick(dt, true);
          }

          // Gather complete run telemetry
          const facStats = {};
          let totalActive = 0, totalStalled = 0, totalBroken = 0;
          for (const n of S.nodes) {
            const role = TYPES[n.type]?.line || n.type.replace(/\\d+$/, '');
            if (!facStats[role]) {
              facStats[role] = { count: 0, totalDone: 0, active: 0, stalled: 0, broken: 0 };
            }
            facStats[role].count++;
            facStats[role].totalDone += (n.done || 0);
            if (n.broken) { facStats[role].broken++; totalBroken++; }
            else if (n.stall) { facStats[role].stalled++; totalStalled++; }
            else { facStats[role].active++; totalActive++; }
          }

          // Stockpile & material counts
          const stock = {};
          for (const k in homeOf()) {
            if (homeOf()[k] > 0) stock[k] = homeOf()[k];
          }
          for (const n of S.nodes) {
            for (const ik in (n.inBuf || {})) {
              if (n.inBuf[ik] > 0) stock[ik] = (stock[ik] || 0) + n.inBuf[ik];
            }
            for (const ok in (n.outBuf || {})) {
              if (n.outBuf[ok] > 0) stock[ok] = (stock[ok] || 0) + n.outBuf[ok];
            }
          }

          // Skills learned
          const learnedSkills = Object.keys(S.skills || {});

          return {
            runId: ${runNum},
            archId: archId,
            archName: '${arch.name}',
            seed: seed,
            finalFloor: S.floor || 1,
            maxFloor: S.best || 1,
            gold: Math.floor(S.gold || 0),
            rp: Math.floor(S.rp || 0),
            mat: Math.floor(S.stock || 0),
            era: S.era || 1,
            nodeCount: S.nodes.length,
            totalActive: totalActive,
            totalStalled: totalStalled,
            totalBroken: totalBroken,
            facStats: facStats,
            stockpile: stock,
            learnedSkills: learnedSkills,
            partyHp: S.partyHp || 100,
            partyMaxHp: S.partyMaxHp || 100
          };
        })()`);

        allRunResults.push(runData);

        if (runInArch === 1 || runInArch === 10 || runInArch === 20) {
          console.log(`  Run ${String(runNum).padStart(3)} | ${arch.name.slice(0, 16)}... | Floor: ${runData.maxFloor} | Gold: ${runData.gold.toLocaleString()}G | RP: ${runData.rp} | Nodes: ${runData.nodeCount} (Act:${runData.totalActive}, Stl:${runData.totalStalled}) | Skills: [${runData.learnedSkills.join(',')}]`);
        }
      }
    }

    fs.writeFileSync(path.join(RESULTS_DIR, 'playtest_200_runs_data.json'), JSON.stringify(allRunResults, null, 2));
    console.log(`\n================================================================`);
    console.log(`✅ 200 RUNS SUCCESSFULLY SIMULATED & SAVED TO test_results/playtest_200_runs_data.json`);
    console.log(`================================================================`);

    // Capture final canvas screenshot
    await cdp.screenshot('playtest_200_runs_final_canvas.png');

    cdp.close();
    browserCdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
}

run200AuditSimulation().catch(err => {
  console.error('Fatal error running 200 audit simulation:', err);
  process.exit(1);
});
