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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9239;
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

    const auditData = await cdp.eval(`
      (function() {
        const items = ITEMS;
        const types = TYPES;
        const caves = CAVES;
        const boxes = BOXES;
        const skills = SKILLS;
        const fac = FAC;
        const chain = CHAIN;

        // 1. Analyze items: producers and consumers
        const itemAnalysis = {};
        for (const k in items) {
          itemAnalysis[k] = {
            id: k,
            name: items[k].n,
            icon: items[k].i,
            desc: items[k].desc || '',
            tag: items[k].tag || '',
            producers: [],
            consumers: [],
            isByp: typeof BYP !== 'undefined' ? BYP.includes(k) : false,
            bypVal: typeof BYP_VAL !== 'undefined' ? (BYP_VAL[k] || 0) : 0
          };
        }

        // Check facility ins and outs
        for (const tKey in types) {
          const tDef = types[tKey];
          
          if (tDef.chain) {
            for (const ch of chain) {
              const chNode = { type: tKey, item: ch.key, level: 1 };
              let chIns = {}, chOuts = {};
              try { chIns = insOf(chNode) || {}; } catch(e){}
              try { chOuts = outsOf(chNode) || {}; } catch(e){}
              for (const ik in chIns) {
                if (itemAnalysis[ik]) itemAnalysis[ik].consumers.push({ source: 'facility:' + tKey + '(' + ch.key + ')', amount: chIns[ik] });
              }
              for (const ok in chOuts) {
                if (itemAnalysis[ok]) itemAnalysis[ok].producers.push({ source: 'facility:' + tKey + '(' + ch.key + ')', amount: chOuts[ok] });
              }
            }
          } else {
            const dummyNode = { type: tKey, item: 'ing1', level: 1 };
            let ins = {}, outs = {};
            try { ins = insOf(dummyNode) || {}; } catch(e){}
            try { outs = outsOf(dummyNode) || {}; } catch(e){}
            for (const ik in ins) {
              if (itemAnalysis[ik]) itemAnalysis[ik].consumers.push({ source: 'facility:' + tKey, amount: ins[ik] });
            }
            for (const ok in outs) {
              if (itemAnalysis[ok]) itemAnalysis[ok].producers.push({ source: 'facility:' + tKey, amount: outs[ok] });
            }
          }

          // Check if facility building cost requires item
          if (tDef.costItem && itemAnalysis[tDef.costItem]) {
            itemAnalysis[tDef.costItem].consumers.push({ source: 'build_cost:' + tKey, amount: tDef.costItemQ || 1 });
          }
        }

        // Check CAVES drops and rewards
        for (const cv of caves) {
          if (cv.drop && itemAnalysis[cv.drop]) {
            itemAnalysis[cv.drop].producers.push({ source: 'cave_drop:' + cv.id + ' (' + cv.n + ')' });
          }
          if (cv.rw && cv.rw.item && itemAnalysis[cv.rw.item]) {
            itemAnalysis[cv.rw.item].producers.push({ source: 'cave_reward:' + cv.id + ' (' + cv.n + ')', amount: cv.rw.q });
          }
        }

        // Check BOXES drops
        for (const b of boxes) {
          if (b.loot) {
            for (const lk in b.loot) {
              if (itemAnalysis[lk]) {
                itemAnalysis[lk].producers.push({ source: 'box_loot:' + b.id + ' (' + b.n + ')' });
              }
            }
          }
        }

        // Check companion favorite items
        if (typeof COMPANIONS !== 'undefined') {
          for (const cp of COMPANIONS) {
            if (cp.favoriteItem && itemAnalysis[cp.favoriteItem]) {
              itemAnalysis[cp.favoriteItem].consumers.push({ source: 'companion_favorite:' + cp.name });
            }
          }
        }

        // Check Equipment crafting
        if (typeof EQUIP_RECIPES !== 'undefined') {
          for (const eqKey in EQUIP_RECIPES) {
            const recipe = EQUIP_RECIPES[eqKey];
            if (recipe.mats) {
              for (const mKey in recipe.mats) {
                if (itemAnalysis[mKey]) {
                  itemAnalysis[mKey].consumers.push({ source: 'equip_craft:' + eqKey });
                }
              }
            }
          }
        }

        // Check Reaction tags / items
        if (typeof RX_ITEMS !== 'undefined') {
          for (const rxKey in RX_ITEMS) {
            if (itemAnalysis[rxKey]) {
              itemAnalysis[rxKey].producers.push({ source: 'reaction:' + rxKey });
            }
          }
        }

        // Check skills
        const skillAnalysis = skills.map((s, idx) => {
          return {
            id: s.id || ('skill_' + idx),
            name: s.n,
            icon: s.i,
            desc: s.desc,
            cost: s.c || s.cost,
            statReq: s.req || s.statReq || null,
            effect: s.effect || s.eff || null,
            val: s.val || s.v || null,
            raw: s
          };
        });

        // Check facilities
        const facilityAnalysis = [];
        for (const fKey in types) {
          const T = types[fKey];
          facilityAnalysis.push({
            id: fKey,
            name: T.n,
            icon: T.i,
            role: T.role,
            era: T.era || 1,
            cost: T.c || 0,
            rp: T.rp || 0,
            mat: T.mat || 0,
            time: T.time,
            desc: T.desc || '',
            chain: !!T.chain,
            loot: !!T.loot,
            powerGen: T.powerGen || 0,
            powerNeed: T.powerNeed || 0,
            sta: T.sta || 0
          });
        }

        return {
          items: itemAnalysis,
          skills: skillAnalysis,
          facilities: facilityAnalysis
        };
      })()
    `);

    fs.writeFileSync(path.join(RESULTS_DIR, 'audit_game_economy.json'), JSON.stringify(auditData, null, 2));

    const items = auditData.items;
    const orphans = [];
    const deadEnds = [];
    for (const k in items) {
      const it = items[k];
      if (it.producers.length === 0) {
        orphans.push(it);
      }
      if (it.consumers.length === 0) {
        deadEnds.push(it);
      }
    }

    console.log(`\n================================================================`);
    console.log(`📊 COMPLETE GAME ECONOMY AUDIT: ${Object.keys(items).length} ITEMS INSPECTED`);
    console.log(`================================================================`);
    console.log(`⚠️ Unobtainable Items (0 Producers): ${orphans.length}`);
    for (const o of orphans) {
      console.log(`  - [${o.id}] ${o.icon} ${o.name} (desc: ${o.desc.slice(0, 30)}) | consumers: ${o.consumers.length}`);
    }

    console.log(`\n⚠️ Dead-End Items (0 Sinks / Consumers): ${deadEnds.length}`);
    for (const d of deadEnds) {
      console.log(`  - [${d.id}] ${d.icon} ${d.name} (desc: ${d.desc.slice(0, 30)}) | producers: ${d.producers.length}`);
    }

    console.log(`\n=== SKILLS AUDIT: ${auditData.skills.length} SKILLS ===`);
    for (const s of auditData.skills) {
      console.log(`  - ${s.icon} ${s.name}: ${JSON.stringify(s.cost)} req:${JSON.stringify(s.statReq)} eff:${JSON.stringify(s.effect)} desc:${s.desc}`);
    }

    console.log(`\n=== FACILITIES AUDIT: ${auditData.facilities.length} FACILITIES ===`);
    for (const f of auditData.facilities) {
      console.log(`  - [${f.id}] ${f.icon} ${f.name} (role:${f.role}, era:${f.era}, cost:${f.cost}G, rp:${f.rp}, mat:${f.mat}, time:${f.time}s, pNeed:${f.powerNeed}, pGen:${f.powerGen}, sta:${f.sta})`);
    }

    cdp.close();
    browserCdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
