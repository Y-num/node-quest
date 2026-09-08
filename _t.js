(function(){
  const R=[]; const log=s=>R.push(s); const bad=[];
  newGame(); S.gold=1e9; S.tut=-1;
  const hero=S.nodes.find(n=>n.type==='hero');
  const mine=addNode('mine1',300,-200), boxN=addNode('box1',700,-200), solo=addNode('mine1',300,200);
  const shop=addNode('shop1',700,200);
  addLink(hero.id,'sta',mine.id); addLink(hero.id,'sta',solo.id); addLink(hero.id,'sta',shop.id);
  if(storeCanTake(boxN,'ore1')) storeAssign(boxN,'ore1');
  addLink(mine.id,'ore1',boxN.id);
  if(storeCanTake(shop,'ore1')) storeAssign(shop,'ore1');
  addLink(solo.id,'ore1',shop.id);
  const q=(n,k,d)=>{ const s=n.el.slots[d+'-'+k]; return s? (s.querySelector('.q').textContent+'|'+s.querySelector('b').textContent) : '枠なし'; };
  for(let i=0;i<60*120;i++){ tick(1/60,false); render(); }
  log('■ 出力の見え方（2分後）');
  log('  採掘→木箱 の出力口: '+q(mine,'ore1','out')+'（勢い '+((mine.rate&&mine.rate.ore1)||0).toFixed(1)+'/分）');
  log('  主人公の⚡口: '+q(hero,'sta','out')+'（勢い '+((hero.rate&&hero.rate.sta)||0).toFixed(1)+'/分）');
  log('  木箱の入力口: '+q(boxN,'ore1','in')+' / 木箱の在庫 '+Math.floor(boxN.inBuf.ore1||0));
  log('  露店: '+shop.done+'個 売った / '+(shop.stall?'止 '+shop.why:'稼働')+' 1回'+craftTime(shop).toFixed(1)+'秒');
  // 線を切ったら上限表示に戻るか
  for(const l of [...S.links]) if(l.from===mine.id) removeLink(l.id);
  for(let i=0;i<60*5;i++){ tick(1/60,false); render(); }
  log('  線を切ったあと: '+q(mine,'ore1','out'));
  // 装備タブの数
  const H=homeOf(); H.ore1=20; H.ing1=5; H.eqp1=1;
  bagTab='gear'; renderBag();
  log('■ 持ち物の数: 装備タブ='+document.getElementById('bcGear').textContent
      +' 自宅タブ='+document.getElementById('bcHome').textContent
      +' / 装備タブに並ぶ行='+document.querySelectorAll('#bagList .bitem').length);
  bagTab='home'; renderBag();
  log('  自宅タブに並ぶ行='+document.querySelectorAll('#bagList .bitem').length);
  log(bad.length?'■ 気になった点\n  '+bad.join('\n  '):'■ 異常なし');
  window.__R=R.join('\n');
})();
