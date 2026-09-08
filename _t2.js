(function(){
  const R=[]; const log=s=>R.push(s); const bad=[];
  const errs=[]; const oe=window.onerror;
  window.onerror=(m,s,l,c,e)=>{ errs.push(m+' @'+l); return false; };
  const click=id=>{ const el=document.getElementById(id); if(!el) return bad.push(id+' が無い');
    try{ el.click(); }catch(e){ bad.push(id+' で例外: '+e.message); } };
  const panels=['bFit','bTidy','bTree','bStats','bBag','bCode','bSave','bDbg'];
  for(const id of panels){ click(id); }
  // 開いたパネルの中身が空でないか
  const chk=(sel,name)=>{ const el=document.querySelector(sel);
    log('  '+name+': '+(el? (el.textContent||'').replace(/\s+/g,' ').trim().slice(0,60) || '(空)' : '無い')); };
  click('bTree'); chk('#tree','研究ツリー');
  click('bStats'); chk('#stats','記録');
  click('bBag'); chk('#bag','持ち物');
  // 各ノードのインスペクタを開く
  for(const n of S.nodes){
    try{ sel=n.id; renderInsp(); renderInspLive(); }
    catch(e){ bad.push(tierOf(n).n+' の説明で例外: '+e.message); }
  }
  // 全種類のインスペクタ（施設ごとの選択肢）を試す
  const keep=S.nodes.length;
  for(const t of Object.keys(TYPES)){
    const T=TYPES[t]; if(T.unique||T.layer||T.port) continue;
    let n; try{ n=addNode(t,9000,9000); sel=n.id; renderInsp(); renderInspLive(); render(); }
    catch(e){ bad.push(t+' の説明で例外: '+e.message); }
    if(n) try{ removeNode(n.id); }catch(e){ bad.push(t+' の撤去で例外: '+e.message); }
  }
  log('■ ノード数はもとどおり: '+(S.nodes.length===keep));
  // 画面の更新を何度か
  try{ for(let i=0;i<5;i++){ tick(0.2,false); render(); renderHud&&renderHud(); } }
  catch(e){ bad.push('描画で例外: '+e.message); }
  sel=null; renderInsp();
  window.onerror=oe;
  log(errs.length? '■ 画面のエラー: '+errs.join(' / ') : '■ 画面のエラーなし');
  log(bad.length? '■ 気になった点 ('+bad.length+')\n  '+bad.join('\n  ') : '■ パネル 異常なし');
  window.__R=R.join('\n');
})();
