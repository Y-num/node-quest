(function(){
  const R=[]; const log=s=>R.push(s); const bad=[];
  const run=(sec)=>{ for(let i=0;i<sec/0.2;i++) tick(0.2,false); };
  newGame(); S.gold=1e12; S.rp=1e15; S.stock=1e15;
  while(canEra()) doEra();
  buildShop(); renderShop();
  log('世代'+S.era+' / 建設リストに装備: '+SHOP_ROWS.includes('equip')+' / 行の施設='+rowType('equip')+'='+TYPES[rowType('equip')].n);
  const hero=S.nodes.find(n=>n.type==='hero');
  const eq=addNode('equip3',300,600), anv=addNode('anvil5',700,600), boxN=addNode('box5',1100,600);
  const opts=chainOpts('equip3');
  log('装備工房の候補: '+opts.slice(0,3).map(k=>ITEMS[k].n).join(',')+'…');
  setChainItem(eq,opts[0]);
  log('要るもの: '+Object.keys(insOf(eq)).map(k=>ITEMS[k].n+'×'+insOf(eq)[k]).join(' ')
      +' → できるもの: '+Object.keys(outsOf(eq)).map(k=>ITEMS[k].n).join(' '));
  addLink(hero.id,'sta',eq.id);
  for(let r=0;r<50;r++){ const need=insOf(eq); for(const k in need) if(k!=='sta') eq.inBuf[k]=(eq.inBuf[k]||0)+need[k]*20; }
  // 動力（電力など）も入れておく
  for(const k in insOf(eq)) if(POW_ITEM[k]) eq.inBuf[k]=(eq.inBuf[k]||0)+100000;
  run(600);
  const made=Object.keys(eq.outBuf).filter(k=>eq.outBuf[k]>0);
  log('■ 装備工房 10分: '+eq.done+'回 / 出力='+made.map(k=>ITEMS[k].n+'×'+Math.floor(eq.outBuf[k])).join(' ')
      +(eq.stall?' / 止:'+eq.why:''));
  // 作った装備を鍛錬台へ
  const gear=made.find(isEqp);
  if(gear){
    setChainItem(anv,gear);
    log('■ 鍛錬台: 要るもの='+Object.keys(insOf(anv)).map(k=>ITEMS[k].n+'×'+insOf(anv)[k]).join(' ')
        +' → '+Object.keys(outsOf(anv)).map(k=>ITEMS[k].n).join(' '));
    addLink(hero.id,'sta',anv.id);
    for(let r=0;r<30;r++){ const need=insOf(anv); for(const k in need) if(k!=='sta') anv.inBuf[k]=(anv.inBuf[k]||0)+need[k]*10; }
    for(const k in insOf(anv)) if(POW_ITEM[k]) anv.inBuf[k]=(anv.inBuf[k]||0)+100000;
    run(600);
    log('  鍛錬 10分: '+anv.done+'回 / 出力='+Object.keys(anv.outBuf).filter(k=>anv.outBuf[k]>0)
        .map(k=>ITEMS[k].n+'×'+Math.floor(anv.outBuf[k])).join(' ')+(anv.stall?' / 止:'+anv.why:''));
  }else bad.push('装備ができていない');
  // 装備を身につける
  const list=(typeof equipOpts==='function')?equipOpts():null;
  log('■ 装備できる候補: '+(list?[...list].map(k=>ITEMS[k].n).join(','):'equipOpts無し'));
  log(bad.length?'■ 気になった点\n  '+bad.join('\n  '):'■ 異常なし');
  window.__R=R.join('\n');
})();
