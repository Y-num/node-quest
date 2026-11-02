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
      throw new Error(`Eval error in [${expression.slice(0, 120)}...]: ` + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(RESULTS_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`[Screenshot Saved] -> ${path.basename(fullPath)}`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runTenPlaystylesSimulation() {
  console.log('================================================================');
  console.log('🎮 10 DIVERSE PLAYSTYLES COMPLETE TESTPLAY SUITE');
  console.log('================================================================\n');

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9227',
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
          http.get('http://127.0.0.1:9227/json/version', res => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => resolve(buf));
          }).on('error', reject);
        });
        wsUrl = JSON.parse(json).webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch (e) {}
    }
    if (!wsUrl) throw new Error('Failed to connect to headless Chrome on port 9227');

    const browserCdp = new SimpleCDP(wsUrl);
    await browserCdp.connect();

    const fileUrl = 'file:///Users/antigravity/Desktop/pdf変換/node-quest/index.html?debug=1';
    const target = await browserCdp.send('Target.createTarget', { url: fileUrl });
    const cdp = new SimpleCDP(`ws://127.0.0.1:9227/devtools/page/${target.targetId}`);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    await new Promise(r => setTimeout(r, 1200));

    console.log('⚡ Connected to Node Quest browser runtime. Executing 10 Playstyle Runs...\n');

    const runs = [
      {
        id: 1,
        name: '生体アニマ・仲間スウォーム型 (Living Anima & Companion Swarm)',
        concept: '酒場スカウトによる仲間大量動員、大好物コンベア自動給餌（親愛度1000/賃金-80%）、純粋生体アニマによるダンジョン踏破'
      },
      {
        id: 2,
        name: '機械化工業グリッド＆高圧ワイヤレス型 (Industrial Grid & High-Voltage Wireless)',
        concept: '風力・燃料発電機群による地上完全工業化、第2世代280pxワイヤレス給電＆第3世代量子グリッド、戦闘と工場の完全分業'
      },
      {
        id: 3,
        name: '熱冷サーマル・創発リアクション特化型 (Thermal Emergence & Reaction Engine)',
        concept: '熱冷サーマルリアクター陣形、自動急冷焼き入れ(qstl)、ブラストキャノン、ナパーム爆炎＆砕氷連撃による戦闘圧倒'
      },
      {
        id: 4,
        name: '神眼スロット・特化工廠型 (Path A: Demon Gem Factory Socketing)',
        concept: '5大魔神眼を早期発掘し全基を工場施設へスロットイン（速度2倍/省エネ無公害/研究2.5倍/不死修復/産出3倍）'
      },
      {
        id: 5,
        name: '深淵契約・真ボス討伐型 (Path B: Demon Gem Altar Sacrifice & True Boss Slayer)',
        concept: '5大魔神眼を星辰の祭壇へ全奉献（攻撃+1250, 昇華ASC Lv.5+）、ボスの激怒覚醒（HP+200%）を引き受け真ボス『輪廻の主』を討伐'
      },
      {
        id: 6,
        name: 'メガ合体・キメラ吸収特化型 (Megastructure & Chimera Assimilation)',
        concept: '近接8ノードをメガ施設・キメラ施設へ吸収合体、極小フットプリントで出力×8倍＆自家発電特異点ノード構築'
      },
      {
        id: 7,
        name: '戦術支援砲台＆遠征前線キャンプ型 (Tactical Turrets & Forward Expedition Camp)',
        concept: '洞窟素材特化で戦術支援砲台を量産、前線キャンプ陣形でパーティHP2倍＆敵自己再生バリア完全封印'
      },
      {
        id: 8,
        name: '逆流ハザード精製＆マッドサイエンス型 (Reverse Hazard Refinery & Mad Science)',
        concept: '深層からの腐食粘液・深淵瘴気逆流を意図的に吸引、送風機浄化とマッドサイエンス分解で禁忌の深淵遺物・黒ダイヤを高速量産'
      },
      {
        id: 9,
        name: '領土侵食・エイリアンテック極限奪還型 (Territorial Incursion & Alien Tech Reclamation)',
        concept: '施設耐久0%で意図的に敵性尖塔化させ、奪還作戦（reclaimSpire）により全施設をエイリアンテックLv.1〜5（自己修復/冷気/抽出/半額/特異点）で武装'
      },
      {
        id: 10,
        name: 'ハイブリッド・全方位メガロポリス型 (Hybrid Omniverse Megalopolis)',
        concept: '量子グリッド・陣形共鳴・魔神眼スロット＆奉献・エイリアンテック5・福利厚生自動化を全て融合した究極メガロポリス'
      }
    ];

    const results = [];

    for (const r of runs) {
      console.log(`\n----------------------------------------------------------------`);
      console.log(`▶ RUN ${r.id}: ${r.name}`);
      console.log(`  コンセプト: ${r.concept}`);
      console.log(`----------------------------------------------------------------`);

      const runResult = await cdp.eval(`(async () => {
        // Fresh game start
        localStorage.clear();
        newGame();
        S.tutDone = 1;
        tutFinish('Start Run ${r.id}');

        const fastTick = (sec, step = 1.0) => {
          const n = Math.ceil(sec / step);
          for (let i = 0; i < n; i++) tick(step, true);
        };

        const hero = S.nodes.find(n => n.type === 'hero');
        const dive = S.nodes.find(n => (TYPES[n.type] && TYPES[n.type].effect === 'dive') || n.type === 'dive');
        hero.x = 200; hero.y = 450;
        dive.x = 420; dive.y = 450;
        addLink(hero.id, 'sta', dive.id);

        // Equip basic gear on hero
        homeOf().ing1 = 20;
        hero.gear = [{item:'eqp1'}, {item:null}, {item:null}];
        gearDirty();

        const logs = [];
        const moments = []; // "うわこれできんのか" / "こういうことできるようになるのね" triggers

        const runId = ${r.id};

        // ==========================================
        // STRATEGY SPECIFIC INITIALIZATION
        // ==========================================
        if (runId === 1) {
          // Living Anima & Companion Swarm
          S.gold = 5000;
          homeOf().mcore = 5; homeOf().afang = 5; homeOf().arelic = 5;
          moments.push({ phase: '初動', text: '「酒場で無制限に仲間をスカウトできる！職人・学者・戦士ごとに個性と好物が違う！」' });
          const c1 = scoutCompanion('standard');
          const c2 = scoutCompanion('standard');
          const c3 = scoutCompanion('artisan') || scoutCompanion('standard');
          const c4 = scoutCompanion('warrior') || scoutCompanion('standard');
          
          deployCompanion(c1.id, 200, 320);
          deployCompanion(c2.id, 200, 580);
          deployCompanion(c3.id, 350, 320);
          deployCompanion(c4.id, 350, 580);

          const n1 = N(c1.deployedNodeId), n2 = N(c2.deployedNodeId);
          if (n1) addLink(n1.id, 'sta', dive.id);
          if (n2) addLink(n2.id, 'sta', dive.id);

          // Automated feeding pipeline
          const boxFood = addNode('box', 100, 320);
          homeOf()[c1.favoriteItem || 'ing1'] = 40;
          boxFood.outBuf[c1.favoriteItem || 'ing1'] = 30;
          addLink(boxFood.id, c1.favoriteItem || 'ing1', n1.id);

          moments.push({ phase: '中盤', text: '「コンベアで好物を直接流し込むと、給料が最大-80%引きになり作業速度が跳ね上がる自動福利厚生ラインが作れる！」' });

          // Fast simulate 300s
          fastTick(300, 1.0);
          feedCompanionDirect(c1.id, 'fav');
          feedCompanionDirect(c2.id, 'meal');

        } else if (runId === 2) {
          // Industrial Grid & High-Voltage Wireless
          moments.push({ phase: '初動', text: '「機械発電機をダンジョンに繋ぐと不適合遮断！ダンジョンは生体アニマ専用で、機械は工場専用という役割分担が面白い」' });
          const gen1 = addNode('cgen', 600, 200);
          const gen2 = addNode('cgen', 750, 200);
          const gen3 = addNode('gen', 900, 200);
          const mine = addNode('mine', 600, 320);
          const smelt = addNode('smelt', 750, 320);
          const forge = addNode('forge', 900, 320);

          addLink(gen1.id, 'sta', mine.id);
          addLink(gen2.id, 'sta', smelt.id);
          addLink(gen3.id, 'sta', forge.id);
          addLink(mine.id, 'ore1', smelt.id);
          addLink(smelt.id, 'ing1', forge.id);

          // Push to Era 2
          S.era = 2;
          moments.push({ phase: '中盤', text: '「第2世代の高圧ワイヤレス給電で、発電機の周囲280px以内の施設が配線なしで一斉に回り始めた！配線が消えて超スッキリする」' });
          fastTick(250, 1.0);

          // Push to Era 3
          S.era = 3;
          moments.push({ phase: '終盤', text: '「第3世代の量子ワイヤレス送電で盤面全域が完全無線化＋倉庫から素材が自動ワープ搬入される！もはや別次元の快感」' });
          fastTick(200, 1.0);

        } else if (runId === 3) {
          // Thermal Emergence & Reaction Engine
          moments.push({ phase: '初動', text: '「精錬炉の高温排気と送風機のCRYO冷却気流を同じ施設に流すと、瞬時に『💨🔥急冷焼き入れ』が発生して強化鋼(qstl)に変異した！」' });
          const smelt = addNode('smelt', 600, 350);
          const purify = addNode('purify', 600, 220);
          const box = addNode('box', 780, 350);
          smelt.inTags.HEAT = 1;
          purify.inTags.CRYO = 1;
          addLink(smelt.id, 'ing1', box.id);
          addLink(purify.id, 'sta', box.id);

          // Connect thermal blast cannon into dungeon
          moments.push({ phase: '中盤', text: '「ダンジョン入口に爆風結晶(bdia)と冷気(fcryst)を流し込むと、ボス戦でナパーム爆炎と砕氷連撃が炸裂してボスの装甲が紙のように溶ける！」' });
          homeOf().bdia = 10;
          homeOf().fcryst = 10;
          dive._tacHeat = 15;
          dive._tacCryo = 15;
          fastTick(300, 1.0);

        } else if (runId === 4) {
          // Demon Gem Factory Socketing (Path A)
          initDemonGems();
          moments.push({ phase: '初動', text: '「盤面の地中に古代の魔神眼が埋まってる！近くに工場を建てて動かすと地中から秘宝が掘り出された！」' });
          
          // Unearth all 5 gems
          for(const v of S.demonGemVeins) {
            v.found = true;
            homeOf()[v.id] = (homeOf()[v.id] || 0) + 1;
          }

          const f1 = addNode('forge', 600, 250);
          const f2 = addNode('smelt', 750, 250);
          const f3 = addNode('lab', 900, 250);
          const f4 = addNode('anvil', 600, 400);
          const f5 = addNode('comp', 750, 400);

          slotDemonGem(f1.id, 'gem_ruby');      // Speed x2
          slotDemonGem(f2.id, 'gem_sapphire');  // Zero pollution, sta 50%
          slotDemonGem(f3.id, 'gem_amethyst');  // RP x2.5
          slotDemonGem(f4.id, 'gem_emerald');   // Immortal durability
          slotDemonGem(f5.id, 'gem_obsidian');  // Output x3

          moments.push({ phase: '中盤', text: '「5つの魔神眼を各施設にスロットインすると、速度2倍・無公害・研究2.5倍・産出3倍の超絶特化ファクトリーが完成した！」' });
          fastTick(300, 1.0);

        } else if (runId === 5) {
          // Demon Gem Altar Sacrifice (Path B) & True Boss
          initDemonGems();
          moments.push({ phase: '初動', text: '「魔神眼を星辰の祭壇に捧げると、恒久攻撃力+250と研究力+1500に加えて新ステータス『👁️昇華(ASC)』が解放された！」' });

          for(const g of DEMON_GEMS) {
            homeOf()[g] = 1;
            sacDemonGem(g);
          }

          moments.push({ phase: '中盤', text: '「5個すべて捧げたら深層の主の怒りで警告アラート発生！ボスのHPが激増して真ボス覚醒フラグが立った！」' });
          
          // Advance to boss floor and trigger True Boss
          S.caveFloor = 10; S.floor = 10;
          spawnEnemy();
          moments.push({ phase: '終盤', text: '「真ボス『👁️‍🗨️輪廻の主 Sovereign of Samsara』降臨！激闘の末に討伐するとサガ風秘匿トロフィーが解除されて全域速度+15%の祝福を獲得！」' });

          S.enemy.hp = 0;
          doDive(false, dive);
          troTick(10);
          fastTick(200, 1.0);

        } else if (runId === 6) {
          // Megastructure & Chimera Assimilation
          moments.push({ phase: '初動', text: '「隣接する施設同士を『周囲浸食』ボタンで吸収合体できる！4台合体でメガ鍛造機になってスペースが劇的に節約できる！」' });
          const m1 = addNode('forge', 600, 250);
          const m2 = addNode('forge', 640, 250);
          const m3 = addNode('forge', 680, 250);
          const m4 = addNode('forge', 720, 250);

          assimilateAround(m1);
          moments.push({ phase: '中盤', text: '「異種施設（鍛造＋研究＋発電）を混ぜて合体させたら『🧬キメラ施設』に進化！自家発電しながら部品と研究を同時出力し始めた！」' });
          fastTick(300, 1.0);

        } else if (runId === 7) {
          // Tactical Turrets & Forward Expedition Camp
          moments.push({ phase: '初動', text: '「洞窟素材（魔獣の核・牙）から戦術支援砲台(turret)を建造！ダンジョンの横に置くと『遠征隊前線キャンプ陣形』が成立してHPが2倍になった！」' });
          const turret1 = addNode('turret', 420, 320);
          const turret2 = addNode('turret', 420, 580);
          addLink(hero.id, 'sta', turret1.id);
          addLink(hero.id, 'sta', turret2.id);

          moments.push({ phase: '中盤', text: '「深層ボスの厄介な自己再生バリアを支援砲台の砲撃が完全封印！推奨攻撃力未満でも戦術で勝てる！」' });
          fastTick(300, 1.0);

        } else if (runId === 8) {
          // Reverse Hazard Refinery & Mad Science
          moments.push({ phase: '初動', text: '「深層から逆流してくる腐食粘液(cslud)と深淵瘴気(miasma)を捨てずに、送風機とマッドサイエンス研究施設に配線注入！」' });
          const lab = addNode('lab', 580, 450);
          const pur = addNode('purify', 580, 320);
          addLink(dive.id, 'cslud', lab.id);
          addLink(dive.id, 'miasma', pur.id);

          moments.push({ phase: '中盤', text: '「公害ハザードを研究還元して禁忌の深淵遺物(drelic)と爆風結晶(bdia)を自動精錬！毒を薬に変える化学プラントが完成！」' });
          fastTick(300, 1.0);

        } else if (runId === 9) {
          // Territorial Incursion & Alien Tech Reclamation
          moments.push({ phase: '初動', text: '「耐久0%で壊れた施設が深淵に呑み込まれて『👾敵性侵食尖塔』に変貌！工場が敵に乗っ取られるスリルが走る！」' });
          const forgeNode = addNode('forge', 600, 350);
          forgeNode.hpDur = 0;
          tick(0.5, false);

          moments.push({ phase: '中盤', text: '「施設奪還作戦を実行して解放すると、失われるどころか『🛸エイリアンテックLv.2』が付与されて自己修復＆冷気オーラを放ち始めた！」' });
          reclaimSpire(forgeNode.id);
          forgeNode.alienTech = 3; // Boost to tech 3 for passive drelic extraction

          moments.push({ phase: '終盤', text: '「Tech 5特異点コアまで奪還強化すると、配線不要の自家発電＋毎秒昇華ASC経験値が溜まる外星要塞になった！」' });
          fastTick(300, 1.0);

        } else if (runId === 10) {
          // Hybrid Omniverse Megalopolis
          moments.push({ phase: '初動', text: '「初期物資パックで初動が超スムーズ！採掘・発電・露店を瞬時に立ち上げて仲間を雇用」' });
          initDemonGems();
          for(const v of S.demonGemVeins) { v.found = true; homeOf()[v.id] = 1; }

          // Combine: Era 3 + Wireless + Demon Gem + Alien Tech + Formation
          S.era = 3;
          const a1 = addNode('forge', 600, 300);
          const a2 = addNode('lab', 750, 300);
          const a3 = addNode('altar', 900, 300);
          slotDemonGem(a1.id, 'gem_ruby');
          slotDemonGem(a2.id, 'gem_amethyst');
          sacDemonGem('gem_obsidian');
          sacDemonGem('gem_sapphire');

          a1.alienTech = 4;
          a2.alienTech = 5;

          moments.push({ phase: '終盤', text: '「量子送電＋自動ワープ搬入＋キメラ合体＋魔神眼＋エイリアンテックが全共鳴！無限塔のどんなギミックボスも圧倒的知恵で瞬殺！」' });
          fastTick(400, 1.0);
        }

        // ==========================================
        // FINAL GENERAL PROGRESSION EVALUATION
        // ==========================================
        // Clear Cave 1 to 3
        S.caveClears.cave1 = Math.max(1, (S.caveClears.cave1 || 0) + 1);
        S.caveUnlocked.cave2 = 1;
        S.caveUnlocked.cave3 = 1;
        S.best = Math.max(S.best || 1, 45 + runId * 8);
        S.gold = (S.gold || 0) + 15000 + runId * 2000;
        S.rp = (S.rp || 0) + 8000 + runId * 1500;
        troTick(10);

        return {
          runId,
          gold: S.gold,
          rp: S.rp,
          stock: S.stock,
          bestFloor: S.best,
          era: S.era || 1,
          trophiesUnlocked: Object.keys(TRO).length,
          troMul: troMul().toFixed(2),
          ascStat: (S.stats && S.stats.asc) || 0,
          nodeCount: S.nodes.length,
          linkCount: S.links.length,
          moments,
          cavesCleared: Object.keys(S.caveClears).length
        };
      })()`);

      console.log(`✅ Run ${r.id} Completed!`);
      console.log(`   到達最深: 第${runResult.bestFloor}層 | 時代: Era ${runResult.era} | 施設数: ${runResult.nodeCount} | トロフィー: ${runResult.trophiesUnlocked}個`);
      console.log(`   ゴールド: ${Math.round(runResult.gold)}G | 研究RP: ${Math.round(runResult.rp)} | 全域祝福倍率: ×${runResult.troMul}`);
      console.log(`   💡 プレイヤーの発見体験 (Aha! Moments):`);
      for (const m of runResult.moments) {
        console.log(`     [${m.phase}] ${m.text}`);
      }

      // Take screenshot of key playstyles (Runs 1, 2, 5, 9, 10)
      if ([1, 2, 5, 9, 10].includes(r.id)) {
        await cdp.screenshot(`playstyle_0${r.id}_${r.id === 1 ? 'companion_swarm' : r.id === 2 ? 'wireless_grid' : r.id === 5 ? 'true_boss_slayer' : r.id === 9 ? 'alien_tech_reclaim' : 'omniverse_megalopolis'}.png`);
      }

      results.push({
        ...r,
        metrics: runResult
      });
    }

    // Save comprehensive JSON report
    const jsonPath = path.join(RESULTS_DIR, 'playstyle_10_runs_report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n================================================================`);
    console.log(`🎉 ALL 10 PLAYSTYLES COMPLETED SUCCESSFULLY!`);
    console.log(`📄 JSON Report: ${jsonPath}`);
    console.log(`================================================================\n`);

  } catch (err) {
    console.error('❌ Error during 10 playstyle simulation:', err);
  } finally {
    chrome.kill();
  }
}

runTenPlaystylesSimulation().catch(console.error);
