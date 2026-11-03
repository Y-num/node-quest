const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTML_PATH = '/Users/antigravity/Desktop/pdf変換/node-quest/index.html';
const OUT_DIR = '/Users/antigravity/.gemini/antigravity/brain/1f7be53d-d7da-40e6-8063-b83d499511b7/scratch';

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
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error('Eval exception: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
    }
    return res.result ? res.result.value : undefined;
  }
  close() { this.ws.close(); }
}

async function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const port = 9555;
  const userDataDir = path.join(OUT_DIR, 'chrome_profile_' + Date.now());
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  proc.stderr.on('data', () => {});
  proc.stdout.on('data', () => {});

  const cleanExit = () => {
    try { proc.kill('SIGKILL'); } catch(_) {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch(_) {}
  };
  process.on('exit', cleanExit);
  process.on('SIGINT', () => { cleanExit(); process.exit(1); });

  console.log('Connecting to Chrome on port', port);
  let targets = null;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await getJson(`http://127.0.0.1:${port}/json`);
      if (targets && targets.length) break;
    } catch (_) {}
    await sleep(200);
  }
  if (!targets || !targets.length) throw new Error('Failed to connect to Chrome targets');

  const pageTarget = targets.find(t => t.type === 'page');
  const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
  await cdp.ready();
  console.log('CDP connected to page target');

  const pageErrors = [];
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      pageErrors.push(params.args.map(a => a.value || a.description).join(' '));
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });

  const fileUrl = 'file://' + path.resolve(HTML_PATH);
  console.log('Navigating to', fileUrl);
  await cdp.send('Page.navigate', { url: fileUrl });
  await sleep(2000);

  const testReport = {
    timestamp: new Date().toISOString(),
    tests: [],
    errors: []
  };

  function record(name, pass, details = {}) {
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}`, details);
    testReport.tests.push({ name, pass, details });
    if (!pass) testReport.errors.push({ name, details });
  }

  try {
    // 1. Initial State & No Softlock
    const initInfo = await cdp.eval(`(() => {
      const hero = S.nodes.find(n => n.type === 'hero');
      const dive = S.nodes.find(n => n.type === 'dive1' || TYPES[n.type]?.effect === 'dive');
      const dist = Math.hypot((hero.x - dive.x), (hero.y - dive.y));
      const range = humanRangeOf(hero);
      const link = S.links.find(l => l.from === hero.id && l.to === dive.id && l.item === 'sta');
      const pillTxt = document.getElementById('mPillTxt')?.textContent || '';
      return {
        heroX: hero.x,
        diveX: dive.x,
        dist,
        range,
        hasLink: !!link,
        diveStall: dive.stall,
        pillTxt
      };
    })()`);
    record('Initial Hero powers Dive within range', initInfo.dist <= initInfo.range && initInfo.hasLink, initInfo);

    // 2. Node '+' More Button opens Inspector
    const moreBtnTest = await cdp.eval(`(() => {
      const dive = S.nodes.find(n => TYPES[n.type]?.effect === 'dive');
      const moreBtn = dive.el.root.querySelector('.node-more-btn');
      if (!moreBtn) return { hasMoreBtn: false };
      moreBtn.click();
      const isInspectorOn = document.getElementById('insp')?.classList.contains('on');
      const selectedId = sel;
      return { hasMoreBtn: true, isInspectorOn, selectedId, targetId: dive.id };
    })()`);
    record('Node + button opens inspector drawer', moreBtnTest.hasMoreBtn && moreBtnTest.isInspectorOn && moreBtnTest.selectedId === moreBtnTest.targetId, moreBtnTest);

    // 3. Smart Cable Wiring Mode
    const smartWiringTest = await cdp.eval(`(() => {
      const hero = S.nodes.find(n => n.type === 'hero');
      // Add an unconnected target facility (cgen) to receive sta
      const targetCgen = addNode('cgen', 220, 80);
      startSmartWiring(hero.id, 'sta');
      const hud = document.getElementById('smartCableHud');
      const hudOn = hud && hud.classList.contains('on');
      const hudTxt = document.getElementById('smartCableTxt')?.textContent || '';
      const cands = document.querySelectorAll('.node.tgt-candidate').length;
      clearSmartWiring();
      const hudAfter = hud && hud.classList.contains('on');
      const candsAfter = document.querySelectorAll('.node.tgt-candidate').length;
      removeNode(targetCgen.id);
      return { hudOn, hudTxt, cands, hudAfter, candsAfter };
    })()`);
    record('Smart Wiring activates HUD & candidate glow then clears cleanly', smartWiringTest.hudOn && smartWiringTest.cands > 0 && !smartWiringTest.hudAfter && smartWiringTest.candsAfter === 0, smartWiringTest);

    // 4. Power Stratification: cgen (人力発電機), wood (木こり小屋), gen (火力発電機)
    const powerChainTest = await cdp.eval(`(() => {
      // Free gold and unlock types for test
      S.gold += 10000;
      S.stock += 500;
      S.dev.cgen = 1;
      S.dev.wood = 1;
      S.dev.gen = 1;
      S.dev.smelt = 1;
      S.dev.mine = 1;

      const hero = S.nodes.find(n => n.type === 'hero');

      // Place cgen at x:180, y:80 (within human range)
      const cgen = addNode('cgen', 180, 80);
      addLink(hero.id, 'sta', cgen.id);

      // Place woodcutter at x:180, y:220 (within human range)
      const wood = addNode('wood', 180, 220);
      addLink(hero.id, 'sta', wood.id);

      // Place gen at x:450, y:220
      const gen = addNode('gen', 450, 220);
      addLink(wood.id, 'wood', gen.id);

      // Verify TYPES ins/outs
      const cgenType = TYPES.cgen;
      const woodType = TYPES.wood;
      const genType = TYPES.gen;

      // Distance test: Place distant factory (x: 1000, y: 100)
      const distantSmelt = addNode('smelt', 1000, 100);
      addLink(gen.id, 'sta', distantSmelt.id); // Machine power wire distance unlimited!
      const farDist = Math.hypot((gen.x - distantSmelt.x), (gen.y - distantSmelt.y));

      // Incompatibility test: Connect gen to dive node
      const dive = S.nodes.find(n => TYPES[n.type]?.effect === 'dive');
      addLink(gen.id, 'sta', dive.id);
      // Run tick for a few frames
      tick(0.5, false);

      const diveIncompatible = dive._incompatiblePower || (dive.stall && dive.why && dive.why.includes('Incompatible'));
      const distantStallFar = distantSmelt.why && distantSmelt.why.includes('範囲外');

      return {
        cgenIns: cgenType.ins,
        cgenOuts: cgenType.outs,
        woodIns: woodType.ins,
        woodOuts: woodType.outs,
        genIns: genType.ins,
        genOuts: genType.outs,
        farDist,
        distantStallFar: !!distantStallFar,
        diveIncompatible: !!diveIncompatible,
        diveWhy: dive.why
      };
    })()`);
    record('Power stratification (cgen, wood, gen, distance unlimited, dungeon blocked from machine)', 
      powerChainTest.cgenIns.sta === 2 && powerChainTest.cgenOuts.sta === 8 &&
      powerChainTest.woodIns.sta === 2 && powerChainTest.woodOuts.wood === 2 &&
      powerChainTest.genIns.wood === 1 && powerChainTest.genOuts.sta === 14 &&
      !powerChainTest.distantStallFar && powerChainTest.diveIncompatible,
      powerChainTest
    );

    // 5. Milestone Check & Claim System
    const milestoneTest = await cdp.eval(`(() => {
      checkMilestones();
      const m1 = MILESTONES.find(m => m.id === 'm1_anima');
      const m1Met = m1.check();
      const goldBefore = S.gold;
      claimMilestone('m1_anima');
      const goldAfter = S.gold;
      const isClaimed = !!S.claimedMilestones['m1_anima'];
      updateMilestonePill();
      const pillTxt = document.getElementById('mPillTxt')?.textContent || '';
      return {
        m1Met,
        goldGain: goldAfter - goldBefore,
        isClaimed,
        pillTxt
      };
    })()`);
    record('Milestones condition check, claiming rewards and updating pill',
      milestoneTest.m1Met && milestoneTest.goldGain === 150 && milestoneTest.isClaimed,
      milestoneTest
    );

    // 6. Codex Modal & Live Monitor & Camera Jump
    const codexTest = await cdp.eval(`(() => {
      toggleCodexModal(true, 'codex');
      const modal = document.getElementById('codexModal');
      const modalOn = modal && modal.classList.contains('on');
      const cardsCount = document.querySelectorAll('.cdx-card').length;

      // Switch to Monitor tab
      toggleCodexModal(true, 'monitor');
      const monitorRows = document.querySelectorAll('.cdx-table tbody tr').length;

      // Switch to Dash tab
      toggleCodexModal(true, 'dash');
      const hasDash = document.querySelector('#codexBody')?.textContent.includes('生体アニマ網');

      // Switch to Milestones tab
      toggleCodexModal(true, 'mile');
      const mileCards = document.querySelectorAll('.cdx-mile-card').length;

      // Test Camera Pan
      const hero = S.nodes.find(n => n.type === 'hero');
      panToNode(hero.id);
      const flash = hero.el.root.classList.contains('flash-focus');

      toggleCodexModal(false);

      return {
        modalOn,
        cardsCount,
        monitorRows,
        hasDash,
        mileCards,
        flash
      };
    })()`);
    record('Codex Modal (4 tabs: Codex, Monitor, Dash, Milestones) and PanToNode flash animation',
      codexTest.modalOn && codexTest.cardsCount > 10 && codexTest.monitorRows > 0 && codexTest.hasDash && codexTest.mileCards === 12 && codexTest.flash,
      codexTest
    );

    // 7. Mobile Viewport & Swipe Header
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(500);

    const mobileTest = await cdp.eval(`(() => {
      const top = document.getElementById('top');
      const cs = window.getComputedStyle(top);
      const isOverflowX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
      const scrollWidth = top.scrollWidth;
      const clientWidth = top.clientWidth;
      return {
        isOverflowX,
        scrollWidth,
        clientWidth,
        canScroll: scrollWidth > clientWidth
      };
    })()`);
    record('Mobile Header horizontal scrolling and responsive layout', mobileTest.isOverflowX && mobileTest.canScroll, mobileTest);

    // Capture Desktop Screenshot
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(500);
    const ss1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'verify_desktop_overview.png'), Buffer.from(ss1.data, 'base64'));

    // Open Codex Modal and capture
    await cdp.eval(`toggleCodexModal(true, 'codex')`);
    await sleep(300);
    const ss2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'verify_codex_glossary.png'), Buffer.from(ss2.data, 'base64'));

    await cdp.eval(`toggleCodexModal(true, 'monitor')`);
    await sleep(300);
    const ss3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'verify_codex_monitor.png'), Buffer.from(ss3.data, 'base64'));

    await cdp.eval(`toggleCodexModal(true, 'mile')`);
    await sleep(300);
    const ss4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'verify_codex_milestones.png'), Buffer.from(ss4.data, 'base64'));

    await cdp.eval(`toggleCodexModal(false)`);

    // Capture Mobile Screenshot
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(500);
    const ss5 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'verify_mobile_overview.png'), Buffer.from(ss5.data, 'base64'));

    console.log('Screenshots saved to scratch directory.');
  } finally {
    cdp.close();
    cleanExit();
  }

  const allPassed = testReport.errors.length === 0;
  console.log('\n========================================');
  console.log(`TEST RUN FINISHED: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  console.log(`Passed: ${testReport.tests.filter(t => t.pass).length} / ${testReport.tests.length}`);
  if (!allPassed) {
    console.error('Failed tests:', testReport.errors);
  }
  console.log('========================================');
  fs.writeFileSync(path.join(OUT_DIR, 'verification_report.json'), JSON.stringify(testReport, null, 2));
}

main().catch(err => {
  console.error('Fatal in test runner:', err);
  process.exit(1);
});
