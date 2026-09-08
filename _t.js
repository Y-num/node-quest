(function(){
  const R=[]; const log=s=>R.push(s); const bad=[];
  const run=(sec)=>{ for(let i=0;i<sec/0.2;i++) tick(0.2,false); };
  newGame(); S.gold=1e12; S.rp=1e15; S.stock=1e15;
  while(canEra()) doEra();
  const hero=S.nodes.find(n=>n.type==='hero'); hero.x=-2000; hero.y=-2000;
  const power=(n)=>{ for(const k in insOf(n)) if(POW_ITEM[k]) n.inBuf[k]=(n.inBuf[k]||0)+1e6; };
  // 汚染源：廃材を抱えた木箱
  const dirty=addNode('box1',0,0); setStoreItem(dirty,0,'waste'); dirty.inBuf.waste=400;
  const near=addNode('box1',200,0); setStoreItem(near,0,'ore1'); near.inBuf.ore1=10;
  run(300);
  const base=near.pol;
  const pin=addNode('purify6',100,150); power(pin); run(20); log('  清浄ピン 稼働='+!pin.stall+(pin.stall?'('+pin.why+')':''));
  run(300);
  log('■ 清浄ピン: 近くのノードの汚染 '+Math.round(base*100)+'% → '+Math.round(near.pol*100)+'%');
  if(near.pol >= base) bad.push('清浄ピンが効いていない');
  // 加速ピン
  const mine=addNode('mine1',-200,0); power(mine); run(20);
  const s0=mine.spd||1;
  const bst=addNode('boost3',-200,150); power(bst); run(20);
  log('■ 加速ピン: 速さ '+s0.toFixed(2)+' → '+(mine.spd||1).toFixed(2)+' / ピン稼働='+!bst.stall);
  if((mine.spd||1) <= s0) bad.push('加速ピンが効いていない');
  // 道具（増幅）
  const tl=addNode('tool2',400,400); tl.item='ore1'; rebuildNodeEl(tl);
  addLink(hero.id,'sta',tl.id); power(tl);
  for(let r=0;r<40;r++){ const need=insOf(tl); for(const k in need) tl.inBuf[k]=(tl.inBuf[k]||0)+need[k]*20; }
  run(120);
  log('■ 道具: '+tl.done+'回 入'+Object.keys(insOf(tl)).map(k=>ITEMS[k].n+'×'+insOf(tl)[k]).join(' ')
      +' → 出'+Object.keys(outsOf(tl)).map(k=>ITEMS[k].n+'×'+outsOf(tl)[k]).join(' ')+(tl.stall?' 止:'+tl.why:''));
  if(!tl.done) bad.push('道具が動かない');
  // 売り場（配線で受け入れる）
  const mn=addNode('mine1',700,400), sh=addNode('shop1',1000,400);
  addLink(hero.id,'sta',mn.id); addLink(hero.id,'sta',sh.id);
  if(canLink(mn,'ore1',sh)){ storeCanTake(sh,'ore1')&&storeAssign(sh,'ore1'); addLink(mn.id,'ore1',sh.id); }
  else bad.push('採掘→露店をつなげない');
  const g0=S.gold; run(600);
  log('■ 露店: 10分で '+sh.done+'個売れた（+'+fmt(S.gold-g0)+'G）'+(sh.stall?' 止:'+sh.why:''));
  // 倉庫（ware）
  const wr=Object.keys(TYPES).filter(t=>TYPES[t].ware);
  log('■ 倉庫になる施設: '+(wr.map(t=>TYPES[t].n+'('+t+')').join(',')||'無い'));
  if(wr.length){
    const w=addNode(wr[0],1300,400);
    for(const k of ['ore1','ing1','prt1','ore2','waste']) w.inBuf[k]=(w.inBuf[k]||0)+50;
    run(60);
    log('  '+TYPES[wr[0]].n+': '+wareKinds(w).length+'種 '+fmt(wareTotal(w))+'個 / 上限'
        +TYPES[wr[0]].kinds+'種 各'+fmt(capIn(w,'x'))+'個');
    bagWare=w.id; bagTab='ware'; renderBag();
    const t=(document.querySelector('#bag')||{}).textContent||'';
    log('  中身の画面: '+t.replace(/\s+/g,' ').slice(0,80));
    if(!wareKinds(w).length) bad.push('倉庫に入らない');
  }else bad.push('ware属性の施設が無い');
  log(bad.length? '■ 気になった点\n  '+bad.join('\n  ') : '■ 異常なし');
  window.__R=R.join('\n');
})();
