const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKSPACE_DIR = '/Users/antigravity/Desktop/pdf変換/node-quest';
const RESULTS_DIR = path.join(WORKSPACE_DIR, 'test_results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

// Lightweight DOM & SVG emulator for running index.html in Node.js sandbox
class MockElement {
  constructor(tagName = 'DIV') {
    this.tagName = String(tagName).toUpperCase();
    this.id = '';
    this.className = '';
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {
      setProperty: (k, v) => { this.style[k] = v; },
      getPropertyValue: (k) => this.style[k] || ''
    };
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.clientWidth = 1200;
    this.clientHeight = 800;
    this._innerHTML = '';
    this._textContent = '';
    this.isConnected = true;
    this.classList = {
      _set: new Set(),
      add: (...cls) => { cls.forEach(c => c && this.classList._set.add(c)); this._syncClass(); },
      remove: (...cls) => { cls.forEach(c => this.classList._set.delete(c)); this._syncClass(); },
      toggle: (c, force) => {
        const on = force !== undefined ? !!force : !this.classList._set.has(c);
        if (on) this.classList._set.add(c); else this.classList._set.delete(c);
        this._syncClass();
        return on;
      },
      contains: (c) => this.classList._set.has(c)
    };
  }
  _syncClass() {
    this.className = [...this.classList._set].join(' ');
  }
  set innerHTML(val) {
    this._innerHTML = String(val || '');
    this.children = [];
    this._parseSimpleChildren(this._innerHTML);
  }
  get innerHTML() {
    return this._innerHTML;
  }
  set textContent(val) {
    this._textContent = String(val ?? '');
    this._innerHTML = this._textContent;
  }
  get textContent() {
    return this._textContent || this._innerHTML.replace(/<[^>]+>/g, '');
  }
  _parseSimpleChildren(html) {
    // Parse elements with class/id/data- attributes so querySelector / querySelectorAll work on generated HTML
    const tagRe = /<([a-zA-Z0-9]+)\s*([^>]*?)>/g;
    let m;
    while ((m = tagRe.exec(html)) !== null) {
      const tag = m[1];
      const attrs = m[2] || '';
      const child = new MockElement(tag);
      const idM = /\bid=["']([^"']+)["']/.exec(attrs);
      if (idM) {
        child.id = idM[1];
        if (global.__idMap) global.__idMap.set(child.id, child);
      }
      const clsM = /\bclass=["']([^"']+)["']/.exec(attrs);
      if (clsM) {
        clsM[1].split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
      }
      const srcM = /\bsrc=["']([^"']+)["']/.exec(attrs);
      if (srcM) child.setAttribute('src', srcM[1]);
      const hrefM = /\bhref=["']([^"']+)["']/.exec(attrs);
      if (hrefM) child.setAttribute('href', hrefM[1]);
      const dataRe = /\bdata-([a-z0-9-]+)=["']([^"']*?)["']/gi;
      let dm;
      while ((dm = dataRe.exec(attrs)) !== null) {
        const camel = dm[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        child.dataset[camel] = dm[2];
        child.setAttribute('data-' + dm[1], dm[2]);
      }
      if (/\bdisabled\b/.test(attrs)) child.disabled = true;
      if (/\bhidden\b/.test(attrs)) child.hidden = true;
      const prev = this.children[this.children.length - 1];
      if (tag.toLowerCase() === 'i' && prev && prev.classList.contains('bar')) {
        prev.appendChild(child);
      }
      child.parentNode = this;
      this.children.push(child);
    }
    // Extract text inside .eng-stack-val if present
    const valM = /<div class="eng-stack-val"[^>]*>([^<]+)<\/div>/.exec(html);
    if (valM) {
      const valEl = this.children.find(c => c.classList.contains('eng-stack-val'));
      if (valEl) valEl.textContent = valM[1];
    }
  }
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k === 'id') { this.id = String(v); if (global.__idMap) global.__idMap.set(this.id, this); }
    if (k === 'class') {
      this.classList._set.clear();
      String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList._set.add(c));
      this._syncClass();
    }
  }
  getAttribute(k) {
    return this.attributes.has(k) ? this.attributes.get(k) : null;
  }
  appendChild(ch) {
    if (!ch) return ch;
    ch.parentNode = this;
    this.children.push(ch);
    return ch;
  }
  append(...nodes) {
    nodes.forEach(n => { if (n && typeof n === 'object') this.appendChild(n); });
  }
  insertBefore(newNode, refNode) {
    if (!newNode) return newNode;
    newNode.parentNode = this;
    const i = this.children.indexOf(refNode);
    if (i >= 0) this.children.splice(i, 0, newNode);
    else this.children.unshift(newNode);
    return newNode;
  }
  remove() {
    if (this.parentNode) {
      const i = this.parentNode.children.indexOf(this);
      if (i >= 0) this.parentNode.children.splice(i, 1);
    }
  }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 }; }
  matches(sel) {
    const s = sel.trim();
    if (s.startsWith('#')) return this.id === s.slice(1);
    if (s.startsWith('.')) {
      const classes = s.split('.').filter(Boolean);
      return classes.every(c => this.classList.contains(c));
    }
    const tagCls = /^([a-zA-Z0-9]+)\.([a-zA-Z0-9_-]+)$/.exec(s);
    if (tagCls) return this.tagName === tagCls[1].toUpperCase() && this.classList.contains(tagCls[2]);
    const attrM = /^\[data-([a-z0-9-]+)(?:=["']?([^"'\]]+)["']?)?\]$/i.exec(s);
    if (attrM) {
      const camel = attrM[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (attrM[2] !== undefined) return String(this.dataset[camel]) === attrM[2];
      return camel in this.dataset;
    }
    return this.tagName === s.toUpperCase();
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/);
    const collect = (root, pred) => {
      let out = [];
      for (const ch of root.children) {
        if (pred(ch)) out.push(ch);
        out = out.concat(collect(ch, pred));
      }
      return out;
    };
    let current = [this];
    for (const part of parts) {
      let next = [];
      for (const node of current) {
        next = next.concat(collect(node, el => el.matches(part)));
      }
      current = [...new Set(next)];
    }
    return current;
  }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (cur.matches && cur.matches(sel)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  get firstChild() { return this.children[0] || null; }
  get childNodes() { return this.children; }
}

function runVerification() {
  console.log('================================================================');
  console.log('🏦⚡🏰 ENERGY VISUALS, VAULT, STACKING & DUNGEON CONTRAPTIONS TEST');
  console.log('================================================================\n');

  const htmlPath = path.join(WORKSPACE_DIR, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract all IDs from HTML and pre-populate Mock DOM
  const idMap = new Map();
  global.__idMap = idMap;
  const body = new MockElement('BODY');
  body._parseSimpleChildren(html);

  const scriptMatch = /<script>([\s\S]*?)<\/script>\s*<\/body>/i.exec(html);
  if (!scriptMatch) throw new Error('Could not find main <script> in index.html');
  const scriptCode = scriptMatch[1];

  const storage = new Map();
  const sandbox = {
    window: null,
    document: {
      body,
      hidden: false,
      createElement: (tag) => new MockElement(tag),
      createElementNS: (ns, tag) => new MockElement(tag),
      getElementById: (id) => sandbox.document.querySelector('#' + id),
      querySelector: (sel) => {
        if (/^#[\w-]+$/.test(sel)) {
          const id = sel.slice(1);
          if (!idMap.has(id)) {
            const el = new MockElement('DIV');
            el.id = id;
            idMap.set(id, el);
            body.appendChild(el);
          }
          return idMap.get(id);
        }
        return body.querySelector(sel) || new MockElement('DIV');
      },
      querySelectorAll: (sel) => body.querySelectorAll(sel),
      addEventListener: () => {},
      execCommand: () => true
    },
    localStorage: {
      getItem: (k) => storage.has(k) ? storage.get(k) : null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear()
    },
    location: { search: '?debug=1', reload: () => {} },
    navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => Date.now() },
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: () => 1,
    setTimeout: (fn) => 1,
    clearTimeout: () => {},
    confirm: () => true,
    alert: () => {},
    console,
    Math, JSON, Object, Array, Set, Map, Number, String, Boolean, RegExp, Date, Error, Infinity, NaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent
  };
  sandbox.window = sandbox;
  sandbox.window.innerWidth = 1440;
  sandbox.window.innerHeight = 900;

  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox, { filename: 'index.html' });

  const testResults = [];
  function assert(name, condition, expected, actual, metric = '') {
    const pass = !!condition;
    testResults.push({ name, pass, expected, actual, metric });
    const status = pass ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} | ${name}: expected [${expected}], got [${actual}] ${metric}`);
    if (!pass) console.error(`    ↳ Assertion Failed: ${name}`);
  }

  // =========================================================================
  // STEP 1: Distinct Custom Visual Images for Every Energy Type
  // =========================================================================
  console.log('\n--- [STEP 1] Distinct Visual Images for Universal, Electric, Gold & Other Energies ---');
  const step1 = vm.runInContext(`(() => {
    localStorage.clear();
    newGame();
    const kinds = ['anima', 'elec', 'gold', 'power', 'nfl', 'tac', 'exs', 'exi', 'exv'];
    const iconUrls = {};
    const layerUrls = {};
    for(const k of kinds){
      iconUrls[k] = getEnergySvgUrl(k);
      layerUrls[k] = getEnergyLayerSvgUrl(k);
    }
    const uniqueIcons = new Set(Object.values(iconUrls)).size;
    const uniqueLayers = new Set(Object.values(layerUrls)).size;

    const hero = S.nodes.find(n => n.type === 'hero');
    const vault = S.nodes.find(n => n.type === 'vault1') || addNode('vault1', 500, 150);
    const cgen = addNode('cgen1', 80, 320);
    const eng  = addNode('engine1', 290, 320);
    render(0.016);

    const heroSlotHtml  = energySlotIconHtml('sta', hero, 'out');
    const cgenSlotHtml  = energySlotIconHtml('sta', cgen, 'out');
    const vaultSlotHtml = energySlotIconHtml('gold', vault, 'out');
    const engSlotHtml   = energySlotIconHtml('tac', eng, 'out');

    return {
      totalKinds: kinds.length,
      uniqueIcons,
      uniqueLayers,
      animaNeqElec: iconUrls.anima !== iconUrls.elec,
      elecNeqGold:  iconUrls.elec !== iconUrls.gold,
      goldNeqPower: iconUrls.gold !== iconUrls.power,
      slotHtmlsAllDistinct: new Set([heroSlotHtml, cgenSlotHtml, vaultSlotHtml, engSlotHtml]).size === 4
    };
  })()`, sandbox);

  assert('All 9 energy types have unique SVG icon images', step1.uniqueIcons === 9, 9, step1.uniqueIcons);
  assert('All 9 energy types have unique 3D stack layer SVG images', step1.uniqueLayers === 9, 9, step1.uniqueLayers);
  assert('Universal Anima energy image !== Electric energy image', step1.animaNeqElec, true, step1.animaNeqElec);
  assert('Electric energy image !== Gold energy image', step1.elecNeqGold, true, step1.elecNeqGold);
  assert('Node slots render distinct custom SVG <img> for Anima, Elec, Gold, and Tac', step1.slotHtmlsAllDistinct, true, step1.slotHtmlsAllDistinct);

  // =========================================================================
  // STEP 2: Visual Energy Stacking on Top of Nodes
  // =========================================================================
  console.log('\n--- [STEP 2] Visual Energy Stacking on Top of Nodes ---');
  const step2 = vm.runInContext(`(() => {
    const hero  = S.nodes.find(n => n.type === 'hero');
    const vault = S.nodes.find(n => n.type === 'vault1');
    const cgen  = S.nodes.find(n => n.type === 'cgen1');
    const eng   = S.nodes.find(n => n.type === 'engine1');

    // Low energy state
    hero.outBuf.sta = 2;
    vault.vaultGold = 30;
    vault.outBuf.gold = 2;
    cgen.outBuf.sta = 3;
    eng.outBuf.tac = 2;
    render(0.016);

    const countLayers = (el) => (el.innerHTML.match(/class="eng-layer-img"/g) || []).length;
    const countCols   = (el) => (el.innerHTML.match(/class="eng-stack-col"/g) || []).length;

    const heroLayersLow  = countLayers(hero.el.engStack);
    const vaultLayersLow = countLayers(vault.el.engStack);

    // High accumulated energy state
    hero.outBuf.sta = 18;
    vault.vaultGold = 900;
    vault.inBuf.gold = 45;
    vault.outBuf.gold = 25;
    cgen.outBuf.sta = 35;
    cgen.outBuf.power = 12;
    eng.outBuf.tac = 28;
    eng._tacPower = 40;
    render(0.016);

    const heroLayersHigh  = countLayers(hero.el.engStack);
    const vaultLayersHigh = countLayers(vault.el.engStack);
    const cgenCols        = countCols(cgen.el.engStack);
    const valMatch        = /<div class="eng-stack-val"[^>]*>([^<]+)<\\/div>/.exec(vault.el.engStack.innerHTML);
    const vaultValText    = valMatch ? valMatch[1] : '';

    return {
      heroLayersLow,
      heroLayersHigh,
      vaultLayersLow,
      vaultLayersHigh,
      cgenCols,
      vaultValText
    };
  })()`, sandbox);

  assert('Hero node energy stack grows as Anima accumulates', step2.heroLayersHigh > step2.heroLayersLow, `>${step2.heroLayersLow}`, step2.heroLayersHigh, 'layers');
  assert('Vault node Gold stack grows to max layers as Gold accumulates', step2.vaultLayersHigh > step2.vaultLayersLow && step2.vaultLayersHigh >= 6, `>${step2.vaultLayersLow}`, step2.vaultLayersHigh, 'layers');
  assert('Generator node stacks multiple energy columns (Elec + High-Voltage Power)', step2.cgenCols >= 2, '>=2', step2.cgenCols, 'columns');
  assert('Energy stack badge shows formatted accumulated value', step2.vaultValText.length > 0, 'non-empty', step2.vaultValText);

  // =========================================================================
  // STEP 3: Gold as Energy & Vault Facility (Storage, Interest, Routing, Discount)
  // =========================================================================
  console.log('\n--- [STEP 3] Gold as Energy & Vault Facility Mechanics ---');
  const step3 = vm.runInContext(`(() => {
    const comp = generateCompanion('standard');
    comp.basePay = 20;
    comp.affection = 0;
    comp.traits = [];
    S.companionRoster.push(comp);

    const vault = S.nodes.find(n => n.type === 'vault1');
    const mateNode = deployCompanion(comp.id, 1800, 1200);
    const payFar = payOf(mateNode);

    mateNode.x = vault.x + 80;
    mateNode.y = vault.y;
    const payNear = payOf(mateNode);

    const goldBefore = S.gold;
    vault.vaultGold = 500;
    vault.inBuf.gold = 20;
    vault.outBuf.gold = 0;

    const tavern = addNode('tavern1', vault.x + 220, vault.y - 120);
    const fund   = addNode('fund1',   vault.x + 220, vault.y + 20);
    const hero   = S.nodes.find(n => n.type === 'hero');
    addLink(hero.id, 'sta', fund.id);

    const tavernStaBase = outsOf(tavern).sta;
    const lkTavern = addLink(vault.id, 'gold', tavern.id);
    const lkFund   = addLink(vault.id, 'gold', fund.id);
    const tavernStaWithGold = outsOf(tavern).sta;

    const rpBefore = S.rp;
    for(let i = 0; i < 20; i++) tick(0.5, false);
    render(0.016);

    const rpAfter = S.rp;
    const goldAfter = S.gold;
    const hasGoldPacketOrBoost = (tavern._goldBoostT || 0) > 0 || (tavern.inBuf.gold || 0) > 0 || lkTavern.packets.length > 0;

    return {
      payFar,
      payNear,
      discountWorked: payNear < payFar,
      tavernStaBase,
      tavernStaWithGold,
      tavernDoubled: tavernStaWithGold >= tavernStaBase * 2,
      rpGained: rpAfter - rpBefore,
      goldDelta: goldAfter - goldBefore,
      hasGoldPacketOrBoost
    };
  })()`, sandbox);

  assert('Vault Wealth Aura reduces nearby companion wages by ~35%', step3.discountWorked, `< ${step3.payFar}`, step3.payNear, 'G');
  assert('Supplying Gold energy to Tavern doubles its Anima output', step3.tavernDoubled, `${step3.tavernStaBase * 2}`, step3.tavernStaWithGold);
  assert('Vault compound interest & Gold routing increase Gold & RP', step3.goldDelta > 0 && step3.rpGained > 0, 'goldDelta>0 & rpGained>0', `+${step3.goldDelta}G, +${step3.rpGained.toFixed(1)}RP`);
  assert('Gold packets flow along links and activate target node Gold boost', step3.hasGoldPacketOrBoost, true, step3.hasGoldPacketOrBoost);

  // =========================================================================
  // STEP 4: Strategic Dungeon Stances, Tactical Barriers & Contraptions
  // =========================================================================
  console.log('\n--- [STEP 4] Strategic Dungeon Stances, Barriers & Modular Contraptions ---');
  const step4 = vm.runInContext(`(() => {
    spawnEnemy();
    render(0.016);
    const enemyHasShield = (S.enemy.maxShield || 0) > 0 && (S.enemy.shield || 0) > 0;
    const shieldRowVisible = !$('#eShieldRow').hidden;

    setDungeonStance('analyze');
    const stanceAnalyze = S.dungeonStance;
    setDungeonStance('plunder');
    const stancePlunder = S.dungeonStance;
    setDungeonStance('assault');
    const stanceAssault = S.dungeonStance;

    const dive  = S.nodes.find(n => n.type === 'dive1');
    const eng   = S.nodes.find(n => n.type === 'engine1') || addNode('engine1', 290, 320);
    const smelt = addNode('smelt1', 80, 470);
    const forge = addNode('forge1', 290, 470);

    autoWireContraption();
    for(let i = 0; i < 10; i++) tick(0.5, false);
    const evalRes = evaluateDungeonContraptions();
    frameN = 0;
    render(0.016);

    S.enemy.shield = 50000;
    S.enemy.maxShield = 50000;
    S.enemy.hp = 50000;
    S.enemy.max = 50000;
    const shdBefore = S.enemy.shield;
    const hpBefore  = S.enemy.hp;
    doDive(false, dive, false);
    const shdAfter = S.enemy.shield;
    const hpAfter  = S.enemy.hp;

    const contraptionHtml = $('#dgnContraptionList').innerHTML;
    const contraptionChips = (contraptionHtml.match(/cnt-chip/g) || []).length;

    return {
      enemyHasShield,
      shieldRowVisible,
      stanceAnalyze,
      stancePlunder,
      stanceAssault,
      activeContraptionCount: evalRes.list.length,
      activeContraptionNames: evalRes.list.map(c => c.n),
      atkMul: evalRes.atkMul,
      shdMul: evalRes.shieldBreak,
      shdBrokenOrReduced: shdAfter < shdBefore || S.enemy.shieldBroken,
      hpReduced: hpAfter < hpBefore,
      contraptionChips
    };
  })()`, sandbox);

  assert('Dungeon enemies spawn with Tactical Barrier (Shield > 0) and visible UI bar', step4.enemyHasShield && step4.shieldRowVisible, true, `${step4.enemyHasShield} / UI:${step4.shieldRowVisible}`);
  assert('Tactical Stances (Analyze / Plunder / Assault) switch cleanly', step4.stanceAnalyze === 'analyze' && step4.stancePlunder === 'plunder' && step4.stanceAssault === 'assault', 'analyze/plunder/assault', `${step4.stanceAnalyze}/${step4.stancePlunder}/${step4.stanceAssault}`);
  assert('Node combinations assemble >= 2 Active Contraptions via Engine Core', step4.activeContraptionCount >= 2, '>=2', `${step4.activeContraptionCount} (${step4.activeContraptionNames.join(', ')})`);
  assert('Active Contraptions boost Dungeon ATK & Shield-Break multipliers', step4.atkMul > 1.5 && step4.shdMul > 1.5, 'atkMul>1.5 & shdMul>1.5', `atk×${step4.atkMul.toFixed(2)}, shd×${step4.shdMul.toFixed(2)}`);
  assert('Contraption-assisted attack damages enemy Tactical Barrier & HP', step4.shdBrokenOrReduced && step4.hpReduced, true, `shdReduced:${step4.shdBrokenOrReduced}, hpReduced:${step4.hpReduced}`);
  assert('Sidebar Contraption Box renders active contraption chips', step4.contraptionChips >= 2, '>=2', step4.contraptionChips);

  // =========================================================================
  // STEP 5: Backward Compatibility Check (Hero Folding, Tavern Gacha, Companion Wages)
  // =========================================================================
  console.log('\n--- [STEP 5] Backward Compatibility Check (Hero Folding & Tavern Gacha) ---');
  const step5 = vm.runInContext(`(() => {
    localStorage.clear();
    newGame();
    const hero = S.nodes.find(n => n.type === 'hero');
    const heroInKeysInitial = inKeys(hero);
    const tstr = addNode('tstr1', hero.x - 180, hero.y);
    const lk = addLink(tstr.id, 'exs', hero.id);
    const heroInKeysLinked = inKeys(hero);
    removeLink(lk.id);
    const heroInKeysRestored = inKeys(hero);

    // Tutorial gacha trigger on cave1 clear
    S.caveId = 'cave1';
    S.caveFloor = 10;
    spawnEnemy();
    S.enemy.shield = 0;
    S.enemy.hp = 1;
    doDive(false, S.nodes.find(n => n.type === 'dive1'), true);
    const hasGaragari = (S.companionRoster || []).some(c => c.id === 'comp_garagary');

    return {
      heroFoldedOk: heroInKeysInitial.length === 0 && heroInKeysLinked.includes('exs') && heroInKeysRestored.length === 0,
      hasGaragari,
      tavernUnlocked: !!(S.dev && S.dev.tavern1) && !!S.tutorialGachaAvailable
    };
  })()`, sandbox);

  assert('Hero soft input ports fold when unlinked and expand when linked', step5.heroFoldedOk, true, step5.heroFoldedOk);
  assert('Clearing Cave 1 triggers Tutorial Gacha & recruits Garagari', step5.hasGaragari && step5.tavernUnlocked, true, `Garagari:${step5.hasGaragari}, Tavern:${step5.tavernUnlocked}`);

  console.log('\n================================================================');
  const passed = testResults.filter(t => t.pass).length;
  const failed = testResults.length - passed;
  console.log(`📊 SUMMARY: ${passed}/${testResults.length} PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'energy_vault_contraptions_report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), passed, failed, tests: testResults }, null, 2)
  );

  if (failed > 0) process.exit(1);
}

runVerification();
