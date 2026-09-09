(function(){
const CAPS = {mine:3, smelt:3, forge:3, equip:2, alloy:2, comp:2, shop:2, lab:3, dump:2,
  wood:2, coal:2, power:2, nfuel:1, fund:1, mate:3, tstr:1, tint:1, tvit:1, dive:2,
  anvil:1, decomp:1, open:1, hout:1, purify:1, boost:1, tool:1, box:2};
function newRun(seed){
  const P = {t:0, hist:[], log:[], nodes:{}, err:[], seed};
  let s = seed>>>0 || 1;
  Math.random = () => ((s = (s*1664525 + 1013904223) >>> 0) / 4294967296);
  newGame(); S.tut=-1;
  const best = role => { const l=FAC[role]; if(!l) return null;
    let b=null; for(const f of l) if(f.e <= (S.era||1)) b=role+f.e; return b; };
  const list = k => (P.nodes[k] = P.nodes[k] || []).filter(n=>N(n.id));
  const wire = (a,item,b) => {
    if(!a||!b) return;
    if(S.links.some(l=>l.from===a.id&&l.to===b.id&&l.item===item)) return;
    if(!canLink(a,item,b)) return;
    if(storeCanTake(b,item)) storeAssign(b,item);
    addLink(a.id,item,b.id);
  };
  function grow(role, x, y, setup){
    const t = best(role); if(!t) return [];
    const cap = CAPS[role] || 2;
    let arr = list(role);
    const need = eraPow(TYPES[t]);
    if(need) for(const k in need) if(!S.nodes.some(n=>outsOf(n)[k])) return arr;
    for(const n of arr) if(n.type !== t && S.gold > buyCost(t)*4){
      removeNode(n.id); S.gold -= buyCost(t); S.counts[t]=(S.counts[t]||0)+1;
      const m = addNode(t, n.x, n.y);
      if(TYPES[t].chain){ const o=chainOpts(t)||[]; if(o.length) setChainItem(m,o[0]); }
      if(setup) setup(m);
      P.nodes[role] = list(role).filter(z=>z.id!==n.id).concat([m]);
    }
    arr = list(role);
    while(arr.length < cap && S.gold > buyCost(t)*25){
      const i = arr.length;
      S.gold -= buyCost(t); S.counts[t]=(S.counts[t]||0)+1;
      const n = addNode(t, x + (i%3)*230, y + Math.floor(i/3)*150);
      if(TYPES[t].chain){ const o=chainOpts(t)||[]; if(o.length) setChainItem(n,o[0]); }
      if(setup) setup(n);
      P.nodes[role] = arr = arr.concat([n]);
    }
    P.nodes[role] = arr;
    return arr;
  }
  function bestMat(){ let i=0; for(let k=0;k<CHAIN.length;k++) if(chainOpen(CHAIN[k])) i=k; return CHAIN[i]; }
  function build(){
    const hero = S.nodes.find(n=>n.type==='hero');
    const c = bestMat();
    const R = {};
    R.wood = grow('wood', -600, -900); R.coal = grow('coal', 100, -900);
    R.power= grow('power', 800, -900); R.nfuel= grow('nfuel', 1500, -900);
    R.mine = grow('mine', -600, -500); R.smelt= grow('smelt', 100, -500);
    R.forge= grow('forge', 800, -500); R.shop = grow('shop', 1500, -500);
    R.dump = grow('dump', -600, -100); R.lab  = grow('lab', 100, -100, n=>{ n.item=c.ore; rebuildNodeEl(n); });
    R.equip= grow('equip', 800, -100); R.alloy= grow('alloy', 1500, -100);
    R.anvil= grow('anvil', 2200, -100); R.comp = grow('comp', -600, 300);
    R.decomp=grow('decomp', 100, 300); R.tool = grow('tool', 800, 300, n=>{ n.item=c.ore; rebuildNodeEl(n); });
    R.box  = grow('box', 1500, 300); R.open = grow('open', 2200, 300);
    R.hout = grow('hout', -600, 700); R.fund = grow('fund', 100, 700);
    R.mate = grow('mate', 800, 700); R.dive = grow('dive', 1500, 700);
    R.tstr = grow('tstr', -600, 1100); R.tint = grow('tint', 100, 1100);
    R.tvit = grow('tvit', 800, 1100); R.purify=grow('purify', 1500, 1100);
    R.boost= grow('boost', 2200, 1100);
    for(const n of R.lab) if(n.item!==c.ore){ n.item=c.ore; rebuildNodeEl(n); }
    for(const role of ['mine','smelt','forge','equip','alloy','tool']){
      const want = role==='mine'?c.ore : role==='smelt'?c.ore : role==='forge'?c.ingot
                 : role==='equip'?c.part : role==='alloy'?c.ingot : c.ore;
      for(const n of R[role]||[]){ const o=chainOpts(n.type)||[];
        if(n.item!==want && o.includes(want)) setChainItem(n, want); }
    }
    const dives = S.nodes.filter(n=>TYPES[n.type].effect==='dive');
    const src = [hero].concat(R.mate||[]);
    const all = S.nodes.filter(n=>!TYPES[n.type].unique);
    for(const n of all){ const ins=insOf(n);
      if(ins.sta) for(const s2 of src) wire(s2,'sta',n);
      for(const k of ['wood','coal','power','nfl']) if(ins[k])
        for(const p of S.nodes) if(outsOf(p)[k]) wire(p,k,n);
    }
    for(const a of R.mine||[]) for(const b of (R.smelt||[])) wire(a,c.ore,b);
    for(const a of R.smelt||[]) for(const b of (R.forge||[]).concat(R.alloy||[])) wire(a,c.ingot,b);
    for(const a of R.forge||[]) for(const b of (R.shop||[]).concat(R.equip||[])) wire(a,c.part,b);
    for(const a of R.mine||[]) for(const b of (R.lab||[]).concat(R.comp||[])) wire(a,c.ore,b);
    for(const d of dives) for(const b of (R.shop||[])) wire(d,lootItem(d),b);
    for(const d of dives) for(const b of (R.open||[])) for(const k in outsOf(d)) if(/^bx/.test(k)) wire(d,k,b);
    for(const n of all) for(const k in outsOf(n)) if(isByp(k)){
      for(const b of (R.wood||[])) wire(n,k,b);
      for(const b of (R.dump||[]).concat(R.decomp||[])) wire(n,k,b);
    }
    for(const a of R.equip||[]) for(const b of R.anvil||[])
      for(const k in outsOf(a)) if(isEqp(k)) wire(a,k,b);
    for(const a of R.alloy||[]) for(const b of R.anvil||[]) for(const k in outsOf(a)) wire(a,k,b);
    for(const [role,it] of [['tstr','exs'],['tint','exi'],['tvit','exv']])
      for(const n of R[role]||[]) wire(n,it,hero);
    const eq = equipOpts();
    if(eq.length) for(const n of S.nodes) for(let i=0;i<gearSlots(n);i++){
      const g=gearOf(n)[i]; if(!g.item && stockOf(eq[0])>1) setGear(n,i,eq[0]);
    }
    for(const d of (S.drops||[]).slice()) placeDrop(d.id);      // 拾ったものは置く
  }
  function spend(){
    const order=['mine','smelt','forge','shop','wood','coal','power','lab','equip','alloy',
                 'anvil','mate','dive','tstr','tint','tvit','dump','comp','decomp','tool','fund','box'];
    for(let pass=0; pass<2; pass++) for(const k of order)
      for(const n of list(k)){ const c=upCostN(n,10); if(S.gold > c*25){ S.gold-=c; n.level+=10; } }
  }
  P.advance = function(sec){
    const step=10;
    for(let i=0;i<sec/step;i++){
      try{
        tick(step,true); P.t+=step;
        if(P.t % 120 < step){ while(canEra()){ const e=S.era+1; doEra(); P.log.push(`[${(P.t/3600).toFixed(1)}h] 第${e}時代`); }
          build(); spend(); }
        if(P.t % 3600 < step){
          const h=S.nodes.find(n=>n.type==='hero');
          P.hist.push({h:Math.round(P.t/3600), gold:S.gold, rp:S.rp, era:S.era, best:S.best,
            atk:atk(), str:S.stats.str, int:S.stats.int, vit:S.stats.vit,
            nodes:S.nodes.length, links:S.links.length,
            sta:+(outsOf(h).sta/craftTime(h)).toFixed(2)});
        }
      }catch(e){ if(P.err.length<5) P.err.push(String(e.message||e)); }
    }
    return P.hist.length;
  };
  build();
  return P;
}
window.newRun = newRun;
window.RUNS = []; window.CUR = null;
const sumOf = P => {
  const eras = {}; for(const r of P.hist) if(!eras[r.era]) eras[r.era]=r.h;
  const last = P.hist[P.hist.length-1] || {};
  return {seed:P.seed, eras, end:last, err:P.err,
    hist:P.hist.map(r=>[r.h,Math.round(r.gold),Math.round(r.rp),r.era,r.best,r.atk,r.sta,r.nodes])};
};
window.DRIVE = function(budgetMs, runs, hours){
  const t0 = performance.now();
  while(performance.now() - t0 < budgetMs){
    if(!window.CUR){
      if(window.RUNS.length >= (runs||10)) return 'done';
      window.CUR = newRun(1001 + window.RUNS.length * 37);
    }
    window.CUR.advance(3600*4);
    if(window.CUR.t >= (hours||240)*3600){ window.RUNS.push(sumOf(window.CUR)); window.CUR = null; }
  }
  return {done: window.RUNS.length, now: window.CUR ? Math.round(window.CUR.t/3600)+'h' : '-'};
};
window.__R='準備できた';
})();
