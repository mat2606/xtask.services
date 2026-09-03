import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, getDocs, query, orderBy, limit, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { TRIGGER_URL } from "./trigger-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
let uid = null, ads = [], activeAd = null, keywords = [], selectedKeyword = null;
let unsubAds = null, unsubKeywords = null, unsubQueue = null;
let requestedRuns = 1;

const normalizeMlb = (v) => (String(v || '').toUpperCase().match(/MLB\d{6,}/) || [])[0] || '';
const kwId = (s) => btoa(unescape(encodeURIComponent(s.trim().toLowerCase()))).replace(/[+/=]/g, c => ({'+':'-','/':'_','=':''}[c]));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const stamp = (t) => t?.toMillis ? t.toMillis() : (t ? new Date(t).getTime() : 0);
const fmtTime = (ts) => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); };
const short = (s,n) => String(s||'').length > n ? String(s).slice(0,n-1)+'…' : String(s||'');
const toast = (msg) => { const el=$('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3600); };

$('loginBtn').onclick = async()=>{ try{ await signInWithEmailAndPassword(auth,$('authEmail').value.trim(),$('authPassword').value); }catch(e){toast('Login: '+friendlyError(e));} };
$('signupBtn').onclick = async()=>{ try{ await createUserWithEmailAndPassword(auth,$('authEmail').value.trim(),$('authPassword').value); }catch(e){toast('Cadastro: '+friendlyError(e));} };
$('guestBtn').onclick = async()=>{ try{ await signInAnonymously(auth); }catch(e){toast('Visitante: '+friendlyError(e));} };
$('logoutBtn').onclick = ()=>signOut(auth);

function friendlyError(e){ const c=e?.code||''; if(c.includes('invalid-credential')) return 'e-mail ou senha inválidos.'; if(c.includes('email-already-in-use')) return 'este e-mail já está cadastrado.'; if(c.includes('weak-password')) return 'use uma senha com pelo menos 6 caracteres.'; if(c.includes('operation-not-allowed')) return 'ative este método em Firebase Authentication.'; return e?.message||String(e); }

onAuthStateChanged(auth, user => {
  cleanup();
  if(!user){ uid=null; $('authView').classList.remove('hidden'); $('appView').classList.add('hidden'); return; }
  uid=user.uid; $('authView').classList.add('hidden'); $('appView').classList.remove('hidden');
  $('userLine').textContent = user.isAnonymous ? `Sessão visitante • ${user.uid.slice(0,8)}` : user.email;
  $('cloudBadge').textContent='● Firebase conectado';
  listenAds(); listenQueue();
});

function cleanup(){ if(unsubAds)unsubAds(); if(unsubKeywords)unsubKeywords(); if(unsubQueue)unsubQueue(); unsubAds=unsubKeywords=unsubQueue=null; ads=[];keywords=[];activeAd=null;selectedKeyword=null; }

for(const chip of document.querySelectorAll('.run-chip')) chip.onclick=()=>{ document.querySelectorAll('.run-chip').forEach(x=>x.classList.remove('active')); chip.classList.add('active'); requestedRuns=Number(chip.dataset.runs||1); $('statusText').textContent=requestedRuns===3?'Cada palavra fará 3 sessões limpas e salvará a mediana.':'Varredura rápida com 1 sessão limpa.'; };

$('addAdBtn').onclick = async()=>{
  const mlb=normalizeMlb($('mlbInput').value), name=$('adNameInput').value.trim();
  if(!mlb) return toast('Cole um MLB válido ou o link do anúncio.');
  await setDoc(doc(db,'users',uid,'ads',mlb),{mlb,name:name||'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
  $('mlbInput').value=''; $('adNameInput').value=''; toast(`${mlb} salvo.`);
};

$('addKeywordsBtn').onclick = async()=>{
  if(!activeAd) return toast('Selecione um MLB primeiro.');
  const list=[...new Set($('keywordsInput').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
  if(!list.length) return toast('Digite pelo menos uma palavra-chave.');
  for(const keyword of list){ const id=kwId(keyword); await setDoc(doc(db,'users',uid,'ads',activeAd.mlb,'keywords',id),{keyword,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),autoEnabled:false,frequencyHours:24},{merge:true}); }
  $('keywordsInput').value=''; toast(`${list.length} palavra(s) salva(s).`);
};

$('adSelect').onchange=()=>{ const ad=ads.find(a=>a.mlb===$('adSelect').value); if(ad)selectAd(ad); };
$('filterInput').oninput=renderAds;
$('scanAllBtn').onclick=()=>scanAll();
$('scanSelectedBtn').onclick=()=>scanAll();

async function scanAll(){ if(!activeAd)return toast('Selecione um MLB.'); if(!keywords.length)return toast('Adicione palavras-chave.'); const jobs=[]; for(const k of keywords) jobs.push(await enqueue(k)); await triggerScanner(); toast(`${jobs.length} pesquisa(s) enviada(s) para o Chromium.`); }

async function enqueue(k){
  const ref=await addDoc(collection(db,'users',uid,'queue'),{adId:activeAd.mlb,keywordId:k.id,keyword:k.keyword,status:'pending',requestedRuns,createdAt:serverTimestamp()});
  return ref.id;
}

async function scanOne(k){ if(!activeAd)return; await enqueue(k); await triggerScanner(); toast(`Varredura enviada: ${k.keyword}`); }

async function triggerScanner(){
  if(!TRIGGER_URL){ $('robotBadge').textContent='Chromium • fila salva'; return; }
  try{
    const token=await auth.currentUser.getIdToken();
    const r=await fetch(TRIGGER_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({uid})});
    if(!r.ok) throw new Error((await r.text()).slice(0,200));
    $('robotBadge').textContent='Chromium • acionado';
  }catch(e){ console.warn(e); $('robotBadge').textContent='Chromium • aguardando agendado'; toast('Fila salva. O acionador instantâneo falhou; o agendamento do GitHub ainda poderá executar.'); }
}

function listenAds(){
  unsubAds=onSnapshot(collection(db,'users',uid,'ads'),snap=>{
    ads=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>stamp(b.updatedAt)-stamp(a.updatedAt)||String(a.mlb).localeCompare(String(b.mlb)));
    const prev=activeAd?.mlb;
    renderAds(); renderAdSelect();
    if(prev){ const p=ads.find(a=>a.mlb===prev); if(p)selectAd(p,false); else if(ads[0])selectAd(ads[0]); }
    else if(ads[0])selectAd(ads[0]); else clearAdView();
  });
}

function renderAdSelect(){ $('adSelect').innerHTML=ads.length?ads.map(a=>`<option value="${a.mlb}" ${activeAd?.mlb===a.mlb?'selected':''}>${esc(a.name||a.title||a.mlb)} • ${a.mlb}</option>`).join(''):'<option value="">Nenhum MLB salvo</option>'; }

function renderAds(){ const q=$('filterInput').value.trim().toLowerCase(); const filtered=ads.filter(a=>!q||`${a.mlb} ${a.name||''} ${a.title||''}`.toLowerCase().includes(q)); $('adsList').innerHTML=filtered.map(a=>`<div class="ad-card ${activeAd?.mlb===a.mlb?'active':''}" data-mlb="${a.mlb}"><button class="delete-ad" data-del="${a.mlb}" title="Excluir">×</button><strong>${esc(a.name||a.title||a.mlb)}</strong><small>${a.mlb}${a.title&&a.title!==a.name?' • '+esc(short(a.title,58)):''}</small></div>`).join('')||'<div class="subtle">Nenhum MLB salvo.</div>';
  document.querySelectorAll('.ad-card').forEach(el=>el.onclick=(ev)=>{ if(ev.target.dataset.del)return; const a=ads.find(x=>x.mlb===el.dataset.mlb); if(a)selectAd(a); });
  document.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=async(ev)=>{ ev.stopPropagation(); const mlb=btn.dataset.del; if(confirm(`Excluir ${mlb} e seus dados?`)) await deleteDoc(doc(db,'users',uid,'ads',mlb)); });
}

function selectAd(ad,rerender=true){ activeAd=ad; selectedKeyword=null; if(unsubKeywords)unsubKeywords(); $('adSelect').value=ad.mlb; if(rerender)renderAds(); $('chartSubtitle').textContent=`${ad.name||ad.title||ad.mlb} • ${ad.mlb}`; listenKeywords(); }

function listenKeywords(){
  unsubKeywords=onSnapshot(collection(db,'users',uid,'ads',activeAd.mlb,'keywords'),snap=>{
    keywords=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.keyword).localeCompare(String(b.keyword),'pt-BR'));
    renderKeywords(); renderMetrics(); drawBarChart();
    if(selectedKeyword){ const k=keywords.find(x=>x.id===selectedKeyword.id); if(k) selectedKeyword=k; }
  });
}

function clearAdView(){ keywords=[]; $('keywordsTable').innerHTML='<tr><td colspan="9">Salve um MLB para começar.</td></tr>'; $('chartSubtitle').textContent='Selecione um MLB.'; renderMetrics(); drawBarChart(); drawLineChart([]); }

function renderKeywords(){
  $('keywordsTable').innerHTML=keywords.map(k=>{
    const general=num(k.referenceGeneralPosition), organic=num(k.referenceOrganicPosition), ad=num(k.referenceAdsPosition), delta=num(k.deltaOrganic ?? k.deltaGeneral);
    const deltaHtml=delta===null?'—':delta>0?`<span class="delta up">▲ ${delta}</span>`:delta<0?`<span class="delta down">▼ ${Math.abs(delta)}</span>`:'<span class="delta flat">0</span>';
    const range=k.requestedRuns===3 && k.referenceMin && k.referenceMax?`<span class="range">#${k.referenceMin}–#${k.referenceMax}</span>`:'—';
    return `<tr><td><span class="kw-link" data-hist="${k.id}">${esc(k.keyword)}</span></td><td>${general?`<span class="pos">#${general}</span>`:'—'}</td><td>${organic?`<span class="pos org">#${organic}</span>`:'—'}</td><td>${ad?`<span class="pos ad">#${ad}</span>`:'—'}</td><td>${deltaHtml}</td><td>${range}</td><td>${fmtTime(k.lastCheckedAt)}</td><td><input class="auto-toggle" type="checkbox" data-auto="${k.id}" ${k.autoEnabled?'checked':''}></td><td><button class="btn btn-dark btn-sm" data-scan="${k.id}">Varrer</button> <button class="btn btn-ghost btn-sm" data-delete="${k.id}">×</button></td></tr>`;
  }).join('')||'<tr><td colspan="9">Nenhuma palavra salva neste MLB.</td></tr>';
  document.querySelectorAll('[data-scan]').forEach(b=>b.onclick=()=>{const k=keywords.find(x=>x.id===b.dataset.scan);if(k)scanOne(k)});
  document.querySelectorAll('[data-hist]').forEach(b=>b.onclick=()=>{const k=keywords.find(x=>x.id===b.dataset.hist);if(k)selectKeyword(k)});
  document.querySelectorAll('[data-auto]').forEach(b=>b.onchange=async()=>{const k=keywords.find(x=>x.id===b.dataset.auto);if(!k)return;const freq=Number($('autoFrequency').value||24);await updateDoc(doc(db,'users',uid,'ads',activeAd.mlb,'keywords',k.id),{autoEnabled:b.checked,frequencyHours:freq,nextScanAt:b.checked?new Date():null,updatedAt:serverTimestamp()});toast(b.checked?`Automação ligada: ${k.keyword}`:`Automação desligada: ${k.keyword}`)});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const k=keywords.find(x=>x.id===b.dataset.delete);if(k&&confirm(`Excluir a palavra “${k.keyword}”?`))await deleteDoc(doc(db,'users',uid,'ads',activeAd.mlb,'keywords',k.id))});
}

function listenQueue(){
  unsubQueue=onSnapshot(collection(db,'users',uid,'queue'),snap=>{
    const arr=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>stamp(b.createdAt)-stamp(a.createdAt)).slice(0,14);
    $('queueList').innerHTML=arr.map(q=>`<div class="queue-item ${q.status||'pending'}"><b>${esc(q.keyword||'')}</b> • ${esc(q.adId||'')}<br><span>${statusLabel(q.status)}${q.status==='running'&&q.progressPage?` • pág. ${q.progressPage} • ${q.progressChecked||0} verificados`:''}${q.finishedAt?' • '+fmtTime(q.finishedAt):''}${q.error?' • '+esc(q.error):''}</span></div>`).join('')||'<div class="subtle">Fila vazia.</div>';
    const running=arr.filter(x=>x.status==='running'), pending=arr.filter(x=>x.status==='pending');
    if(running.length){const q=running[0];$('robotBadge').textContent=`Chromium • pág. ${q.progressPage||1}`;$('statusTitle').textContent=`Pesquisando “${q.keyword}”`;$('statusText').textContent=`${q.progressChecked||0} resultados verificados.`;}
    else if(pending.length){$('robotBadge').textContent=`Chromium • ${pending.length} na fila`;$('statusTitle').textContent='Pesquisa aguardando início';$('statusText').textContent='O pedido já está salvo no Firebase.';}
    else{$('robotBadge').textContent='Chromium • fila limpa';$('statusTitle').textContent='Sistema pronto';$('statusText').textContent='Os resultados ficam salvos no Firebase com data e hora.';}
  });
}
const statusLabel=s=>({pending:'aguardando',running:'pesquisando',done:'concluído',error:'erro'}[s]||s||'aguardando');

async function selectKeyword(k){ selectedKeyword=k; $('historyTitle').textContent=k.keyword; const q=query(collection(db,'users',uid,'ads',activeAd.mlb,'keywords',k.id,'history'),orderBy('checkedAt','asc'),limit(100)); const snap=await getDocs(q); drawLineChart(snap.docs.map(d=>d.data())); }

function num(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
function renderMetrics(){ const found=keywords.map(k=>num(k.referenceOrganicPosition)).filter(Boolean); $('mBest').textContent=found.length?'#'+Math.min(...found):'—'; $('mAvg').textContent=found.length?'#'+Math.round(found.reduce((s,n)=>s+n,0)/found.length):'—'; $('mTop10').textContent=found.filter(n=>n<=10).length; const last=keywords.map(k=>k.lastCheckedAt).filter(Boolean).sort((a,b)=>stamp(b)-stamp(a))[0]; $('mLast').textContent=last?fmtTime(last):'—'; }

function setupCanvas(canvas){ const dpr=Math.max(1,window.devicePixelRatio||1),rect=canvas.getBoundingClientRect(); const w=Math.max(500,rect.width||900),h=Math.max(270,rect.height||310); canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);return{c,w,h}; }
function drawBarChart(){ const {c,w,h}=setupCanvas($('barChart'));c.clearRect(0,0,w,h); const data=keywords.map(k=>({k,val:num(k.referenceOrganicPosition)||num(k.referenceGeneralPosition),isAd:!num(k.referenceOrganicPosition)&&num(k.referenceAdsPosition)})).filter(x=>x.val).sort((a,b)=>a.val-b.val); if(!data.length)return emptyChart(c,w,h,'Sem medições para este MLB'); const pad={l:165,r:28,t:20,b:28},row=(h-pad.t-pad.b)/data.length,max=Math.max(10,...data.map(x=>x.val));c.font='12px Segoe UI';data.forEach((x,i)=>{const y=pad.t+i*row+row*.18,bh=Math.min(24,row*.56),bw=(w-pad.l-pad.r)*(x.val/max);c.fillStyle='#dfe8f5';c.textAlign='right';c.fillText(short(x.k.keyword,22),pad.l-10,y+bh*.72);c.fillStyle=x.isAd?'#ffb52e':'#20d66b';c.fillRect(pad.l,y,Math.max(3,bw),bh);c.fillStyle='#fff';c.textAlign='left';c.fillText('#'+x.val,pad.l+Math.max(5,bw)+6,y+bh*.72)});c.strokeStyle='#3a4d67';c.beginPath();c.moveTo(pad.l,pad.t-5);c.lineTo(pad.l,h-pad.b);c.stroke(); }
function drawLineChart(hist){ const {c,w,h}=setupCanvas($('lineChart'));c.clearRect(0,0,w,h); const data=hist.map(x=>({...x,val:num(x.referenceOrganicPosition)||num(x.referenceGeneralPosition)||num(x.organicPosition)||num(x.generalPosition)})).filter(x=>x.val); if(!data.length)return emptyChart(c,w,h,'Sem histórico desta palavra'); const pad={l:48,r:24,t:22,b:36},max=Math.max(...data.map(x=>x.val)),min=Math.max(1,Math.min(...data.map(x=>x.val))-2),range=Math.max(1,max-min);c.strokeStyle='#30465f';c.fillStyle='#7890b0';c.font='11px Segoe UI';for(let i=0;i<5;i++){const y=pad.t+(h-pad.t-pad.b)*i/4,v=Math.round(min+range*i/4);c.beginPath();c.moveTo(pad.l,y);c.lineTo(w-pad.r,y);c.stroke();c.fillText('#'+v,6,y+4)}const pts=data.map((d,i)=>({x:pad.l+(w-pad.l-pad.r)*(data.length===1?.5:i/(data.length-1)),y:pad.t+(h-pad.t-pad.b)*(d.val-min)/range,d}));c.strokeStyle='#ffe600';c.lineWidth=2;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();pts.forEach(p=>{c.fillStyle=num(p.d.referenceOrganicPosition)||num(p.d.organicPosition)?'#20d66b':'#ffb52e';c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fill()}); }
function emptyChart(c,w,h,text){c.fillStyle='#6f88a8';c.font='14px Segoe UI';c.textAlign='center';c.fillText(text,w/2,h/2)}
window.addEventListener('resize',()=>{if(activeAd){drawBarChart();if(selectedKeyword)selectKeyword(selectedKeyword)}});
