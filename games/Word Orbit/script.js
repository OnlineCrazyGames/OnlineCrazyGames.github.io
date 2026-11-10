const DICT=new Set(["the","and","for","you","are","not","but","can","had","was","his","her","one","all","out","cat","dog","sun","moon","star","orbit","word","game","play","time","best","score","love","fire","water","earth","space","neon","code","data","atom","nova","flux","void","warp","glow","beam","core","zone","ring","planet","comet","rocket","blast","shine","power","level","magic","music","sound","touch","mouse","click","drag","make","find","list","book","look","good","great","super","ultra","mega","hyper","hello","world","swift","quick","bright","light","night","day","sky","blue","red","green","pink","games","merge","stack","block","drop","prism","rush","swarm","forge","nebula","dog","cat","hat","bat","rat","mat","sat","run","fun","sun","top","pop","hop","map","tap","car","bar","far","war","sea","tea","bee","see","you","are","one","two","three","four","five","code","play","word","time","love"]);
const LETTERS="AEIOU".repeat(4)+"BCDFGHJKLMNPQRSTVWXYZ".repeat(2);
const STATE={letters:[],selected:[],score:0,best:0,wordsFound:[],time:60,running:false,paused:false,muted:false,particles:[]};
try{STATE.best=parseInt(localStorage.getItem('word-orbit-best')||'0');STATE.muted=localStorage.getItem('word-orbit-muted')==='1';}catch{}
let audioCtx=null;function getAudio(){if(!audioCtx){try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch{}}return audioCtx;}
function tone(f,d=0.15,v=0.15){if(STATE.muted)return;const c=getAudio();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;g.gain.value=v;g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+d);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+d);}
function sfxSel(){tone(400,0.08,0.12);}function sfxGood(){tone(300,0.12,0.15);setTimeout(()=>tone(600,0.15,0.15),90);}function sfxBad(){tone(150,0.2,0.12);}function sfxOver(){tone(100,0.5,0.2);}
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),wordsEl=document.getElementById('words'),timeEl=document.getElementById('time');
const curEl=document.getElementById('currentWord'),ptsEl=document.getElementById('points'),foundEl=document.getElementById('found'),nextEl=document.getElementById('nextLetters');
bestEl.textContent=STATE.best;document.getElementById('bestStart').textContent=STATE.best;
function resize(){const r=canvas.parentElement.getBoundingClientRect();const d=window.devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);}window.addEventListener('resize',resize);resize();
function randomLetters(n=12){const arr=[];for(let i=0;i<n;i++)arr.push(LETTERS[Math.floor(Math.random()*LETTERS.length)]);return arr;}
function createOrbitLetters(){
  const letters=randomLetters(12);
  const W=canvas.width/(window.devicePixelRatio||1),H=canvas.height/(window.devicePixelRatio||1);
  const R=Math.min(W,H)*0.32;
  STATE.letters=letters.map((ch,i)=>{
    const ang=(i/letters.length)*Math.PI*2;
    return{ch,ang,R:R,speed:0.005,x:0,y:0,r:26,selected:false,id:i};
  });
  nextEl.innerHTML=randomLetters(6).map(l=>"<span>"+l+"</span>").join('');
  updatePos();
}
function updatePos(){
  const W=canvas.width/(window.devicePixelRatio||1),H=canvas.height/(window.devicePixelRatio||1);
  const cx=W/2,cy=H/2;
  for(let L of STATE.letters){L.ang+=L.speed;L.x=cx+Math.cos(L.ang)*L.R;L.y=cy+Math.sin(L.ang)*L.R;}
}
function draw(){
  const d=window.devicePixelRatio||1;const W=canvas.width/d,H=canvas.height/d;ctx.clearRect(0,0,W,H);const cx=W/2,cy=H/2;
  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,Math.min(W,H)*0.32,0,Math.PI*2);ctx.stroke();
  if(STATE.selected.length>1){ctx.strokeStyle='rgba(41,227,208,.9)';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(STATE.selected[0].x,STATE.selected[0].y);for(let i=1;i<STATE.selected.length;i++)ctx.lineTo(STATE.selected[i].x,STATE.selected[i].y);ctx.stroke();}
  for(let L of STATE.letters){
    const sel=L.selected;const grd=ctx.createRadialGradient(L.x-6,L.y-6,6,L.x,L.y,L.r);
    if(sel){grd.addColorStop(0,'#29e3d0');grd.addColorStop(1,'#7c5cff');}else{grd.addColorStop(0,'#ffb3e0');grd.addColorStop(1,'#7c5cff');}
    ctx.fillStyle=grd;ctx.beginPath();ctx.arc(L.x,L.y,L.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='white';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(L.ch,L.x,L.y+1);
    if(sel){ctx.strokeStyle='#29e3d0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(L.x,L.y,L.r+5,0,Math.PI*2);ctx.stroke();}
  }
  for(let p of STATE.particles){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
}
function getLetterAt(x,y){for(let L of STATE.letters){if(Math.hypot(L.x-x,L.y-y)<L.r+14)return L;}return null;}
// FIXED: No distance limit - any word can connect to any word
function selectLetter(L){if(!L||L.selected)return;L.selected=true;STATE.selected.push(L);sfxSel();updateCurrent();}
function updateCurrent(){const word=STATE.selected.map(l=>l.ch).join('');curEl.textContent=word||'-';const isValid=DICT.has(word.toLowerCase());const pts=word.length>=3?word.length*10+(isValid?50:0):0;ptsEl.textContent=word.length===0?"Any letter to any letter - drag freely":isValid?pts+" pts - VALID! Release to submit":pts+" pts";ptsEl.style.color=isValid?'#29e3d0':'#b4abdc';}
function clearSel(){for(let l of STATE.selected)l.selected=false;STATE.selected=[];updateCurrent();}
function submitWord(){const word=STATE.selected.map(l=>l.ch).join('').toLowerCase();if(word.length<3){clearSel();sfxBad();return;}if(!DICT.has(word)){clearSel();sfxBad();curEl.textContent="Not a word!";ptsEl.textContent=word.toUpperCase()+" not in list";setTimeout(updateCurrent,900);return;}if(STATE.wordsFound.includes(word)){clearSel();sfxBad();curEl.textContent="Already found!";setTimeout(updateCurrent,900);return;}STATE.wordsFound.push(word);STATE.score+=word.length*15+50;wordsEl.textContent=STATE.wordsFound.length;scoreEl.textContent=STATE.score;if(STATE.score>STATE.best){STATE.best=STATE.score;bestEl.textContent=STATE.best;try{localStorage.setItem('word-orbit-best',STATE.best);}catch{}}foundEl.innerHTML=STATE.wordsFound.map(w=>"<span>"+w.toUpperCase()+"</span>").join('');for(let L of STATE.selected){const idx=STATE.letters.indexOf(L);if(idx>-1){const ch=LETTERS[Math.floor(Math.random()*LETTERS.length)];STATE.letters[idx].ch=ch;}}const cx=STATE.selected.reduce((s,l)=>s+l.x,0)/STATE.selected.length;const cy=STATE.selected.reduce((s,l)=>s+l.y,0)/STATE.selected.length;for(let i=0;i<16;i++)STATE.particles.push({x:cx,y:cy,vx:(Math.random()-0.5)*7,vy:(Math.random()-0.5)*7-2,life:1,color:'#29e3d0',r:Math.random()*5+2});clearSel();sfxGood();}
let timerInt=null;function loop(){if(!STATE.running||STATE.paused)return;updatePos();for(let p of STATE.particles){p.x+=p.vx;p.y+=p.vy;p.vy+=0.08;p.life-=0.025;}STATE.particles=STATE.particles.filter(p=>p.life>0);draw();requestAnimationFrame(loop);}
function start(){document.getElementById('startOverlay').classList.add('hidden');STATE.running=true;STATE.paused=false;STATE.score=0;STATE.wordsFound=[];STATE.time=60;scoreEl.textContent='0';wordsEl.textContent='0';timeEl.textContent='60';foundEl.innerHTML='';createOrbitLetters();getAudio();requestAnimationFrame(loop);clearInterval(timerInt);timerInt=setInterval(()=>{if(!STATE.running||STATE.paused)return;STATE.time--;timeEl.textContent=STATE.time;if(STATE.time<=0)gameOver();},1000);}
function gameOver(){STATE.running=false;clearInterval(timerInt);sfxOver();document.getElementById('finalScore').textContent=STATE.score;document.getElementById('finalWords').textContent=STATE.wordsFound.length;document.getElementById('bestMsg').textContent=STATE.score>=STATE.best?"New Best!":"Best: "+STATE.best;document.getElementById('overOverlay').classList.remove('hidden');try{localStorage.setItem('word-orbit-best',STATE.best);}catch{}}
function togglePause(){if(!STATE.running)return;STATE.paused=!STATE.paused;document.getElementById('pauseOverlay').classList.toggle('hidden',!STATE.paused);if(!STATE.paused)requestAnimationFrame(loop);}
function toggleMute(){STATE.muted=!STATE.muted;try{localStorage.setItem('word-orbit-muted',STATE.muted?'1':'0');}catch{}document.getElementById('muteBtn').textContent=STATE.muted?'🔇':'🔊';}
let dragging=false;canvas.addEventListener('mousedown',e=>{dragging=true;const r=canvas.getBoundingClientRect();const L=getLetterAt((e.clientX-r.left),(e.clientY-r.top));selectLetter(L);});canvas.addEventListener('mousemove',e=>{if(!dragging)return;const r=canvas.getBoundingClientRect();const L=getLetterAt((e.clientX-r.left),(e.clientY-r.top));selectLetter(L);});window.addEventListener('mouseup',()=>{if(dragging){dragging=false;submitWord();}});canvas.addEventListener('touchstart',e=>{e.preventDefault();dragging=true;const r=canvas.getBoundingClientRect();const t=e.touches[0];const L=getLetterAt((t.clientX-r.left),(t.clientY-r.top));selectLetter(L);},{passive:false});canvas.addEventListener('touchmove',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();const t=e.touches[0];const L=getLetterAt((t.clientX-r.left),(t.clientY-r.top));selectLetter(L);},{passive:false});canvas.addEventListener('touchend',e=>{e.preventDefault();dragging=false;submitWord();});
window.addEventListener('keydown',e=>{if(e.code==='KeyS')createOrbitLetters();if(e.code==='KeyP'||e.code==='Escape')togglePause();if(e.code==='KeyM')toggleMute();if(e.code==='Space'||e.code==='Enter')submitWord();if(e.code==='Backspace')clearSel();});
document.getElementById('playBtn').addEventListener('click',start);document.getElementById('againBtn').addEventListener('click',()=>{document.getElementById('overOverlay').classList.add('hidden');start();});document.getElementById('pauseBtn').addEventListener('click',togglePause);document.getElementById('resumeBtn').addEventListener('click',togglePause);document.getElementById('muteBtn').addEventListener('click',toggleMute);document.getElementById('clearBtn').addEventListener('click',clearSel);document.getElementById('shuffleBtn').addEventListener('click',()=>{createOrbitLetters();});resize();draw();
