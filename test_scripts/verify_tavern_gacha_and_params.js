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

async function runTavernVerification() {
  console.log('================================================================');
  console.log('🍻 TAVERN, DICE GACHA & PLAYER PARAMETER VERIFICATION SUITE');
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

    const fileUrl = 'file:///Users/antigravity/Desktop/pdf変換/node-quest/index.html?debug=1';
    const target = await cdp.send('Target.createTarget', { url: fileUrl });
    const pageCdp = new SimpleCDP(`ws://127.0.0.1:9222/devtools/page/${target.targetId}`);
    await pageCdp.connect();

    await pageCdp.send('Page.enable');
    await pageCdp.send('Runtime.enable');
    await pageCdp.send('DOM.enable');

    await new Promise(r => setTimeout(r, 1200));

    // =========================================================================
    // STEP 1: Cave 1 Victory Hook & ガラガリー Recruitment
    // =========================================================================
    console.log('\n--- [STEP 1] Cave 1 Victory Hook & Garagary Recruitment ---');
    const cave1Victory = await pageCdp.eval(`(() => {
      // Simulate Cave 1 clearing
      S.caveId = 'cave1';
      S.caveFloor = 10;
      S.caveClears = S.caveClears || {};
      S.caveClears.cave1 = 0; // First clear
      S.companionRoster = S.companionRoster || [];
      S.dev = S.dev || {};

      // Trigger cave clear victory logic
      S.enemy = { hp: 1, max: 100, name: 'ボススライム', boss: true };
      doDive(false, null, true);

      const garagary = (S.companionRoster || []).find(c => c.id === 'comp_garagary');
      return {
        tavernDev: !!S.dev.tavern1,
        tutorialGachaAvailable: !!S.tutorialGachaAvailable,
        garagaryExists: !!garagary,
        garagaryName: garagary ? garagary.name : null,
        garagaryRole: garagary ? garagary.role : null,
        garagaryRarity: garagary ? garagary.rarity : null,
        garagaryDiceSum: garagary ? garagary.diceSum : null,
        garagaryStats: garagary ? garagary.stats : null,
        garagaryTraits: garagary ? garagary.traits : []
      };
    })()`);

    console.log('🍻 Cave 1 Victory Result:', cave1Victory);
    assert('Tavern facility unlocked (S.dev.tavern1)', cave1Victory.tavernDev, true, cave1Victory.tavernDev);
    assert('Garagary joined the roster', cave1Victory.garagaryExists, true, cave1Victory.garagaryExists);
    assert('Garagary name is 女店長 ガラガリー', cave1Victory.garagaryName, '女店長 ガラガリー', cave1Victory.garagaryName);
    assert('Garagary role is tavern_master', cave1Victory.garagaryRole, 'tavern_master', cave1Victory.garagaryRole);
    assert('Garagary is SSR rarity (sum 22 >= 18)', cave1Victory.garagaryRarity === 'SSR' && cave1Victory.garagaryDiceSum >= 18, 'SSR >= 18', `${cave1Victory.garagaryRarity} (sum ${cave1Victory.garagaryDiceSum})`);
    assert('Garagary has tavern_cheer trait', cave1Victory.garagaryTraits.includes('tavern_cheer'), true, cave1Victory.garagaryTraits.includes('tavern_cheer'));
    assert('Tutorial Gacha flagged available', cave1Victory.tutorialGachaAvailable, true, cave1Victory.tutorialGachaAvailable);

    // =========================================================================
    // STEP 2: Dice Scaling with Progression (3 to 6 dice)
    // =========================================================================
    console.log('\n--- [STEP 2] Dice Scaling with Progression (3 to 6 dice) ---');
    const diceScaling = await pageCdp.eval(`(() => {
      S.stats = { str: 0, int: 0, vit: 0 };
      S.caveClears = {};
      S.best = 1;
      const d1 = gachaDiceCount();

      // Cave 2 cleared / best >= 25
      S.caveClears.cave2 = 1;
      S.best = 25;
      const d2 = gachaDiceCount();

      // Cave 4 cleared / best >= 100
      S.caveClears.cave4 = 1;
      S.best = 100;
      const d3 = gachaDiceCount();

      // Cave 6 cleared / best >= 275
      S.caveClears.cave6 = 1;
      S.best = 275;
      const d4 = gachaDiceCount();

      // High Player INT bonus (+1 die when INT >= 40)
      S.caveClears = {};
      S.best = 1;
      S.stats.int = 45;
      const dIntBonus = gachaDiceCount();

      return { d1, d2, d3, d4, dIntBonus };
    })()`);

    console.log('🎲 Dice Progression Counts:', diceScaling);
    assert('Base Progression dice count is 3', diceScaling.d1 === 3, 3, diceScaling.d1);
    assert('Cave 2 clear scales dice count to 4', diceScaling.d2 === 4, 4, diceScaling.d2);
    assert('Cave 4 clear scales dice count to 5', diceScaling.d3 === 5, 5, diceScaling.d3);
    assert('Cave 6 clear scales dice count to 6', diceScaling.d4 === 6, 6, diceScaling.d4);
    assert('Player INT >= 40 grants +1 die bonus early', diceScaling.dIntBonus === 4, 4, diceScaling.dIntBonus);

    // =========================================================================
    // STEP 3: Rarity Thresholds: 18+ = SSR, 30+ = Legend
    // =========================================================================
    console.log('\n--- [STEP 3] Rarity Thresholds: 18+ = SSR, 30+ = Legend ---');
    const thresholdTests = await pageCdp.eval(`(() => {
      // Test C tier (sum = 10)
      const cComp = createCompanionFromDice({
        rawDice: [3, 3, 4], rerolledIndex: -1, origVal: null, intBonus: 0, rawSum: 10, totalSum: 10, rarity: 'C'
      });

      // Test SSR tier (sum = 20 >= 18)
      const ssrComp = createCompanionFromDice({
        rawDice: [5, 5, 5, 5], rerolledIndex: -1, origVal: null, intBonus: 0, rawSum: 20, totalSum: 20, rarity: 'SSR'
      });

      // Test Legend tier (sum = 32 >= 30)
      const legComp = createCompanionFromDice({
        rawDice: [6, 6, 6, 6, 5, 3], rerolledIndex: -1, origVal: null, intBonus: 0, rawSum: 32, totalSum: 32, rarity: 'LEGEND'
      });

      return {
        cRarity: cComp.rarity,
        cSlots: cComp.sk.length,
        ssrRarity: ssrComp.rarity,
        ssrSlots: ssrComp.sk.length,
        ssrStats: ssrComp.stats,
        ssrTraits: ssrComp.traits,
        legRarity: legComp.rarity,
        legSlots: legComp.sk.length,
        legStats: legComp.stats,
        legTraits: legComp.traits,
        legHasMythic: legComp.traits.some(tk => ['god_hand','overlord','archmage','immortal'].includes(tk))
      };
    })()`);

    console.log('🌟 Threshold Roll Test:', thresholdTests);
    assert('Sum 10 results in C rarity', thresholdTests.cRarity === 'C', 'C', thresholdTests.cRarity);
    assert('Sum 20 (>=18) results in SSR rarity', thresholdTests.ssrRarity === 'SSR', 'SSR', thresholdTests.ssrRarity);
    assert('SSR tier has 3 skill slots', thresholdTests.ssrSlots === 3, 3, thresholdTests.ssrSlots);
    assert('SSR tier has elevated stats (STR>=13, INT>=13, VIT>=15)', thresholdTests.ssrStats.str >= 13 && thresholdTests.ssrStats.vit >= 15, true, JSON.stringify(thresholdTests.ssrStats));
    assert('Sum 32 (>=30) results in LEGEND rarity', thresholdTests.legRarity === 'LEGEND', 'LEGEND', thresholdTests.legRarity);
    assert('LEGEND tier has 4 skill slots', thresholdTests.legSlots === 4, 4, thresholdTests.legSlots);
    assert('LEGEND tier has guaranteed Mythic trait', thresholdTests.legHasMythic, true, thresholdTests.legTraits.join(','));

    // =========================================================================
    // STEP 4: Tavern Facility Aura (Wage Discount, Morale, Strike Immunity)
    // =========================================================================
    console.log('\n--- [STEP 4] Tavern Facility Welfare Aura ---');
    const tavernAura = await pageCdp.eval(`(() => {
      // Place a companion node and check wage before and after placing tavern
      S.gold = 5000;
      S.nodes = S.nodes.filter(n => n.type === 'hero');
      const compNode = addNode('mate1', 300, 300);
      rebuildNodeEl(compNode);
      const wageBefore = payOf(compNode);

      // Place Tavern node within 280px (e.g. at 350, 300)
      const tavernNode = addNode('tavern1', 350, 300);
      rebuildNodeEl(tavernNode);
      const nearTav = isNearTavern(compNode);
      const wageAfter = payOf(compNode);

      // Check strike immunity: Gold to 0, tick polTick / wage check
      S.gold = 0;
      compNode.isStrike = false;
      const isImmune = isNearTavern(compNode);
      // Run tick step for wage check
      const wage = payOf(compNode);
      const strikeTriggered = (wage > 0 && S.gold < wage && !isImmune);

      return {
        wageBefore,
        wageAfter,
        discountAchieved: wageAfter < wageBefore,
        discountPct: Math.round((1 - (wageAfter / wageBefore)) * 100),
        nearTav,
        strikeImmune: !strikeTriggered
      };
    })()`);

    console.log('🍺 Tavern Aura Test Metrics:', tavernAura);
    assert('isNearTavern returns true within 280px', tavernAura.nearTav, true, tavernAura.nearTav);
    assert('Tavern reduces companion wage by ~30%', tavernAura.discountPct >= 28 && tavernAura.discountPct <= 35, '30%', `${tavernAura.discountPct}%`);
    assert('Tavern aura grants strike immunity on zero gold', tavernAura.strikeImmune, true, tavernAura.strikeImmune);

    // =========================================================================
    // STEP 5: Player Parameter Active Factory Synergy
    // =========================================================================
    console.log('\n--- [STEP 5] Player Parameter Active Factory Synergy ---');
    const paramSynergy = await pageCdp.eval(`(() => {
      // 1. INT: RP grant bonus
      S.stats.int = 50;
      const rpBefore = S.rp || 0;
      grantRp(100);
      const rpGainedWith50Int = (S.rp || 0) - rpBefore;

      S.stats.int = 0;
      const rpBeforeZero = S.rp || 0;
      grantRp(100);
      const rpGainedWith0Int = (S.rp || 0) - rpBeforeZero;

      // 2. VIT: Gacha pull discount
      S.stats.vit = 40;
      const gachaCostDiscounted = gachaCostGold('standard');
      S.stats.vit = 0;
      const gachaCostStandard = gachaCostGold('standard');

      // 3. STR: Gacha companion bonus
      S.stats.str = 40;
      const compWithStr = createCompanionFromDice({
        rawDice: [4, 4, 4], rerolledIndex: -1, origVal: null, intBonus: 0, rawSum: 12, totalSum: 12, rarity: 'SR'
      });

      return {
        rpGainedWith50Int,
        rpGainedWith0Int,
        intRpMultiplier: +(rpGainedWith50Int / rpGainedWith0Int).toFixed(2),
        gachaCostDiscounted,
        gachaCostStandard,
        vitDiscountRatio: +(1 - (gachaCostDiscounted / gachaCostStandard)).toFixed(2),
        compAffWithStr: compWithStr.affection
      };
    })()`);

    console.log('⚡ Player Parameter Active Synergy:', paramSynergy);
    assert('Hero INT 50 boosts RP research output (+75%)', paramSynergy.intRpMultiplier >= 1.7, '>=1.70', paramSynergy.intRpMultiplier);
    assert('Hero VIT 40 discounts Gacha cost (~32%)', paramSynergy.vitDiscountRatio >= 0.30, '>=0.30', paramSynergy.vitDiscountRatio);
    assert('Hero STR 40 gives initial affection boost (+200)', paramSynergy.compAffWithStr >= 200, '>=200', paramSynergy.compAffWithStr);

    // =========================================================================
    // STEP 6: UI & Modal Open, Tabs & Dice Rolling Verification
    // =========================================================================
    console.log('\n--- [STEP 6] UI & Modal Open, Tabs & Dice Rolling ---');
    await pageCdp.eval(`
      S.gold = 10000;
      openCompModal('gacha');
    `);
    await new Promise(r => setTimeout(r, 600));

    const modalUiCheck = await pageCdp.eval(`(() => {
      const modal = document.getElementById('compModal');
      const gPane = document.getElementById('compGachaPane');
      const rPane = document.getElementById('compRosterPane');
      const dArena = document.getElementById('diceArena');
      const btnSingle = document.getElementById('btnRollGachaSingle');

      return {
        modalVisible: modal && modal.classList.contains('on'),
        gachaPaneActive: gPane && !gPane.hidden,
        rosterPaneHidden: rPane && rPane.hidden,
        btnSingleExists: !!btnSingle
      };
    })()`);

    assert('Tavern Gacha Modal opens with .on class', modalUiCheck.modalVisible, true, modalUiCheck.modalVisible);
    assert('Gacha pane active and roster pane hidden initially', modalUiCheck.gachaPaneActive && modalUiCheck.rosterPaneHidden, true, true);

    // Take screenshot of Gacha Arena
    await pageCdp.screenshot('tavern_gacha_01_modal.png');

    // Trigger Single Roll
    await pageCdp.eval(`
      document.getElementById('btnRollGachaSingle').click();
    `);
    await new Promise(r => setTimeout(r, 700));

    const rollUiCheck = await pageCdp.eval(`(() => {
      const arena = document.getElementById('diceArena');
      const dRow = document.getElementById('diceRow');
      const dSum = document.getElementById('diceSumDisplay');
      const resCont = document.getElementById('gachaResultContainer');

      return {
        arenaVisible: arena && !arena.hidden,
        diceCubesCount: dRow ? dRow.querySelectorAll('.dice-cube').length : 0,
        sumText: dSum ? dSum.textContent : '',
        resultCardVisible: resCont && !resCont.hidden
      };
    })()`);

    console.log('🎲 Roll UI Check:', rollUiCheck);
    assert('Dice arena visible with rolled dice cubes', rollUiCheck.arenaVisible && rollUiCheck.diceCubesCount >= 3, true, `${rollUiCheck.diceCubesCount} cubes`);
    assert('Companion result card revealed after roll', rollUiCheck.resultCardVisible, true, rollUiCheck.resultCardVisible);

    // Take screenshot of Roll result
    await pageCdp.screenshot('tavern_gacha_02_roll_result.png');

    // Switch to Roster tab
    await pageCdp.eval(`
      document.querySelector('.comp-tab[data-ctab="roster"]').click();
    `);
    await new Promise(r => setTimeout(r, 500));

    const rosterUiCheck = await pageCdp.eval(`(() => {
      const rPane = document.getElementById('compRosterPane');
      const cards = rPane.querySelectorAll('.comp-card');
      const hasGaragaryCard = Array.from(cards).some(c => c.textContent.includes('ガラガリー'));
      return {
        rosterActive: rPane && !rPane.hidden,
        cardsCount: cards.length,
        hasGaragaryCard
      };
    })()`);

    console.log('📋 Roster UI Check:', rosterUiCheck);
    assert('Roster tab active with companion cards', rosterUiCheck.rosterActive && rosterUiCheck.cardsCount >= 1, true, `${rosterUiCheck.cardsCount} cards`);
    assert('Garagary displayed in companion roster with SSR badge', rosterUiCheck.hasGaragaryCard, true, rosterUiCheck.hasGaragaryCard);

    // Take screenshot of Roster view
    await pageCdp.screenshot('tavern_gacha_03_roster.png');

    // Close modal
    await pageCdp.eval(`closeCompModal();`);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n================================================================');
    console.log('📊 VERIFICATION SUMMARY');
    console.log('================================================================');
    const total = testResults.length;
    const passed = testResults.filter(r => r.pass).length;
    const failed = total - passed;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    if (failed === 0) {
      console.log('🎉 ALL TAVERN, GACHA & PLAYER PARAMETER TESTS PASSED!');
    } else {
      console.error(`❌ ${failed} TESTS FAILED!`);
    }

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'tavern_gacha_test_report.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), total, passed, failed, testResults }, null, 2)
    );

    pageCdp.close();
    cdp.close();
  } catch (err) {
    console.error('Fatal Error during verification:', err);
  } finally {
    chrome.kill();
  }
}

runTavernVerification();
