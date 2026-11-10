/* Games are discovered automatically from the games/ folder of this repo. */
const OWNER='OnlineCrazyGames',REPO='OnlineCrazyGames.github.io';
const $=s=>document.querySelector(s);
const COL=['#ffb3d1','#a8f0c6','#ffe7a0','#c9bbff','#9fe9f2','#ffd59a','#ffc9e3','#b6f0a8'],EM=['🎮','🕹️','👾','🚀','🎲','🧩','🏁','⭐'];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const enc=p=>p.split('/').map(encodeURIComponent).join('/');
const pretty=n=>n.replace(/[-_]+/g,' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
const hsh=s=>[...s].reduce((a,c)=>a+c.charCodeAt(0),0);
function fromPaths(paths){
 const m={};
 paths.forEach(p=>{const a=p.split('/');if(['games','game'].includes(a[0].toLowerCase())&&a.length>2)(m[a[0]+'/'+a[1]]??=[]).push(a.slice(2).join('/'))});
 return Object.keys(m).sort().map(k=>{const f=m[k],n=k.split('/')[1],h=hsh(n);
  const html=f.find(x=>x.toLowerCase()==='index.html')||f.find(x=>/^[^/]+\.html?$/i.test(x));if(!html)return null;
  const img=f.find(x=>/^(thumbnail|thumb|cover|icon|logo|preview)\.(png|jpe?g|webp|gif|svg)$/i.test(x));
  return{id:n,title:pretty(n),blurb:'Play now in your browser.',cat:'Games',emoji:EM[h%EM.length],color:COL[h%COL.length],url:enc(k+'/'+html),thumb:img&&enc(k+'/'+img),meta:f.includes('game.json')&&enc(k+'/game.json')}}).filter(Boolean);
}
async function loadGames(){
 const ck='ocg-games-v2';let stale=null;
 try{const c=JSON.parse(localStorage.getItem(ck));if(c){stale=c.d;if(Date.now()-c.t<6e5)return c.d}}catch(e){}
 let list=null;
 for(const br of ['main','master']){try{const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${br}?recursive=1`);if(r.ok){list=fromPaths((await r.json()).tree.map(x=>x.path));break}}catch(e){}}
 if(!list){ // fallback: optional games.json containing an array of folder names
  try{const r=await fetch('games.json');if(r.ok)list=fromPaths((await r.json()).flatMap(n=>['games/'+n+'/index.html']))}catch(e){}}
 if(!list)return stale||[];
 await Promise.all(list.filter(g=>g.meta).map(async g=>{try{const j=await (await fetch(g.meta)).json();
  Object.assign(g,{title:j.title||g.title,blurb:j.description||g.blurb,cat:j.category||g.cat,emoji:j.emoji||g.emoji,color:j.color||g.color})}catch(e){}}));
 try{localStorage.setItem(ck,JSON.stringify({t:Date.now(),d:list}))}catch(e){}
 return list;
}
const card=g=>`<a class="card" href="play.html?g=${encodeURIComponent(g.id)}"><div class="thumb" style="--c:${g.color}" aria-hidden="true">${g.thumb?`<img src="${g.thumb}" alt="" loading="lazy">`:`<span>${g.emoji}</span>`}<i class="go">▶ Play</i></div><div class="b"><span class="tag">${esc(g.cat)}</span><h3>${esc(g.title)}</h3><p>${esc(g.blurb)}</p></div></a>`;
const none='<p class="empty">No games found yet. Add a folder inside <b>games/</b> with an <b>index.html</b> and it will appear here.</p>';
const page=document.body.dataset.page;
const nav=(p,l,h)=>`<li><a href="${h}"${page===p?' aria-current="page"':''}>${l}</a></li>`;
$('#top').innerHTML=`<nav class="wrap" aria-label="Main"><a class="logo" href="index.html"><span>🎮</span> Online Crazy Games</a><ul>${nav('home','Home','index.html')}${nav('games','All games','games.html')}<li><a href="https://github.com/${OWNER}/${REPO}">GitHub</a></li></ul></nav>`;
$('#foot').innerHTML=`<footer class="wrap"><span>© ${new Date().getFullYear()} Online Crazy Games</span><span>Free to play, always. <a href="games.html">Browse all games</a></span></footer>`;
loadGames().then(G=>{
 const cats=[...new Set(G.map(g=>g.cat))];
 if(page==='home'){
  $('#count').textContent=G.length;
  const t=G.length?G.map(g=>g.emoji+' '+g.title):['🎮 Free games','🕹️ No downloads','🚀 Play instantly','⭐ No sign-up'];
  $('#mq').innerHTML=(t.join('   ✦   ')+'   ✦   ').repeat(Math.ceil(12/t.length)*2);
  $('#pop').innerHTML=G.length?G.slice(0,6).map(card).join(''):none;
  $('#stick').innerHTML=Array.from({length:6},(_,i)=>{const g=G[i];return`<a href="${g?'play.html?g='+encodeURIComponent(g.id):'games.html'}" style="--c:${g?g.color:COL[i]}" aria-label="${g?esc(g.title):'Games'}">${g?g.thumb?`<img src="${g.thumb}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:18px">`:g.emoji:EM[i]}</a>`}).join('');
  $('#rnd').onclick=()=>{if(G.length)location.href='play.html?g='+encodeURIComponent(G[Math.random()*G.length|0].id);else location.href='games.html'};
  if(cats.length>1)$('#cats').innerHTML=cats.map(c=>`<a class="chip" href="games.html?c=${encodeURIComponent(c)}">${esc(c)}</a>`).join('');else $('#catsec').hidden=true;
 }
 if(page==='games'){
  const tools=$('#tools'),q=$('#q'),grid=$('#grid');let cat=new URLSearchParams(location.search).get('c')||'All';
  if(cats.length>1)['All',...cats].forEach(c=>{const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=c;b.onclick=()=>{cat=c;draw()};tools.insertBefore(b,q)});
  function draw(){[...tools.querySelectorAll('.chip')].forEach(b=>b.setAttribute('aria-pressed',b.textContent===cat));
   const t=q.value.toLowerCase(),l=G.filter(g=>(cat==='All'||g.cat===cat)&&(g.title+g.blurb).toLowerCase().includes(t));
   grid.innerHTML=l.length?l.map(card).join(''):(G.length?'<p class="empty">No games match. Try another search.</p>':none)}
  q.oninput=draw;draw();
 }
 if(page==='play'){
  const id=new URLSearchParams(location.search).get('g'),g=G.find(x=>x.id===id);
  $('#more').innerHTML=G.filter(x=>x!==g).slice(0,3).map(card).join('');
  if(!g){$('#title').textContent='Game not found';$('#how').textContent='Pick a game from the list below.';$('#stage').remove();$('.acts').remove()}
  else{document.title=g.title+' – Online Crazy Games';$('#title').textContent=g.title;$('#how').textContent=g.blurb;
   const f=$('#frame');f.title=g.title;f.src=g.url;$('#new').href=g.url;$('#rl').onclick=()=>{f.src=g.url};
   $('#fs').onclick=()=>{(f.requestFullscreen||f.webkitRequestFullscreen||(()=>{})).call(f)}}
 }
});

document.addEventListener('pointermove',e=>{const c=e.target.closest&&e.target.closest('.card');if(!c)return;const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.setProperty('--rx',(-y*8)+'deg');c.style.setProperty('--ry',(x*10)+'deg');c.style.setProperty('--mx',(x+.5)*100+'%');c.style.setProperty('--my',(y+.5)*100+'%')});
document.addEventListener('pointerout',e=>{const c=e.target.closest&&e.target.closest('.card');if(c){c.style.setProperty('--rx','0deg');c.style.setProperty('--ry','0deg')}});
