const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/antigravity/Desktop/pdf変換/node-quest';
const RESULTS_DIR = path.join(ARTIFACT_DIR, 'test_results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
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
      throw new Error(`Eval error: ` + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(RESULTS_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runDetailedBalanceMeasurement() {
  console.log('================================================================');
  console.log('📐 NODE QUEST COMPREHENSIVE BALANCE & DIFFICULTY PROFILING');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,900'
  ]);

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

    // Detailed profiling of all 7 zones with proper gear progression
    const balanceData = await pageCdp.eval(`(() => {
      newGame();
      const hero = S.nodes.find(n => n.type === 'hero');

      // Profiling setup per cave
      const profileCave = (caveId, era, str, gearItems, compSetup = null, rxSetup = null) => {
        S.era = era;
        S.stats.str = str;
        hero.gear = gearItems.map(item => ({ item }));
        gearDirty();
        
        // Setup battle reactions if specified
        S.battleRx = rxSetup || {};

        selectCave(caveId, true);
        const c = caveById(caveId);

        // Floor 1 (regular mob)
        S.caveFloor = 1;
        S.floor = effFloorOf(1, c);
        spawnEnemy();
        const f1Enemy = { ...S.enemy };
        const f1Hp = f1Enemy.hp;
        const f1Arm = enemyArm(S.floor);
        const f1Dmg = dmg();
        const f1Hits = hitsLeft();
        const f1Gold = enemyGold(S.floor);

        // Mid Floor
        const midF = c.infinite ? 20 : Math.floor(c.maxF / 2);
        S.caveFloor = midF;
        S.floor = effFloorOf(midF, c);
        spawnEnemy();
        const midEnemy = { ...S.enemy };
        const midHp = midEnemy.hp;
        const midArm = enemyArm(S.floor);
        const midDmg = dmg();
        const midHits = hitsLeft();

        // Boss Floor
        const bossF = c.infinite ? 50 : c.maxF;
        S.caveFloor = bossF;
        S.floor = effFloorOf(bossF, c);
        spawnEnemy();
        const bossEnemy = { ...S.enemy };
        const bossHp = bossEnemy.hp;
        const bossArm = enemyArm(S.floor);
        const bossDmg = dmg();
        const bossHits = hitsLeft();
        const bossGold = enemyGold(S.floor);

        return {
          id: c.id,
          name: c.n,
          icon: c.i,
          era,
          recAtk: c.recAtk,
          actualAtk: atk(),
          gear: gearItems,
          f1: { name: f1Enemy.name, hp: f1Hp, arm: f1Arm, dmg: f1Dmg, hits: f1Hits, gold: f1Gold },
          mid: { floor: midF, name: midEnemy.name, hp: midHp, arm: midArm, dmg: midDmg, hits: midHits },
          boss: { floor: bossF, name: bossEnemy.name, hp: bossHp, arm: bossArm, dmg: bossDmg, hits: bossHits, gold: bossGold },
          reward: c.rw ? {
            gold10x: c.rw.g * 10,
            rp10x: c.rw.rp * 10,
            mat10x: c.rw.mat * 10,
            item: c.rw.item,
            qty10x: c.rw.q * 10
          } : null
        };
      };

      const profiles = [];

      // 1. Cave 1: Mossy Cave (Era 1, Base sword eqp1, STR 5)
      profiles.push(profileCave('cave1', 1, 5, ['eqp1']));

      // 2. Cave 2: Underground Canal (Era 1, eqp1 + comp warrior, STR 15)
      profiles.push(profileCave('cave2', 1, 15, ['eqp1', 'eqp1']));

      // 3. Cave 3: Ancient Ruins (Era 2, Iron sword eqp2, STR 25)
      profiles.push(profileCave('cave3', 2, 25, ['eqp2', 'eqp2']));

      // 4. Cave 4: Lava Cave (Era 2, eqp2 + quenched steel qstl, STR 35, Cryo reaction active)
      profiles.push(profileCave('cave4', 2, 35, ['eqp2', 'eqp2', 'qstl'], null, { cryo: 1 }));

      // 5. Cave 5: Crystal Cave (Era 3, Titanium rapier eqp3 + bdia, STR 55, Shatter active)
      profiles.push(profileCave('cave5', 3, 55, ['eqp3', 'eqp3', 'bdia'], null, { shatter: 1 }));

      // 6. Cave 6: Starlit Abyss (Era 3, Supercritical blade eqp4 + acore, STR 75, Napalm + Berserk)
      profiles.push(profileCave('cave6', 3, 75, ['eqp4', 'eqp4', 'acore'], null, { napalm: 1, berserk: 1 }));

      // 7. Tower: Infinite Tower at entry (Floor 1 ~ 30)
      profiles.push(profileCave('tower', 3, 90, ['eqp5', 'eqp5', 'acore'], null, { shatter: 1, berserk: 1 }));

      // 8. Tower Deep Push (Floor 100, Floor 200 simulation)
      S.stats.str = 100;
      hero.gear = [{item:'eqp5'}, {item:'eqp5'}, {item:'acore'}];
      gearDirty();
      selectCave('tower', true);
      const cTow = caveById('tower');
      
      const sampleFloors = [1, 10, 25, 50, 75, 100, 150, 200];
      const towerCurve = sampleFloors.map(f => {
        S.caveFloor = f;
        S.floor = effFloorOf(f, cTow);
        spawnEnemy();
        return {
          towerFloor: f,
          effFloor: S.floor,
          name: S.enemy.name,
          hp: S.enemy.hp,
          arm: enemyArm(S.floor),
          atk: atk(),
          dmg: dmg(),
          hitsToKill: hitsLeft(),
          gold: enemyGold(S.floor)
        };
      });

      return {
        profiles,
        towerCurve,
        eraRequirements: {
          era2: { rp: ERA_RP[2], mat: ERA_MAT[2], goldEst: 6000 },
          era3: { rp: ERA_RP[3], mat: ERA_MAT[3], goldEst: 65000 }
        },
        offlineStats: {
          offRate: offRate(),
          offCapH: offCapH()
        }
      };
    })()`);

    console.log('✅ Balance measurements completed.\n');

    // Output formatted profile table
    console.log('------------------------------------------------------------------------------------------------------------');
    console.log('洞窟ID | 洞窟名            | 推奨ATK | 実効ATK | 1層敵HP / 撃破打数 | ボス階敵HP / 撃破打数 | 初回クリア報酬(10倍)');
    console.log('------------------------------------------------------------------------------------------------------------');
    for (const p of balanceData.profiles) {
      const boss = p.boss;
      const f1 = p.f1;
      const rw = p.reward ? `G:${p.reward.gold10x} RP:${p.reward.rp10x} ${p.reward.item}x${p.reward.qty10x}` : '無制限';
      console.log(
        `${p.id.padEnd(6)} | ${(p.icon + ' ' + p.name).padEnd(16)} | ${String(p.recAtk).padStart(7)} | ${String(p.actualAtk).padStart(7)} | ` +
        `${String(f1.hp).padStart(6)} (${String(f1.hits).padStart(2)}打) | ` +
        `${String(boss.hp).padStart(9)} (${String(boss.hits).padStart(3)}打) | ${rw}`
      );
    }
    console.log('------------------------------------------------------------------------------------------------------------\n');

    console.log('🗼 無限塔（Tower of Infinity）階層別スケーリングカーブ:');
    console.log('---------------------------------------------------------------------------------------------');
    console.log('塔階層 | 実効階層 | 敵名           | 敵HP       | 敵装甲 | プレイヤー与ダメ | 撃破必要打数 | 獲得Gold');
    console.log('---------------------------------------------------------------------------------------------');
    for (const t of balanceData.towerCurve) {
      console.log(
        `第${String(t.towerFloor).padStart(3)}層 | 第${String(t.effFloor).padStart(4)}層 | ${t.name.padEnd(14)} | ${String(t.hp).padStart(10)} | ${String(t.arm).padStart(6)} | ${String(t.dmg).padStart(14)} | ${String(t.hitsToKill).padStart(10)}打 | ${String(t.gold).padStart(8)}G`
      );
    }
    console.log('---------------------------------------------------------------------------------------------\n');

    // Save report to JSON
    fs.writeFileSync(
      path.join(RESULTS_DIR, 'detailed_balance_profiling.json'),
      JSON.stringify(balanceData, null, 2)
    );

    pageCdp.close();
    cdp.close();
  } catch (err) {
    console.error('Fatal Profiling Error:', err);
  } finally {
    chrome.kill();
  }
}

runDetailedBalanceMeasurement();
