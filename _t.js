(function(){
  newGame(); S.gold=1e9;
  const hero=S.nodes.find(n=>n.type==='hero'); hero.x=-260; hero.y=0;
  const m1=addNode('mine1',60,-180), m2=addNode('mine1',60,180), sm=addNode('smelt1',380,0);
  const sh=addNode('shop1',700,0);
  for(const n of [m1,m2,sm,sh]) addLink(hero.id,'sta',n.id);
  addLink(m1.id,'ore1',sm.id); addLink(m2.id,'ore1',sm.id);
  if(storeCanTake(sh,'ing1')) storeAssign(sh,'ing1');
  addLink(sm.id,'ing1',sh.id);
  const L=makeLayer([m1.id,m2.id,sm.id]);
  setLayerOut(L,'ing1');
  for(let i=0;i<1500;i++) tick(0.2,false);
  sel=L.id; renderInsp(); render(); fitView(1);
  window.__R='ok layer='+(L?L.id:'なし')+' out='+L.out;
})();
