const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/antigravity/Desktop/pdf変換/node-quest';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'test_results');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

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
    const fullPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`[Screenshot Saved] -> ${fullPath}`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 COMPANION ARCHITECTURE COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,900'
  ]);

  const testResults = [];
  function assert(name, condition, expected, actual, metric = '') {
    const pass = !!condition;
    testResults.push({ name, pass, expected, actual, metric });
    const status = pass ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} | ${name}: expected [${expected}], got [${actual}] ${metric}`);
    if (!pass) console.error(`    ↳ Assertion Failed: ${name}`);
  }

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

    cdp.on('Runtime.exceptionThrown', p => {
      console.error('⚠️ [Page Exception]', p.exceptionDetails.text, p.exceptionDetails.exception);
    });

    const fileUrl = 'file:///Users/antigravity/Desktop/pdf変換/node-quest/index.html?debug=1';
    const target = await cdp.send('Target.createTarget', { url: fileUrl });
    const pageCdp = new SimpleCDP(`ws://127.0.0.1:9222/devtools/page/${target.targetId}`);
    await pageCdp.connect();

    await pageCdp.send('Page.enable');
    await pageCdp.send('Runtime.enable');
    await pageCdp.send('DOM.enable');

    await new Promise(r => setTimeout(r, 1200));
    await pageCdp.eval('console.log("CDP Connected successfully to Node Quest!")');

    const initState = await pageCdp.eval(`(() => {
      return {
        gold: S.gold,
        best: S.best,
        nodes: S.nodes.length,
        scoutCount: S.scoutCount || 0,
        rosterLen: (S.companionRoster || []).length
      };
    })()`);
    console.log('🎮 Initial Game State:', initState);
    assert('Initial Gold is at least 500G', initState.gold >= 500, '>=500', initState.gold);

    // =========================================================================
    // STEP 1: Uncapped Scout & Roster State Verification
    // =========================================================================
    console.log('\n--- [STEP 1] Uncapped Scout & Roster State Verification ---');
    
    // Clear deployed nodes (except hero and dive) to prevent ambient wage draw during scout cost assertion
    await pageCdp.eval(`
      S.gold = 10000;
      S.scoutCount = 0;
      S.companionRoster = [];
      S.nodes = S.nodes.filter(n => n.type === 'hero' || n.type === 'dive1');
      save();
    `);
    
    // Perform 5 consecutive standard scouts and verify formula
    const scoutHistory = [];
    for (let c = 0; c < 5; c++) {
      const expectedCost = Math.floor(250 * Math.pow(1.12, c));
      const res = await pageCdp.eval(`(() => {
        const expected = Math.floor(250 * Math.pow(1.12, S.scoutCount || 0));
        const costReported = scoutCostGold('standard');
        const gBefore = S.gold;
        const comp = scoutCompanion('standard');
        const gAfter = S.gold;
        return {
          expected,
          costReported,
          deducted: gBefore - gAfter,
          compRole: comp ? comp.role : null
        };
      })()`);
      scoutHistory.push(res);
      assert(`Standard Scout #${c+1} Cost Formula (${expectedCost}G)`, res.costReported === expectedCost && res.deducted === expectedCost, expectedCost, res.deducted, 'G deducted');
    }

    const rosterCheck = await pageCdp.eval(`(() => {
      const r = S.companionRoster || [];
      const ids = new Set(r.map(c => c.id));
      const allValid = r.every(c => c.id && c.name && c.role && c.stats && c.traits && c.favoriteItem && c.basePay > 0);
      return { len: r.length, uniqueIds: ids.size, allValid };
    })()`);
    assert('5 Unique Companions Recruited to Roster', rosterCheck.len === 5 && rosterCheck.uniqueIds === 5, '5 unique', `${rosterCheck.len} (unique ${rosterCheck.uniqueIds})`);
    assert('Companions have complete schema (Role, Stats, Traits, FavItem)', rosterCheck.allValid, true, rosterCheck.allValid);

    // Specialized Scout (Warrior)
    await pageCdp.eval(`addItem('mcore', 4); S.gold = Math.max(S.gold, 3000);`);
    const mcoreBefore = await pageCdp.eval(`homeOf().mcore || 0`);
    const specComp = await pageCdp.eval(`scoutCompanion('special', 'warrior')`);
    const mcoreAfter = await pageCdp.eval(`homeOf().mcore || 0`);
    
    assert('Specialized Scout consumes 2x mcore', mcoreBefore - mcoreAfter === 2, 2, mcoreBefore - mcoreAfter, 'mcore consumed');
    assert('Specialized Warrior has warrior role', specComp.role === 'warrior', 'warrior', specComp.role);
    assert('Specialized Warrior has elevated STR (>=10)', specComp.stats.str >= 10, '>=10', specComp.stats.str);

    // Open Scout & Roster modal and take screenshot
    await pageCdp.eval(`openCompModal(); renderCompModal();`);
    await new Promise(r => setTimeout(r, 400));
    await pageCdp.screenshot('test_01_roster_scout.png');
    await pageCdp.eval(`closeCompModal();`);

    // =========================================================================
    // STEP 2: Continuous Wage & Real-Time Strike Test
    // =========================================================================
    console.log('\n--- [STEP 2] Continuous Wage & Real-Time Strike Test ---');

    const deployInfo = await pageCdp.eval(`(() => {
      const roster = S.companionRoster;
      const c1 = roster[0];
      const c2 = roster[1];
      const n1 = deployCompanion(c1.id, 240, 260);
      const n2 = deployCompanion(c2.id, 240, 420);
      return {
        c1Id: c1.id, n1Id: n1.id, pay1: payOf(n1),
        c2Id: c2.id, n2Id: n2.id, pay2: payOf(n2)
      };
    })()`);
    console.log('Deployed 2 Companions:', deployInfo);

    // Fund ample gold (5000G) and measure wage deductions over pulses
    await pageCdp.eval(`S.gold = 5000;`);
    const gStart = await pageCdp.eval(`S.gold`);
    await pageCdp.eval(`
      for(let i=0; i<3; i++) {
        tick(1.0, false);
      }
    `);
    const gMid = await pageCdp.eval(`S.gold`);
    const wageDeducted = gStart - gMid;
    assert('Companions consume real-time Gold wages on pulses', wageDeducted > 0, '>0', wageDeducted, 'G paid');
    
    const strikeCheckBefore = await pageCdp.eval(`(() => {
      const n1 = N(${deployInfo.n1Id}), n2 = N(${deployInfo.n2Id});
      return { s1: !!n1.isStrike, s2: !!n2.isStrike };
    })()`);
    assert('Companions active without strike while funded', !strikeCheckBefore.s1 && !strikeCheckBefore.s2, 'false, false', `${strikeCheckBefore.s1}, ${strikeCheckBefore.s2}`);

    // Set gold to 0 and trigger strike
    await pageCdp.eval(`
      S.gold = 0;
      for(let i=0; i<4; i++) {
        tick(1.0, false);
      }
      render();
    `);

    const strikeCheckAfter = await pageCdp.eval(`(() => {
      const n1 = N(${deployInfo.n1Id}), n2 = N(${deployInfo.n2Id});
      const c1 = compOfNode(n1), c2 = compOfNode(n2);
      const dom1Strike = n1.el && n1.el.root && n1.el.root.classList.contains('strike');
      const badge1Visible = n1.el && n1.el.strikeBadge && !n1.el.strikeBadge.hidden;
      return {
        n1Strike: n1.isStrike, c1Strike: c1.isStrike,
        n2Strike: n2.isStrike, c2Strike: c2.isStrike,
        dom1Strike, badge1Visible
      };
    })()`);
    assert('Insufficient Gold triggers isStrike on nodes & companions', strikeCheckAfter.n1Strike && strikeCheckAfter.c1Strike, true, strikeCheckAfter.n1Strike);
    assert('Strike indicator class & badge active on DOM', strikeCheckAfter.dom1Strike && strikeCheckAfter.badge1Visible, true, `${strikeCheckAfter.dom1Strike}, badge:${strikeCheckAfter.badge1Visible}`);

    // Capture Strike screenshot
    await pageCdp.eval(`
      sel = ${deployInfo.n1Id};
      renderInsp();
      render();
    `);
    await new Promise(r => setTimeout(r, 400));
    await pageCdp.screenshot('test_02_strike_state.png');

    // Deposit Gold and assert automatic recovery
    await pageCdp.eval(`
      S.gold = 1000;
      tick(1.0, false);
      render();
    `);
    const strikeRecovered = await pageCdp.eval(`(() => {
      const n1 = N(${deployInfo.n1Id});
      return !n1.isStrike && !compOfNode(n1).isStrike;
    })()`);
    assert('Deposit Gold immediately clears isStrike and resumes work', strikeRecovered, true, strikeRecovered);

    // Test Feed Rations / Clear Strikes
    await pageCdp.eval(`
      S.gold = 0;
      for(let i=0; i<4; i++) tick(1.0, false);
      S.gold = 1000;
      feedRosterAll();
      render();
    `);
    const strikeClearedByRation = await pageCdp.eval(`(() => {
      const n1 = N(${deployInfo.n1Id});
      return !n1.isStrike && !compOfNode(n1).isStrike;
    })()`);
    assert('feedRosterAll() clears strike via meal distribution', strikeClearedByRation, true, strikeClearedByRation);

    // =========================================================================
    // STEP 3: Conveyor Feeding & Affection Wage Discount Test
    // =========================================================================
    console.log('\n--- [STEP 3] Conveyor Feeding & Affection Wage Discount Test ---');

    const feedNodeTest = await pageCdp.eval(`(() => {
      const n = N(${deployInfo.n1Id});
      const comp = compOfNode(n);
      comp.affection = 0;
      const initialStr = comp.stats.str;
      const fav = comp.favoriteItem;
      // Soft input feed simulation
      feedCompanionByNode(n, fav, 1, false);
      return {
        fav,
        affAfter: comp.affection,
        strBefore: initialStr,
        strAfter: comp.stats.str,
        grown: comp.stats.str - initialStr
      };
    })()`);
    console.log('Feeding Result:', feedNodeTest);
    assert('Conveyor feeding favorite item boosts Affection', feedNodeTest.affAfter >= 40, '>=40', feedNodeTest.affAfter);
    assert('Conveyor feeding permanently boosts stats (+2)', feedNodeTest.grown === 2, 2, feedNodeTest.grown);

    // Capture visual conveyor feeding / pop screenshot
    await pageCdp.eval(`
      sel = ${deployInfo.n1Id};
      spawnReactionPop(N(${deployInfo.n1Id}), '🎁大好物！ 💕+55 (95/1000)', '#f472b6');
      renderInsp();
      render();
    `);
    await new Promise(r => setTimeout(r, 400));
    await pageCdp.screenshot('test_03_affection_feeding.png');

    // Test Milestone Affection Scaling at 1000
    const milestone1000 = await pageCdp.eval(`(() => {
      const n = N(${deployInfo.n1Id});
      const comp = compOfNode(n);
      const basePay = comp.basePay;
      
      // Measure base range with affection = 0
      comp.affection = 0;
      const range0 = humanRangeOf(n);
      const staBefore = (outsOf(n).sta || 1);
      
      setCompanionAffection(comp, 1000);
      
      const pay1000 = payOf(n);
      const discountRatio = affectionDiscount(comp.affection);
      const spdMul = compAffectionSpdMul(comp);
      const staAfter = (outsOf(n).sta || 1);
      const range1000 = humanRangeOf(n);
      
      return {
        basePay,
        pay1000,
        discountRatio,
        spdMul,
        staBonus: staAfter - staBefore,
        rangeGain: range1000 - range0
      };
    })()`);
    console.log('Affection 1000 Milestone Metrics:', milestone1000);
    assert('Affection 1000 reaches exactly -80% wage discount ratio', milestone1000.discountRatio === 0.80, 0.80, milestone1000.discountRatio);
    assert('Affection 1000 wage payOf(n) reduced by ~80%', milestone1000.pay1000 <= Math.ceil(milestone1000.basePay * 0.25), `<= ${Math.ceil(milestone1000.basePay * 0.25)}`, milestone1000.pay1000);
    assert('Affection 1000 grants +50% work speed multiplier', milestone1000.spdMul === 1.50, 1.50, milestone1000.spdMul);
    assert('Affection 1000 grants +2 stamina pulse output', milestone1000.staBonus === 2, 2, milestone1000.staBonus);
    assert('Affection 1000 extends human range by +100px', milestone1000.rangeGain === 100, 100, milestone1000.rangeGain);

    // Capture inspector displaying 1000 Affection and discounts
    await pageCdp.eval(`
      sel = ${deployInfo.n1Id};
      renderInsp();
      render();
    `);
    await new Promise(r => setTimeout(r, 400));
    await pageCdp.screenshot('test_04_discount_inspector.png');

    // =========================================================================
    // STEP 4: Emergent Trait Tag Integration Test
    // =========================================================================
    console.log('\n--- [STEP 4] Emergent Trait Tag Integration Test ---');

    const traitTest = await pageCdp.eval(`(() => {
      S.gold = 5000;
      // 1. Fiery companion -> Smelter receiving CRYO from cgen -> Quench reaction
      const compFiery = generateCompanion('standard');
      compFiery.traits = ['fiery'];
      S.companionRoster.push(compFiery);
      const nFiery = deployCompanion(compFiery.id, 500, 200);
      
      const smeltNode = addNode('smelt1', 680, 200);
      const cgenNode  = addNode('cgen1', 680, 80);
      addLink(nFiery.id, 'sta', smeltNode.id);
      addLink(cgenNode.id, 'sta', smeltNode.id);
      
      updateReactionEngine(0.5, false);
      const isQuench = !!smeltNode._rxQuench;
      
      // 2. Polluter companion increments node pollution
      const compPol = generateCompanion('standard');
      compPol.traits = ['polluter'];
      S.companionRoster.push(compPol);
      const nPol = deployCompanion(compPol.id, 500, 360);
      nPol.pol = 0.05;
      nPol.stall = false;
      
      updateReactionEngine(1.0, false);
      const polAfter = nPol.pol;
      
      // 3. Warrior with KINETIC connected to dive1
      const compWar = generateCompanion('special', 'warrior');
      S.companionRoster.push(compWar);
      const nWar = deployCompanion(compWar.id, 500, 520);
      const diveNode = S.nodes.find(n => n.type === 'dive1') || addNode('dive1', 680, 520);
      addLink(nWar.id, 'sta', diveNode.id);
      
      updateReactionEngine(0.5, false);
      const diveTags = diveNode.inTags || {};
      const hasKinetic = !!diveTags.KINETIC;

      return {
        isQuench,
        polIncremented: polAfter > 0.05,
        polDelta: polAfter - 0.05,
        hasKinetic
      };
    })()`);
    console.log('Trait Integration Test Metrics:', traitTest);
    assert('Fiery trait triggers Thermal Quench on Smelter with CRYO', traitTest.isQuench, true, traitTest.isQuench);
    assert('Polluter trait increments local node pollution', traitTest.polIncremented, true, traitTest.polIncremented, `+${traitTest.polDelta.toFixed(4)}`);
    assert('Warrior companion outputs KINETIC tag to linked Cave node', traitTest.hasKinetic, true, traitTest.hasKinetic);

    // =========================================================================
    // FINAL TEST SUMMARY REPORT
    // =========================================================================
    console.log('\n================================================================');
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('================================================================');
    const total = testResults.length;
    const passed = testResults.filter(t => t.pass).length;
    const failed = total - passed;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Overall Status: ${failed === 0 ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);

    const summaryReport = {
      timestamp: new Date().toISOString(),
      total,
      passed,
      failed,
      status: failed === 0 ? 'PASS' : 'FAIL',
      tests: testResults,
      screenshots: [
        'test_01_roster_scout.png',
        'test_02_strike_state.png',
        'test_03_affection_feeding.png',
        'test_04_discount_inspector.png'
      ]
    };

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'test_results', 'companion_test_report.json'),
      JSON.stringify(summaryReport, null, 2)
    );

    pageCdp.close();
    cdp.close();
  } catch (err) {
    console.error('💥 Test Suite Fatal Error:', err);
  } finally {
    chrome.kill();
    console.log('Chrome process terminated.');
  }
}

runTestSuite();
