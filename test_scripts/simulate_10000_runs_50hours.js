const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const WORKSPACE_DIR = '/Users/antigravity/Desktop/pdf変換/node-quest';
const RESULTS_DIR = path.join(WORKSPACE_DIR, 'test_results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

// MockElement providing minimal DOM/SVG operations needed by index.html
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
  }
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }
  getAttribute(k) {
    return this.attributes.get(k) || null;
  }
  removeAttribute(k) {
    this.attributes.delete(k);
  }
  appendChild(c) {
    c.parentNode = this;
    this.children.push(c);
    return c;
  }
  append(...nodes) {
    nodes.forEach(n => this.appendChild(n));
  }
  removeChild(c) {
    const idx = this.children.indexOf(c);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      c.parentNode = null;
    }
    return c;
  }
  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
  insertBefore(newChild, refChild) {
    newChild.parentNode = this;
    const idx = this.children.indexOf(refChild);
    if (idx !== -1) this.children.splice(idx, 0, newChild);
    else this.children.push(newChild);
    return newChild;
  }
  querySelector(sel) {
    if (!sel) return null;
    sel = sel.trim();
    if (sel.includes(' ')) {
      const parts = sel.split(/\s+/).filter(Boolean);
      let curr = this;
      for (const p of parts) {
        if (!curr) return null;
        curr = curr.querySelector(p);
      }
      return curr;
    }
    if (sel.startsWith('#')) {
      const targetId = sel.slice(1);
      const walk = (node) => {
        if (node.id === targetId) return node;
        for (const ch of node.children) {
          const res = walk(ch);
          if (res) return res;
        }
        return null;
      };
      return walk(this);
    }
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      const walk = (node) => {
        if (node.classList.contains(cls)) return node;
        for (const ch of node.children) {
          const res = walk(ch);
          if (res) return res;
        }
        return null;
      };
      return walk(this);
    }
    const tag = sel.toUpperCase();
    const walk = (node) => {
      if (node.tagName === tag) return node;
      for (const ch of node.children) {
        const res = walk(ch);
        if (res) return res;
      }
      return null;
    };
    return walk(this);
  }
  querySelectorAll(sel) {
    const list = [];
    if (!sel) return list;
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      const walk = (node) => {
        if (node.classList.contains(cls)) list.push(node);
        for (const ch of node.children) walk(ch);
      };
      walk(this);
    }
    return list;
  }
  closest(sel) {
    let curr = this;
    while (curr) {
      if (sel.startsWith('#') && curr.id === sel.slice(1)) return curr;
      if (sel.startsWith('.') && curr.classList.contains(sel.slice(1))) return curr;
      if (curr.tagName === sel.toUpperCase()) return curr;
      curr = curr.parentNode;
    }
    return null;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 };
  }
  focus() {}
  blur() {}
  click() {}
  scrollIntoView() {}
  addEventListener() {}
  removeEventListener() {}
}

const ARCHETYPES = [
  { id: 'standard', name: '標準バランス型 (Standard Balanced)', desc: 'Mine + Smelter + Forge + Dive + Vault' },
  { id: 'vault_wealth', name: '金庫蓄財・商業富豪型 (Vault Wealth & Commerce)', desc: 'Multi-Vault + Shop + Compound Interest' },
  { id: 'tavern_gacha', name: '酒場ギルド・仲間スウォーム型 (Tavern Guild & Gacha)', desc: 'Tavern Gacha + Wage System + High Affection' },
  { id: 'modular_contraption', name: '複合攻略装置・戦術コア特化型 (Modular Contraptions)', desc: 'Ballista + Stun Barrier + Turret' },
  { id: 'clean_energy', name: '自然エネルギー・アニマ特化型 (Clean Anima)', desc: 'Human Treadmill + Bio Altar + Pure Anima' },
  { id: 'thermal_industrial', name: '火力発電・過負荷工業ラッシュ型 (Thermal Rush)', desc: 'Thermal Gen + Heavy Industry + High Output' },
  { id: 'combat_forge', name: '武闘派・装備鍛造速攻型 (Combat Forge)', desc: 'Deep Dive + Equipment Crafting + Weapon Upgrades' },
  { id: 'scholar_tech', name: '学者・研究ツリー最速突破型 (Scholar Tech Tree)', desc: 'Lab Decomposition + Fast Era 2/3 Evolution' },
  { id: 'alchemy_reaction', name: '創発リアクション・錬金術型 (Emergent Alchemy)', desc: 'Quench + Supercharge + Catalyst Reactions' },
  { id: 'afk_idle', name: '長期放置・自動換金型 (Idle Investor)', desc: 'Vault Compounding + Auto-liquidation + AFK Defense' }
];

// =========================================================================
// WORKER THREAD LOGIC (Each runs 1 archetype = 1,000 runs)
// =========================================================================
if (!isMainThread) {
  const { archIndex, runsCount } = workerData;
  const arch = ARCHETYPES[archIndex];

  const htmlPath = path.join(WORKSPACE_DIR, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

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
      removeEventListener: () => {},
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
    getComputedStyle: () => ({ display: 'none' }),
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math, JSON, Object, Array, Set, Map, Number, String, Boolean, RegExp, Date, Error, Infinity, NaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent
  };
  sandbox.window = sandbox;
  sandbox.window.innerWidth = 1440;
  sandbox.window.innerHeight = 900;

  vm.createContext(sandbox);
  const vmScript = new vm.Script(scriptCode, { filename: 'index.html' });
  vmScript.runInContext(sandbox);

  const results = [];
  const bugReports = [];

  for (let r = 0; r < runsCount; r++) {
    const runId = archIndex * runsCount + r + 1;
    const seed = runId * 31 + archIndex * 1009;

    try {
      const runData = vm.runInContext(`(() => {
        localStorage.clear();
        newGame();
        S.tutDone = 1;
        tutFinish();

        const hero = S.nodes.find(n => n.type === 'hero');
        const dive = S.nodes.find(n => n.type === 'dive1' || (TYPES[n.type] && TYPES[n.type].effect === 'dive'));
        const vault = S.nodes.find(n => n.type === 'vault1');

        let sRnd = ${seed};
        const nextRnd = () => { sRnd = (sRnd * 1664525 + 1013904223) % 4294967296; return sRnd / 4294967296; };

        const archType = '${arch.id}';
        if (archType === 'standard') {
          const cgen = addNode('cgen1', 80, 280);
          const mine = addNode('mine1', 290, 280);
          const smelt = addNode('smelt1', 500, 280);
          const dump = addNode('dump1', 290, 420);
          dump.item = 'waste';
          addLink(hero.id, 'sta', cgen.id);
          addLink(cgen.id, 'sta', mine.id);
          addLink(cgen.id, 'sta', smelt.id);
          addLink(mine.id, 'ore1', smelt.id);
          addLink(mine.id, 'waste', dump.id);
          addLink(smelt.id, 'waste', dump.id);

        } else if (archType === 'vault_wealth') {
          const v2 = addNode('vault1', 500, 280);
          const sh = addNode('shop1', 700, 150);
          const sh2 = addNode('shop1', 700, 280);
          const cgen = addNode('cgen1', 80, 280);
          addLink(hero.id, 'sta', cgen.id);
          addLink(cgen.id, 'sta', sh.id);
          addLink(cgen.id, 'sta', sh2.id);
          if (vault) {
            vault.vaultGold = 200 + Math.floor(nextRnd() * 300);
            addLink(vault.id, 'gold', sh.id);
          }

        } else if (archType === 'tavern_gacha') {
          S.gold = 3500;
          const tav = addNode('tavern1', 290, 280);
          addLink(hero.id, 'sta', tav.id);
          if (typeof recruitTavernGaragari === 'function') recruitTavernGaragari();
          if (typeof rollTavernGacha === 'function') rollTavernGacha(4);

        } else if (archType === 'modular_contraption') {
          const tr = addNode('turret1', 290, 280);
          const mn = addNode('mine1', 290, 150);
          addLink(hero.id, 'sta', tr.id);
          addLink(hero.id, 'sta', mn.id);
          if (dive) addLink(tr.id, 'sta', dive.id);
          addLink(mn.id, 'ore1', tr.id);

        } else if (archType === 'clean_energy') {
          const tm = addNode('cgen1', 290, 280);
          const mn = addNode('mine1', 500, 280);
          const dp = addNode('dump1', 500, 420);
          dp.item = 'waste';
          addLink(hero.id, 'sta', tm.id);
          addLink(tm.id, 'sta', mn.id);
          addLink(mn.id, 'waste', dp.id);

        } else if (archType === 'thermal_industrial') {
          const wd = addNode('wood1', 180, 280);
          const th = addNode('gen1', 350, 280);
          const mn = addNode('mine1', 520, 280);
          const sm = addNode('smelt1', 700, 280);
          const dp = addNode('dump1', 520, 420);
          dp.item = 'waste';
          addLink(hero.id, 'sta', wd.id);
          addLink(wd.id, 'wood', th.id);
          addLink(th.id, 'sta', mn.id);
          addLink(th.id, 'sta', sm.id);
          addLink(mn.id, 'ore1', sm.id);
          addLink(th.id, 'waste', dp.id);
          addLink(mn.id, 'waste', dp.id);
          addLink(sm.id, 'waste', dp.id);

        } else if (archType === 'combat_forge') {
          const mn = addNode('mine1', 80, 280);
          const sm = addNode('smelt1', 290, 280);
          const fg = addNode('forge1', 500, 280);
          const eq = addNode('equip1', 700, 280);
          const dp = addNode('dump1', 290, 420);
          dp.item = 'waste';
          addLink(hero.id, 'sta', mn.id);
          addLink(hero.id, 'sta', sm.id);
          addLink(hero.id, 'sta', fg.id);
          addLink(hero.id, 'sta', eq.id);
          addLink(mn.id, 'ore1', sm.id);
          addLink(sm.id, 'ing1', fg.id);
          addLink(fg.id, 'prt1', eq.id);
          addLink(sm.id, 'ing1', eq.id);
          addLink(mn.id, 'waste', dp.id);
          addLink(sm.id, 'waste', dp.id);
          addLink(fg.id, 'waste', dp.id);
          addLink(eq.id, 'waste', dp.id);

        } else if (archType === 'scholar_tech') {
          const lb = addNode('lab1', 290, 280);
          const fn = addNode('fund1', 500, 280);
          addLink(hero.id, 'sta', lb.id);
          addLink(hero.id, 'sta', fn.id);
          if (vault) addLink(vault.id, 'gold', fn.id);

        } else if (archType === 'alchemy_reaction') {
          const sm = addNode('smelt1', 290, 280);
          const pu = addNode('purify1', 290, 150);
          const bx = addNode('box1', 500, 280);
          addLink(hero.id, 'sta', sm.id);
          addLink(hero.id, 'sta', pu.id);
          sm.inTags = { HEAT: 1, CRYO: 1 };
          sm._rxQuench = true;
          addLink(sm.id, 'qstl', bx.id);

        } else if (archType === 'afk_idle') {
          if (vault) vault.vaultGold = 500;
          const sh = addNode('shop1', 500, 150);
          addLink(hero.id, 'sta', sh.id);
        }

        if (S.stats) {
          S.stats.str = 2 + Math.floor(nextRnd() * 15);
          S.stats.int = 2 + Math.floor(nextRnd() * 15);
          S.stats.vit = 2 + Math.floor(nextRnd() * 15);
        }

        const sessions = [
          { activeTicks: 4, afkSec: 5400 },
          { activeTicks: 4, afkSec: 16200 },
          { activeTicks: 4, afkSec: 36000 },
          { activeTicks: 4, afkSec: 57600 },
          { activeTicks: 4, afkSec: 64800 },
        ];

        let totalExplosions = 0;
        let totalRepairs = 0;
        let deadlocksDetected = 0;

        for (let sIdx = 0; sIdx < sessions.length; sIdx++) {
          const sess = sessions[sIdx];

          for (let t = 0; t < sess.activeTicks; t++) {
            tick(2.0, true);
            if (S.floor < S.best) S.floor = S.best;
            const dNode = S.nodes.find(n => n.type === 'dive1' || (TYPES[n.type] && TYPES[n.type].effect === 'dive'));
            if (dNode && !dNode.stall) {
              doDive(false, dNode, true);
            }
          }

          if (S.rp >= 15 && (!S.dev || !S.dev.smelt1)) { S.dev = S.dev || {}; S.dev.smelt1 = 1; }
          if (S.rp >= 60 && S.dev && S.dev.smelt1 && !S.dev.forge1) { S.dev.forge1 = 1; }
          if (S.rp >= 120 && S.dev && S.dev.smelt1 && !S.dev.comp1) { S.dev.comp1 = 1; }
          if (S.rp >= 300 && S.dev && !S.dev.lab1) { S.dev.lab1 = 1; }
          if (S.rp >= 800 && S.dev && !S.dev.turret1) { S.dev.turret1 = 1; }
          if (S.rp >= 1500 && S.dev && !S.dev.altar1) { S.dev.altar1 = 1; }

          // Material Stock conversion from gold/production via lab
          if (S.gold >= 5000) {
            const stockGen = Math.min(6000, Math.floor(S.gold * 0.002));
            S.stock = (S.stock || 0) + stockGen;
          }

          // Era Evolution (Era 2: 18,000 RP + 800 Mat, Era 3: 650,000 RP + 25,000 Mat)
          if (S.era === 1 && S.rp >= 18000 && (S.stock || 0) >= 800) {
            S.era = 2;
            S.rp -= 18000;
            S.stock -= 800;
          } else if (S.era === 2 && S.rp >= 650000 && (S.stock || 0) >= 25000) {
            S.era = 3;
            S.rp -= 650000;
            S.stock -= 25000;
          }

          if ((archType === 'tavern_gacha' || S.gold >= 5000) && (!S.roster || S.roster.length < 5)) {
            const diceCount = (S.era >= 3) ? 6 : (S.era >= 2 ? 5 : 4);
            if (typeof rollTavernGacha === 'function' && S.gold >= 2000) {
              S.gold -= 500;
              rollTavernGacha(diceCount);
            }
          }

          if (S.stats) {
            const bonus = (S.era >= 3) ? 6 : (S.era >= 2 ? 3 : 1);
            S.stats.str = Math.min(150, (S.stats.str || 5) + bonus + Math.floor(nextRnd() * 2));
            S.stats.vit = Math.min(150, (S.stats.vit || 5) + bonus + Math.floor(nextRnd() * 2));
            S.stats.int = Math.min(150, (S.stats.int || 5) + bonus + Math.floor(nextRnd() * 2));
          }

          if (S.era >= 2 && !S.nodes.some(n => n.type === 'turret1') && S.gold >= 3000) {
            const tr = addNode('turret1', 700, 420);
            const dv = S.nodes.find(n => n.type === 'dive1');
            if (dv) addLink(tr.id, 'sta', dv.id);
          }

          if (S.best >= 10 && !isCaveUnlocked('cave2') && S.gold >= 500) {
            dispatchScout('cave2');
            S.caveClears = S.caveClears || {}; S.caveClears.cave1 = 1;
          }
          if (S.best >= 25 && isCaveUnlocked('cave2') && !isCaveUnlocked('cave3') && S.gold >= 2500) {
            dispatchScout('cave3');
            S.caveClears = S.caveClears || {}; S.caveClears.cave2 = 1;
          }
          if (S.best >= 50 && isCaveUnlocked('cave3') && !isCaveUnlocked('cave4') && S.gold >= 12000) {
            dispatchScout('cave4');
            S.caveClears = S.caveClears || {}; S.caveClears.cave3 = 1;
          }
          if (S.best >= 80 && isCaveUnlocked('cave4') && !isCaveUnlocked('cave5') && S.gold >= 60000) {
            dispatchScout('cave5');
            S.caveClears = S.caveClears || {}; S.caveClears.cave4 = 1;
          }
          if (S.best >= 120 && isCaveUnlocked('cave5') && !isCaveUnlocked('cave6') && S.gold >= 300000) {
            dispatchScout('cave6');
            S.caveClears = S.caveClears || {}; S.caveClears.cave5 = 1;
          }

          if (S.enemy && S.enemy.shield > 500) {
            setDungeonStance('analyze');
          } else if (S.gold < 1000) {
            setDungeonStance('plunder');
          } else {
            setDungeonStance('assault');
          }

          for (const nd of S.nodes) {
            if (nd.broken || (nd.hpDur !== undefined && nd.hpDur <= 0)) {
              totalRepairs++;
              nd.broken = false;
              nd.hpDur = 100;
              nd.stall = false;
              nd.why = '';
            }
            if (nd.pol >= 0.85) {
              totalExplosions++;
              nd.pol = 0.2;
            }
          }

          const counted = Math.min(offCapH() * 3600, sess.afkSec);
          if (counted > 5) {
            const effAway = counted * offRate();
            const gBefore = S.gold, rpBefore = S.rp;
            for (let t = 0; t < 4; t++) tick(2.0, true);
            const sampleTime = 8;
            const gRate = Math.max(0, (S.gold - gBefore) / sampleTime);
            const rRate = Math.max(0, (S.rp - rpBefore) / sampleTime);
            const remain = Math.max(0, effAway - sampleTime);
            S.gold += Math.floor(gRate * remain);
            S.rp += Math.floor(rRate * remain);

            for (const n of S.nodes) {
              const T = TYPES[n.type] || {};
              if (T.vault || T.line === 'vault') {
                const maxV = 50000 * Math.pow(4, (T.era || 1) - 1);
                const growth = (remain / 2.0) * Math.max(6, (10 + (n.vaultGold || 60) * 0.045) * lvPow(n.level));
                n.vaultGold = Math.min(maxV, Math.round((n.vaultGold || 60) + growth));
                S.gold += Math.round(n.vaultGold * 0.25);
              }
              if (n.hpDur !== undefined && n.hpDur <= 0) {
                n.hpDur = 50; n.broken = false; n.isOverrun = false; n.why = '';
              }
            }

            const dNode = S.nodes.find(n => n.type === 'dive1' || (TYPES[n.type] && TYPES[n.type].effect === 'dive'));
            if (dNode && !dNode.stall && S.lp > 0) {
              const pDmg = dmg();
              const contraptions = evaluateDungeonContraptions();
              const cMul = (contraptions && contraptions.atkMul) || 1.0;
              const totalDmg = pDmg * cMul;
              const maxF = Math.max(S.floor, Math.min(180, Math.floor(Math.log(Math.max(1, totalDmg * 15 / 35)) / Math.log(1.18))));
              if (maxF > S.floor) {
                const advance = Math.min(maxF - S.floor, Math.floor(remain / 400));
                S.floor += advance;
                if (S.floor > S.best) S.best = S.floor;
              }
            }

            if (S.roster && S.roster.length > 0) {
              for (const comp of S.roster) {
                const wage = Math.max(5, Math.floor(20 * (comp.level || 1)));
                if (S.gold >= wage * 10) {
                  S.gold -= wage * 5;
                  comp.isStrike = false;
                  comp.affection = Math.min(1000, (comp.affection || 100) + 15);
                } else {
                  comp.isStrike = true;
                  comp.affection = Math.max(0, (comp.affection || 100) - 25);
                }
              }
            }
          }

          const activeNodes = S.nodes.filter(n => !n.stall && !n.broken && !n.isStrike).length;
          if (activeNodes === 0 && S.gold <= 0) {
            deadlocksDetected++;
            S.gold += 50;
            for (const nd of S.nodes) { nd.stall = false; nd.why = ''; }
          }
        }

        const evalContraptions = evaluateDungeonContraptions();
        const activeContraptionCount = (evalContraptions && evalContraptions.list) ? evalContraptions.list.length : 0;
        const activeContraptionNames = (evalContraptions && evalContraptions.list) ? evalContraptions.list.map(c => c.n) : [];

        let totalActive = 0, totalStalled = 0, totalBroken = 0, totalStriking = 0;
        let totalVaultGold = 0;
        for (const n of S.nodes) {
          const T = TYPES[n.type] || {};
          if (T.vault || T.line === 'vault') totalVaultGold += (n.vaultGold || 0);
          if (n.broken) totalBroken++;
          else if (n.isStrike) totalStriking++;
          else if (n.stall) totalStalled++;
          else totalActive++;
        }

        const roster = S.roster || [];
        let strikingComps = 0;
        let sumAffection = 0;
        for (const c of roster) {
          if (c.isStrike) strikingComps++;
          sumAffection += (c.affection || 0);
        }
        const avgAffection = roster.length > 0 ? +(sumAffection / roster.length).toFixed(1) : 0;
        const clearedCavesCount = Object.keys(S.caveClears || {}).filter(k => (S.caveClears[k] || 0) > 0).length;

        const hasNaN = isNaN(S.gold) || isNaN(S.rp) || isNaN(S.floor) || isNaN(S.best) || isNaN(S.partyHp);
        const hasInfinity = !isFinite(S.gold) || !isFinite(S.rp) || !isFinite(S.floor) || !isFinite(S.best);

        return {
          runId: ${runId},
          archId: archType,
          seed: ${seed},
          gold: Math.floor(S.gold || 0),
          vaultGold: Math.floor(totalVaultGold),
          rp: Math.floor(S.rp || 0),
          stock: Math.floor(S.stock || 0),
          era: S.era || 1,
          finalFloor: S.floor || 1,
          maxFloor: S.best || 1,
          clearedCaves: clearedCavesCount,
          caveClears: Object.assign({}, S.caveClears || {}),
          nodeCount: S.nodes.length,
          activeNodes: totalActive,
          stalledNodes: totalStalled,
          brokenNodes: totalBroken,
          strikingNodes: totalStriking,
          companionCount: roster.length,
          strikingCompanions: strikingComps,
          avgAffection: avgAffection,
          activeContraptions: activeContraptionCount,
          contraptionNames: activeContraptionNames,
          stance: S.dungeonStance || 'assault',
          explosions: totalExplosions,
          repairs: totalRepairs,
          deadlocks: deadlocksDetected,
          hasGaragari: roster.some(c => c.isGaragari || c.id === 'comp_garagary'),
          hasNaN,
          hasInfinity
        };
      })()`, sandbox);

      if (runData) {
        if (runData.hasNaN || runData.hasInfinity) {
          bugReports.push({ runId, arch: arch.id, seed, issue: 'NaN or Infinity detected in state metrics', data: runData });
        }
        if (runData.deadlocks > 0) {
          bugReports.push({ runId, arch: arch.id, seed, issue: 'Resource Deadlock recovered during run', data: runData });
        }
        results.push(runData);
      }
    } catch (err) {
      bugReports.push({ runId, arch: arch.id, seed, error: err.message, stack: err.stack });
    }
  }

  parentPort.postMessage({ results, bugReports, archIndex });
  process.exit(0);
}

// =========================================================================
// MASTER THREAD LOGIC (Coordinates 10 Workers across 10 Archetypes)
// =========================================================================
async function runMaster() {
  console.log('================================================================');
  console.log('🌍 NODE QUEST: 10,000-RUN x 50-HOUR EXTENSIVE BALANCE SIMULATION');
  console.log('   Simulating 10,000 independent 50-hour lifetime gameplay runs');
  console.log('   Running on 10 parallel worker threads (1 per archetype)');
  console.log('================================================================\n');

  const TOTAL_RUNS = 10000;
  const RUNS_PER_ARCH = TOTAL_RUNS / ARCHETYPES.length; // 1,000 runs each
  const startTime = Date.now();

  const allResults = [];
  const allBugs = [];

  const promises = ARCHETYPES.map((arch, archIndex) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { archIndex, runsCount: RUNS_PER_ARCH }
      });
      worker.on('message', (msg) => {
        const { results, bugReports } = msg;
        allResults.push(...results);
        allBugs.push(...bugReports);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Worker Completed: ${arch.name.padEnd(35)}] +${results.length} runs in ${elapsed}s (Bugs: ${bugReports.length})`);
        resolve();
      });
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker for arch ${arch.id} exited with code ${code}`));
      });
    });
  });

  await Promise.all(promises);

  const elapsedTotal = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n================================================================');
  console.log(`🎉 10,000 RUNS (50h each) SIMULATION COMPLETE IN ${elapsedTotal}s!`);
  console.log('================================================================\n');

  function computeStats(arr, key) {
    if (!arr || arr.length === 0) return { min: 0, max: 0, avg: 0, median: 0, p10: 0, p90: 0, p99: 0 };
    const vals = arr.map(x => x[key] || 0).sort((a, b) => a - b);
    const min = vals[0];
    const max = vals[vals.length - 1];
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const median = vals[Math.floor(vals.length * 0.5)];
    const p10 = vals[Math.floor(vals.length * 0.1)];
    const p90 = vals[Math.floor(vals.length * 0.9)];
    const p99 = vals[Math.floor(vals.length * 0.99)];
    return { min, max, avg: +avg.toFixed(2), median, p10, p90, p99 };
  }

  const globalStats = {
    totalRuns: allResults.length,
    elapsedSeconds: +elapsedTotal,
    maxFloor: computeStats(allResults, 'maxFloor'),
    gold: computeStats(allResults, 'gold'),
    vaultGold: computeStats(allResults, 'vaultGold'),
    rp: computeStats(allResults, 'rp'),
    clearedCaves: computeStats(allResults, 'clearedCaves'),
    nodeCount: computeStats(allResults, 'nodeCount'),
    activeNodes: computeStats(allResults, 'activeNodes'),
    stalledNodes: computeStats(allResults, 'stalledNodes'),
    strikingNodes: computeStats(allResults, 'strikingNodes'),
    companionCount: computeStats(allResults, 'companionCount'),
    avgAffection: computeStats(allResults, 'avgAffection'),
    activeContraptions: computeStats(allResults, 'activeContraptions'),
    explosions: computeStats(allResults, 'explosions'),
    repairs: computeStats(allResults, 'repairs')
  };

  const eraDistribution = { era1: 0, era2: 0, era3: 0 };
  for (const r of allResults) {
    if (r.era === 1) eraDistribution.era1++;
    else if (r.era === 2) eraDistribution.era2++;
    else if (r.era >= 3) eraDistribution.era3++;
  }

  const archetypeStats = {};
  for (const arch of ARCHETYPES) {
    const subset = allResults.filter(r => r.archId === arch.id);
    archetypeStats[arch.id] = {
      name: arch.name,
      runs: subset.length,
      maxFloor: computeStats(subset, 'maxFloor'),
      gold: computeStats(subset, 'gold'),
      vaultGold: computeStats(subset, 'vaultGold'),
      rp: computeStats(subset, 'rp'),
      clearedCaves: computeStats(subset, 'clearedCaves'),
      activeContraptions: computeStats(subset, 'activeContraptions'),
      activeNodes: computeStats(subset, 'activeNodes'),
      stalledNodes: computeStats(subset, 'stalledNodes'),
      explosions: computeStats(subset, 'explosions')
    };
  }

  const finalReport = {
    generatedAt: new Date().toISOString(),
    totalRunsSimulated: TOTAL_RUNS,
    hoursPerRun: 50,
    totalSimulatedGameplayHours: TOTAL_RUNS * 50, // 500,000 hours
    elapsedSimulationSeconds: +elapsedTotal,
    globalStats,
    eraDistribution,
    archetypeStats,
    bugCount: allBugs.length,
    bugs: allBugs.slice(0, 50)
  };

  const reportPath = path.join(RESULTS_DIR, 'simulation_10000_runs_50hours_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
  console.log(`📊 Comprehensive analysis saved to ${reportPath}`);

  console.log('\n================================================================');
  console.log('📈 GLOBAL 10,000-RUN STATISTICAL HIGHLIGHTS (After 50h Gameplay)');
  console.log('================================================================');
  console.log(`• Max Reached Floor: Median ${globalStats.maxFloor.median}F (Avg ${globalStats.maxFloor.avg}F | P10: ${globalStats.maxFloor.p10}F ~ P90: ${globalStats.maxFloor.p90}F | Min: ${globalStats.maxFloor.min}F, Max: ${globalStats.maxFloor.max}F)`);
  console.log(`• Cleared Caves: Median ${globalStats.clearedCaves.median} Caves (Max: ${globalStats.clearedCaves.max} Caves)`);
  console.log(`• Gold (Pocket): Median ${globalStats.gold.median.toLocaleString()}G (Avg ${globalStats.gold.avg.toLocaleString()}G)`);
  console.log(`• Vault Gold (Stacked): Median ${globalStats.vaultGold.median.toLocaleString()}G (Max: ${globalStats.vaultGold.max.toLocaleString()}G)`);
  console.log(`• Research RP: Median ${globalStats.rp.median.toLocaleString()} RP (Max: ${globalStats.rp.max.toLocaleString()} RP)`);
  console.log(`• Era Distribution: Era 1: ${((eraDistribution.era1/TOTAL_RUNS)*100).toFixed(1)}% | Era 2: ${((eraDistribution.era2/TOTAL_RUNS)*100).toFixed(1)}% | Era 3: ${((eraDistribution.era3/TOTAL_RUNS)*100).toFixed(1)}%`);
  console.log(`• Factory Nodes: Avg ${globalStats.nodeCount.avg} nodes (Active: ${globalStats.activeNodes.avg}, Stalled: ${globalStats.stalledNodes.avg})`);
  console.log(`• Companions: Avg ${globalStats.companionCount.avg} companions (Avg Affection: ${globalStats.avgAffection.avg}/1000)`);
  console.log(`• Active Contraptions: Avg ${globalStats.activeContraptions.avg} devices simultaneously firing`);
  console.log(`• Bugs / Anomalies Detected: ${allBugs.length} (${((allBugs.length/TOTAL_RUNS)*100).toFixed(2)}%)`);
  console.log('================================================================\n');

  return finalReport;
}

if (isMainThread) {
  runMaster().catch(err => {
    console.error('Fatal master simulation error:', err);
    process.exit(1);
  });
}
