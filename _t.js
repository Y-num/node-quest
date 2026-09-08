(function(){
  const R=[]; const log=s=>R.push(s); const bad=[];
  newGame(); S.gold=1e9; S.tut=-1;
  const hero=S.nodes.find(n=>n.type==='hero');
  const m1=addNode('mine1',300,-150), m2=addNode('mine1',300,150);
  const L=makeLayer([m1.id,m2.id]);
  const lin=memOf(L).find(m=>TYPES[m.type].lin);
  // 中に「新しく要るもの」があるノードを建てる
  enterLayer(L);
  const op=addNode('open1',600,0); const o=chainOpts('open1')||[]; if(o.length) setChainItem(op,o[0]);
  leaveLayer();
  log('1 入口が出すもの='+Object.keys(outsOf(lin)).join(',')+' / 枠='+Object.keys(lin.el.slots).join(','));
  let err=''; try{ render(); }catch(e){ err=e.message; }
  log('2 描画: '+(err?'例外 '+err:'OK')+' / 枠（描画後）='+Object.keys(lin.el.slots).join(','));
  log('3 レイヤーが外から欲しいもの='+Object.keys(layerNeeds(L)).map(k=>ITEMS[k].n).join(',')
      +' / レイヤーの入力口='+Object.keys(portIns(L)).map(k=>ITEMS[k].n).join(','));
  // 実際に流れるか（⚡と宝箱を外から入れる）
  const dv=S.nodes.find(n=>TYPES[n.type].effect==='dive');
  addLink(hero.id,'sta',L.id);
  if(canLink(dv,'bxc',L)) addLink(dv.id,'bxc',L.id); else bad.push('宝箱をレイヤーへつなげない');
  // 中では 入口→開封所 を繋ぐ
  enterLayer(L); autoWire(L); leaveLayer();
  let alive=0; try{ for(let i=0;i<3600;i++){ tick(1/60,false); render(); alive++; } }catch(e){ bad.push('途中で例外: '+e.message); }
  log('4 1分ぶんループ: '+alive+'/3600コマ');
  log('5 中の採掘 '+(m1.done+m2.done)+'回 / 開封所 '+op.done+'回'+(op.stall?' 止:'+op.why:''));
  // 作り直しが毎コマ起きていないか
  let rebuilds=0; const orig=rebuildNodeEl;
  window.rebuildNodeEl=function(n){ rebuilds++; return orig(n); };
  for(let i=0;i<120;i++){ tick(1/60,false); render(); }
  window.rebuildNodeEl=orig;
  log('6 2秒間の作り直し回数: '+rebuilds+'（0に近ければ良い）');
  if(rebuilds>10) bad.push('毎コマ作り直している');
  log(bad.length? '■ 気になった点\n  '+bad.join('\n  ') : '■ 異常なし');
  window.__R=R.join('\n');
})();
