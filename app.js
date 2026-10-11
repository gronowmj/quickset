/* Quickset — original daily quick crossword. Plain JS, no dependencies. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---- tiny SHA-256 (works without a secure context) ----
function sha256(str){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes=new TextEncoder().encode(str); const l=bytes.length;
  const n=((l+9+63)>>6)<<6; const m=new Uint8Array(n); m.set(bytes); m[l]=0x80;
  const dv=new DataView(m.buffer); dv.setUint32(n-4,l*8); dv.setUint32(n-8,Math.floor(l/0x20000000));
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w=new Uint32Array(64); const r=(x,k)=>(x>>>k)|(x<<(32-k));
  for(let o=0;o<n;o+=64){
    for(let i=0;i<16;i++) w[i]=dv.getUint32(o+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(b,17)^r(b,19)^(b>>>10)))|0;}
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){const t1=(hh+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0;const t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
    h=[h[0]+a,h[1]+b,h[2]+c,h[3]+d,h[4]+e,h[5]+f,h[6]+g,h[7]+hh].map(x=>x|0);
  }
  const out=new Uint8Array(32); const od=new DataView(out.buffer); h.forEach((x,i)=>od.setUint32(i*4,x>>>0)); return out;
}
const hex = b => Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
function decode(salt,id,x){
  const enc=Uint8Array.from(atob(x),c=>c.charCodeAt(0)); let key=[]; let i=0;
  while(key.length<enc.length){ key=key.concat(Array.from(sha256(`${salt}|${id}|${i}`))); i++; }
  return String.fromCharCode(...enc.map((b,j)=>b^key[j]));
}

// ---- dates ----
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayIso = () => params.get('today') && TEST ? params.get('today') : iso(new Date());
const nice = s => { const [y,m,d]=s.split('-').map(Number); const dt=new Date(y,m-1,d); return `${DAYS[dt.getDay()]} ${d} ${MONTHS[m-1]}`; };

// ---- state ----
let P, ans={}, cellsEl=[], grid=[], entryAt={}, S, sel={r:0,c:0,dir:'A'}, timerId=null, audio=null, muted=localStorage.getItem('qs-muted')==='1';
const key = () => 'qs-'+P.date;
function save(){ localStorage.setItem(key(), JSON.stringify(S)); }

async function boot(){
  const idx = await (await fetch('puzzles/index.json',{cache:'no-cache'})).json();
  const today = todayIso();
  const avail = idx.dates.filter(d=>d<=today);
  let want = params.get('date');
  if(!want || want>today || !idx.dates.includes(want)) want = avail[avail.length-1];
  if(!want){ $('#clueText').textContent='No puzzle yet — check back soon.'; return; }
  window.__avail = avail;
  P = await (await fetch(`puzzles/${want}.json`,{cache:'no-cache'})).json();
  for(const e of P.entries){
    const a=decode(P.salt,e.id,e.x);
    if(hex(sha256(`${P.salt}:${e.id}:${a}`)).slice(0,16)!==e.h) console.warn('answer check mismatch',e.id);
    ans[e.id]=a;
  }
  setup();
}

function setup(){
  const H=P.height,W=P.width;
  $('#puzzleTitle').textContent = `Quickset No. ${P.no} · ${nice(P.date)}`;
  document.title = `Quickset No. ${P.no}`;
  S = JSON.parse(localStorage.getItem(key())||'null') || {letters:{},revealed:{},bad:{},hints:0,time:0,done:false};
  // solution map
  for(const e of P.entries){
    e.cells=[]; for(let i=0;i<e.len;i++){ const r=e.row+(e.dir==='D'?i:0), c=e.col+(e.dir==='A'?i:0); e.cells.push([r,c]); entryAt[`${r},${c},${e.dir}`]=e; grid[`${r},${c}`]=ans[e.id][i]; }
  }
  const g=$('#grid'); g.innerHTML=''; g.style.setProperty('--cols',W); g.style.setProperty('--rows',H);
  const nums={}; P.entries.forEach(e=>nums[`${e.row},${e.col}`]=e.num);
  for(let r=0;r<H;r++) for(let c=0;c<W;c++){
    const d=document.createElement('div'); d.className='cell'+(P.grid[r][c]==='#'?' blk':'');
    d.dataset.r=r; d.dataset.c=c;
    if(P.grid[r][c]!=='#'){ if(nums[`${r},${c}`]) d.innerHTML=`<span class="n">${nums[`${r},${c}`]}</span>`; d.insertAdjacentHTML('beforeend','<span class="l"></span>'); d.addEventListener('click',()=>tapCell(r,c)); }
    g.appendChild(d); cellsEl[`${r},${c}`]=d;
  }
  const first=P.entries.find(e=>e.dir==='A')||P.entries[0];
  sel={r:first.row,c:first.col,dir:first.dir};
  buildKeyboard(); bind(); render(); startTimer();
  if(S.done) setTimeout(showDone,50);
  if(TEST) window.__qs = { solve(){ for(const k in grid){ if(!k.includes(',')) continue; S.letters[k]=grid[k]; } save(); render(); checkDone(); },
    entries:()=>P.entries.map(e=>({id:e.id,len:e.len,clue:e.clue})), sel:()=>({...sel}), state:()=>S };
}

const white = (r,c) => P.grid[r] && P.grid[r][c]==='.';
const cur = () => entryAt[`${sel.r},${sel.c},${sel.dir}`] || entryAt[`${sel.r},${sel.c},${sel.dir==='A'?'D':'A'}`];
function tapCell(r,c){
  unlockAudio();
  if(S.done) return;
  if(sel.r===r && sel.c===c){ const other=sel.dir==='A'?'D':'A'; if(entryAt[`${r},${c},${other}`]) sel.dir=other; }
  else { sel.r=r; sel.c=c; if(!entryAt[`${r},${c},${sel.dir}`]) sel.dir=sel.dir==='A'?'D':'A'; }
  render();
}
function toggleDir(){ const other=sel.dir==='A'?'D':'A'; if(entryAt[`${sel.r},${sel.c},${other}`]){ sel.dir=other; render(); } }
function ordered(){ return [...P.entries.filter(e=>e.dir==='A'),...P.entries.filter(e=>e.dir==='D')]; }
function gotoEntry(e, firstEmpty=true){
  let cell=e.cells[0];
  if(firstEmpty){ const emp=e.cells.find(([r,c])=>!S.letters[`${r},${c}`]); if(emp) cell=emp; }
  sel={r:cell[0],c:cell[1],dir:e.dir}; render();
}
function stepClue(d){ const L=ordered(); const i=L.indexOf(cur()); gotoEntry(L[(i+d+L.length)%L.length]); }
function nextUnfinished(){
  const L=ordered(); const i=L.indexOf(cur());
  for(let k=1;k<=L.length;k++){ const e=L[(i+k)%L.length]; if(e.cells.some(([r,c])=>!S.letters[`${r},${c}`])) return gotoEntry(e); }
}
function type(ch){
  unlockAudio(); if(S.done) return;
  const e=cur(); if(!e) return; const k=`${sel.r},${sel.c}`;
  if(S.revealed[k]){ /* locked */ } else { S.letters[k]=ch; delete S.bad[k]; }
  const i=e.cells.findIndex(([r,c])=>r===sel.r&&c===sel.c);
  // next empty cell in word after i
  let nxt=null; for(let j=i+1;j<e.len;j++){ const [r,c]=e.cells[j]; if(!S.letters[`${r},${c}`]){ nxt=e.cells[j]; break; } }
  if(!nxt) for(let j=0;j<i;j++){ const [r,c]=e.cells[j]; if(!S.letters[`${r},${c}`]){ nxt=e.cells[j]; break; } }
  save();
  if(nxt){ sel.r=nxt[0]; sel.c=nxt[1]; render(); }
  else { render(); if(!checkDone()) nextUnfinished(); }
}
function del(){
  if(S.done) return; const e=cur(); if(!e) return; const k=`${sel.r},${sel.c}`;
  if(S.letters[k] && !S.revealed[k]){ delete S.letters[k]; delete S.bad[k]; }
  else { const i=e.cells.findIndex(([r,c])=>r===sel.r&&c===sel.c); if(i>0){ [sel.r,sel.c]=e.cells[i-1]; const k2=`${sel.r},${sel.c}`; if(!S.revealed[k2]){ delete S.letters[k2]; delete S.bad[k2]; } } }
  save(); render();
}
function move(dr,dc){
  let r=sel.r+dr,c=sel.c+dc;
  while(r>=0&&c>=0&&r<P.height&&c<P.width){ if(white(r,c)){ sel.r=r; sel.c=c; const d=dr?'D':'A'; if(entryAt[`${r},${c},${d}`]) sel.dir=d; else if(!entryAt[`${r},${c},${sel.dir}`]) sel.dir=d==='A'?'D':'A'; render(); return; } r+=dr;c+=dc; }
}

function render(){
  const e=cur(); const inWord=new Set(e?e.cells.map(([r,c])=>`${r},${c}`):[]);
  for(let r=0;r<P.height;r++) for(let c=0;c<P.width;c++){
    if(!white(r,c)) continue; const k=`${r},${c}`, d=cellsEl[k];
    d.classList.toggle('sel', !S.done && r===sel.r && c===sel.c);
    d.classList.toggle('word', !S.done && inWord.has(k));
    d.classList.toggle('bad', !!S.bad[k]); d.classList.toggle('rev', !!S.revealed[k]);
    d.querySelector('.l').textContent=S.letters[k]||'';
  }
  if(e) $('#clueText').innerHTML=`<b>${e.num}${e.dir==='A'?'a':'d'}</b>${escapeHtml(e.clue)}`;
  $('#soundBtn').textContent='Sound: '+(muted?'off':'on');
}
const escapeHtml = s => s.replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

function checkDone(){
  const keys=Object.keys(grid).filter(k=>k.includes(','));
  if(keys.some(k=>!S.letters[k])) return false;
  if(keys.every(k=>S.letters[k]===grid[k])){ S.done=true; save(); stopTimer(); render(); chime(true); setTimeout(showDone,400); return true; }
  toast('Grid full, but something isn’t right yet'); return false;
}

// ---- hints ----
function hint(kind){
  const e=cur(); if(!e||S.done) return;
  const reveal=k=>{ if(S.letters[k]!==grid[k]||!S.revealed[k]){ S.letters[k]=grid[k]; S.revealed[k]=1; delete S.bad[k]; } };
  const check=list=>{ let wrong=0; for(const k of list){ if(S.letters[k] && S.letters[k]!==grid[k]){ S.bad[k]=1; wrong++; } } toast(wrong?`${wrong} wrong letter${wrong>1?'s':''}`:'No mistakes so far'); };
  const ek=e.cells.map(([r,c])=>`${r},${c}`);
  if(kind==='letter'){ reveal(`${sel.r},${sel.c}`); S.hints++; }
  else if(kind==='word'){ ek.forEach(reveal); S.hints++; }
  else if(kind==='checkword'){ check(ek); S.hints++; }
  else if(kind==='checkgrid'){ check(Object.keys(grid).filter(k=>k.includes(','))); S.hints++; }
  else if(kind==='grid'){ return ask('Reveal the whole grid? This ends the puzzle.',()=>{ Object.keys(grid).filter(k=>k.includes(',')).forEach(reveal); S.hints++; S.revealedAll=true; save(); render(); checkDone(); }); }
  save(); render();
  if(kind==='letter'||kind==='word'){ if(!checkDone() && kind==='word') nextUnfinished(); }
}

// ---- timer ----
function startTimer(){ showTime(); if(S.done||timerId) return; timerId=setInterval(()=>{ if(document.hidden) return; S.time++; showTime(); if(S.time%5===0) save(); },1000); }
function stopTimer(){ clearInterval(timerId); timerId=null; showTime(); }
const fmt = t => `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
function showTime(){ $('#timer').textContent=fmt(S.time); }

// ---- sound ----
function unlockAudio(){ if(audio) { if(audio.state==='suspended') audio.resume(); return; } try{ audio=new (window.AudioContext||window.webkitAudioContext)(); const b=audio.createBuffer(1,1,22050); const s=audio.createBufferSource(); s.buffer=b; s.connect(audio.destination); s.start(0);}catch(e){} }
function chime(big){
  if(muted||!audio) return;
  const notes=big?[659.25,783.99,987.77,1318.5]:[783.99,1046.5]; const t0=audio.currentTime+0.02;
  notes.forEach((f,i)=>{ const o=audio.createOscillator(), g=audio.createGain(); o.type='sine'; o.frequency.value=f; const t=t0+i*0.13;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.18,t+0.015); g.gain.exponentialRampToValueAtTime(0.0008,t+1.1);
    o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t+1.2); });
}

// ---- UI chrome ----
function buildKeyboard(){
  const rows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']; const k=$('#kbd'); k.innerHTML='';
  rows.forEach((row,i)=>{ const d=document.createElement('div'); d.className='krow';
    for(const ch of row){ const b=document.createElement('button'); b.className='key'; b.textContent=ch; b.dataset.k=ch; d.appendChild(b); }
    if(i===2){ const b=document.createElement('button'); b.className='key del'; b.dataset.k='DEL'; b.setAttribute('aria-label','Delete'); b.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9l5 6M17 9l-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; d.appendChild(b); }
    k.appendChild(d); });
  k.addEventListener('pointerdown',ev=>{ const b=ev.target.closest('.key'); if(!b) return; ev.preventDefault(); b.dataset.k==='DEL'?del():type(b.dataset.k); });
}
function open(id){ document.querySelectorAll('.sheet').forEach(s=>s.hidden=true); $(id).hidden=false; }
function closeAll(){ document.querySelectorAll('.sheet').forEach(s=>s.hidden=true); }
let confirmFn=null;
function ask(text,fn){ $('#confirmText').textContent=text; confirmFn=fn; open('#confirm'); }
let toastT; function toast(t){ const el=$('#toast'); el.textContent=t; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>el.hidden=true,1800); }
function showDone(){
  const label=`Quickset No. ${P.no}`;
  $('#doneStats').textContent = S.revealedAll ? `Grid revealed after ${fmt(S.time)}.` : `Solved in ${fmt(S.time)} with ${S.hints} hint${S.hints===1?'':'s'}.`;
  const share = `${label} · ${nice(P.date)}\n⏱ ${fmt(S.time)}  💡 ${S.hints} hint${S.hints===1?'':'s'}\n${S.hints===0?'🟪🟪🟪🟪🟪 clean solve':'🟪🟪🟪🟧 solved'}`;
  $('#shareText').textContent=share; $('#shareBtn').onclick=async()=>{ try{ if(navigator.share) await navigator.share({text:share}); else { await navigator.clipboard.writeText(share); toast('Copied'); } }catch(e){} };
  open('#done');
}
function showArchive(){
  const L=$('#archiveList'); L.innerHTML='';
  [...window.__avail].reverse().forEach(d=>{ const b=document.createElement('button'); b.className='day'; b.dataset.date=d;
    const no=Math.round((new Date(d)-new Date(window.__avail[0]))/864e5)+1; const st=JSON.parse(localStorage.getItem('qs-'+d)||'null');
    b.innerHTML=`Quickset No. ${no} · ${nice(d)} <span>${st&&st.done?'Solved':st&&Object.keys(st.letters||{}).length?'Started':''}</span>`;
    b.onclick=()=>{ const u=new URL(location.href); u.searchParams.set('date',d); location.href=u.toString(); }; L.appendChild(b); });
  open('#archive');
}
function bind(){
  $('#prevClue').onclick=()=>stepClue(-1); $('#nextClue').onclick=()=>stepClue(1);
  $('#clueText').onclick=toggleDir;
  $('#hintBtn').onclick=()=>{ unlockAudio(); open('#hintMenu'); };
  $('#moreBtn').onclick=()=>{ unlockAudio(); open('#moreMenu'); };
  document.querySelectorAll('[data-hint]').forEach(b=>b.onclick=()=>{ closeAll(); hint(b.dataset.hint); });
  document.querySelectorAll('.sheet').forEach(s=>s.addEventListener('click',ev=>{ if(ev.target===s||ev.target.closest('.cancel')) closeAll(); }));
  $('#confirmOk').onclick=()=>{ closeAll(); const f=confirmFn; confirmFn=null; f&&f(); };
  $('#archiveBtn').onclick=showArchive;
  $('#helpBtn').onclick=()=>open('#help');
  $('#soundBtn').onclick=()=>{ muted=!muted; localStorage.setItem('qs-muted',muted?'1':'0'); render(); if(!muted){ unlockAudio(); chime(false);} };
  $('#restartBtn').onclick=()=>ask('Clear all your letters and restart the timer?',()=>{ S={letters:{},revealed:{},bad:{},hints:0,time:0,done:false}; save(); stopTimer(); startTimer(); render(); });
  document.addEventListener('keydown',ev=>{
    if(ev.metaKey||ev.ctrlKey||ev.altKey) return;
    if(document.querySelectorAll('.sheet:not([hidden])').length){ if(ev.key==='Escape') closeAll(); return; }
    const k=ev.key;
    if(/^[a-zA-Z]$/.test(k)){ type(k.toUpperCase()); ev.preventDefault(); }
    else if(k==='Backspace'||k==='Delete'){ del(); ev.preventDefault(); }
    else if(k==='ArrowLeft'){ move(0,-1); ev.preventDefault(); } else if(k==='ArrowRight'){ move(0,1); ev.preventDefault(); }
    else if(k==='ArrowUp'){ move(-1,0); ev.preventDefault(); } else if(k==='ArrowDown'){ move(1,0); ev.preventDefault(); }
    else if(k==='Tab'){ stepClue(ev.shiftKey?-1:1); ev.preventDefault(); }
    else if(k===' '||k==='Enter'){ toggleDir(); ev.preventDefault(); }
  });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); });
}
boot().catch(err=>{ console.error(err); $('#clueText').textContent='Could not load the puzzle.'; });
})();
