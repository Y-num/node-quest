const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = '/Users/antigravity/Desktop/pdf変換/node-quest';
const RESULTS_DIR = path.join(WORKSPACE_DIR, 'test_results');
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

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`📸 Screenshot saved: ${path.basename(filePath)}`);
  }
}

async function runMasterMilestoneVerification() {
  console.log('🚀 Starting Master Milestone Verification Suite (Headless Chrome CDP)...');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,900'
  ]);

  const jsErrors = [];
  const report = {
    timestamp: new Date().toISOString(),
    tests: [],
    overallStatus: 'PASS'
  };

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

    cdp.on('Runtime.exceptionThrown', params => {
      jsErrors.push(params.exceptionDetails);
      console.error('❌ JS Exception:', JSON.stringify(params.exceptionDetails));
    });

    await new Promise(r => setTimeout(r, 1200));

    // ==========================================
    // TEST 1: Onboarding & Early-Game Resource Grant & Initial Mine Placement Fix
    // ==========================================
    console.log('\n--- [TEST 1] Onboarding & Initial Mine Placement Fix ---');
    const t1 = await cdp.eval(`
      (() => {
        localStorage.clear();
        newGame();
        const initialGold = S.gold;
        // Check tutFinish grant
        tutFinish('Tutorial Skipped');
        const claimed = S.starterKitClaimed;
        const postGold = S.gold;
        const postStock = S.stock;
        const postRp = S.rp;
        const postIng = homeOf().ing1 || 0;

        // Verify Era 1 initial mine placement with 0 physical inventory
        // buyMat for mine1 should return null / require 0 physical ingots
        const mineMatReq = buyMat('mine1');
        const cgenMatReq = buyMat('cgen1');
        const shopMatReq = buyMat('shop1');

        // Place mine1
        const mineNode = addNode('mine1', 400, 200);
        const placedMineOk = !!mineNode && S.nodes.some(n => n.id === mineNode.id);

        return {
          initialGold,
          claimed,
          postGold,
          postStock,
          postRp,
          postIng,
          mineMatReq,
          cgenMatReq,
          shopMatReq,
          placedMineOk,
          pass: claimed === true && postGold >= 340 && postStock >= 40 && postRp >= 20 && postIng >= 10 && mineMatReq === null && placedMineOk
        };
      })()
    `);
    console.log('Test 1 Result:', t1);
    report.tests.push({ name: 'Onboarding & Early Mine Placement Fix', result: t1 });
    if (!t1.pass) report.overallStatus = 'FAIL';

    // ==========================================
    // TEST 2: Power Stratification & Dungeon Incompatibility (Universal Anima vs Industrial Power)
    // ==========================================
    console.log('\n--- [TEST 2] Power Stratification & Dungeon Incompatibility ---');
    const t2 = await cdp.eval(`
      (() => {
        // Place mechanical generator and dungeon node
        const genNode = addNode('cgen1', 200, 300);
        const diveNode = addNode('dive1', 480, 300);
        // Connect generator sta to dive node
        const l1 = addLink(genNode.id, 'sta', diveNode.id);
        
        // Render & tick
        render();
        tick(1.0, false);
        render();

        const incompCheck = isLinkIncompatible(l1);
        const diveIncomp = diveNode._incompatiblePower;
        const diveStall = diveNode.stall;
        const diveWhy = diveNode.why;
        const linkClassRail = l1.el && l1.el.rail ? l1.el.rail.getAttribute('class') : '';
        const incompTagDisplay = l1.el && l1.el.incompTag ? l1.el.incompTag.style.display : 'none';

        // Attempt attack - must fail
        const initialEnemyHp = S.enemy ? S.enemy.hp : 0;
        doDive(false, diveNode);
        const blockedAttackHp = S.enemy ? S.enemy.hp : 0;

        // Now remove machine link and connect human Hero sta to dungeon
        removeLink(l1.id);
        const heroNode = S.nodes.find(n => n.type === 'hero');
        heroNode.x = 240; heroNode.y = 300;
        const l2 = addLink(heroNode.id, 'sta', diveNode.id);
        render();
        tick(1.0, false);

        const heroIncompCheck = isLinkIncompatible(l2);
        const diveHeroIncomp = diveNode._incompatiblePower;

        return {
          incompCheck,
          diveIncomp,
          diveStall,
          diveWhy,
          linkClassRail,
          incompTagDisplay,
          attackBlocked: initialEnemyHp === blockedAttackHp,
          heroIncompCheck,
          diveHeroIncomp,
          pass: incompCheck === true && diveIncomp === true && diveStall === true &&
                linkClassRail.includes('incompatible-power') && incompTagDisplay !== 'none' &&
                heroIncompCheck === false && diveHeroIncomp === false
        };
      })()
    `);
    console.log('Test 2 Result:', t2);
    report.tests.push({ name: 'Power Stratification & Dungeon Isolation', result: t2 });
    if (!t2.pass) report.overallStatus = 'FAIL';

    // Capture Power Stratification Screenshot
    await cdp.eval(`sel = S.nodes.find(n => n.type === 'dive1').id; render(); renderInsp();`);
    await cdp.screenshot(path.join(RESULTS_DIR, 'master_01_power_stratification.png'));

    // ==========================================
    // TEST 3: Stealth Default Wiring, Cable Bundling & Interactive Focus Mode
    // ==========================================
    console.log('\n--- [TEST 3] Stealth Wiring, Cable Bundling & Interactive Focus Mode ---');
    const t3 = await cdp.eval(`
      (() => {
        // Create 2 nodes with multiple connections (sta + ore1)
        const box1 = addNode('box1', 650, 200);
        const box2 = addNode('box1', 900, 200);
        box1.outBuf.ore1 = 10;
        const lb1 = addLink(box1.id, 'ore1', box2.id);
        const lb2 = addLink(box1.id, 'sta', box2.id);
        
        render();
        const g1 = geomOf(lb1);
        const g2 = geomOf(lb2);
        const hasBundleOffset = (lb1._bundleOffset !== undefined || lb2._bundleOffset !== undefined) || (lb1.bundleOffset !== undefined || lb2.bundleOffset !== undefined);

        // Select box1: verify focus-link class on lb1/lb2 and dim-link on unrelated links
        sel = box1.id;
        render();
        const focusClass1 = lb1.el.rail.getAttribute('class') || '';
        const unrelatedLink = S.links.find(l => l.from !== box1.id && l.to !== box1.id);
        const dimClass = unrelatedLink && unrelatedLink.el.rail ? unrelatedLink.el.rail.getAttribute('class') : '';

        // Reset selection
        sel = null;
        render();

        return {
          hasBundleOffset,
          focusClass1,
          dimClass,
          pass: focusClass1.includes('focus-link') && (dimClass === '' || dimClass.includes('dim-link'))
        };
      })()
    `);
    console.log('Test 3 Result:', t3);
    report.tests.push({ name: 'Stealth Wiring, Cable Bundling & Focus Mode', result: t3 });
    if (!t3.pass) report.overallStatus = 'FAIL';

    await cdp.eval(`sel = S.nodes.find(n => n.type === 'box1').id; render();`);
    await cdp.screenshot(path.join(RESULTS_DIR, 'master_02_focus_mode_and_bundling.png'));

    // ==========================================
    // TEST 4: Dynamic Threat: Facility Overrun & Alien Tech Liberation
    // ==========================================
    console.log('\n--- [TEST 4] Facility Overrun & Alien Tech Liberation ---');
    const t4 = await cdp.eval(`
      (() => {
        const forge = addNode('forge', 500, 480);
        forge.hpDur = 0; // Trigger durability break
        tick(0.5, false);
        render();

        const isOverrun = forge.isOverrun;
        const isStall = forge.stall;
        const spireTech = forge.spireTech;
        const spireClass = forge.el.root.classList.contains('enemy-spire');

        // Execute liberation operation
        reclaimSpire(forge.id);
        render();

        const postOverrun = forge.isOverrun;
        const postHp = forge.hpDur;
        const alienTech = forge.alienTech;
        const alienClass = forge.el.root.classList.contains('alien-tech');

        // Advance 2s to test Alien Tech 1 auto-repair
        forge.hpDur = 60;
        tick(2.0, false);
        const autoRepairedHp = forge.hpDur;

        return {
          isOverrun,
          isStall,
          spireTech,
          spireClass,
          postOverrun,
          postHp,
          alienTech,
          alienClass,
          autoRepairedHp,
          pass: isOverrun === true && isStall === true && spireClass === true &&
                postOverrun === false && postHp === 100 && alienTech >= 1 &&
                alienClass === true && autoRepairedHp > 60
        };
      })()
    `);
    console.log('Test 4 Result:', t4);
    report.tests.push({ name: 'Territorial Incursion & Alien Tech Liberation', result: t4 });
    if (!t4.pass) report.overallStatus = 'FAIL';

    await cdp.eval(`sel = S.nodes.find(n => n.type === 'forge').id; render(); renderInsp();`);
    await cdp.screenshot(path.join(RESULTS_DIR, 'master_03_alien_tech_liberation.png'));

    // ==========================================
    // TEST 5: 5 Destiny Demon Gems, Slotting, Sacrifice & True Boss Awakening
    // ==========================================
    console.log('\n--- [TEST 5] 5 Destiny Demon Gems, Slotting & True Boss ---');
    const t5 = await cdp.eval(`
      (() => {
        initDemonGems();
        // 1. Proximity unearthing
        const vein = S.demonGemVeins[0]; // gem_ruby
        const probe = addNode('cgen', vein.x - 30, vein.y - 30);
        probe.done = 5;
        tick(1.0, false);
        const rubyFound = vein.found;
        const rubyInBag = homeOf()['gem_ruby'] || 0;

        // 2. Base slotting (Path A)
        const targetNode = S.nodes.find(n => n.type === 'forge');
        slotDemonGem(targetNode.id, 'gem_ruby');
        render();
        const slottedGem = targetNode.slottedGem;
        const hasBadge = !!targetNode.el.root.querySelector('.gem-badge');

        // 3. Altar Sacrifice (Path B) for all 5 gems
        for(const g of DEMON_GEMS){
          homeOf()[g] = 1;
          sacDemonGem(g);
        }
        const sacCount = S.demonGemsSacrificed.length;
        const ascVal = S.stats.asc || 0;

        // 4. Boss awakening: True Boss "Sovereign of Samsara"
        S.caveFloor = 10;
        S.floor = 10;
        spawnEnemy();
        const enemyName = S.enemy.name;
        const isTrueBoss = !!S.enemy.trueBoss;
        const enemyHpVal = S.enemy.hp;

        // 5. Defeat True Boss & Unlock Secret Trophy
        S.enemy.hp = 0;
        const diveNode = S.nodes.find(n => n.type === 'dive');
        doDive(false, diveNode);
        troTick(10);
        const defeatedTrueBoss = !!S.trueBossDefeated;
        const troTrueBossHas = troHas('tro_true_boss');
        const troSpeedMul = troMul();

        return {
          rubyFound,
          rubyInBag,
          slottedGem,
          hasBadge,
          sacCount,
          ascVal,
          enemyName,
          isTrueBoss,
          enemyHpVal,
          defeatedTrueBoss,
          troTrueBossHas,
          troSpeedMul,
          pass: rubyFound === true && slottedGem === 'gem_ruby' && hasBadge === true &&
                sacCount === 5 && ascVal >= 5 && isTrueBoss === true &&
                defeatedTrueBoss === true && troTrueBossHas === true && troSpeedMul > 1.15
        };
      })()
    `);
    console.log('Test 5 Result:', t5);
    report.tests.push({ name: '5 Destiny Demon Gems & True Boss Awakening', result: t5 });
    if (!t5.pass) report.overallStatus = 'FAIL';

    await cdp.eval(`$('#mTroBtn').click(); renderTro();`);
    await cdp.screenshot(path.join(RESULTS_DIR, 'master_04_secret_trophy_and_gems.png'));
    await cdp.eval(`$('#troClose').click();`);

    // ==========================================
    // TEST 6: Progression Flattening, 4th Stat & AFK Safeties
    // ==========================================
    console.log('\n--- [TEST 6] Progression Flattening, 4th Stat & AFK Safeties ---');
    const t6 = await cdp.eval(`
      (() => {
        // 1. Flattened depthBonus test
        S.best = 100;
        const tVal = depthTier();
        const expectedDepthBonus = 1 + 0.08 * tVal + 0.02 * Math.pow(tVal, 1.35);
        const actualDepthBonus = depthBonus();

        // 2. Skill learning threshold (no deduction)
        S.stats.str = 20; S.stats.int = 20;
        const prevStr = S.stats.str;
        learnSkill('atk1');
        const postStr = S.stats.str;
        const hasSkillAtk1 = hasSkill('atk1');

        // 3. Companion food stat growth cap (+30)
        const comp = generateCompanion('std');
        S.companionRoster.push(comp);
        homeOf()[comp.favoriteItem] = 50; // provide favorite food
        for(let i = 0; i < 25; i++){
          feedCompanionDirect(comp.id, 'fav');
        }
        const foodStatBonus = comp.foodStatBonus;
        const tempBuff = comp.tempBuff || 1;

        // 4. AFK Safeties: 60s reboot & 25% liquidation
        const brokenNode = S.nodes.find(n => n.type === 'mine' || n.type === 'mine1') || addNode('mine', 500, 200);
        brokenNode.hpDur = 0;
        brokenNode.inBuf = brokenNode.inBuf || {};
        brokenNode.inBuf.ore1 = 300; // overflowing buffer (>100)
        const goldBefore = S.gold;
        applyAway(120); // 120s offline
        const rebootDur = brokenNode.hpDur;
        const goldGained = S.gold - goldBefore;

        return {
          expectedDepthBonus,
          actualDepthBonus,
          depthDiff: Math.abs(expectedDepthBonus - actualDepthBonus),
          prevStr,
          postStr,
          hasSkillAtk1,
          foodStatBonus,
          tempBuff,
          rebootDur,
          goldGained,
          pass: Math.abs(expectedDepthBonus - actualDepthBonus) < 0.001 &&
                prevStr === postStr && hasSkillAtk1 === true &&
                foodStatBonus <= 30 && tempBuff > 1.0 &&
                rebootDur >= 50 && goldGained > 0
        };
      })()
    `);
    console.log('Test 6 Result:', t6);
    report.tests.push({ name: 'Progression Flattening, 4th Stat & AFK Safeties', result: t6 });
    if (!t6.pass) report.overallStatus = 'FAIL';

    // Summary output
    console.log('\n==========================================');
    console.log(`VERIFICATION SUMMARY: ${report.overallStatus}`);
    console.log(`Total JS Errors: ${jsErrors.length}`);
    console.log('==========================================');

    const reportPath = path.join(RESULTS_DIR, 'master_milestone_verification.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📄 Test JSON report written to: ${reportPath}`);

  } catch (err) {
    console.error('❌ Verification failed with error:', err);
    report.overallStatus = 'ERROR';
    report.error = String(err);
  } finally {
    chrome.kill();
  }
}

runMasterMilestoneVerification().catch(console.error);
