(function(){
/* 10日間の自動プレイ。人がやりそうな順で建てて、繋いで、強化して、世代を上げる */
const P = { t:0, hist:[], log:[], nodes:{} };
window.SIM = P;
const N_ = k => P.nodes[k] && N(P.nodes[k].id) ? P.nodes[k] : null;
function say(s){ P.log.push(`[${(P.t/3600).toFixed(1)}h] ${s}`); }

/* いまの世代で建てられる、その役割の最新版 */
function best(role){
  const list = FAC[role]; if(!list) return null;
  let b=null; for(const f of list) if(f.e <= (S.era||1)) b = role+f.e;
  return b;
}
function wire(a,item,b){
  if(!a||!b) return false;
  if(S.links.some(l=>l.from===a.id&&l.to===b.id&&l.item===item)) return true;
  if(!canLink(a,item,b)) return false;
  if(storeCanTake(b,item)) storeAssign(b,item);
  addLink(a.id,item,b.id); return true;
}
/* 役割ごとに1つだけ持つ。新しい世代の版が出たら建て替える */
function ensure(key, role, x, y, setup){
  const t = best(role); if(!t) return null;
  const x2 = eraPow(TYPES[t]);
  if(x2) for(const k in x2) if(!S.nodes.some(n=>outsOf(n)[k])) return P.nodes[key] && N(P.nodes[key].id) ? P.nodes[key] : null;
  const cur = P.nodes[key];
  if(cur && N(cur.id) && cur.type === t) return cur;
  const cost = buyCost(t);
  if(S.gold < cost) return cur && N(cur.id) ? cur : null;
  if(cur && N(cur.id)){ removeNode(cur.id); }
  S.gold -= cost; S.counts[t] = (S.counts[t]||0)+1;
  const n = addNode(t, x, y);
  P.nodes[key] = n;
  if(TYPES[t].chain){ const o=chainOpts(t)||[]; if(o.length) setChainItem(n, o[0]); }
  if(setup) setup(n);
  say(`${tierOf(n).i}${tierOf(n).n} を建てた（${fmt(cost)}G）`);
  return n;
}
/* 掘る鉱石は、いま解放されている中でいちばん良いものにする */
function bestMat(){
  let i=0; for(let k=0;k<CHAIN.length;k++) if(chainOpen(CHAIN[k])) i=k;
  return CHAIN[i];
}
function build(){
  const hero = S.nodes.find(n=>n.type==='hero');
  const c = bestMat();
  const mine = ensure('mine','mine',300,-400);
  const smelt= ensure('smelt','smelt',700,-400);
  const forge= ensure('forge','forge',1100,-400);
  const shop = ensure('shop','shop',1500,-400);
  const dump = ensure('dump','dump',300,-100);
  const lab  = ensure('lab','lab',700,-100, n=>{ n.item=c.ore; rebuildNodeEl(n); });
  if(lab && lab.item!==c.ore){ lab.item=c.ore; rebuildNodeEl(lab); }
  const ts   = ensure('tstr','tstr',300,200), ti=ensure('tint','tint',700,200), tv=ensure('tvit','tvit',1100,200);
  const dive = S.nodes.find(n=>TYPES[n.type].effect==='dive');
  const wood = (S.era>=2) ? ensure('wood','wood',300,-700) : null;
  const coal = (S.era>=5) ? ensure('coal','coal',700,-700) : null;
  const pw   = (S.era>=6) ? ensure('power','power',1100,-700) : null;
  const nf   = (S.era>=8) ? ensure('nfuel','nfuel',1500,-700) : null;
  P.needG = 0;                                  // 建てたいのに買えていないものの値段
  for(const [k,role] of [['wood','wood'],['coal','coal'],['power','power'],['nfuel','nfuel'],
                         ['mine','mine'],['smelt','smelt'],['forge','forge'],['shop','shop']]){
    const t=best(role); if(!t) continue;
    const cur=P.nodes[k];
    if(!cur || !N(cur.id) || cur.type!==t) P.needG = Math.max(P.needG, buyCost(t));
  }
  const mate = (S.era>=3 && S.gold>buyCost(best('mate'))*3) ? ensure('mate','mate',-200,200) : null;
  const fund = (S.era>=2 && S.gold>500000) ? ensure('fund','fund',1500,200) : null;
  const eqp  = (S.era>=2) ? ensure('equip','equip',1100,-100) : null;
  const alloy= (S.era>=3) ? ensure('alloy','alloy',1500,-100) : null;
  const anv  = (S.era>=3) ? ensure('anvil','anvil',1900,-100) : null;
  // 素材の段位をいまの深さに合わせる
  for(const [k,ch] of [['mine','ore'],['smelt','ore'],['forge','ingot'],['equip','part'],['alloy','ingot']]){
    const n=N_(k); if(!n||!n.item) continue;
    const want = ch==='ore'?c.ore:ch==='ingot'?c.ingot:c.part;
    const opts = chainOpts(n.type)||[];
    if(n.item!==want && opts.includes(want)) setChainItem(n, want);
  }
  // ── 配線 ──
  const src = [hero, mate].filter(Boolean);
  const powered = [mine,smelt,forge,shop,dump,lab,ts,ti,tv,dive,wood,coal,pw,nf,fund,eqp,alloy,anv].filter(Boolean);
  for(const n of powered) for(const s of src) if(insOf(n).sta) wire(s,'sta',n);
  if(wood) for(const n of [mine,smelt,forge,shop,comp0(),eqp,alloy,anv].filter(Boolean)) if(insOf(n).wood) wire(wood,'wood',n);
  if(coal) for(const n of powered) if(insOf(n).coal) wire(coal,'coal',n);
  if(pw)   for(const n of powered.concat([nf]).filter(Boolean)) if(insOf(n).power) wire(pw,'power',n);
  if(nf)   for(const n of powered) if(insOf(n).nfl) wire(nf,'nfl',n);
  if(mine&&smelt) wire(mine,c.ore,smelt);
  if(smelt&&forge) wire(smelt,c.ingot,forge);
  if(forge&&shop) wire(forge,c.part,shop);
  if(mine&&lab) wire(mine,c.ore,lab);
  if(dive&&shop) wire(dive,lootItem(dive),shop);
  for(const n of [mine,smelt,forge,eqp,alloy].filter(Boolean)){
    if(wood) wire(n,'waste',wood);
    if(dump) wire(n,'waste',dump);
  }
  if(ts) wire(ts,'exs',hero); if(ti) wire(ti,'exi',hero); if(tv) wire(tv,'exv',hero);
  if(eqp&&forge) wire(forge,c.part,eqp);
  if(eqp&&smelt) wire(smelt,c.ingot,eqp);
  if(alloy&&smelt) wire(smelt,c.ingot,alloy);
  if(anv&&eqp) for(const k in outsOf(eqp)) if(isEqp(k)) wire(eqp,k,anv);
  if(anv&&alloy) for(const k in outsOf(alloy)) wire(alloy,k,anv);
  // 装備を身につける
  const opts = equipOpts();
  if(opts.length) for(const n of S.nodes) for(let i=0;i<gearSlots(n);i++){
    const g=gearOf(n)[i]; if(!g.item && stockOf(opts[0])>1) setGear(n,i,opts[0]);
  }
}
function comp0(){ return null; }
/* 余ったゴールドは強化に回す（生産の要から順に）*/
function spend(){
  const order=['mine','smelt','forge','shop','wood','coal','power','lab','tstr','tint','tvit','equip','alloy','anvil','mate','dump','fund'];
  for(let pass=0; pass<3; pass++){
    for(const k of order){
      const n=N_(k); if(!n) continue;
      const c=upCostN(n,10);
      if(S.gold - (P.needG||0)*1.2 > c*20){ S.gold-=c; n.level+=10; }
    }
  }
}
P.advance = function(sec){
  const step=2;
  for(let i=0;i<sec/step;i++){
    tick(step,true); P.t+=step;
    if(P.t % 60 < step){ if(canEra()){ const e=S.era+1; doEra(); say(`第${e}時代へ`); build(); } build(); spend(); }
    if(P.t % 3600 < step){
      P.hist.push({h:Math.round(P.t/3600), gold:S.gold, rp:S.rp, era:S.era, best:S.best,
        str:S.stats.str, int:S.stats.int, vit:S.stats.vit, atk:atk(),
        nodes:S.nodes.length, sta:+(outsOf(S.nodes.find(n=>n.type==='hero')).sta/craftTime(S.nodes.find(n=>n.type==='hero'))).toFixed(2)});
    }
  }
  return P.hist.length;
};
newGame(); S.tut=-1; build();
window.__R='準備できた: ノード'+S.nodes.length;
})();
