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

async function run50TelemetrySimulation() {
  console.log('================================================================');
  console.log('🚀 NODE QUEST: 50-RUN HIGH-PRECISION FACILITY OUTPUT PROFILER');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9233;
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
    await cdp.send('DOM.enable');

    await sleep(1200);

    console.log('⚡ Connected to Chrome CDP runtime. Starting 50-run simulation profile...\n');

    // 10 playstyles x 5 runs each = 50 runs
    const ARCHETYPES = [
      { id: 1, key: 'companion_swarm', name: '生体アニマ・仲間スウォーム型' },
      { id: 2, key: 'industrial_grid', name: '機械化火力・工業グリッド型' },
      { id: 3, key: 'clean_cgen_hub', name: '人力・清浄オーラ複合拠点型' },
      { id: 4, key: 'thermal_quench', name: '熱冷サーマル・急冷鋼特化型' },
      { id: 5, key: 'demon_factory', name: '魔神眼スロット・特化工廠型' },
      { id: 6, key: 'waste_incinerator', name: '焼却発電・循環リサイクル型' },
      { id: 7, key: 'turret_expedition', name: '戦術支援砲台・洞窟遠征型' },
      { id: 8, key: 'deep_decomp_lab', name: '高圧分解・原子還元研究所型' },
      { id: 9, key: 'spire_alien_reclaim', name: '領土侵食・エイリアンテック型' },
      { id: 10, key: 'omniverse_megalopolis', name: '全方位メガロポリス型' }
    ];

    const runs = [];
    const facilityOutputAggregates = {};

    for (const arch of ARCHETYPES) {
      console.log(`▶ [Archetype ${arch.id}/10] ${arch.name}`);

      for (let seed = 1; seed <= 5; seed++) {
        const runNum = (arch.id - 1) * 5 + seed;
        process.stdout.write(`  Run ${runNum.toString().padStart(2, '0')}/50 (Seed ${seed})... `);

        const runData = await cdp.eval(`(async () => {
          localStorage.clear();
          newGame();
          S.tutDone = 1;
          tutFinish('Playtest Profile ${runNum}');

          const hero = S.nodes.find(n => n.type === 'hero');
          const dive = S.nodes.find(n => (TYPES[n.type] && TYPES[n.type].effect === 'dive') || n.type === 'dive');
          hero.x = 200; hero.y = 400;
          dive.x = 420; dive.y = 400;
          addLink(hero.id, 'sta', dive.id);

          hero.gear = [{item:'eqp1'}, {item:null}, {item:null}];
          gearDirty();

          const archId = ${arch.id};
          const seed = ${seed};

          // Build archetype setup
          if (archId === 1) { // Companion Swarm
            S.gold = 5000 + seed * 300;
            const c1 = scoutCompanion('standard');
            const c2 = scoutCompanion('artisan') || scoutCompanion('standard');
            deployCompanion(c1.id, 200, 260);
            deployCompanion(c2.id, 200, 540);
            const n1 = N(c1.deployedNodeId), n2 = N(c2.deployedNodeId);
            if(n1) addLink(n1.id, 'sta', dive.id);
            if(n2) addLink(n2.id, 'sta', dive.id);
            const m = addNode('mine1', 350, 260);
            const sm = addNode('smelt1', 500, 260);
            if(n1) addLink(n1.id, 'sta', m.id);
            addLink(m.id, 'ore1', sm.id);
            const dmp = addNode('dump1', 350, 140);
            dmp.item = 'waste';
            addLink(m.id, 'waste', dmp.id);
            addLink(sm.id, 'waste', dmp.id);

          } else if (archId === 2) { // Industrial Grid (wood -> gen -> smelt/mine -> dump)
            S.gold = 4000;
            const cg = addNode('cgen1', 200, 260);
            addLink(hero.id, 'sta', cg.id);
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

          } else if (archId === 3) { // Clean Cgen Hub
            S.gold = 4500;
            const cg1 = addNode('cgen1', 200, 260);
            const cg2 = addNode('cgen1', 200, 540);
            addLink(hero.id, 'sta', cg1.id);
            addLink(hero.id, 'sta', cg2.id);
            const lb = addNode('lab1', 350, 260);
            lb.item = 'ing1';
            const mn = addNode('mine1', 350, 400);
            const sm = addNode('smelt1', 500, 400);
            const dp = addNode('dump1', 500, 260);
            dp.item = 'waste';
            addLink(cg1.id, 'sta', lb.id);
            addLink(cg2.id, 'sta', mn.id);
            addLink(cg2.id, 'sta', sm.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(sm.id, 'ing1', lb.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);

          } else if (archId === 4) { // Thermal Quench
            S.gold = 5000;
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

          } else if (archId === 5) { // Demon Factory
            S.gold = 6000; S.rp = 2000;
            for(const g of DEMON_GEMS) homeOf()[g] = 1;
            const sm = addNode('smelt1', 500, 350);
            const fg = addNode('forge1', 650, 350);
            const lb = addNode('lab1', 800, 350);
            slotDemonGem(sm, 'gem_crimson');
            slotDemonGem(fg, 'gem_amber');
            slotDemonGem(lb, 'gem_azure');
            const cg = addNode('cgen1', 350, 350);
            addLink(hero.id, 'sta', cg.id);
            addLink(cg.id, 'sta', sm.id);
            addLink(cg.id, 'sta', fg.id);
            addLink(cg.id, 'sta', lb.id);

          } else if (archId === 6) { // Waste Incinerator Loop (fuel + purify)
            S.gold = 4800;
            const mn = addNode('mine1', 350, 300);
            const sm = addNode('smelt1', 500, 300);
            const fl = addNode('fuel1', 350, 480);
            fl.item = 'waste';
            const pu = addNode('purify1', 500, 480);
            addLink(hero.id, 'sta', mn.id);
            addLink(hero.id, 'sta', sm.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(mn.id, 'waste', fl.id);
            addLink(sm.id, 'waste', fl.id);
            addLink(fl.id, 'sta', pu.id); // Power purify with waste electricity

          } else if (archId === 7) { // Turrets & Expedition
            S.gold = 5500;
            const tur = addNode('turret1', 420, 260);
            const cg = addNode('cgen1', 200, 260);
            addLink(hero.id, 'sta', cg.id);
            addLink(cg.id, 'sta', tur.id);
            tur.gain = 800;
            hero._formCamp = true;
            dive._formCamp = true;

          } else if (archId === 8) { // Deep Decomp & Shop
            S.gold = 8000;
            const mn = addNode('mine1', 350, 300);
            const sm = addNode('smelt1', 500, 300);
            const dc = addNode('decomp1', 650, 300);
            dc.item = 'ing1';
            const sh = addNode('shop1', 650, 450);
            setStoreItem(sh, 0, 'ing1');
            const cg = addNode('cgen1', 200, 300);
            const gn = addNode('gen1', 350, 450);
            const wd = addNode('wood1', 200, 450);
            const dp = addNode('dump1', 350, 180);
            dp.item = 'waste';
            addLink(hero.id, 'sta', cg.id);
            addLink(hero.id, 'sta', wd.id);
            addLink(wd.id, 'wood', gn.id);
            addLink(cg.id, 'sta', mn.id);
            addLink(cg.id, 'sta', sm.id);
            addLink(gn.id, 'sta', dc.id);
            addLink(gn.id, 'sta', sh.id);
            addLink(mn.id, 'ore1', sm.id);
            addLink(sm.id, 'ing1', dc.id);
            addLink(sm.id, 'ing1', sh.id);
            addLink(gn.id, 'waste', dp.id);
            addLink(mn.id, 'waste', dp.id);
            addLink(sm.id, 'waste', dp.id);

          } else if (archId === 9) { // Spire Overrun & Alien Tech
            S.gold = 6000;
            const sm = addNode('smelt1', 500, 350);
            const fg = addNode('forge1', 650, 350);
            sm.hpDur = 0; sm.isOverrun = true;
            fg.hpDur = 0; fg.isOverrun = true;
            reclaimSpire(sm);
            reclaimSpire(fg);
            sm.alienTech = 3; fg.alienTech = 4;
            const cg = addNode('cgen1', 350, 350);
            addLink(hero.id, 'sta', cg.id);
            addLink(cg.id, 'sta', sm.id);
            addLink(cg.id, 'sta', fg.id);

          } else if (archId === 10) { // Omniverse Megalopolis
            S.gold = 30000; S.rp = 8000; S.era = 2;
            const cgens = [], gens = [], mines = [], smelts = [], dumps = [], woods = [];
            for (let i = 0; i < 18; i++) {
              const types = ['wood1', 'gen1', 'mine1', 'smelt1', 'dump1', 'cgen1'];
              const t = types[i % types.length];
              const gx = 500 + (i % 6) * 110;
              const gy = 160 + Math.floor(i / 6) * 110;
              const nd = addNode(t, gx, gy);
              if(t === 'wood1') woods.push(nd);
              else if(t === 'gen1') gens.push(nd);
              else if(t === 'mine1') mines.push(nd);
              else if(t === 'smelt1') smelts.push(nd);
              else if(t === 'dump1') dumps.push(nd);
              else if(t === 'cgen1') cgens.push(nd);
            }
            dumps.forEach(d => d.item = 'waste');
            for(let k=0; k<Math.min(cgens.length, woods.length); k++) addLink(hero.id, 'sta', cgens[k].id);
            for(let k=0; k<Math.min(woods.length, gens.length); k++){
              addLink(hero.id, 'sta', woods[k].id);
              addLink(woods[k].id, 'wood', gens[k].id);
              addLink(gens[k].id, 'waste', dumps[k%dumps.length].id);
            }
            for(let k=0; k<Math.min(mines.length, smelts.length); k++){
              addLink(gens[k%gens.length].id, 'sta', mines[k].id);
              addLink(gens[k%gens.length].id, 'sta', smelts[k].id);
              addLink(mines[k].id, 'ore1', smelts[k].id);
              addLink(mines[k].id, 'waste', dumps[k%dumps.length].id);
              addLink(smelts[k].id, 'waste', dumps[k%dumps.length].id);
            }
          }

          // Sample at 3 time milestones: Early (40s), Mid (120s), Late (240s)
          const snapshots = [];
          const stepSec = 1.0;

          function captureSnapshot(phaseName, elapsedSec) {
            const facStats = {};
            for(const n of S.nodes) {
              const role = TYPES[n.type]?.line || n.type.replace(/\\d+$/, '');
              if(!facStats[role]) {
                facStats[role] = {
                  count: 0,
                  totalDone: 0,
                  activeCount: 0,
                  stalledCount: 0,
                  stallWhys: {},
                  avgDur: 0,
                  avgPol: 0,
                  outBufs: {}
                };
              }
              const fs = facStats[role];
              fs.count++;
              fs.totalDone += (n.done || 0);
              if(n.stall) {
                fs.stalledCount++;
                const w = n.why || '停止';
                fs.stallWhys[w] = (fs.stallWhys[w] || 0) + 1;
              } else {
                fs.activeCount++;
              }
              fs.avgDur += (n.hpDur != null ? n.hpDur : 100);
              fs.avgPol += (n.pol || 0);
              for(const ok in (n.outBuf || {})) {
                fs.outBufs[ok] = (fs.outBufs[ok] || 0) + n.outBuf[ok];
              }
            }

            for(const k in facStats) {
              facStats[k].avgDur = +(facStats[k].avgDur / facStats[k].count).toFixed(1);
              facStats[k].avgPol = +(facStats[k].avgPol / facStats[k].count).toFixed(3);
            }

            snapshots.push({
              phase: phaseName,
              t: elapsedSec,
              gold: Math.round(S.gold || 0),
              rp: Math.round(S.rp || 0),
              stock: Math.round(S.stock || 0),
              floor: S.caveFloor || S.floor || 1,
              bestFloor: S.best || 1,
              partyHp: Math.round(S.partyHp || 0),
              brokenCount: S.nodes.filter(n => n.broken).length,
              stalledCount: S.nodes.filter(n => n.stall).length,
              facStats
            });
          }

          // Run Phase 1: 0 -> 40s
          for(let t = 0; t < 40; t++) tick(stepSec, true);
          captureSnapshot('Phase1_Early', 40);

          // Run Phase 2: 40s -> 120s
          for(let t = 40; t < 120; t++) tick(stepSec, true);
          captureSnapshot('Phase2_Mid', 120);

          // Run Phase 3: 120s -> 240s
          for(let t = 120; t < 240; t++) tick(stepSec, true);
          captureSnapshot('Phase3_Late', 240);

          const finalSnap = snapshots[snapshots.length - 1];
          return {
            runNum: ${runNum},
            archId: archId,
            archKey: '${arch.key}',
            archName: '${arch.name}',
            seed: seed,
            snapshots,
            finalSummary: {
              gold: finalSnap.gold,
              rp: finalSnap.rp,
              stock: finalSnap.stock,
              bestFloor: finalSnap.bestFloor,
              brokenCount: finalSnap.brokenCount,
              totalNodes: S.nodes.length
            }
          };
        })()`);

        runs.push(runData);

        const fin = runData.finalSummary;
        console.log(`Floor: ${fin.bestFloor}F | Gold: ${fin.gold} | RP: ${fin.rp} | Nodes: ${fin.totalNodes} | Broken: ${fin.brokenCount} | OK`);
      }
    }

    // Capture visual snapshot of the final run
    await cdp.eval(`(() => {
      sel = null;
      renderInsp();
      render();
    })()`);
    await sleep(600);
    await cdp.screenshot('playtest_50_runs_final_canvas.png');

    console.log('\n📊 Aggregating Facility Transition Telemetry across 50 Runs...');

    // Compute aggregated per-facility outputs across all runs & phases
    const facilityReport = {};
    const phases = ['Phase1_Early', 'Phase2_Mid', 'Phase3_Late'];

    for (const phase of phases) {
      facilityReport[phase] = {};
    }

    for (const r of runs) {
      for (const snap of r.snapshots) {
        const ph = snap.phase;
        for (const [facKey, fData] of Object.entries(snap.facStats)) {
          if (!facilityReport[ph][facKey]) {
            facilityReport[ph][facKey] = {
              sampleCount: 0,
              totalCycles: 0,
              stalls: 0,
              activeSum: 0,
              avgDurSum: 0,
              avgPolSum: 0,
              stallReasons: {},
              outBufSums: {}
            };
          }
          const rep = facilityReport[ph][facKey];
          rep.sampleCount++;
          rep.totalCycles += fData.totalDone;
          rep.stalls += fData.stalledCount;
          rep.activeSum += fData.activeCount;
          rep.avgDurSum += fData.avgDur;
          rep.avgPolSum += fData.avgPol;

          for (const [w, cnt] of Object.entries(fData.stallWhys)) {
            rep.stallReasons[w] = (rep.stallReasons[w] || 0) + cnt;
          }
          for (const [ok, qty] of Object.entries(fData.outBufs)) {
            rep.outBufSums[ok] = (rep.outBufSums[ok] || 0) + qty;
          }
        }
      }
    }

    // Calculate averages
    const finalFacilityMetrics = {};
    for (const phase of phases) {
      finalFacilityMetrics[phase] = {};
      for (const [facKey, rep] of Object.entries(facilityReport[phase])) {
        const n = rep.sampleCount || 1;
        finalFacilityMetrics[phase][facKey] = {
          meanDone: +(rep.totalCycles / n).toFixed(1),
          stallRatePct: +(rep.stalls / Math.max(1, rep.activeSum + rep.stalls) * 100).toFixed(1),
          meanDurability: +(rep.avgDurSum / n).toFixed(1),
          meanPollution: +(rep.avgPolSum / n).toFixed(3),
          primaryStalls: rep.stallReasons,
          meanOutBufs: Object.fromEntries(
            Object.entries(rep.outBufSums).map(([k, v]) => [k, +(v / n).toFixed(1)])
          )
        };
      }
    }

    const fullTelemetry = {
      timestamp: new Date().toISOString(),
      totalRuns: runs.length,
      archetypeCount: ARCHETYPES.length,
      facilityMetricsByPhase: finalFacilityMetrics,
      runsSummary: runs.map(r => ({
        runNum: r.runNum,
        archName: r.archName,
        seed: r.seed,
        final: r.finalSummary
      }))
    };

    const outPath = path.join(RESULTS_DIR, 'playtest_50_runs_telemetry.json');
    fs.writeFileSync(outPath, JSON.stringify(fullTelemetry, null, 2));
    console.log(`\n💾 Telemetry Report written to: ${path.basename(outPath)}`);

    cdp.close();
    chrome.kill();
    return fullTelemetry;

  } catch (err) {
    console.error('Fatal simulation error:', err);
    chrome.kill();
    throw err;
  }
}

run50TelemetrySimulation();
