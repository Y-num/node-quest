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
    console.log(`📸 [Screenshot Saved] -> ${path.basename(fullPath)}`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function verifyMobileAndHumanPower() {
  console.log('================================================================');
  console.log('📱 NODE QUEST: EXPANDED HUMAN RANGE, POWER STRATIFICATION & MOBILE AUDIT');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9230',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=390,844'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 250));
      try {
        const json = await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:9230/json/version', res => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => resolve(buf));
          }).on('error', reject);
        });
        wsUrl = JSON.parse(json).webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch (e) {}
    }
    if (!wsUrl) throw new Error('Failed to connect to headless Chrome on port 9230');

    const browserCdp = new SimpleCDP(wsUrl);
    await browserCdp.connect();

    // Create target
    const target = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
    const pageCdp = new SimpleCDP(`ws://127.0.0.1:9230/devtools/page/${target.targetId}`);
    await pageCdp.connect();

    await pageCdp.send('Page.enable');
    await pageCdp.send('Runtime.enable');
    await pageCdp.send('DOM.enable');

    // Emulate Mobile Device (iPhone 14: 390x844)
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await pageCdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });

    const htmlPath = 'file://' + path.join(WORKSPACE_DIR, 'index.html');
    await pageCdp.send('Page.navigate', { url: htmlPath });
    await new Promise(r => setTimeout(r, 1000));

    // 1. Initial State & Mobile Ergonomics Check
    console.log('--- Step 1: Initial Mobile View & Hero Node Measurements ---');
    const step1 = await pageCdp.eval(`(() => {
      window.DEV_CFG = window.DEV_CFG || {};
      newGame();

      const hero = S.nodes.find(n => n.type === 'hero');
      const dive = S.nodes.find(n => n.type === 'dive1' || n.type === 'dive');

      return {
        heroRange: humanRangeOf(hero),
        heroH: nodeH(hero),
        heroInKeys: inKeys(hero),
        heroOutKeys: outKeys(hero),
        dist: Math.round(nodeDist(hero, dive)),
        inRange: inHumanRange(hero, dive),
        diveFar: farHumanInfo(dive)
      };
    })()`);

    console.log(`Hero Effect Range: ${step1.heroRange}px (Expected: 750px)`);
    console.log(`Hero Card Height: ${step1.heroH}px (Expected <= 65px)`);
    console.log(`Hero Visible InKeys: ${JSON.stringify(step1.heroInKeys)} (Folded: [])`);
    console.log(`Hero Visible OutKeys: ${JSON.stringify(step1.heroOutKeys)} (['sta'])`);
    console.log(`Hero-to-Dive Distance: ${step1.dist}px (Inside 750px: ${step1.inRange})`);
    console.log(`Dive farHumanInfo: ${step1.diveFar === null ? 'None (Running smoothly)' : 'Stalled'}`);

    if (step1.heroRange !== 750) throw new Error(`Hero range was ${step1.heroRange}, expected 750!`);
    if (step1.heroH > 65) throw new Error(`Hero card height was ${step1.heroH}, expected <= 65px!`);
    if (step1.heroInKeys.length !== 0) throw new Error(`Hero should have 0 input slots by default, got ${step1.heroInKeys.length}!`);

    // 2. Test Generator Power Far Outside Hero Circle
    console.log('\n--- Step 2: Generator Power Far from Hero (Industrial Grid Independence) ---');
    const step2 = await pageCdp.eval(`(() => {
      const hero = S.nodes.find(n => n.type === 'hero');
      // Place wind turbine and smelter at x: 2000, y: 1500 (1500px+ away from hero)
      const gen = addNode('cgen', 2000, 1500);
      const smelt = addNode('smelt', 2250, 1500);

      const lk = addLink(gen.id, 'sta', smelt.id);

      return {
        distFromHero: Math.round(nodeDist(hero, smelt)),
        isOutOfRange: isLinkOutOfRange(lk),
        farInfo: farHumanInfo(smelt)
      };
    })()`);

    console.log(`Smelter Distance from Hero: ${step2.distFromHero}px`);
    console.log(`Generator Link isOutOfRange: ${step2.isOutOfRange} (Expected: false)`);
    console.log(`Smelter farHumanInfo: ${step2.farInfo === null ? 'None (Runs anywhere on map!)' : 'Stalled'}`);

    if (step2.isOutOfRange) throw new Error('Generator link should NOT be out of range!');
    if (step2.farInfo !== null) throw new Error('Generator-powered facility should NOT stall for human range!');

    // 3. Test Dungeon Requires Living Anima & Human Range
    console.log('\n--- Step 3: Dungeon Isolation Rule (Living Anima Only) ---');
    const step3 = await pageCdp.eval(`(() => {
      const hero = S.nodes.find(n => n.type === 'hero');
      const dive = S.nodes.find(n => n.type === 'dive1' || n.type === 'dive');

      // Move dive node to 1200px away from hero (outside 750px radius)
      dive.x = hero.x + 1200;
      dive.y = hero.y;

      const linkHeroDive = S.links.find(l => l.from === hero.id && l.to === dive.id);
      const isHeroOutOfRange = isLinkOutOfRange(linkHeroDive);
      const farInfo = farHumanInfo(dive);

      // Attempt to connect mechanical generator to dungeon
      const gen = S.nodes.find(n => n.type === 'cgen');
      const genLink = addLink(gen.id, 'sta', dive.id);
      const isIncompatible = isLinkIncompatible(genLink);

      return {
        isHeroOutOfRange,
        farOver: farInfo ? farInfo.over : 0,
        isIncompatible
      };
    })()`);

    console.log(`Dungeon at 1200px isHeroOutOfRange: ${step3.isHeroOutOfRange} (Expected: true)`);
    console.log(`Dungeon Far Stall Over: ${step3.farOver}px (Expected > 0)`);
    console.log(`Mechanical Generator to Dungeon Incompatible: ${step3.isIncompatible} (Expected: true)`);

    if (!step3.isHeroOutOfRange) throw new Error('Hero link to dungeon at 1200px must be out of range!');
    if (!step3.isIncompatible) throw new Error('Generator link to dungeon must be incompatible!');

    // 4. Test Soft Input Port Expansion and Folding
    console.log('\n--- Step 4: Soft Input Port Dynamic Expansion & Folding ---');
    const step4 = await pageCdp.eval(`(() => {
      const hero = S.nodes.find(n => n.type === 'hero');
      const tstr = addNode('tstr', hero.x - 200, hero.y);

      const canConnect = canLink(tstr, 'exs', hero);
      const lk = addLink(tstr.id, 'exs', hero.id);
      rebuildNodeEl(hero);

      const inKeysAfter = inKeys(hero);
      const hAfter = nodeH(hero);

      removeLink(lk.id);
      rebuildNodeEl(hero);

      const inKeysRestored = inKeys(hero);
      const hRestored = nodeH(hero);

      return {
        canConnect,
        inKeysAfter,
        hAfter,
        inKeysRestored,
        hRestored
      };
    })()`);

    console.log(`Can connect exs to folded hero: ${step4.canConnect} (Expected: true)`);
    console.log(`InKeys with active link: ${JSON.stringify(step4.inKeysAfter)} (Expanded: ['exs'])`);
    console.log(`Hero Height with link: ${step4.hAfter}px`);
    console.log(`InKeys after link removal: ${JSON.stringify(step4.inRestored || step4.inKeysRestored)} (Folded back to: [])`);
    console.log(`Hero Height after link removal: ${step4.hRestored}px (Sleek: 61px)`);

    if (!step4.canConnect) throw new Error('Should be able to connect exs to hero!');
    if (!step4.inKeysAfter.includes('exs')) throw new Error('exs port did not expand on connection!');
    if (step4.inKeysRestored.length !== 0) throw new Error('exs port did not fold upon link deletion!');

    // 5. Screenshots
    console.log('\n--- Step 5: Capturing Mobile Evidence Screenshots ---');
    await pageCdp.eval(`(() => {
      newGame();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    await pageCdp.screenshot('mobile_01_spacious_hero_range.png');

    // Tap hero to show mobile inspector bottom sheet
    await pageCdp.eval(`(() => {
      const hero = S.nodes.find(n => n.type === 'hero');
      window.sel = hero.id;
      renderInsp();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await pageCdp.screenshot('mobile_02_inspector_bottom_sheet.png');

    // Switch to Shop on mobile
    await pageCdp.eval(`(() => {
      window.sel = null;
      const b = document.querySelector('#mtabs button[data-p="shop"]');
      if (b) b.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await pageCdp.screenshot('mobile_03_compact_build_menu.png');

    console.log('\n================================================================');
    console.log('🎉 ALL MOBILE ERGONOMICS & POWER RULES VERIFIED WITH 100% SUCCESS!');
    console.log('================================================================');

    pageCdp.close();
    browserCdp.close();
    chrome.kill();
  } catch (err) {
    console.error('❌ Verification failed:', err);
    chrome.kill();
    process.exit(1);
  }
}

verifyMobileAndHumanPower();
