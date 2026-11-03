const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTML_PATH = '/Users/antigravity/Desktop/pdf変換/node-quest/index.html';
const OUT_DIR = '/Users/antigravity/Desktop/pdf変換/node-quest/test_results';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class SimpleCDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) fn(msg.params);
      }
    });
  }
  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error('Eval exception: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
    }
    return res.result ? res.result.value : undefined;
  }
  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log('  📸 Screenshot saved:', path.basename(filePath));
  }
  close() { this.ws.close(); }
}

async function getWsUrl(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.type === 'page');
          if (page && page.webSocketDebuggerUrl) resolve(page.webSocketDebuggerUrl);
          else reject(new Error('No page target found'));
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('🚀 Starting Chrome for Facility Balance & Trade-off Verification...');
  const port = 9333;
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,800',
    `file://${HTML_PATH}`
  ]);

  await sleep(1500);

  try {
    const wsUrl = await getWsUrl(port);
    const cdp = new SimpleCDP(wsUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('🔍 Executing Test Suite: Facility Balance & Trade-offs...\n');
    const testResults = [];

    // Test 1: Byproduct Buffer & Thermal Gen (gen1) Ash Clog
    console.log('--- Test 1: Thermal Generator (gen1) Ash Byproduct & Clog Verification ---');
    const t1 = await cdp.eval(`(() => {
      newGame();
      const hero = S.nodes.find(n => n.type === 'hero');
      const wood = addNode('wood1', 200, 250);
      const gen = addNode('gen1', 450, 250);
      const forge = addNode('forge1', 700, 250);
      forge.item = 'prt1';
      forge.inBuf.ing1 = 200; // Keep forge running to consume power
      
      // Give wood to gen
      wood.outBuf.wood = 100;
      gen.inBuf.wood = 100;
      
      // Wire sta from gen to forge (so sta does not back up)
      addLink(gen.id, 'sta', forge.id);
      
      const bCap = bypCap(gen);
      const genOuts = outsOf(gen);
      
      // Step simulation until waste reaches capacity (25 cycles)
      for(let i=0; i<35; i++){
        gen.inBuf.wood = 100;
        gen.outBuf.sta = 0; // Consume power to isolate waste test
        tick(1.8, true);
      }
      
      const wasteHeld = gen.outBuf.waste || 0;
      const isStalled = gen.stall;
      const stallWhy = gen.why;
      
      return {
        bCap,
        genOutsWaste: genOuts.waste,
        wasteHeld,
        isStalled,
        stallWhy
      };
    })()`);
    console.log('  gen1 bypCap:', t1.bCap, '(Expected: 25)');
    console.log('  gen1 outsOf waste:', t1.genOutsWaste, '(Expected: 1)');
    console.log('  gen1 wasteHeld after 30 cycles:', t1.wasteHeld);
    console.log('  gen1 stalled:', t1.isStalled, 'why:', t1.stallWhy);
    
    const pass1 = t1.bCap === 25 && t1.genOutsWaste === 1 && t1.wasteHeld === 25 && t1.isStalled && /満杯/.test(t1.stallWhy);
    testResults.push({ name: 'gen1_ash_byproduct_and_clog', pass: pass1, data: t1 });
    console.log(pass1 ? '  ✅ Test 1 PASSED\n' : '  ❌ Test 1 FAILED\n');

    await cdp.screenshot(path.join(OUT_DIR, 'balance_gen_waste_clog.png'));

    // Test 2: Safe Landfill (dump1) with 0 Stamina Logistics
    console.log('--- Test 2: Safe Landfill (dump1) 0 Stamina Discard & Gen Recovery ---');
    const t2 = await cdp.eval(`(() => {
      const gen = S.nodes.find(n => n.type === 'gen1');
      const dump = addNode('dump1', 450, 420);
      dump.item = 'waste';
      
      // Check dump1 insOf
      const dumpIns = insOf(dump);
      
      // Wire waste from gen to dump
      const l = addLink(gen.id, 'waste', dump.id);
      
      // Run packets and simulation to clear waste
      for(let i=0; i<35; i++){
        gen.inBuf.wood = 50;
        gen.outBuf.sta = 0; // Consume power so gen stays active
        tick(1.0, true);
      }
      
      return {
        dumpIns,
        dumpStaCost: dumpIns.sta || 0,
        genWasteAfterWire: gen.outBuf.waste || 0,
        genStalledAfterWire: gen.stall,
        dumpDone: dump.done || 0
      };
    })()`);
    console.log('  dump1 insOf:', JSON.stringify(t2.dumpIns));
    console.log('  dump1 stamina consumption:', t2.dumpStaCost, '(Expected: 0)');
    console.log('  gen1 waste after piping to dump:', t2.genWasteAfterWire);
    console.log('  gen1 stalled after wire:', t2.genStalledAfterWire);
    console.log('  dump1 disposal count:', t2.dumpDone);

    const pass2 = t2.dumpStaCost === 0 && t2.genWasteAfterWire < 25 && !t2.genStalledAfterWire && t2.dumpDone > 0;
    testResults.push({ name: 'dump1_0_stamina_landfill_recovery', pass: pass2, data: t2 });
    console.log(pass2 ? '  ✅ Test 2 PASSED\n' : '  ❌ Test 2 FAILED\n');

    // Test 3: Human Power Gen (cgen1) Clean Aura & Zero Waste
    console.log('--- Test 3: Human Power Generator (cgen1) Clean Aura & Zero Waste ---');
    const t3 = await cdp.eval(`(() => {
      const hero = S.nodes.find(n => n.type === 'hero');
      const cgen = addNode('cgen1', 100, 280);
      const cAura = auraOf(cgen);
      const cOuts = outsOf(cgen);
      
      hero.outBuf.sta = 20;
      addLink(hero.id, 'sta', cgen.id);
      
      // Run simulation
      for(let i=0; i<20; i++){
        tick(1.4, true);
      }
      
      return {
        cAura,
        cOuts,
        wasteInCgen: cgen.outBuf.waste || 0,
        cgenDone: cgen.done || 0,
        cgenStaOut: cgen.outBuf.sta || 0
      };
    })()`);
    console.log('  cgen1 auraOf:', JSON.stringify(t3.cAura), '(Expected: clean aura r=240, v=0.8)');
    console.log('  cgen1 outsOf:', JSON.stringify(t3.cOuts));
    console.log('  cgen1 waste produced:', t3.wasteInCgen, '(Expected: 0)');
    console.log('  cgen1 done count:', t3.cgenDone);
    console.log('  cgen1 sta generated:', t3.cgenStaOut);

    const pass3 = t3.cAura && t3.cAura.k === 'clean' && t3.cAura.v >= 0.8 && t3.wasteInCgen === 0 && t3.cgenDone > 0 && t3.cgenStaOut > 0;
    testResults.push({ name: 'cgen1_clean_aura_and_zero_waste', pass: pass3, data: t3 });
    console.log(pass3 ? '  ✅ Test 3 PASSED\n' : '  ❌ Test 3 FAILED\n');

    await cdp.screenshot(path.join(OUT_DIR, 'balance_cgen_clean_aura.png'));

    // Test 4: Severe Environmental Slowdown & Durability Wear
    console.log('--- Test 4: Severe Environmental Slowdown & Durability Wear under Pollution ---');
    const t4 = await cdp.eval(`(() => {
      const testFac = addNode('forge1', 500, 500);
      testFac.item = 'prt1';
      testFac.pol = 0.0;
      const baseCraftTime = craftTime(testFac);
      
      // At 50% pollution
      testFac.pol = 0.50;
      const timeAt50 = craftTime(testFac);
      
      // At 100% pollution
      testFac.pol = 1.0;
      const timeAt100 = craftTime(testFac);
      
      const speedRatio100 = (baseCraftTime / timeAt100);
      
      // Test durability decay under 70% pollution
      testFac.hpDur = 100;
      testFac.pol = 0.70;
      
      // Step polTick for 10 seconds (10 ticks)
      for(let i=0; i<10; i++){
        polTick(1.0, true);
      }
      
      return {
        baseCraftTime: +baseCraftTime.toFixed(2),
        timeAt50: +timeAt50.toFixed(2),
        timeAt100: +timeAt100.toFixed(2),
        speedRatio100: +speedRatio100.toFixed(3),
        hpDurAfterPollution: +testFac.hpDur.toFixed(1)
      };
    })()`);
    console.log('  Base craft time:', t4.baseCraftTime);
    console.log('  Time at 50% pol:', t4.timeAt50);
    console.log('  Time at 100% pol:', t4.timeAt100);
    console.log('  Work speed ratio at 100% pol:', (t4.speedRatio100 * 100).toFixed(1) + '% (Slowdown penalty active)');
    console.log('  Durability after 10s at 70% pol:', t4.hpDurAfterPollution, '(Decayed from 100%)');

    const pass4 = t4.timeAt100 > t4.baseCraftTime * 3.0 && t4.speedRatio100 <= 0.30 && t4.hpDurAfterPollution < 100;
    testResults.push({ name: 'pollution_slowdown_and_durability_corrosion', pass: pass4, data: t4 });
    console.log(pass4 ? '  ✅ Test 4 PASSED\n' : '  ❌ Test 4 FAILED\n');

    // Test 5: Rebalanced Facilities Matrix (decomp, tool, fuel)
    console.log('--- Test 5: Facility Trade-Offs Matrix (decomp, tool, fuel) ---');
    const t5 = await cdp.eval(`(() => {
      const decomp = addNode('decomp1', 800, 500);
      decomp.item = 'ing1';
      const decompIns = insOf(decomp);
      
      const tool = addNode('tool1', 800, 600);
      tool.item = 'ing1';
      const toolIns = insOf(tool);
      
      const fuel = addNode('fuel1', 800, 700);
      fuel.item = 'toxic';
      const fuelPtype = powerTypeOf(fuel);
      const fuelPollution = polSource(fuel);
      
      const cgen = addNode('cgen1', 800, 800);
      const cgenPollution = polSource(cgen);
      
      return {
        decompStaCost: decompIns.sta || 0,
        toolStaCost: toolIns.sta || 0,
        fuelPtype,
        fuelPollution: +fuelPollution.toFixed(2),
        cgenPollution: +cgenPollution.toFixed(2)
      };
    })()`);
    console.log('  decomp1 stamina requirement:', t5.decompStaCost, '(Baseline increased to 12)');
    console.log('  tool1 stamina requirement:', t5.toolStaCost, '(Baseline increased to 6)');
    console.log('  fuel1 powerTypeOf:', t5.fuelPtype);
    console.log('  fuel1 smoke emission rate:', t5.fuelPollution, '(Extra toxic smoke)');
    console.log('  cgen1 smoke emission rate:', t5.cgenPollution, '(Zero smoke)');

    const pass5 = t5.decompStaCost >= 10 && t5.toolStaCost >= 5 && t5.fuelPtype === 'dirty_gen' && t5.fuelPollution >= 3.0 && t5.cgenPollution === 0;
    testResults.push({ name: 'facility_tradeoffs_matrix', pass: pass5, data: t5 });
    console.log(pass5 ? '  ✅ Test 5 PASSED\n' : '  ❌ Test 5 FAILED\n');

    // Open Codex Glossary to verify live UI rendering
    await cdp.eval(`(() => {
      toggleCodexModal(true, 'codex');
    })()`);
    await sleep(500);
    await cdp.screenshot(path.join(OUT_DIR, 'balance_codex_overview.png'));

    // Output summary
    const allPassed = testResults.every(t => t.pass);
    console.log('========================================================');
    console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${testResults.filter(t=>t.pass).length} | FAILED: ${testResults.filter(t=>!t.pass).length}`);
    console.log('OVERALL STATUS:', allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED');
    console.log('========================================================\n');

    fs.writeFileSync(path.join(OUT_DIR, 'facility_balance_report.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      allPassed,
      results: testResults
    }, null, 2));

    cdp.close();
  } catch(err) {
    console.error('Fatal error during test execution:', err);
  } finally {
    chrome.kill();
  }
}

run();
