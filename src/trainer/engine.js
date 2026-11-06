/* Trainer engine: lessons, practice games, Air Defender and Tower Control.
   React mounts it with mountTrainer(rootElement, bridge) and gets back an unmount function.
   bridge = { user(): string|null, online: boolean, onGameOver(result), openLeaderboard(game, level), debug?: boolean }
   result = { game: 'defender'|'tower', level, levelName, score, wave, map } */
import DATA_SETS from '../data/sets.json';
import DATA_GEO from '../data/geo.json';

export function mountTrainer(root, bridge = {}) {
root.innerHTML = '<div class="app" id="app"><main id="main" class="stack"></main></div><div id="toast" role="status" hidden></div>';
/* ================= catalog =================
   Everything comes from the airport database (DATA_SETS) and map data (DATA_GEO).
   DATA_SETS.airports: key = IATA code, value = { city, place, st, lat, lon, label?, tip?, clue? }
   DATA_SETS.sets: course sets in order; each panel is one state map listing its codes.
   Add a code: add it to airports, then list it in a set's panel. Nothing else changes. */
const DECKS=DATA_SETS.sets;
const REGIONS=DATA_SETS.regions;
const GROUPS=[
 {name:'Easy Three',sub:'The code is just the first three letters of the name.'},
 {name:'Hidden Letters',sub:'All three letters are inside the name, in the same order. You just skip the letters in between.'},
 {name:'Story Codes',sub:'Some of the letters are not in the name, so each one comes with a short saying to remember it by.'},
];
const INTERVALS=[0,5*60e3,30*60e3,864e5,3*864e5,7*864e5];
const RANKS=['Ground Crew','Ramp Agent','Dispatcher','First Officer','Captain','Chief Pilot'];
const XP_PER=400;
const KEY='wyo-airport-codes-v2',OLDKEY='wyo-airport-codes-v1';
const DEFAULT_SET='wy';

/* ================= state ================= */
function blank(){return{v:2,items:{},sel:(DECKS.find(d=>d.id===DEFAULT_SET)||DECKS[0]).panels.flatMap(p=>p.codes),custom:[],xp:0,streak:{n:0,last:''},
  best:{quick:0,match:0,mock:0},hs:{cadet:[],pilot:[],ace:[],doomsday:[]},ths:{trainee:[],controller:[],chief:[]},mute:false,diff:'cadet',tdiff:'trainee',t:0};}
function merge(o){const b=blank();if(!o||typeof o!=='object')return b;
  if(o.items&&typeof o.items==='object')for(const c in o.items){const it=o.items[c];if(it&&typeof it==='object')b.items[c]={box:+it.box||0,due:+it.due||0,r:+it.r||0,w:+it.w||0,learned:!!it.learned};}
  if(Array.isArray(o.sel))b.sel=o.sel.filter(x=>typeof x==='string');
  if(Array.isArray(o.custom))b.custom=o.custom.filter(c=>c&&/^[A-Z]{3}$/.test(c.code)&&typeof c.city==='string').map(c=>({code:c.code,city:c.city.slice(0,40),tip:typeof c.tip==='string'?c.tip.slice(0,160):''}));
  b.xp=+o.xp||0;if(o.streak)Object.assign(b.streak,o.streak);if(o.best)Object.assign(b.best,o.best);
  if(o.hs)for(const k of ['cadet','pilot','ace','doomsday'])if(Array.isArray(o.hs[k]))b.hs[k]=o.hs[k].slice(0,10);
  if(o.ths)for(const k of ['trainee','controller','chief'])if(Array.isArray(o.ths[k]))b.ths[k]=o.ths[k].slice(0,10);
  if(['trainee','controller','chief'].includes(o.tdiff))b.tdiff=o.tdiff;
  b.mute=!!o.mute;if(['cadet','pilot','ace'].includes(o.diff))b.diff=o.diff;b.t=+o.t||0;return b;}
let S=(()=>{try{const r=localStorage.getItem(KEY)||localStorage.getItem(OLDKEY);if(r)return merge(JSON.parse(r));}catch(e){}return blank();})();
let remote=null,syncText='Progress saves in this browser',saveTimer=null;
function save(){S.t=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}clearTimeout(saveTimer);saveTimer=setTimeout(remoteSave,1200);}
async function remoteSave(){if(!remote)return;try{await remote.set({json:JSON.stringify(S),t:S.t});setSync('Progress synced to your account');}catch(e){setSync('Progress saves on this device');}}
function setSync(t){syncText=t;const el=document.getElementById('sync');if(el)el.textContent=t;}
/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function flaps(code,anim,cls=''){return `<span class="flaps ${cls}">${[...code].map(ch=>`<span class="flap${anim?' flip':''}">${esc(ch)}</span>`).join('')}</span>`;}
function hl(a){let j=0,out='';for(const ch of a.city){if(j<3&&ch.toUpperCase()===a.code[j]){out+=`<b class="hit">${esc(ch)}</b>`;j++;}else out+=esc(ch);}return out;}
const letters=s=>s.toUpperCase().replace(/[^A-Z]/g,'');
function isSub(code,str){let j=0;for(const ch of str){if(ch===code[j])j++;if(j===3)return true;}return false;}
function classify(a){const L=letters(a.city);return L.startsWith(a.code)?0:isSub(a.code,L)?1:2;}
function autoTip(a){
  if(a.g===0){const w=a.city.split(/\s*[\/(]\s*|\s+-\s+/)[0];return `Just the first three letters of ${w}: ${a.code}.`;}
  if(a.g===1)return `The letters ${a.code.split('').join(', ')} are all inside the name ${a.city}, in that order. Find them and skip the rest.`;
  return `Not all of these letters are in the name. Make up a short phrase about ${a.city} whose words start with ${a.code.split('').join(', ')}.`;}
function autoClue(a){return a.g===0?'First 3 letters of the name':a.g===1?'All 3 letters are in the name':`Starts with ${a.code[0]}. Use your phrase`;}
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;}
function today(o=0){return new Date(Date.now()-o*864e5).toLocaleDateString('en-CA');}
function touchDay(){const d=today();if(S.streak.last===d)return;S.streak.n=S.streak.last===today(1)?S.streak.n+1:1;S.streak.last=d;}
function streakNow(){return (S.streak.last===today()||S.streak.last===today(1))?S.streak.n:0;}
function levelInfo(xp){const lvl=Math.floor(xp/XP_PER)+1;return{lvl,rank:RANKS[Math.min(RANKS.length-1,lvl-1)],pct:Math.round((xp%XP_PER)/XP_PER*100)};}
function addXP(n){if(n<=0)return;const before=levelInfo(S.xp).lvl;S.xp+=n;const after=levelInfo(S.xp);if(after.lvl>before)toast(`Level ${after.lvl}: ${after.rank}`);save();}
function grade(code,ok,kind){const it=S.items[code];if(!it)return;const now=Date.now();touchDay();
  if(ok){it.r++;
    if(kind==='recall')it.box=Math.min(5,it.box+1);
    else if(kind==='recog'&&it.box<2)it.box++;
    it.due=now+(kind==='hint'?60e3:INTERVALS[it.box]);
  }else{it.w++;it.box=Math.max(0,it.box-(kind==='recall'?2:1));it.due=now;}
  save();}
function fmtTime(ms){const s=ms/1000;return s<60?s.toFixed(1)+'s':Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');}
let toastT;function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,2400);}

/* catalog build */
let AP=[],BY={},DECKMAP={},ALLDECKS=[],CODEDECKS={};
function rebuild(){
  const decks=DECKS.map(d=>({id:d.id,name:d.name,region:d.region,tag:d.tag,grid:d.grid,sectors:d.sectors,panels:d.panels.map(p=>({...p}))}));
  if(S.custom.length)decks.push({id:'my',name:'My Codes',region:'My Codes',custom:true,panels:null});
  AP=[];BY={};DECKMAP={};CODEDECKS={};
  for(const d of decks){
    d.airports=d.custom?S.custom.map(c=>({...c,place:c.city,st:''}))
      :d.panels.flatMap((p,pi)=>p.codes.filter(c=>DATA_SETS.airports[c]).map(code=>({code,...DATA_SETS.airports[code],pi})));
    d.airports.forEach(a=>{a.deck=d.id;a.g=classify(a);if(!a.tip)a.tip=autoTip(a);if(!a.clue)a.clue=autoClue(a);if(!a.place)a.place=a.city;
      if(!BY[a.code]){BY[a.code]=a;AP.push(a);}(CODEDECKS[a.code]||(CODEDECKS[a.code]=new Set())).add(d.id);
      if(!S.items[a.code])S.items[a.code]={box:0,due:0,r:0,w:0,learned:false};});
    layout(d);DECKMAP[d.id]=d;if(d.sectors){buildSubs(d);for(const sd of d.sub)DECKMAP[sd.id]=sd;}}
  ALLDECKS=decks;
  S.sel=[...new Set(S.sel.filter(c=>BY[c]))];
}
/* a set with "sectors" gets one full-size map per region (plus that region's insets) for the games */
function buildSubs(d){
  d.sub=d.panels.map((p,i)=>[p,i]).filter(([p])=>!p.inset).map(([p,i],n)=>{
    const idxs=[i,...d.panels.map((q,j)=>[q,j]).filter(([q])=>q.inset&&(q.inset.in||0)===i).map(x=>x[1])];
    const sd={id:d.id+'~'+n,name:p.name,parent:d,isSub:true,region:d.region,
      panels:idxs.map(j=>{const q={...d.panels[j]};delete q.idx;if(q.inset)q.inset={...q.inset,in:0};return q;}),
      airports:d.airports.filter(a=>idxs.includes(a.pi)).map(a=>({...a,pi:idxs.indexOf(a.pi)}))};
    layout(sd);return sd;});}
const lab=a=>a.label||a.city;
const studied=a=>{const it=S.items[a.code];return it&&(it.learned||it.r+it.w>0);};
const twins=a=>AP.filter(o=>o.code!==a.code&&o.code.slice(0,2)===a.code.slice(0,2)&&[...(CODEDECKS[o.code]||[])].some(x=>CODEDECKS[a.code]?.has(x)));
/* a code can be in more than one set (ATL is in Georgia and in the 50 Busiest).
   Its "home" is the set you have most of picked, so lessons and maps show the set you're studying. */
function deckRank(){const s=selSet();return ALLDECKS.map((d,i)=>({d,i,f:d.airports.length?d.airports.filter(a=>s.has(a.code)).length/d.airports.length:0})).sort((a,b)=>b.f-a.f||a.i-b.i).map(x=>x.d);}
/* sets worth offering as a game map: ones that are "home" to at least min of the picked codes */
function homeDecks(min=3){const s=selSet(),cnt={};const R=deckRank();for(const c of s){const d=R.find(d=>d.airports.some(a=>a.code===c));if(d)cnt[d.id]=(cnt[d.id]||0)+1;}
  return ALLDECKS.filter(d=>(cnt[d.id]||0)>=min);}
function homeOf(code){for(const d of deckRank()){const a=d.airports.find(x=>x.code===code);if(a)return a;}return BY[code];}
function placeHL(a){const h=hl(a);return a.place.startsWith(a.city)?h+esc(a.place.slice(a.city.length)):`${h} <span class="placest">${esc(a.place)}</span>`;}

/* ---------- map layout: one panel per state, laid out in a grid ---------- */
const GEO_STATE_BOX={};
for(const st in DATA_GEO.states){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const r of DATA_GEO.states[st].rings)for(const [x,y] of r){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}GEO_STATE_BOX[st]=[x0,y0,x1,y1];}
function frameFor(p,d){const f=DATA_GEO.frames[p.st]?.slice()||GEO_STATE_BOX[p.st]?.slice()||[-125,25,-66,50];
  for(const a of d.airports.filter(a=>a.pi===p.idx)){const k=.15;if(a.lon<f[0]+k)f[0]=a.lon-k;if(a.lon>f[2]-k)f[2]=a.lon+k;if(a.lat<f[1]+k)f[1]=a.lat-k;if(a.lat>f[3]-k)f[3]=a.lat+k;}
  return f;}
function layout(d){
  const n=d.airports.length;
  if(d.custom){d.W=700;d.H=404;d.box={x0:30,y0:24,x1:670,y1:376};d.P=[{st:'',name:'',x0:30,y0:24,x1:670,y1:376,proj:null}];
    d.airports.forEach((a,i)=>{const cols=Math.max(1,Math.ceil(Math.sqrt(n*1.8))),rows=Math.ceil(n/cols),w=600/cols,h=280/rows,c=i%cols,r=Math.floor(i/cols);
      a.x=50+w*(c+.5)+(hash(a.code)-.5)*w*.3;a.y=80+h*(r+.5)+(hash(a.code+'y')-.5)*h*.3;a.pi=0;});return;}
  const base=d.panels.filter(p=>!p.inset),W0=700,pad=14,gap=12,np=base.length,cols=np===1?1:2,head=np>1?22:0,cw=(W0-2*pad-gap*(cols-1))/cols;
  const info=d.panels.map((p,i)=>{p.idx=i;const f=frameFor(p,d),k=Math.cos((f[1]+f[3])/2*Math.PI/180),gw=(f[2]-f[0])*k,gh=f[3]-f[1];return{p,f,k,gw,gh,asp:gh/gw};});
  const lim=np===1?1.3:1.25,minA=np===1?.5:.62;
  // default: two panels per row. A set can give its own grid: rows of columns, each column stacks panels.
  const rows=d.grid?d.grid.map(r=>r.map(c=>({w:c.w,p:c.p.map(i=>info[i])})))
    :Array.from({length:Math.ceil(np/cols)},(_,r)=>info.filter(o=>!o.p.inset).slice(r*cols,r*cols+cols).map(o=>({w:1,p:[o]})));
  let y=pad;d.P=[];
  function mk(o,x0,y0,w,ch,head){const x1=x0+w,y1=y0+ch;
    const s=Math.min(w/o.gw,ch/o.gh),cxg=(o.f[0]+o.f[2])/2,cyg=(o.f[1]+o.f[3])/2;
    const L0=cxg-(w/s)/2/o.k,T=cyg+(ch/s)/2;
    const P={st:o.p.st,name:o.p.name,zoom:o.p.zoom,dense:!!o.p.dense,inset:!!o.p.inset,x0,y0,x1,y1,k:o.k,s,L0,T,head};
    P.proj=(lat,lon)=>({x:x0+(lon-L0)*o.k*s,y:y0+(T-lat)*s});
    P.geo=[L0,T-ch/s,L0+w/(s*o.k),T];
    d.P[o.p.idx]=P;}
  for(const row of rows){
    const ncol=d.grid?row.length:cols,sw=d.grid?row.reduce((t,c)=>t+c.w,0):cols,avail=W0-2*pad-gap*(ncol-1);
    row.forEach(c=>{c.cw=avail*c.w/sw;c.hs=c.p.map(o=>Math.max(c.cw*Math.min(o.asp,lim),c.cw*minA));c.nat=c.hs.reduce((t,h)=>t+h,0)+(c.p.length-1)*(head+gap);});
    const RH=Math.max(...row.map(c=>c.nat));
    // a lone panel in the last row is centred
    let x=pad+(!d.grid&&row.length===1&&np>1?(cw+gap)/2:0);
    for(const c of row){const extra=(RH-c.nat)/c.p.length;let yy=y;
      c.p.forEach((o,j)=>{const ch=c.hs[j]+extra;mk(o,x,yy+head,c.cw,ch,np>1);yy+=head+ch+gap;});
      x+=c.cw+gap;}
    y+=head+RH+gap;
  }
  // inset panels sit inside another panel, in an empty stretch of ocean (box is [lon0,lat0,lon1,lat1] on the host map)
  d.blocks=[];
  for(const o of info.filter(o=>o.p.inset)){const H0=d.P[o.p.inset.in||0],b=o.p.inset.box,a=H0.proj(b[3],b[0]),c=H0.proj(b[1],b[2]);
    mk(o,a.x,a.y,c.x-a.x,c.y-a.y,false);d.blocks.push({x0:a.x-3,y0:a.y-3,x1:c.x+3,y1:c.y+3});}
  d.W=W0;d.H=Math.round(y-gap+pad+24);d.box={x0:pad,y0:pad,x1:W0-pad,y1:d.H-24};
  d.airports.forEach(a=>{const p=d.P[a.pi].proj(a.lat,a.lon);a.x=p.x;a.y=p.y;});
  const MIN=14;
  for(let it=0;it<40;it++){let moved=false;
    for(let i=0;i<d.airports.length;i++)for(let j=i+1;j<d.airports.length;j++){const a=d.airports[i],b=d.airports[j];if(a.pi!==b.pi)continue;
      let dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy);if(dd>=MIN)continue;if(dd<.01){dx=1;dy=0;dd=1;}
      const push=(MIN-dd)/2+.1;a.x-=dx/dd*push;a.y-=dy/dd*push;b.x+=dx/dd*push;b.y+=dy/dd*push;moved=true;}
    for(const a of d.airports){const P=d.P[a.pi];a.x=clampv(a.x,P.x0+9,P.x1-9);a.y=clampv(a.y,P.y0+9,P.y1-9);}
    if(!moved)break;}
  // dashed box on a panel showing where a zoomed-in panel is
  for(const P of d.P)P.zooms=(P.zoom||[]).map(j=>{const Z=d.P[j],a=P.proj(Z.geo[3],Z.geo[0]),b=P.proj(Z.geo[1],Z.geo[2]);
    // connector lines from the dashed box to the zoomed panel when it sits inside this one
    const ln=Z.inset?[[a.x,b.y,Z.x0,Z.y0],[b.x,b.y,Z.x1,Z.y0]]:[];return{x:a.x,y:a.y,w:b.x-a.x,h:b.y-a.y,ln};});
}
const selSet=()=>new Set(S.sel);
function SET(){const s=selSet();return AP.filter(a=>s.has(a.code));}
function weight(a){const it=S.items[a.code];return (6-it.box)*(it.due<=Date.now()?2:1);}
function pickQueue(n,prev,pool=SET()){const out=[],count={};const cap=pool.length>=n?1:Math.ceil(n/Math.max(1,pool.length))+1;
  for(let k=0;k<n;k++){let p=pool.filter(a=>a.code!==prev&&(count[a.code]||0)<cap);if(!p.length)p=pool.filter(a=>a.code!==prev);if(!p.length)p=pool;
    const ws=p.map(weight);let r=Math.random()*ws.reduce((x,y)=>x+y,0),pick=p[p.length-1];
    for(let j=0;j<p.length;j++){r-=ws[j];if(r<=0){pick=p[j];break;}}
    out.push(pick.code);count[pick.code]=(count[pick.code]||0)+1;prev=pick.code;}
  return out;}
function pickDistinct(n,pool=SET()){return pool.map(a=>[a,weight(a)*Math.random()]).sort((x,y)=>y[1]-x[1]).slice(0,n).map(p=>p[0]);}
function sim(a,b){let s=0;for(const ch of new Set(a.code))if(b.code.includes(ch))s++;if(a.code[0]===b.code[0])s+=1.5;if(a.g===b.g)s+=.5;return s+Math.random()*1.4;}
function options(a,pool=SET()){const base=pool.length>=4?pool:AP;return shuffle([a,...base.filter(x=>x.code!==a.code).map(x=>[x,sim(a,x)]).sort((p,q)=>q[1]-p[1]).slice(0,3).map(p=>p[0])]);}
function groupQueue(codes){const a=shuffle(codes.slice());let b=shuffle(codes.slice());if(b.length>1&&b[0]===a[a.length-1])b.push(b.shift());return a.concat(b);}

/* lessons: one pattern per lesson, max 4 codes */
function lessonsFor(){const out=[],s=selSet(),home={};
  for(const d of deckRank())for(const a of d.airports)if(s.has(a.code)&&!home[a.code])home[a.code]=d.id;
  for(const d of ALLDECKS)for(let g=0;g<3;g++){const list=d.airports.filter(a=>s.has(a.code)&&a.g===g&&home[a.code]===d.id);
    for(let k=0;k<list.length;k+=4)out.push({deck:d,g,codes:list.slice(k,k+4).map(a=>a.code),title:GROUPS[g].name+(list.length>4?` ${k/4+1}`:'')});}
  return out;}
const lessonDone=L=>L.codes.every(c=>S.items[c].learned);

/* ================= maps ================= */
let W=700,H=404,BX={x0:30,y0:24,x1:670,y1:376},SPD=1;
function setWorld(d){W=d.W;H=d.H;BX=d.box;SPD=Math.sqrt(W*H/(700*404));}
function fitCanvas(cv){cv.style.aspectRatio=`${W} / ${H}`;cv.style.width=`min(100%, ${(62*W/H).toFixed(1)}vh)`;cv.style.marginInline='auto';}
const f1=n=>n.toFixed(1);
function ringsPath(rings,P,latlon){let s='';for(const r of rings){for(let i=0;i<r.length;i++){const q=latlon?P.proj(r[i][0],r[i][1]):P.proj(r[i][1],r[i][0]);s+=(i?'L':'M')+f1(q.x)+' '+f1(q.y);}s+='Z';}return s;}
function linesPath(lines,P,latlon){let s='';for(const r of lines){for(let i=0;i<r.length;i++){const q=latlon?P.proj(r[i][0],r[i][1]):P.proj(r[i][1],r[i][0]);s+=(i?'L':'M')+f1(q.x)+' '+f1(q.y);}}return s;}
const boxHit=(b,g)=>!(b[2]<g[0]||b[0]>g[2]||b[3]<g[1]||b[1]>g[3]);
function ringBox(r){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const [x,y] of r){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return [x0,y0,x1,y1];}
/* every layer of one panel, as SVG path strings in world coordinates (made once, then cached) */
function panelPaths(P){
  if(P.paths)return P.paths;
  const g=P.geo,st=P.st,o=DATA_GEO.over[st]||{},ex=DATA_GEO.extras&&DATA_GEO.extras[st];
  const grp=DATA_GEO.groups&&DATA_GEO.groups[st],mine=new Set(grp||[st]);
  const nb=[];for(const k in DATA_GEO.states)if(!mine.has(k)&&boxHit(GEO_STATE_BOX[k],g))for(const r of DATA_GEO.states[k].rings)if(boxHit(ringBox(r),g))nb.push(r);
  const world=DATA_GEO.world.filter(r=>boxHit(ringBox(r),g));
  const own=[];for(const k of mine)if(DATA_GEO.states[k]&&boxHit(GEO_STATE_BOX[k],g))for(const r of DATA_GEO.states[k].rings)if(boxHit(ringBox(r),g))own.push(r);
  const p={world:ringsPath(world,P),nb:ringsPath(nb,P),state:ringsPath(own,P)};
  if(ex){
    p.mtn=ringsPath(ex.mtns.map(m=>m.pts),P,true);p.lake=ringsPath(ex.lakes.map(l=>l.pts),P,true);
    p.river=linesPath(ex.rivers.map(r=>r.pts),P,true);p.road=linesPath(ex.roads.map(r=>r.pts),P,true);
    p.park=ringsPath(ex.parks.map(k=>k.pts),P,true);p.div=linesPath(ex.divide,P,true);
  }else{p.mtn=ringsPath(o.mtns||[],P);p.lake=ringsPath(o.lakes||[],P);p.river=linesPath(o.rivers||[],P);p.road=linesPath(o.roads||[],P);p.park='';p.div='';}
  return P.paths=p;
}
/* hand-made text layers (Wyoming): basins, ranges, towns, parks, landmarks, road shields */
function extrasSVG(P){const ex=DATA_GEO.extras&&DATA_GEO.extras[P.st];if(!ex)return '';const Q=(la,lo)=>P.proj(la,lo);let s='';
  (ex.basins||[]).forEach(b=>{const p=Q(...b.at);s+=`<text class="gbasin" x="${f1(p.x)}" y="${f1(p.y)}" text-anchor="middle">${esc(b.n.toUpperCase())}</text>`;});
  (ex.mtns||[]).filter(m=>m.lab).forEach(m=>{const p=Q(...m.lab);s+=`<text class="gmtnt" x="${f1(p.x)}" y="${f1(p.y)}" text-anchor="middle" transform="rotate(${m.rot||0} ${f1(p.x)} ${f1(p.y)})">${esc(m.n.toUpperCase())}</text>`;});
  (ex.parks||[]).forEach(k=>{const p=Q(...k.lab);s+=`<text class="gparkt" x="${f1(p.x)}" y="${f1(p.y)}">${esc(k.short)}</text>`;});
  if(ex.divideLab){const p=Q(...ex.divideLab);s+=`<text class="gdivt" x="${f1(p.x)}" y="${f1(p.y)}" text-anchor="middle" transform="rotate(${ex.divideRot||0} ${f1(p.x)} ${f1(p.y)})">CONTINENTAL DIVIDE</text>`;}
  (ex.towns||[]).forEach(t=>{const p=Q(...t.at),l=p.x>P.x1-110;s+=`<rect class="gtown" x="${f1(p.x-2)}" y="${f1(p.y-2)}" width="4" height="4"/><text class="gtownt" x="${f1(p.x+(l?-6:6))}" y="${f1(p.y+3.5)}" text-anchor="${l?'end':'start'}">${esc(t.n)}</text>`;});
  (ex.marks||[]).forEach(m=>{const p=Q(...m.at);s+=`<path class="gmark" d="M${f1(p.x)} ${f1(p.y-6)}L${f1(p.x+5)} ${f1(p.y+4)}L${f1(p.x-5)} ${f1(p.y+4)}Z"/><text class="gtownt" x="${f1(p.x+7)}" y="${f1(p.y+4)}">${esc(m.n)}</text>`;});
  (ex.roads||[]).forEach(r=>{const q=r.pts[r.at];if(q){const p=Q(...q);s+=`<g transform="translate(${f1(p.x)},${f1(p.y)})"><rect class="shield" x="-14" y="-8" width="28" height="15" rx="3"/><text class="shieldt" y="3.5" text-anchor="middle">${r.n}</text></g>`;}});
  return s;}
/* label placement: tries spots around each airport, nearest first, and keeps labels off each other */
function placeLabels(items,pts){
  const placed=[],res={},obst=pts.map(p=>({x0:p.x-8,y0:p.y-8,x1:p.x+8,y1:p.y+8}));
  const ov=(a,b)=>Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
  const dirs=[[1,0],[-1,0],[0,-1],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]];
  const order=items.map(it=>[it,items.reduce((n,o)=>n+(Math.hypot(o.x-it.x,o.y-it.y)<90?1:0),0)]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  for(const it of order){let best=null,bs=1e18;
    for(const [ring,dist] of [[0,12],[1,30],[2,54],[3,82]]){
      for(const [ux,uy] of dirs){
        const x0=ux>0?it.x+dist:ux<0?it.x-dist-it.w:it.x-it.w/2;
        const y0=uy<0?it.y-dist*.75-it.h:uy>0?it.y+dist*.75:it.y-it.h/2;
        const R={x0,y0,x1:x0+it.w,y1:y0+it.h},F=it.fr;
        let sc=ring*45+(ux&&uy?5:0)+(Math.max(0,F.x0-R.x0)+Math.max(0,R.x1-F.x1)+Math.max(0,F.y0-R.y0)+Math.max(0,R.y1-F.y1))*80;
        for(const q of placed)sc+=ov(R,q)*14;for(const q of obst)sc+=ov(R,q)*9;for(const q of it.no||[])sc+=ov(R,q)*40;
        if(sc<bs){bs=sc;best={R,ux,uy,ring};}
      }
      if(bs<ring*45+6)break;
    }
    placed.push(best.R);res[it.key]=best;}
  return res;}
const clampv=(v,a,b)=>Math.max(a,Math.min(b,v));
function canvasLabeler(ctx,deck,list,mono){const memo=new Map();
  return (c,fs,vis)=>{const V=vis||list,key=fs+'|'+V.map(q=>q.a.code).join(',');let cache=memo.get(key);
    if(!cache){if(memo.size>80)memo.clear();ctx.save();ctx.font=`600 ${fs}px ${mono}`;
      const items=V.map(q=>{const P=deck.P[q.a.pi]||deck.P[0];return{no:P.inset?null:deck.blocks,key:q.a.code,x:q.x,y:q.y,w:ctx.measureText(lab(q.a)).width+8,h:fs*1.15,fr:{x0:P.x0+2,y0:P.y0+2,x1:P.x1-2,y1:P.y1-2}};});
      ctx.restore();const res=placeLabels(items,list.map(q=>({x:q.x,y:q.y})));cache={};memo.set(key,cache);
      for(const q of V){const r=res[q.a.code].R;cache[q.a.code]={x:r.x0,y:r.y0+fs*.85,bottom:r.y1,lead:res[q.a.code].ring>0,lx:clampv(q.x,r.x0,r.x1),ly:clampv(q.y,r.y0,r.y1)};}}
    return cache[c.a.code];};}
/* canvas map for the games */
function drawGeoCanvas(ctx,d,COL,scale){
  const sm=Math.max(9,8.5/scale),mono=getFamily('mono');
  for(const P of d.P){
    const w=P.x1-P.x0,h=P.y1-P.y0;
    if(!P.st){ctx.save();ctx.strokeStyle=COL.mid;ctx.lineWidth=2;ctx.globalAlpha=.8;ctx.strokeRect(P.x0,P.y0,w,h);ctx.restore();continue;}
    const p=panelPaths(P);if(!P.p2d)P.p2d=Object.fromEntries(Object.entries(p).map(([k,v])=>[k,new Path2D(v||'M0 0')]));const q=P.p2d;
    ctx.save();ctx.beginPath();ctx.rect(P.x0,P.y0,w,h);ctx.clip();
    ctx.fillStyle=COL.sea||COL.bg;ctx.fillRect(P.x0,P.y0,w,h);
    ctx.globalAlpha=.55;ctx.fillStyle=COL.lo;ctx.fill(q.world);ctx.fill(q.nb);
    ctx.globalAlpha=.35;ctx.strokeStyle=COL.mid;ctx.lineWidth=1;ctx.stroke(q.nb);
    ctx.globalAlpha=1;ctx.fillStyle=COL.land||COL.lo;ctx.fill(q.state);
    ctx.save();ctx.clip(q.mtn);ctx.globalAlpha=.2;ctx.strokeStyle=COL.mid;ctx.beginPath();for(let x=P.x0-h;x<P.x1;x+=7){ctx.moveTo(x,P.y0);ctx.lineTo(x+h,P.y1);}ctx.stroke();ctx.restore();
    ctx.globalAlpha=.5;ctx.fillStyle=COL.water;ctx.fill(q.lake);
    ctx.globalAlpha=.55;ctx.strokeStyle=COL.water;ctx.lineWidth=1.3;ctx.stroke(q.river);
    ctx.globalAlpha=.28;ctx.strokeStyle=COL.mid;ctx.lineWidth=2.2;ctx.stroke(q.road);
    if(p.park){ctx.setLineDash([4,5]);ctx.globalAlpha=.45;ctx.lineWidth=1.2;ctx.stroke(q.park);ctx.setLineDash([]);}
    ctx.globalAlpha=.85;ctx.strokeStyle=COL.mid;ctx.lineWidth=1.6;ctx.stroke(q.state);
    if(P.zooms.length){ctx.setLineDash([5,4]);ctx.globalAlpha=.8;ctx.lineWidth=1.4;for(const z of P.zooms){ctx.strokeRect(z.x,z.y,z.w,z.h);ctx.beginPath();for(const l of z.ln){ctx.moveTo(l[0],l[1]);ctx.lineTo(l[2],l[3]);}ctx.stroke();}ctx.setLineDash([]);}
    ctx.restore();
    ctx.save();ctx.strokeStyle=COL.mid;ctx.globalAlpha=P.inset?.95:.7;ctx.lineWidth=P.inset?2:1.5;ctx.strokeRect(P.x0,P.y0,w,h);
    if(P.inset){ctx.globalAlpha=.85;ctx.fillStyle=COL.mid;ctx.font=`600 ${Math.max(9,8.5/scale)}px ${mono}`;ctx.textAlign='left';ctx.fillText(P.name.toUpperCase(),P.x0+5,P.y0+Math.max(12,11/scale));}
    else if(d.isSub){const f=Math.max(13,12/scale);ctx.globalAlpha=.9;ctx.fillStyle=COL.bg;ctx.font=`700 ${f}px ${mono}`;const t=P.name.toUpperCase(),tw=ctx.measureText(t).width;ctx.fillRect(P.x0,P.y0,tw+14,f*1.6);ctx.fillStyle=COL.hi;ctx.textAlign='left';ctx.fillText(t,P.x0+7,P.y0+f*1.15);}
    if(P.head){ctx.globalAlpha=.9;ctx.fillStyle=COL.mid;ctx.font=`600 ${Math.max(11,10/scale)}px ${mono}`;ctx.textAlign='left';ctx.fillText(P.name.toUpperCase(),P.x0+1,P.y0-6);}
    ctx.restore();
  }
}
let mapUid=0;
function mapSVG(deck,o={}){
  const s0=o.codes||selSet(),list=deck.airports.filter(a=>s0.has(a.code)),uid='m'+(++mapUid);
  let s=`<svg class="map" viewBox="0 0 ${deck.W} ${deck.H}" role="img" aria-label="Map of ${esc(deck.name)} with airport locations"><defs><pattern id="mhatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" class="hatch"/></pattern></defs>`;
  for(let i=0;i<deck.P.length;i++){const P=deck.P[i],w=P.x1-P.x0,h=P.y1-P.y0;
    if(!P.st){s+=`<rect class="state" x="${P.x0}" y="${P.y0}" width="${w}" height="${h}" rx="6"/>`;continue;}
    const p=panelPaths(P);
    if(P.head)s+=`<text class="ptitle" x="${f1(P.x0)}" y="${f1(P.y0-7)}">${esc(P.name.toUpperCase())}</text>`;
    s+=`<clipPath id="${uid}c${i}"><rect x="${f1(P.x0)}" y="${f1(P.y0)}" width="${f1(w)}" height="${f1(h)}"/></clipPath><g clip-path="url(#${uid}c${i})">`;
    s+=`<rect class="sea" x="${f1(P.x0)}" y="${f1(P.y0)}" width="${f1(w)}" height="${f1(h)}"/><path class="land2" d="${p.world}"/><path class="land2 nb" d="${p.nb}"/><path class="stfill" d="${p.state}"/>`;
    if(p.park)s+=`<path class="gpark" d="${p.park}"/>`;
    s+=`<path class="gmtn" d="${p.mtn}"/><path class="gmtnh" d="${p.mtn}"/><path class="glake" d="${p.lake}"/><path class="griver" d="${p.river}"/>`;
    if(p.div)s+=`<path class="gdiv" d="${p.div}"/>`;
    s+=`<path class="road" d="${p.road}"/><path class="stline" d="${p.state}"/>${extrasSVG(P)}${P.zooms.map(z=>`<rect class="zoombox" x="${f1(z.x)}" y="${f1(z.y)}" width="${f1(z.w)}" height="${f1(z.h)}"/>${z.ln.map(l=>`<line class="zoombox" x1="${f1(l[0])}" y1="${f1(l[1])}" x2="${f1(l[2])}" y2="${f1(l[3])}"/>`).join('')}`).join('')}</g><rect class="pframe${P.inset?' inset':''}" x="${f1(P.x0)}" y="${f1(P.y0)}" width="${f1(w)}" height="${f1(h)}"/>${P.inset?`<text class="ititle" x="${f1(P.x0+5)}" y="${f1(P.y0+13)}">${esc(P.name.toUpperCase())}</text>`:''}`;
  }
  const show=a=>o.all||(o.labeled&&o.labeled.has(a.code));
  const items=list.filter(show).map(a=>{const P=deck.P[a.pi]||deck.P[0];return{key:a.code,x:a.x,y:a.y,w:Math.max(31,lab(a).length*6.9)+8,h:31,dense:P.dense,no:P.inset?null:deck.blocks,fr:{x0:P.x0+2,y0:P.y0+2,x1:P.x1-2,y1:P.y1-2}};});
  const pts=list.map(a=>({x:a.x,y:a.y}));let L;
  for(let pass=0;pass<4;pass++){L=placeLabels(items,pts);let ch=false;
    for(const it of items)if(!it.short&&L[it.key].ring>=(it.dense?2:3)){it.short=true;it.w=39;it.h=17;ch=true;}
    if(!ch)break;}
  const SH=Object.fromEntries(items.map(it=>[it.key,it.short]));
  for(const a of list){const isT=o.target===a.code;
    const cls=`apt g${a.g}${isT?' target':''}${o.dim&&!show(a)&&!isT?' dim':''}`;
    s+=`<g class="${cls}" transform="translate(${f1(a.x)},${f1(a.y)})">${isT?'<circle class="pulse" r="7"/>':''}<circle class="core" r="6"/><line x1="0" y1="-6" x2="0" y2="-10"/><line x1="0" y1="6" x2="0" y2="10"/><line x1="-6" y1="0" x2="-10" y2="0"/><line x1="6" y1="0" x2="10" y2="0"/></g>`;}
  for(const a of list){if(!L[a.code])continue;const r=L[a.code].R,right=L[a.code].ux<0;
    if(L[a.code].ring>0)s+=`<line class="lead" x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(clampv(a.x,r.x0,r.x1))}" y2="${f1(clampv(a.y,r.y0,r.y1))}"/>`;
    const tx=right?r.x1:r.x0,an=right?'end':'start';
    s+=`<text class="lab-code" x="${f1(tx)}" y="${f1(r.y0+12)}" text-anchor="${an}">${a.code}</text>${SH[a.code]?'':`<text class="lab-city" x="${f1(tx)}" y="${f1(r.y0+26)}" text-anchor="${an}">${esc(lab(a))}</text>`}`;}
  return s+`</svg>`;
}

/* ================= router ================= */
const main=$('#main');let cleanup=null,onHome=false;
function go(fn,...args){if(cleanup){cleanup();cleanup=null;}onHome=fn===home;$('#app').classList.remove('wide');window.scrollTo(0,0);fn(...args);}
function topbar(t,r=''){return `<div class="bar"><button class="back" data-home>‹ Home</button><span class="bar-t">${t}</span><span class="bar-r" id="barR">${r}</span></div>`;}
main.addEventListener('click',e=>{if(e.target.closest('[data-home]'))go(home);const m=e.target.closest('.mapbox');if(m&&!e.target.closest('button,a,input'))m.classList.toggle('zoomed');});
const mcKey=e=>{if(/^[1-4]$/.test(e.key)&&document.activeElement.tagName!=='INPUT'){const b=document.querySelectorAll('.opt')[+e.key-1];if(b)b.click();}};document.addEventListener('keydown',mcKey);
function needSet(fn,min=3){return (...args)=>{if(SET().length<min){main.innerHTML=topbar('Pick codes first')+`<div class="panel"><p>This game needs at least ${min} codes picked. You have ${SET().length}.</p><button class="btn primary" id="toPick">Choose codes</button></div>`;$('#toPick').onclick=()=>go(picker);return;}fn(...args);};}
function wireInput(onThree){const inp=$('#ans');inp.focus({preventScroll:true});
  inp.oninput=()=>{inp.value=inp.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);if(inp.value.length===3)onThree(inp.value);};
  $('#f').onsubmit=e=>{e.preventDefault();if(inp.value.length===3)onThree(inp.value);};return inp;}
const ANSWER=(btn='Check')=>`<form class="answer" id="f" autocomplete="off"><input id="ans" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="3" placeholder="···" aria-label="Airport code"><button class="btn primary" type="submit">${btn}</button></form>`;
function shakeEl(el){el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');}

/* ================= home ================= */
const MODES=[
 {id:'school',name:'Flight School',tag:'Start here',desc:'Step-by-step lessons. 3 or 4 codes at a time.'},
 {id:'recall',name:'Recall',tag:'Type it',desc:'See the city, type the code. The strongest practice.'},
 {id:'quick',name:'Quick Fire',tag:'60 seconds',desc:'Rapid multiple choice. Chain answers for combos.',best:()=>S.best.quick?`Best ${S.best.quick} pts`:''},
 {id:'match',name:'Match',tag:'Tap pairs',desc:'Pair cities with their codes against the clock.',best:()=>S.best.match?`Best ${fmtTime(S.best.match)}`:''},
 {id:'map',name:'Map Run',tag:'Locate',desc:'An airport lights up on the map. Name its code.'},
 {id:'mock',name:'Mock Test',tag:'Test mode',desc:'No hints, results at the end.',best:()=>S.best.mock?`Best ${S.best.mock}%`:''},
];
const VIEWS={school:()=>school(),recall:needSet(()=>recall()),quick:needSet(()=>quick()),match:needSet(()=>match()),map:needSet(()=>mapPick()),mock:needSet(()=>mock()),defender:needSet(()=>defender()),tower:needSet(()=>tower())};
function home(){
  const now=Date.now(),L=levelInfo(S.xp),st=streakNow(),set=SET();
  const due=set.filter(a=>S.items[a.code].due<=now).length;
  const mastered=set.filter(a=>S.items[a.code].box>=4).length;
  const lessons=lessonsFor(),nextL=lessons.find(l=>!lessonDone(l)),doneN=lessons.filter(lessonDone).length;
  const decksUsed=ALLDECKS.filter(d=>d.airports.length&&d.airports.every(a=>selSet().has(a.code))).map(d=>d.name);
  const topHS=Math.max(0,...['cadet','pilot','ace','doomsday'].map(k=>S.hs[k][0]?.s||0)),topTS=Math.max(0,...['trainee','controller','chief'].map(k=>S.ths[k][0]?.s||0));
  let cta,ctaFn;
  if(set.length<3){cta='Choose at least 3 codes';ctaFn=()=>go(picker);}
  else if(nextL){cta=doneN?`Continue Flight School: ${nextL.title}`:'Start Flight School, lesson 1';ctaFn=()=>go(lesson,nextL);}
  else{cta=`Practice now · ${due} ready to review`;ctaFn=()=>go(VIEWS.recall);}
  main.innerHTML=`
  <header class="hero">
    <span class="k">Airport code study deck</span>
    <h1>Airport Code Trainer</h1>
    <div class="boarding" aria-hidden="true"><span class="k">Now boarding</span><span id="bf">${flaps(set.find(studied)?set.find(studied).code:'???')}</span><span class="city" id="bc">${esc((set.find(studied)||set[0]||AP[0]).place)}</span></div>
  </header>
  ${doneN===0?`<section class="panel welcome"><h2>Never studied these before?</h2>
    <p>Every airport has a three-letter code. It's on bag tags, tickets and departure boards. For your test you'll match each city to its code.</p>
    <p>You don't need to know anything yet. <b>Flight School</b> shows you each code with a trick for remembering it, has you type it once while you can see it, then checks you from memory. After that, the games keep it fresh.</p></section>`:''}
  ${DECKMAP.top50&&DECKMAP.top50.airports.every(a=>selSet().has(a.code))?`<section class="hardbar" aria-label="Hardcore set"><span class="hz" aria-hidden="true"></span><div><b>HARDCORE · 50 BUSIEST AIRPORTS</b><span>Six regional maps, coast to coast. In the games the attack moves region to region.</span></div></section>`:''}
  <div class="setbar"><span>Studying <b>${set.length}</b> ${set.length===1?'code':'codes'}${decksUsed.length===1?` · ${esc(decksUsed[0])}`:decksUsed.length>1?` · ${decksUsed.length} sets`:''}</span><button class="btn" id="toPick">Choose set</button></div>
  <button class="btn primary big" id="cta">${esc(cta)}</button>
  <section class="stats" aria-label="Your progress">
    <div><span class="k">Rank · Lv ${L.lvl}</span><span class="v">${L.rank}</span><div class="xpbar"><i style="width:${L.pct}%"></i></div><span class="s">${S.xp} XP</span></div>
    <div><span class="k">Streak</span><span class="v">${st}</span><span class="s">${st===1?'day':'days'}</span></div>
    <div><span class="k">Mastered</span><span class="v">${mastered}/${set.length}</span><span class="s">4+ bars of 5</span></div>
  </section>
  <button class="feature" id="feat"><span class="t">AIR DEFENDER</span><span class="d">Bombs are falling on the map. Type a city's code to shoot them down.</span><span class="b">${topHS?`HIGH SCORE<br>${topHS}`:'NEW GAME'}</span></button>
  ${set.length>=3?`<button class="feature doom" id="feat3"><span class="t">DOOMSDAY</span><span class="d">Real nukes. A city that gets hit is gone for good, and fewer cities means more warheads split. Hold out until the last city falls.</span><span class="b">${S.hs.doomsday[0]?`BEST<br>${S.hs.doomsday[0].s}`:'☢ ARMED'}</span></button>`:''}
  <button class="feature radar" id="feat2"><span class="t">TOWER CONTROL</span><span class="d">You run the control tower. Pilots don't know the codes: guide every plane to refuel and land.</span><span class="b">${topTS?`HIGH SCORE<br>${topTS}`:'NEW GAME'}</span></button>
  <div class="modes">${MODES.map(m=>`<button class="mode" data-mode="${m.id}"><span class="k">${m.tag}</span><span class="name">${m.name}</span><span class="desc">${m.desc}</span><span class="best">${m.id==='school'&&lessons.length?`${doneN}/${lessons.length} lessons done`:m.best?m.best():''}</span></button>`).join('')}</div>
  <section class="panel board">
    <h2>Departures Board</h2>
    <p class="note">Each code fills up to 5 bars as you learn it. Picking from choices fills up to 2 bars. Bars 3 to 5 only fill when you type the code from memory. Tap a row to review it.</p>
    ${set.map(a=>{const b=S.items[a.code].box;return `<button class="brow g${a.g}" data-card="${a.code}">${studied(a)?flaps(a.code):flaps('???')}<span class="city">${esc(a.place)}</span><span class="pips" aria-label="Level ${b} of 5">${[1,2,3,4,5].map(i=>`<i class="${i<=b?'on':''}"></i>`).join('')}</span></button>`;}).join('')||'<p class="note">No codes picked yet.</p>'}
  </section>
  <details class="why"><summary>Why the games work this way</summary>
    <ul>
      <li><b>Recall beats rereading.</b> Pulling an answer out of your head builds memory far better than staring at a list. That's why most games make you type the code.</li>
      <li><b>Short spaced sessions beat cramming.</b> Coming back after you've forgotten a little is what makes it stick. Missed codes come back sooner; known codes wait longer.</li>
      <li><b>Memory tricks speed up learning,</b> but they fade unless you keep reviewing. Flight School gives you the trick, the games keep it fresh.</li>
      <li><b>Mixing it up helps.</b> Wrong choices are look-alike codes (CPR vs CYS) so you learn to tell them apart.</li>
    </ul>
  </details>
  <div class="foot"><span id="sync">${syncText}</span><button class="link" id="reset">Reset progress</button></div>
  <div class="panel confirm" id="rc" hidden><p>Erase all levels, XP, high scores and your own added codes?</p><div class="row"><button class="btn" id="rcNo">Keep progress</button><button class="btn primary" id="rcYes">Erase</button></div></div>`;
  $('#cta').onclick=ctaFn;$('#toPick').onclick=()=>go(picker);$('#feat').onclick=()=>go(VIEWS.defender);$('#feat2').onclick=()=>go(VIEWS.tower);const f3=$('#feat3');if(f3)f3.onclick=()=>{S.diff='doomsday';save();go(VIEWS.defender);};
  main.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>go(VIEWS[b.dataset.mode]));
  main.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>go(cheat,b.dataset.card));
  $('#reset').onclick=()=>{$('#rc').hidden=false;$('#rc').scrollIntoView({block:'center'});};
  $('#rcNo').onclick=()=>$('#rc').hidden=true;
  $('#rcYes').onclick=()=>{S=blank();rebuild();save();go(home);toast('Progress erased');};
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches,cyc=(set.filter(studied).length?set.filter(studied):set.length?set:AP);
  if(!reduce){let k=0;const iv=setInterval(()=>{k=(k+1)%cyc.length;const a=cyc[k];$('#bf').innerHTML=flaps(studied(a)?a.code:'???',true);$('#bc').textContent=a.place;},2600);cleanup=()=>clearInterval(iv);}
}

/* ================= picker ================= */
function picker(){
  let err='';const open=new Set();
  function setRow(d,s){const on=d.airports.filter(a=>s.has(a.code)).length,n=d.airports.length,m=d.airports.filter(a=>S.items[a.code].box>=4).length;
    return `<div class="setrow${on===n?' on':on?' part':''}${d.tag?' hard':''}">
      <label class="deck-h"><input type="checkbox" data-deck="${d.id}" ${on===n?'checked':''}><span class="sn"><b>${esc(d.name)}${d.tag?` <span class="tagb">${esc(d.tag)}</span>`:''}</b><span class="k">${n} codes · ${m} mastered</span></span></label>
      <button class="btn sm" data-only="${d.id}">Study only this</button>
      <details data-open="${d.id}" ${open.has(d.id)?'open':''}><summary>Pick single codes</summary>
      ${d.airports.map(a=>`<div class="pickrow"><label class="pick"><input type="checkbox" data-code="${a.code}" ${s.has(a.code)?'checked':''}>${flaps(a.code)}<span class="c">${esc(a.place)}</span></label>${d.custom?`<button class="link" data-rm="${a.code}">Remove</button>`:''}</div>`).join('')}
      </details></div>`;}
  function render(){const s=selSet();
    const groups=[...REGIONS,'My Codes'].map(r=>[r,ALLDECKS.filter(d=>d.region===r)]).filter(g=>g[1].length);
    main.innerHTML=topbar('Choose Codes',`${S.sel.length} picked`)+`
    <p class="lead">Sets follow your course order. Tap <b>Study only this</b> to focus on one set, or tick several to mix them. Progress on a code is kept even when it's turned off.</p>
    ${S.sel.length<3?'<p class="warn">Pick at least 3 codes to play the games.</p>':''}
    <div class="row"><button class="btn sm" id="selNone">Clear all</button><button class="btn sm" id="selAll">Pick every set</button></div>
    ${groups.map(([r,ds],gi)=>`<section class="region"><h2>${gi+1}. ${esc(r)}</h2>${ds.map(d=>setRow(d,s)).join('')}</section>`).join('')}
    <section class="panel"><h2>Add your own code</h2>
      <form class="addf" id="addf" autocomplete="off">
        <label>City<input id="ac" maxlength="40" placeholder="Omaha"></label>
        <label>Code<input id="ak" maxlength="3" placeholder="OMA" autocapitalize="characters" autocorrect="off" spellcheck="false"></label>
        <label class="full">Memory trick (optional)<input id="at" maxlength="160" placeholder="Leave blank and one is suggested"></label>
        <button class="btn primary full" type="submit">Add code</button>
        ${err?`<p class="err full">${esc(err)}</p>`:''}
      </form>
      <p class="note">Codes added here go in “My Codes” and are saved on this device only.</p>
    </section>`;
    main.querySelectorAll('[data-deck]').forEach(cb=>{const d=DECKMAP[cb.dataset.deck];const on=d.airports.filter(a=>s.has(a.code)).length;cb.indeterminate=on>0&&on<d.airports.length;
      cb.onchange=()=>{const codes=d.airports.map(a=>a.code);S.sel=cb.checked?[...new Set([...S.sel,...codes])]:S.sel.filter(c=>!codes.includes(c));save();keep(render);};});
    main.querySelectorAll('[data-only]').forEach(b=>b.onclick=()=>{const d=DECKMAP[b.dataset.only];S.sel=d.airports.map(a=>a.code);save();toast(`Now studying ${d.name}`);go(home);});
    main.querySelectorAll('details[data-open]').forEach(el=>el.ontoggle=()=>{el.open?open.add(el.dataset.open):open.delete(el.dataset.open);});
    main.querySelectorAll('[data-code]').forEach(cb=>cb.onchange=()=>{const c=cb.dataset.code;S.sel=cb.checked?[...new Set([...S.sel,c])]:S.sel.filter(x=>x!==c);save();keep(render);});
    main.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const c=b.dataset.rm;S.custom=S.custom.filter(x=>x.code!==c);S.sel=S.sel.filter(x=>x!==c);rebuild();save();keep(render);toast(`Removed ${c}`);});
    $('#selNone').onclick=()=>{S.sel=[];save();keep(render);};
    $('#selAll').onclick=()=>{S.sel=AP.map(a=>a.code);save();keep(render);};
    const ak=$('#ak');ak.oninput=()=>{ak.value=ak.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);};
    $('#addf').onsubmit=e=>{e.preventDefault();const city=$('#ac').value.trim(),code=ak.value,tip=$('#at').value.trim();
      if(!city){err='Type the city name.';return keep(render);}
      if(!/^[A-Z]{3}$/.test(code)){err='A code is exactly 3 letters.';return keep(render);}
      if(BY[code]){err=`${code} is already in the list (${BY[code].place}).`;return keep(render);}
      err='';S.custom.push({code,city,tip});S.sel.push(code);rebuild();save();open.add('my');keep(render);toast(`Added ${code} · ${city}`);};
  }
  function keep(fn){const y=window.scrollY;fn();window.scrollTo(0,y);}
  render();
}

/* ================= flight school ================= */
function school(){
  const lessons=lessonsFor(),nextL=lessons.find(l=>!lessonDone(l));
  main.innerHTML=topbar('Flight School')+`
  <section class="panel"><h2>How this works</h2>
    <p class="lead">Every airport has a three-letter code. Most codes are built from the city's name in one of three ways, so each lesson teaches one way with 3 or 4 codes.</p>
    <p class="lead">For each code you'll <b>see it</b>, <b>type it once</b> while it's on screen, then <b>type it from memory</b>. Anything you miss comes back until you get it.</p></section>
  ${lessons.length?lessons.map((L,i)=>{const done=lessonDone(L),isNext=L===nextL;return `<button class="lrow g${L.g}${done?' done':''}${isNext?' next':''}" data-l="${i}"><span class="num">${i+1}</span><span><span class="lt">${esc(L.title)}</span><br><span class="ls">${esc(L.deck.name)} · ${L.codes.map(c=>esc(BY[c].city)).join(', ')}</span></span><span class="st">${done?'Done ✓':isNext?'Next':'Start'}</span></button>`;}).join(''):'<p class="note">Pick some codes first.</p>'}
  <div class="row"><button class="btn" id="cheatB">Open the cheat sheet</button><button class="btn" id="pickB">Choose codes</button></div>`;
  main.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>go(lesson,lessons[+b.dataset.l]));
  $('#cheatB').onclick=()=>go(cheat);$('#pickB').onclick=()=>go(picker);
}
function lesson(L){
  const steps=[];L.codes.forEach((c,idx)=>{steps.push({t:'meet',c,n:idx+1});steps.push({t:'copy',c});});
  shuffle(L.codes.slice()).forEach(c=>steps.push({t:'quiz',c}));
  let i=0,timer=null;const missed=new Set(),extra={};
  function render(){
    const s=steps[i],a=L.deck.airports.find(x=>x.code===s.c)||BY[s.c],deck=DECKMAP[a.deck];
    let h=topbar(L.title,`${Math.min(i+1,steps.length)}/${steps.length}`)+`<div class="progress"><i style="width:${i/steps.length*100}%"></i></div><div class="stage g${a.g}">`;
    if(s.t==='meet'){
      h+=`<span class="k">New code ${s.n} of ${L.codes.length}</span>
      ${s.n===1?`<div class="pattern g${L.g}"><b>This lesson's pattern: ${GROUPS[L.g].name}.</b> ${GROUPS[L.g].sub}</div>`:''}
      <div class="prompt">${esc(a.place)}</div>
      <div>${flaps(a.code,true,'huge')}</div>
      ${a.g<2?`<p><span class="k">See it in the name</span><br><span style="font-size:1.4rem;font-weight:700">${hl(a)}</span></p>`:'<p><span class="k">The trick</span></p>'}
      ${twins(a).length?`<p class="careful">Careful, look-alike: ${twins(a).map(o=>`<b>${o.code}</b> is ${esc(o.place)}`).join(' · ')}</p>`:''}
      <p class="lead">${esc(a.tip)}</p>
      <button class="btn primary big" id="nx">Got it</button>
      ${deck.region?`<div class="mapbox">${mapSVG(deck,{target:a.code,codes:new Set([a.code]),all:true})}</div>`:''}`;
    }else if(s.t==='copy'){
      h+=`<span class="k">Your turn · copy it</span><div class="prompt">${esc(a.place)}</div>
      <p class="lead">Type <b class="ghost" style="font-size:1.3rem">${a.code}</b> to lock it in.</p>${ANSWER('Enter')}<div class="fb" id="fb"></div>`;
    }else{
      h+=`<span class="k">Memory check · no peeking</span><div class="prompt">${esc(a.place)}</div>${ANSWER()}
      <div class="fb" id="fb" aria-live="polite"></div><div class="row"><button class="btn" type="button" id="idk">I don't remember</button></div>`;
    }
    main.innerHTML=h+`</div>`;
    if(s.t==='meet'){$('#nx').onclick=next;$('#nx').focus({preventScroll:true});return;}
    let mode='ask';
    const inp=wireInput(v=>{
      if(mode==='lock')return;
      if(s.t==='copy'||mode==='fix'){
        if(v===a.code){mode='lock';inp.disabled=true;$('#fb').innerHTML='<span class="ok">Locked in.</span>';timer=setTimeout(next,450);}
        else{inp.value='';shakeEl(inp);$('#fb').innerHTML=`<span class="tipline">Copy it exactly: <b>${a.code}</b></span>`;}
        return;}
      if(v===a.code){mode='lock';inp.disabled=true;if(!missed.has(a.code))grade(a.code,true,'recall');
        $('#fb').innerHTML=`<span class="ok">Correct: ${a.code} · ${esc(a.place)}</span>`;timer=setTimeout(next,650);}
      else miss(v);});
    const miss=v=>{mode='fix';missed.add(a.code);grade(a.code,false,'recall');
      extra[a.code]=(extra[a.code]||0)+1;if(extra[a.code]<=3)steps.push({t:'quiz',c:a.code});
      $('#barR').textContent=`${i+1}/${steps.length}`;
      $('#fb').innerHTML=`<span class="no">${v?`${esc(v)} isn't it. `:''}${esc(a.place)} is</span>${flaps(a.code,true)}<span class="tipline">${esc(a.tip)}</span><span class="tipline">Type <b>${a.code}</b> now. It'll come back once more before the lesson ends.</span>`;
      inp.value='';inp.focus();const b=$('#idk');if(b)b.disabled=true;};
    const idk=$('#idk');if(idk)idk.onclick=()=>{if(mode==='ask')miss('');};
  }
  function next(){i++;if(i>=steps.length)return done();render();}
  function done(){
    L.codes.forEach(c=>S.items[c].learned=true);addXP(40);save();
    const ls=lessonsFor(),nl=ls.find(x=>!lessonDone(x));
    main.innerHTML=topbar(L.title)+`<div class="result"><span class="k">Lesson complete · +40 XP</span><div class="big">${L.codes.length} new</div><p>${missed.size?`You needed a second look at ${missed.size}. That's normal; they'll show up more in practice.`:'Perfect from memory on the first try.'}</p></div>
      ${L.codes.map(c=>{const a=BY[c];return `<div class="mrow g${a.g}">${flaps(a.code)}<div><div class="c">${placeHL(a)}</div><div class="t">${esc(a.tip)}</div></div></div>`;}).join('')}
      ${nl?`<button class="btn primary big" id="nl">Next lesson: ${esc(nl.title)}</button>`:`<div class="panel"><b>All lessons done.</b><p class="note">Now drill them: Recall daily, Air Defender for fun, then the Mock Test.</p></div><button class="btn primary big" id="ad">Play Air Defender</button>`}
      <div class="row"><button class="btn" id="sch">All lessons</button><button class="btn" data-home>Home</button></div>`;
    const b=$('#nl');if(b)b.onclick=()=>go(lesson,nl);const ad=$('#ad');if(ad)ad.onclick=()=>go(VIEWS.defender);$('#sch').onclick=()=>go(school);
  }
  cleanup=()=>clearTimeout(timer);render();
}

/* ================= cheat sheet ================= */
function cheat(focus){
  let hide=false;
  function render(){const s=selSet();
    const full=ALLDECKS.filter(d=>d.airports.length&&d.airports.every(a=>s.has(a.code))),shown=full.length?full:ALLDECKS.filter(d=>d.airports.some(a=>s.has(a.code)));
    main.innerHTML=topbar('Cheat Sheet')+shown.map(d=>`
      ${ALLDECKS.length>1?`<h2>${esc(d.name)}</h2>`:''}
      ${d.region?`<div class="mapbox">${mapSVG(d,{all:true})}</div>`:''}`).join('')+`
    <p class="note">Tap a map to zoom in. Tap again to zoom out.</p>
    <label class="toggle"><input type="checkbox" id="hide" ${hide?'checked':''}> Hide codes and test myself</label>
    ${GROUPS.map((g,gi)=>{const list=SET().filter(a=>a.g===gi);if(!list.length)return '';return `<section class="group g${gi}"><header><span class="k">Pattern ${gi+1} of 3</span><h2>${g.name}</h2><p>${g.sub}</p></header>
      ${list.map(a=>`<article class="card g${gi}" id="card-${a.code}"><div class="card-top">${hide?`<span class="flaps covered" data-rev="${a.code}" role="button" tabindex="0" aria-label="Reveal code">${[0,1,2].map(()=>'<span class="flap">?</span>').join('')}</span>`:flaps(a.code)}<h3>${hl(a)}</h3></div><p>${esc(a.tip)}</p></article>`).join('')}</section>`;}).join('')}
    <button class="btn primary big" id="toRecall">Practice with Recall</button>`;
    $('#hide').onchange=e=>{hide=e.target.checked;const y=window.scrollY;render();window.scrollTo(0,y);};
    main.querySelectorAll('[data-rev]').forEach(el=>{const f=()=>{el.outerHTML=flaps(el.dataset.rev,true);};el.onclick=f;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();f();}};});
    $('#toRecall').onclick=()=>go(VIEWS.recall);
  }
  render();
  if(focus){const el=document.getElementById('card-'+focus);if(el){el.scrollIntoView({block:'center'});el.style.borderColor='var(--gc)';}}
}

/* ================= recall ================= */
function recall(opts={}){
  const queue=opts.list?opts.list.slice():pickQueue(Math.min(10,Math.max(6,SET().length*2)));
  let i=0,firstTry=0,xp=0,hints=0,mode='ask',timer=null;const missed=new Set(),reins=new Set();
  const title=opts.list?'Your Misses':'Recall';
  function render(){
    const a=homeOf(queue[i]),deck=DECKMAP[a.deck];mode='ask';hints=0;
    main.innerHTML=topbar(title,`${i+1}/${queue.length}`)+`
    <div class="progress"><i style="width:${i/queue.length*100}%"></i></div>
    <div class="stage">
      <span class="k">Type the code for</span>
      <div class="prompt">${esc(a.place)}</div>${ANSWER()}
      <div class="fb" id="fb" aria-live="polite"></div>
      <div class="row"><button class="btn" type="button" id="hint">Hint</button><button class="btn" type="button" id="skip">I don't know</button></div>
      ${deck.region?`<div class="mapbox">${mapSVG(deck,{target:a.code,dim:true})}</div>`:''}
    </div>`;
    const inp=wireInput(v=>check(v));
    $('#hint').onclick=()=>{if(mode!=='ask')return;hints++;const g=GROUPS[a.g];
      $('#fb').innerHTML=hints===1?`<span class="tipline">Clue: <b>${esc(a.clue)}</b>. It starts with <b>${a.code[0]}</b>.</span>`:`<span class="tipline">${esc(a.tip)}</span>`;
      if(hints>=2)$('#hint').disabled=true;inp.focus();};
    $('#skip').onclick=()=>{if(mode==='ask')miss(a,'');};
  }
  function miss(a,typed){
    grade(a.code,false,'recall');missed.add(a.code);
    if(!reins.has(a.code)){queue.splice(Math.min(queue.length,i+3),0,a.code);reins.add(a.code);$('#barR').textContent=`${i+1}/${queue.length}`;}
    mode='fix';
    $('#fb').innerHTML=`<span class="no">${typed?`${esc(typed)} isn't it. `:''}${esc(a.place)} is</span>${flaps(a.code,true)}<span class="tipline">${esc(a.tip)}</span><span class="tipline">Type <b>${a.code}</b> once to lock it in.</span>`;
    $('#hint').disabled=true;$('#skip').disabled=true;const inp=$('#ans');inp.value='';inp.focus();
  }
  function check(v){
    const a=BY[queue[i]],inp=$('#ans');if(mode==='lock')return;
    if(mode==='ask'){
      if(v===a.code){grade(a.code,true,hints?'hint':'recall');if(!missed.has(a.code))firstTry++;
        const g=hints?5:15;xp+=g;addXP(g);mode='lock';inp.disabled=true;
        $('#fb').innerHTML=`<span class="ok">Correct: ${a.code} · ${esc(a.place)} · +${g} XP</span>`;timer=setTimeout(next,750);}
      else miss(a,v);
    }else if(mode==='fix'){
      if(v===a.code){mode='lock';inp.disabled=true;$('#fb').insertAdjacentHTML('beforeend','<span class="ok">Locked in.</span>');timer=setTimeout(next,600);}
      else{inp.value='';shakeEl(inp);}
    }
  }
  function next(){i++;if(i>=queue.length)return done();render();}
  function done(){const bonus=missed.size===0?25:0;addXP(bonus);
    summary({title,big:`${firstTry}/${queue.length-reins.size}`,sub:`right on the first try · +${xp+bonus} XP${bonus?' (includes a 25 XP perfect-round bonus)':''}`,missed:[...missed],again:()=>go(recall,opts)});}
  cleanup=()=>clearTimeout(timer);render();
}

/* ================= quick fire ================= */
function quick(){
  const DUR=60000;let end=performance.now()+DUR,score=0,streak=0,topStreak=0,answered=0,correct=0,busy=false,prev=null,cur=null,iv=null,t2=null,over=false;const missed=new Set();
  main.innerHTML=topbar('Quick Fire','0')+`<div class="timer" id="tm"><i id="tb" style="width:100%"></i></div>
    <div class="combo"><span id="secs">60s</span><span>combo <b id="mult">×1</b></span></div><div class="stage" id="qa"></div>`;
  function newQ(){if(over)return;busy=false;
    const a=BY[pickQueue(1,prev)[0]];prev=a.code;cur=a;const dir=Math.random()<.5?'c2k':'k2c';
    $('#qa').innerHTML=`<span class="k">${dir==='c2k'?'Pick the code for':'Which city is'}</span>
      <div class="prompt">${dir==='c2k'?esc(a.place):flaps(a.code,true,'huge')}</div>
      <div class="opts">${options(a).map(o=>`<button class="opt" data-c="${o.code}">${dir==='c2k'?flaps(o.code):esc(o.place)}</button>`).join('')}</div>`;
    $('#qa').querySelectorAll('.opt').forEach(b=>b.onclick=()=>pick(b));}
  function pick(b){if(busy||over)return;busy=true;answered++;const ok=b.dataset.c===cur.code;
    if(ok){const m=Math.min(5,1+Math.floor(streak/3));score+=10*m;streak++;topStreak=Math.max(topStreak,streak);correct++;b.classList.add('right');grade(cur.code,true,'recog');t2=setTimeout(newQ,280);}
    else{streak=0;end-=3000;missed.add(cur.code);b.classList.add('wrong');$('#qa').querySelector(`.opt[data-c="${cur.code}"]`).classList.add('right');grade(cur.code,false,'recog');t2=setTimeout(newQ,950);}
    $('#barR').textContent=score;$('#mult').textContent='×'+Math.min(5,1+Math.floor(streak/3));}
  function tick(){const left=Math.max(0,end-performance.now());$('#tb').style.width=(left/DUR*100)+'%';$('#secs').textContent=Math.ceil(left/1000)+'s';$('#tm').classList.toggle('low',left<10000);if(left<=0)finish();}
  function finish(){if(over)return;over=true;clearInterval(iv);clearTimeout(t2);
    const xp=Math.round(score/10);addXP(xp);const isBest=score>S.best.quick;if(isBest){S.best.quick=score;save();}
    summary({title:'Quick Fire',big:score,sub:`points · ${correct}/${answered} correct · best combo ${topStreak} in a row · +${xp} XP${isBest?' · new best!':''}`,missed:[...missed],again:()=>go(quick)});}
  iv=setInterval(tick,100);cleanup=()=>{over=true;clearInterval(iv);clearTimeout(t2);};newQ();
}

/* ================= match ================= */
function match(){
  const pool=SET().length<=10?SET():pickDistinct(10),N=pool.length;
  const L=shuffle(pool.slice()),R=shuffle(pool.slice());let sel=null,done=0,penalty=0,wrongs=0,iv=null,over=false;const start=performance.now();
  main.innerHTML=topbar('Match','0.0s')+`<p class="k" style="padding-top:12px">Tap a city, then its code. Wrong pairs add 2 seconds.</p>
    <div class="mgrid"><div class="mcol">${L.map(a=>`<button class="mt g${a.g}" data-s="c" data-c="${a.code}">${esc(a.place)}</button>`).join('')}</div>
    <div class="mcol">${R.map(a=>`<button class="mt g${a.g}" data-s="k" data-c="${a.code}">${flaps(a.code)}</button>`).join('')}</div></div>`;
  main.querySelectorAll('.mt').forEach(b=>b.onclick=()=>{
    if(over||b.classList.contains('done'))return;
    if(!sel||sel.dataset.s===b.dataset.s){if(sel)sel.classList.remove('sel');sel=b;b.classList.add('sel');return;}
    if(sel.dataset.c===b.dataset.c){[sel,b].forEach(x=>{x.classList.remove('sel');x.classList.add('done');x.disabled=true;if(x.dataset.s==='c')x.insertAdjacentHTML('beforeend',` <span class="mcode">${x.dataset.c}</span>`);});sel=null;done++;if(done===N)finish();}
    else{penalty+=2000;wrongs++;const s=sel;[s,b].forEach(x=>{x.classList.remove('sel');shakeEl(x);x.classList.add('bad');setTimeout(()=>x.classList.remove('bad'),400);});sel=null;}});
  const el=()=>performance.now()-start+penalty;
  iv=setInterval(()=>{$('#barR').textContent=fmtTime(el());},100);
  function finish(){over=true;clearInterval(iv);const t=el();touchDay();
    const xp=Math.max(20,Math.round(80-t/1000));addXP(xp);const isBest=N>=10&&(!S.best.match||t<S.best.match);if(isBest){S.best.match=Math.round(t);save();}
    summary({title:'Match',big:fmtTime(t),sub:`${N} pairs · ${wrongs} wrong ${wrongs===1?'pair':'pairs'} · +${xp} XP${isBest?' · new best time!':''}`,missed:[],again:()=>go(match),noMissNote:wrongs?'Wrong pairs cost time. Try for zero.':''});}
  cleanup=()=>{over=true;clearInterval(iv);};
}

/* ================= map run ================= */
function mapDecks(min=3){const h=homeDecks(min).filter(d=>!d.custom);if(h.length)return h;const s=selSet();return ALLDECKS.filter(d=>!d.custom&&d.airports.filter(a=>s.has(a.code)).length>=min);}
function mapPick(){const ds=mapDecks();
  if(!ds.length){main.innerHTML=topbar('Map Run')+`<div class="panel"><p>Map Run needs at least 3 picked codes from a state with a map.</p><button class="btn primary" id="toPick">Choose codes</button></div>`;$('#toPick').onclick=()=>go(picker);return;}
  if(ds.length===1)return mapRun(ds[0]);
  main.innerHTML=topbar('Map Run')+`<p class="lead" style="padding-top:12px">Which map?</p>`+ds.map(d=>`<button class="btn big" data-d="${d.id}">${esc(d.name)}</button>`).join('');
  main.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>go(mapRun,DECKMAP[b.dataset.d]));}
function locatorSVG(root,sd){
  const Wl=220,Hl=128,L0=-125,L1=-66.5,T=49.6,B=24.2,k=Math.cos(37*Math.PI/180),s=Math.min(Wl/((L1-L0)*k),Hl/(T-B));
  const pr=(lon,lat)=>[(lon-L0)*k*s+(Wl-(L1-L0)*k*s)/2,(T-lat)*s];
  if(!root._loc){const ks=DATA_GEO.groups?.R_NW||Object.keys(DATA_GEO.states).filter(x=>!['AK','HI','PR'].includes(x));let dd='';
    for(const st of ks)for(const r of DATA_GEO.states[st]?.rings||[]){if(r.length<8)continue;const step=Math.max(1,Math.floor(r.length/60));let first=true;
      for(let i=0;i<r.length;i+=step){const [x,y]=pr(r[i][0],r[i][1]);dd+=(first?'M':'L')+x.toFixed(1)+' '+y.toFixed(1);first=false;}dd+='Z';}
    root._loc=dd;}
  const box=sd.P[0].geo,[x0,y0]=pr(Math.max(L0,box[0]),Math.min(T,box[3])),[x1,y1]=pr(Math.min(L1,box[2]),Math.max(B,box[1]));
  const others=root.sub.filter(o=>o!==sd).map(o=>{const g=o.P[0].geo,[a,b]=pr(Math.max(L0,g[0]),Math.min(T,g[3])),[c,e]=pr(Math.min(L1,g[2]),Math.max(B,g[1]));return `<rect class="lc-reg" x="${a.toFixed(1)}" y="${b.toFixed(1)}" width="${(c-a).toFixed(1)}" height="${(e-b).toFixed(1)}"/>`;}).join('');
  return `<svg class="locator" viewBox="0 0 ${Wl} ${Hl}" aria-hidden="true"><path class="lc-land" d="${root._loc}"/>${others}<rect class="lc-hit" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1-x0).toFixed(1)}" height="${(y1-y0).toFixed(1)}"/></svg>`;}
function mapRun(deck){
  const s=selSet(),pool=deck.airports.filter(a=>s.has(a.code));const order=shuffle(pool.map(a=>a.code)).slice(0,10);
  let i=0,ok=0,t=null,busy=false;const labeled=new Set(),missed=new Set();
  function render(){busy=false;const a=BY[order[i]];
    main.innerHTML=topbar('Map Run',`${i+1}/${order.length}`)+`<div class="stage"><span class="k">Which airport is lit up?</span>
      <div class="mapbox">${mapSVG(deck,{target:a.code,labeled,dim:true})}</div>
      <div class="opts">${options(a,pool.length>=4?pool:deck.airports).map(o=>`<button class="opt" data-c="${o.code}">${flaps(o.code)}</button>`).join('')}</div>
      <div class="fb" id="fb" aria-live="polite"></div></div>`;
    main.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{if(busy)return;busy=true;const good=b.dataset.c===a.code;
      grade(a.code,good,'recog');labeled.add(a.code);
      if(good){ok++;b.classList.add('right');addXP(5);}else{missed.add(a.code);b.classList.add('wrong');main.querySelector(`.opt[data-c="${a.code}"]`).classList.add('right');}
      $('#fb').innerHTML=`<span class="${good?'ok':'no'}">${good?'Correct':'Not quite'}: ${a.code} is ${esc(a.place)}</span>${good?'':`<span class="tipline">${esc(a.tip)}</span>`}`;
      t=setTimeout(()=>{i++;i>=order.length?finish():render();},good?900:2000);});}
  function finish(){summary({title:'Map Run',big:`${ok}/${order.length}`,sub:`airports named from the map · +${ok*5} XP`,missed:[...missed],again:()=>go(mapRun,deck),extra:`<div class="mapbox">${mapSVG(deck,{all:true})}</div>`});}
  cleanup=()=>clearTimeout(t);render();
}

/* ================= mock test ================= */
function mock(){
  const pool=SET();
  let qs=shuffle([...pool.map(a=>({t:'type',c:a.code})),...pickDistinct(Math.min(10,pool.length),pool).map(a=>({t:'mc',c:a.code}))]);
  for(let k=1;k<qs.length;k++)if(qs[k].c===qs[k-1].c){const j=(k+2)%qs.length;[qs[k],qs[j]]=[qs[j],qs[k]];}
  let i=0;const ans=[],T=qs.length;
  function render(){const q=qs[i],a=BY[q.c];
    main.innerHTML=topbar('Mock Test',`${i+1}/${T}`)+`<div class="progress"><i style="width:${i/T*100}%"></i></div><div class="stage">`+
    (q.t==='type'?`<span class="k">Write the code for</span><div class="prompt">${esc(a.place)}</div>${ANSWER('Next')}`
     :`<span class="k">Which city has this code?</span><div class="prompt">${flaps(a.code,false,'huge')}</div>
      <div class="opts">${options(a).map(o=>`<button class="opt" data-c="${o.code}">${esc(o.place)}</button>`).join('')}</div>`)+`</div>`;
    if(q.t==='type'){const inp=$('#ans');inp.focus({preventScroll:true});inp.oninput=()=>{inp.value=inp.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);};
      $('#f').onsubmit=e=>{e.preventDefault();if(!inp.value)return;rec(inp.value);};}
    else main.querySelectorAll('.opt').forEach(b=>b.onclick=()=>rec(b.dataset.c));}
  function rec(v){const q=qs[i];ans.push({...q,v,ok:v===q.c});i++;i>=T?finish():render();}
  function finish(){
    let n=0;ans.forEach(x=>{grade(x.c,x.ok,x.t==='type'?'recall':'recog');if(x.ok)n++;});
    const pct=Math.round(n/T*100),xp=n*4;addXP(xp);const isBest=pct>S.best.mock;if(isBest){S.best.mock=pct;save();}
    const wrong=ans.filter(x=>!x.ok);
    summary({title:'Mock Test',big:pct+'%',sub:`${n}/${T} correct · ${pct>=90?`Test ready: you typed every one of the ${pool.length} codes from memory. The bars on the home board fill as you keep reviewing on later days.`:pct>=70?'Close. Drill the misses below, then retake.':'Go back to Flight School for the patterns, then Recall.'} · +${xp} XP${isBest?' · new best!':''}`,
      missed:[...new Set(wrong.map(x=>x.c))],again:()=>go(mock),
      extra:wrong.length?`<span class="k">Your answers vs. correct</span>${wrong.map(x=>{const a=BY[x.c];return `<div class="mrow g${a.g}">${flaps(a.code)}<div><div class="c">${esc(a.place)}</div><div class="t">${x.t==='type'?`You wrote ${esc(x.v)}`:`You picked ${esc(BY[x.v]?.place||x.v)}`}</div></div></div>`;}).join('')}`:''});}
  render();
}

/* ================= summary ================= */
function summary({title,big,sub,missed,again,extra='',noMissNote=''}){
  main.innerHTML=topbar(title)+`<div class="result"><div class="big">${big}</div><p>${sub}</p></div>${extra}
    ${missed.length?`<span class="k">Review these</span>${missed.map(c=>{const a=BY[c];return `<div class="mrow g${a.g}">${flaps(a.code)}<div><div class="c">${placeHL(a)}</div><div class="t">${esc(a.tip)}</div></div></div>`;}).join('')}`:`<p class="k">${noMissNote||'No misses. Clean run.'}</p>`}
    <div class="row"><button class="btn primary" id="again">Play again</button><button class="btn" data-home>Home</button></div>
    ${missed.length?`<button class="btn" id="drillMiss">Recall just my misses</button>`:''}`;
  $('#again').onclick=again;
  const dm=$('#drillMiss');if(dm)dm.onclick=()=>go(recall,{list:groupQueue(missed)});
}

/* ================= AIR DEFENDER ================= */
/* hints: progress points (0 top → 1 city) where hint 1 (pattern), 2 (first letter), 3 (two letters), 4 (full code) unlock */
const DIFFS={
 cadet:{name:'Cadet',desc:'Slow bombs. Hints start early. Splitting warheads from wave 3.',sp:14,spInc:2.2,gap:3.8,gapMin:2.0,act:w=>Math.min(3,1+Math.floor(w/2)),hints:[.16,.3,.44,.58],split:w=>w>=3?Math.min(.35,.12+(w-3)*.05):0},
 pilot:{name:'Pilot',desc:'Faster. Hints arrive as bombs get close. Splits from wave 2.',sp:18,spInc:3.2,gap:3.4,gapMin:1.5,act:w=>Math.min(5,2+Math.floor((w-1)/2)),hints:[.35,.5,.65,.8],split:w=>w>=2?Math.min(.5,.18+(w-2)*.07):0},
 ace:{name:'Ace',desc:'Fast. Hints only in the last moments. Splits from wave 1.',sp:24,spInc:4.2,gap:2.7,gapMin:1.0,act:w=>Math.min(6,2+Math.floor((w-1)/1.5)),hints:[.6,.74,.86,.94],split:w=>Math.min(.65,.25+(w-1)*.08)},
 doomsday:{name:'Doomsday',desc:'Real nukes. A city that gets hit is gone for good. The fewer cities left, the more warheads split. Lasts until the last city falls.',doom:true,
   sp:16,spInc:2.6,gap:3.0,gapMin:.8,act:w=>Math.min(8,2+Math.floor(w/1.5)),hints:[.3,.46,.62,.78],split:w=>Math.min(.45,.1+(w-1)*.06)},
};
const HINT_PTS=[1.25,1,.75,.5,.3];
let AC=null;
function sfx(k){if(S.mute)return;try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
  const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.connect(g);g.connect(AC.destination);
  const P={fire:['square',420,1500,.05,.13],boom:['sawtooth',200,40,.1,.4],hit:['triangle',130,28,.22,.8],bad:['square',150,110,.05,.16],wave:['square',520,1040,.05,.35],split:['sawtooth',900,300,.06,.25],tick:['square',1200,1100,.025,.05],nuke:['sawtooth',120,18,.3,1.5],siren:['square',560,980,.05,.7]}[k];if(!P)return;
  o.type=P[0];o.frequency.setValueAtTime(P[1],t);o.frequency.exponentialRampToValueAtTime(P[2],t+P[4]);g.gain.setValueAtTime(P[3],t);g.gain.exponentialRampToValueAtTime(.0001,t+P[4]+.02);o.start(t);o.stop(t+P[4]+.05);}catch(e){}}
function hsTable(diff,hlIdx=-1){const L=S.hs[diff];if(!L.length)return `<p>No scores yet on ${DIFFS[diff].name}. Be the first.</p>`;
  return `<table class="hs"><thead><tr><th>#</th><th>NAME</th><th>MAP</th><th class="n">WAVE</th><th class="n">SCORE</th></tr></thead><tbody>${L.map((r,i)=>`<tr class="${i===hlIdx?'me':''}"><td>${i+1}</td><td>${esc(r.n)}</td><td>${esc(r.m||'')}</td><td class="n">${r.w}</td><td class="n">${r.s}</td></tr>`).join('')}</tbody></table>`;}
function defender(){
  let decks=homeDecks();if(!decks.length){const s=selSet();decks=ALLDECKS.filter(d=>d.airports.filter(a=>s.has(a.code)).length>=3);}
  if(!decks.length){main.innerHTML=topbar('Air Defender')+`<div class="panel"><p>Air Defender needs at least 3 picked codes from one deck.</p><button class="btn primary" id="toPick">Choose codes</button></div>`;$('#toPick').onclick=()=>go(picker);return;}
  let deckId=decks[0].id,diff=DIFFS[S.diff]?S.diff:'cadet';
  const hard=decks.find(d=>d.id==='top50');if(hard&&diff==='doomsday')deckId=hard.id;
  let sec='all';
  function render(){const cur=DECKMAP[deckId];
    main.innerHTML=topbar('Air Defender')+`<div class="defender"><div class="crt${DIFFS[diff].doom?' doomcrt':''}">
      <div class="ttl">${DIFFS[diff].doom?'☢ DOOMSDAY':'AIR DEFENDER'}</div>
      ${DIFFS[diff].doom?`<ol class="doomrules">
        <li>Nuclear warheads fall toward the cities on the map. The city under attack <b>blinks</b>.</li>
        <li>Type that city's <b>3-letter code</b> to fire an interceptor. Hints still show up as a warhead gets close.</li>
        <li>A warhead that lands <b>wipes the city off the map for good</b>. Its code shows in red so you learn it.</li>
        <li>The fewer cities left, the more often warheads <b>split</b>, into as many as <b>four</b> at the end.</li>
        <li>No shields. The game ends when the <b>last city falls</b>.</li>
      </ol>`:`<ol>
        <li>Bombs fall toward cities on the map. The city under attack <b>blinks</b>.</li>
        <li>Type that city's <b>3-letter code</b> to fire an interceptor.</li>
        <li>The closer a bomb gets, the more help you get: <b>1</b> a clue, <b>2</b> the first letter, <b>3</b> two letters, <b>4</b> the whole code. Fewer hints, more points.</li>
        <li>A bomb that <b>flashes amber</b> is about to <b>split into two warheads</b>, each going for its own city.</li>
        <li>Every bomb that lands costs a shield. Lose all 5 and it's over. A wave with no hits gives one back.</li>
      </ol>`}
      ${decks.length>1?`<p class="k" style="color:var(--crt-mid)">MAP</p><div class="row">${decks.map(d=>`<button class="crt-btn ${d.id===deckId?'on':''}" data-deck="${d.id}">${esc(d.name.toUpperCase())}</button>`).join('')}</div>`:''}
      ${cur.sub?`<p class="k" style="color:var(--crt-mid)">REGION</p><div class="row">${[['all','ALL REGIONS · ROTATES EACH WAVE'],...cur.sub.map((sd,i)=>[String(i),sd.name.toUpperCase()])].map(([k,t])=>`<button class="crt-btn ${k===sec?'on':''}" data-sec="${k}">${esc(t)}</button>`).join('')}</div>
        <p class="regnote">${sec==='all'?'Each wave hits a different region, zoomed in so every city has room. A mini map shows where the attack is.':'Practice one region on its own.'}</p>`:''}
      <div class="choices">${Object.entries(DIFFS).map(([k,d])=>`<button class="choice${d.doom?' doom':''}" data-diff="${k}" aria-pressed="${k===diff}"><b>${d.doom?'☢ ':''}${d.name.toUpperCase()}</b>${d.desc}</button>`).join('')}</div>
      <div class="row"><button class="crt-btn primary" id="launch" style="flex:2">LAUNCH</button><button class="crt-btn ${S.mute?'':'on'}" id="snd">SOUND ${S.mute?'OFF':'ON'}</button></div>
      ${bridge.online?`<button class="crt-btn" id="wlb">WORLD LEADERBOARD · ${DIFFS[diff].name.toUpperCase()}</button>`:''}
      <h2 style="font-size:1.2rem">THIS DEVICE · ${DIFFS[diff].name.toUpperCase()}</h2>${hsTable(diff)}
      <p>${DIFFS[diff].doom?'Doomsday works on any map. On the 50 Busiest the attack moves region to region until every one of the 50 cities is gone.':'New to the codes? Start on Cadet. Every city you lose shows its code, and you can practice those right after.'}</p>
    </div></div>`;
    main.querySelectorAll('[data-deck]').forEach(b=>b.onclick=()=>{deckId=b.dataset.deck;sec='all';render();});
    main.querySelectorAll('[data-sec]').forEach(b=>b.onclick=()=>{sec=b.dataset.sec;render();});
    main.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{diff=b.dataset.diff;S.diff=diff;save();render();});
    $('#snd').onclick=()=>{S.mute=!S.mute;save();render();};
    $('#launch').onclick=()=>{sfx('wave');go(defenderRun,cur.sub&&sec!=='all'?cur.sub[+sec]:cur,diff);};
    const wl=$('#wlb');if(wl)wl.onclick=()=>bridge.openLeaderboard('defender',diff);
  }
  render();
}
function defenderRun(root,diffKey){
  $('#app').classList.add('wide');
  const D=DIFFS[diffKey],s=selSet(),DOOM=!!D.doom;
  // a set split into regions plays one region per wave; every city keeps its state (alive/dead) across regions
  const SECS=root.sub?root.sub.filter(sd=>sd.airports.some(a=>s.has(a.code))):null;
  const STATE={};for(const a of root.airports)if(s.has(a.code))STATE[a.code]={a,x:a.x,y:a.y,dmg:0,flash:0,reveal:0,dead:false,deadAt:0};
  const allCities=Object.values(STATE),NC=allCities.length;
  let deck=SECS?SECS[Math.floor(Math.random()*SECS.length)]:root,cities=[],LBL=null,BASES=[],DS=1,secQ=[],sectorFell=false;
  const alive=()=>allCities.filter(c=>!c.dead),secAlive=()=>cities.filter(c=>!c.dead),lost=()=>1-alive().length/NC;
  // Doomsday scales with the map: a big map means more warheads, more at once, shorter gaps
  const ACT=w=>D.act(w)+Math.round((DS-1)*3)+(DOOM?Math.floor(lost()*4):0);
  // DEFCON 5 (all fine) down to 1 (almost nothing left)
  const defconOf=()=>{const f=alive().length/NC;return f>.8?5:f>.6?4:f>.4?3:f>.2?2:1;};
  const idleMsg=()=>SECS?`${deck.name}: type the code of the blinking city`:'Type the code of the blinking city';
  setWorld(deck);
  main.innerHTML=topbar('Air Defender',DIFFS[diffKey].name)+`<div class="defender"><div class="crt${DOOM?' doomcrt':''}" id="crt">
    <div class="hud"><span>SCORE <b id="dScore">0</b></span><span>WAVE <b id="dWave">1</b></span><span>COMBO <b id="dCombo">×1</b></span><span class="sh" id="dSh" aria-label="Shields"></span></div>
    <div class="crt-screen" id="scr"><canvas id="cv" aria-label="Air Defender map"></canvas><div class="flashfx" id="flx" aria-hidden="true"></div><div class="ovl" id="ovl" hidden></div></div>
    <div class="crt-row"><div class="buf" id="buf" aria-label="Typed code"><span></span><span></span><span></span></div><div class="msg" id="msg" aria-live="polite">Type the code of the blinking city</div><button class="crt-btn" id="pz" aria-label="Pause">II</button></div>
    <div class="kb auto" id="kb">${['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map((r,ri)=>`<div class="r">${[...r].map(ch=>`<button class="key" data-k="${ch}">${ch}</button>`).join('')}${ri===2?'<button class="key wide" data-k="DEL" aria-label="Delete">DEL</button>':''}</div>`).join('')}</div>
    <div id="endP" hidden></div>
  </div></div>`;
  const cv=$('#cv'),ctx=cv.getContext('2d');let scale=1,dpr=1;
  function size(){const w=cv.clientWidth||W;dpr=Math.min(2,window.devicePixelRatio||1);scale=w/W;cv.width=Math.round(w*dpr);cv.height=Math.round(w*H/W*dpr);}
  fitCanvas(cv);const ro=new ResizeObserver(size);ro.observe(cv);size();
  const cs=getComputedStyle(document.documentElement),V=n=>cs.getPropertyValue(n).trim();
  const COL={bg:V('--crt-bg'),hi:V('--crt-hi'),mid:V('--crt-mid'),lo:V('--crt-lo'),amb:V('--crt-amber'),red:V('--crt-red'),water:V('--crt-water'),sea:V('--crt-sea'),land:V('--crt-land')};
  const MONO=getFamily('mono');
  let clouds=[],defcon=5,bombs=[],missiles=[],booms=[],pops=[],buf='',score=0,wave=0,shields=5,combo=0,toSpawn=0,spawnT=0,phase='intro',phaseT=0,paused=false,over=false,
      hitsThisWave=0,kills=0,shots=0,misfires=0,splits=0,clean=0,last=performance.now(),raf=0,clock=0,initials=null,initBuf='',endXP=0,lastX=350;
  const missedCodes=new Set(),ovl=$('#ovl'),lastHit={};
  function enterSector(sd){deck=sd;setWorld(deck);BASES=[{x:W*.17,y:H-6},{x:W/2,y:H-6},{x:W*.83,y:H-6}];fitCanvas(cv);size();
    cities=deck.airports.filter(a=>STATE[a.code]).map(a=>{const c=STATE[a.code];c.a=a;c.x=a.x;c.y=a.y;return c;});
    LBL=canvasLabeler(ctx,deck,cities,MONO);DS=DOOM?Math.sqrt(Math.max(1,cities.length/12)):1;clouds=[];booms=[];pops=[];lastX=W/2;
    const m=$('#msg');if(m&&!over){m.textContent=idleMsg();m.className='msg';}}
  function nextSector(){const ok=SECS.filter(sd=>sd.airports.some(a=>STATE[a.code]&&!STATE[a.code].dead));if(!ok.length)return deck;if(ok.length===1)return ok[0];
    secQ=secQ.filter(x=>ok.includes(x)&&x!==deck);if(!secQ.length)secQ=ok.filter(x=>x!==deck).sort(()=>Math.random()-.5);return secQ.shift();}
  enterSector(deck);
  let reported=false;function report(){if(reported||score<=0)return;reported=true;bridge.onGameOver&&bridge.onGameOver({game:'defender',level:diffKey,levelName:DIFFS[diffKey].name,score,wave,map:root.name});}
  function showOvl(big,sub,btns=''){ovl.innerHTML=`<div class="big">${big}</div>${sub?`<div class="sub">${sub}</div>`:''}${btns}`;ovl.hidden=false;}
  const mult=()=>1+Math.min(2,Math.floor(combo/4)*.5);
  function hud(){$('#dScore').textContent=score;$('#dWave').textContent=wave;$('#dCombo').textContent='×'+String(mult());
    if(DOOM){const n=alive().length;$('#dSh').innerHTML=`CITIES <b>${n}/${NC}</b> <span class="defcon d${defcon}">DEFCON ${defcon}</span>`;$('#dSh').setAttribute('aria-label',`${n} of ${NC} cities left, DEFCON ${defcon}`);
      $('#crt').classList.toggle('redalert',defcon<=2);return;}
    $('#dSh').innerHTML='SHIELDS '+[0,1,2,3,4].map(k=>`<i class="${k<shields?'on':''}"></i>`).join('');$('#dSh').setAttribute('aria-label',`Shields: ${Math.max(0,shields)} of 5`);}
  let msgT;function msg(t,cls=''){const m=$('#msg');m.textContent=t;m.className='msg '+cls;clearTimeout(msgT);if(cls)msgT=setTimeout(()=>{if(!over){m.textContent=idleMsg();m.className='msg';}},2600);}
  let bufT;function drawBuf(state){const b=$('#buf'),src=initials!==null?initBuf:buf;b.querySelectorAll('span').forEach((sp,k)=>sp.textContent=src[k]||'');b.className='buf'+(state?' '+state:'');
    clearTimeout(bufT);if(state)bufT=setTimeout(()=>{b.className='buf';if(!buf&&initials===null)b.querySelectorAll('span').forEach(sp=>sp.textContent='');},260);}
  const progOf=(y,c)=>Math.max(0,Math.min(1,(y+6)/(c.y+6)));
  function makeBomb(sx,sy,c,speed,child){const dx=c.x-sx,dy=c.y-sy,dist=Math.hypot(dx,dy);
    return{c,sx,sy,x:sx,y:sy,ux:dx/dist,uy:dy/dist,dist,trav:0,prog:progOf(sy,c),speed,locked:false,hl:0,child:!!child,splitAt:null,split:false};}
  function pickCity(pool){const ws=pool.map(c=>weight(c.a));let r=Math.random()*ws.reduce((x,y)=>x+y,0);for(let j=0;j<pool.length;j++){r-=ws[j];if(r<=0)return pool[j];}return pool[pool.length-1];}
  function splitChance(){return DOOM?Math.min(.92,D.split(wave)+lost()*.75):D.split(wave);}
  function startWave(){wave++;sectorFell=false;if(SECS&&wave>1)enterSector(nextSector());
    toSpawn=DOOM?Math.round((5+3*wave)*DS):4+2*wave;spawnT=.9;hitsThisWave=0;phase='intro';phaseT=SECS?2.8:2.2;sfx(SECS&&wave>1?'siren':'wave');
    const sp=D.split(wave),tip=DOOM?(wave===1?`${NC} cities. Every hit is permanent.`:`${toSpawn} warheads inbound · ${alive().length} cities left`):wave===1?'Type the code of the city under attack':sp>0&&D.split(wave-1)===0?'Warning: warheads can split from this wave on':`${toSpawn} bombs incoming`;
    if(SECS)showOvl(`WAVE ${wave}`,`${DOOM?'WARHEADS':'MISSILES'} INBOUND · ${esc(deck.name.toUpperCase())}`,locatorSVG(root,deck)+`<div class="sub">${tip}</div>`);
    else showOvl(`WAVE ${wave}`,tip);hud();}
  function spawn(){
    const live=secAlive();if(!live.length)return;const targeted=new Set(bombs.map(b=>b.c));let pool=live.filter(c=>!targeted.has(c));if(!pool.length)pool=live;
    const c=pickCity(pool);let sx;do{sx=BX.x0+12+Math.random()*(BX.x1-BX.x0-24);}while(Math.abs(sx-lastX)<90&&Math.random()<.85);lastX=sx;
    const b=makeBomb(sx,-6,c,(D.sp+D.spInc*(wave-1))*(.85+Math.random()*.3)*SPD);
    if(Math.random()<splitChance())b.splitAt=.4+Math.random()*.15;bombs.push(b);}
  // MIRV: in Doomsday the bus releases more warheads the fewer cities are left (1 extra, up to 3 extra)
  function doSplit(b){b.split=true;const n=DOOM?1+Math.min(2,Math.floor(lost()*3.2+Math.random()*.6)):1,hit=[];
    for(let i=0;i<n;i++){const targeted=new Set(bombs.map(x=>x.c));
      let pool=secAlive().filter(c=>c!==b.c&&c.y>b.y+45&&!targeted.has(c));if(!pool.length)pool=secAlive().filter(c=>c!==b.c&&c.y>b.y+45&&!hit.includes(c));if(!pool.length)break;
      const c=pickCity(pool),k=makeBomb(b.x,b.y,c,b.speed*(1.05+i*.06),true);k.parent=b;bombs.push(k);splits++;hit.push(c);}
    if(!hit.length)return;
    booms.push({x:b.x,y:b.y,t:0,R:14+hit.length*4,col:COL.amb});sfx('split');
    msg(hit.length>1?`MIRV! ${hit.length+1} warheads: ${hit.map(c=>c.a.city).join(', ')} are targets too.`:`Warhead split! ${hit[0].a.place} is now a target too.`,'warn');}
  function retarget(dead){for(const b of bombs){if(b.c!==dead)continue;const live=secAlive();if(!live.length)return;
    const c=live.reduce((p,q)=>Math.hypot(q.x-b.x,q.y-b.y)<Math.hypot(p.x-b.x,p.y-b.y)&&q.y>b.y?q:p,live[0]);
    const nb=makeBomb(b.x,b.y,c,b.speed,b.child);Object.assign(b,{c,sx:nb.sx,sy:nb.sy,ux:nb.ux,uy:nb.uy,dist:nb.dist,trav:0,hl:0,prog:progOf(b.y,c),splitAt:null});}}
  function nukeFx(c,big){clouds.push({x:c.x,y:c.y,t:0,big});const f=$('#flx');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');}
  function impact(b){lastHit[b.c.a.code]=clock;bombs=bombs.filter(x=>x!==b);hitsThisWave++;combo=0;b.c.dmg++;b.c.flash=1;b.c.reveal=3.2;
    missedCodes.add(b.c.a.code);grade(b.c.a.code,false,'recog');sfx('nuke');nukeFx(b.c,DOOM);
    const scr=$('#scr');scr.classList.remove('jolt');void scr.offsetWidth;scr.classList.add('jolt');
    if(DOOM){const c=b.c;if(!c.dead){c.dead=true;c.deadAt=clock;c.reveal=4.5;}retarget(c);
      const n=alive().length,dc=defconOf();
      msg(n?`${c.a.place} is gone. Its code was ${c.a.code}. ${n} ${n===1?'city':'cities'} left.`:`${c.a.place} was the last city.`,'bad');
      if(dc<defcon){defcon=dc;setTimeout(()=>{if(!over){sfx('siren');pops.push({x:W/2,y:H*.42,t:0,text:`DEFCON ${dc}`,big:true});}},350);}
      if(n&&SECS&&!secAlive().length){sectorFell=true;bombs=[];missiles=[];toSpawn=0;msg(`${deck.name} has fallen. ${n} ${n===1?'city':'cities'} left elsewhere.`,'bad');}
      hud();if(!n)gameOver();return;}
    shields--;msg(`${b.c.a.place} was hit. Its code is ${b.c.a.code}.`,'bad');hud();if(shields<=0)gameOver();}
  function kill(b){bombs=bombs.filter(x=>x!==b);
    const pts=Math.round((50+120*(1-b.prog))*wave*mult()*HINT_PTS[b.hl]);score+=pts;combo++;kills++;if(b.hl===0)clean++;
    booms.push({x:b.x,y:b.y,t:0,R:26,col:COL.hi});pops.push({x:b.x,y:b.y-10,t:0,text:'+'+pts+(b.hl===0?' CLEAN':'')});
    grade(b.c.a.code,true,b.hl<=1?'recall':'hint');sfx('boom');
    msg(`+${pts}  ${b.c.a.code} ${b.c.a.place} saved${b.hl===0?' with no hints':b.hl===4?' (full code was showing)':''}`,'ok');hud();}
  function fire(code){shots++;
    const cand=bombs.filter(b=>!b.locked&&b.c.a.code===code).sort((p,q)=>q.prog-p.prog);
    if(cand.length){const b=cand[0];b.locked=true;const base=BASES.reduce((p,q)=>Math.abs(q.x-b.x)<Math.abs(p.x-b.x)?q:p);
      missiles.push({x:base.x,y:base.y,sx:base.x,sy:base.y,b});sfx('fire');drawBuf('ok');return;}
    const c=cities.find(c=>c.a.code===code),cs=STATE[code];
    if(cs&&cs.dead){shots--;drawBuf('bad');msg(`${code} was ${cs.a.place}. It's already gone.`,'warn');return;}
    if(c&&clock-(lastHit[code]??-9)<2){shots--;drawBuf('bad');msg(`Right code, just too late: ${c.a.place} was already hit.`,'warn');return;}
    misfires++;combo=0;score=Math.max(0,score-25);sfx('bad');drawBuf('bad');hud();
    if(c)msg(`${code} is ${c.a.place}, but nothing is falling there. −25`,'warn');
    else if(cs)msg(`${code} is ${cs.a.place}. That's not in ${deck.name}. −25`,'warn');
    else if(BY[code])msg(`${code} is ${BY[code].place}. Not on this map. −25`,'warn');
    else msg(`${code} isn't one of your codes. −25`,'bad');}
  function press(k){
    if(initials!==null){if(k==='DEL')initBuf=initBuf.slice(0,-1);else if(initBuf.length<3)initBuf+=k;drawBuf();if(initBuf.length===3)saveInitials();return;}
    if(over||paused||phase==='clear')return;
    if(k==='DEL'){buf=buf.slice(0,-1);drawBuf();return;}
    buf+=k;drawBuf();
    if(buf.length===3){const c=buf;buf='';fire(c);}
  }
  $('#kb').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-k]');if(!b)return;e.preventDefault();press(b.dataset.k);});
  const onKey=e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;if(e.target&&e.target.tagName==='INPUT')return;
    if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();press(e.key.toUpperCase());}
    else if(e.key==='Backspace'){e.preventDefault();press('DEL');}
    else if(e.key==='Escape'||(e.key===' '&&initials===null)){e.preventDefault();togglePause();}};
  document.addEventListener('keydown',onKey);
  function togglePause(){if(over)return;paused=!paused;
    if(paused){showOvl('PAUSED','Your codes are waiting.',`<div class="row"><button class="crt-btn primary" id="res">RESUME</button><button class="crt-btn" id="quit">QUIT</button></div>`);$('#res').onclick=togglePause;$('#quit').onclick=()=>go(defender);}
    else{ovl.hidden=true;if(phase==='intro')showOvl(`WAVE ${wave}`,'');last=performance.now();}}
  $('#pz').onclick=togglePause;
  const onVis=()=>{if(document.hidden&&!paused&&!over)togglePause();};document.addEventListener('visibilitychange',onVis);
  function waveClear(){phase='clear';phaseT=2.8;buf='';drawBuf();
    if(DOOM){const n=alive().length,bonus=sectorFell?0:n*15*wave+(hitsThisWave===0?250*wave:0);score+=bonus;sfx('wave');
      if(sectorFell)showOvl(`${esc(deck.name.toUpperCase())} HAS FALLEN`,`${n} of ${NC} cities left. The attack moves on.`);
      else showOvl(`WAVE ${wave} SURVIVED`,`${n} of ${NC} cities standing · bonus +${bonus}${hitsThisWave===0?' (no city lost)':''}`);hud();return;}
    const bonus=shields*20*wave;score+=bonus;let extra='';
    if(hitsThisWave===0&&shields<5){shields++;extra=' · Perfect wave: shield restored';}else if(hitsThisWave===0)extra=' · Perfect wave';
    sfx('wave');showOvl(`WAVE ${wave} CLEARED`,`Shield bonus +${bonus}${extra}`);hud();}
  function update(dt){
    clock+=dt;
    if(phase==='intro'){phaseT-=dt;if(phaseT<=0){phase='play';ovl.hidden=true;}}
    else if(phase==='play'){spawnT-=dt;
      if(toSpawn>0&&spawnT<=0&&bombs.length<ACT(wave)){spawn();toSpawn--;spawnT=Math.max(D.gapMin,D.gap-(wave-1)*.25)/Math.sqrt(DS)*(.8+Math.random()*.4);}
      if(toSpawn===0&&!bombs.length&&!missiles.length)waveClear();}
    else if(phase==='clear'){phaseT-=dt;if(phaseT<=0)startWave();}
    for(const b of bombs.slice()){if(b.locked)continue;b.trav+=b.speed*dt;b.x=b.sx+b.ux*b.trav;b.y=b.sy+b.uy*b.trav;b.prog=progOf(b.y,b.c);
      let lvl=0;while(lvl<4&&b.prog>=D.hints[lvl])lvl++;if(lvl>b.hl){b.hl=lvl;}
      if(b.splitAt&&!b.split&&b.prog>=b.splitAt)doSplit(b);
      if(b.trav>=b.dist){impact(b);if(over)return;}}
    for(const m of missiles.slice()){const dx=m.b.x-m.x,dy=m.b.y-m.y,d=Math.hypot(dx,dy),step=1000*dt;
      if(d<=step||d<6){missiles=missiles.filter(x=>x!==m);kill(m.b);}else{m.x+=dx/d*step;m.y+=dy/d*step;}}
    tickFx(dt);
  }
  function tickFx(dt){booms=booms.filter(b=>(b.t+=dt)<.7);pops=pops.filter(p=>(p.t+=dt)<(p.big?1.8:1.1));clouds=clouds.filter(e=>(e.t+=dt)<3.4);cities.forEach(c=>{c.flash=Math.max(0,c.flash-dt*1.2);c.reveal=Math.max(0,c.reveal-dt);});}
  function boxes(code,n,x,y,al,fs,col){const bw=fs*1.15,bh=fs*1.35,gap=3,tot=bw*3+gap*2;
    let sx=al==='left'?x:al==='right'?x-tot:x-tot/2;sx=Math.min(Math.max(sx,4),(W-4)-tot);
    ctx.font=`600 ${fs}px ${MONO}`;ctx.textAlign='center';
    for(let k=0;k<3;k++){const bx=sx+k*(bw+gap);ctx.fillStyle=COL.bg;ctx.fillRect(bx,y,bw,bh);ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.strokeRect(bx,y,bw,bh);
      ctx.fillStyle=col;ctx.fillText(k<n?code[k]:'_',bx+bw/2,y+bh*.74);}}
  function draw(){
    const fs=Math.max(14,12/scale);
    ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);ctx.fillStyle=COL.bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=COL.lo;ctx.lineWidth=1;ctx.globalAlpha=.6;ctx.beginPath();for(let x=50;x<W;x+=50){ctx.moveTo(x,0);ctx.lineTo(x,H);}for(let y=50;y<H;y+=50){ctx.moveTo(0,y);ctx.lineTo(W,y);}ctx.stroke();ctx.globalAlpha=1;
    drawGeoCanvas(ctx,deck,COL,scale);
    ctx.fillStyle=COL.mid;for(const b of BASES){ctx.beginPath();ctx.moveTo(b.x-12,H);ctx.lineTo(b.x,H-14);ctx.lineTo(b.x+12,H);ctx.fill();}
    const blinkOn=Math.floor(clock*4)%2===0;
    const vis=cities.filter(c=>c.dead?c.reveal>0||!deck.P[c.a.pi]?.dense:(!deck.P[c.a.pi]?.dense||c.reveal>0||c.flash>0||bombs.some(b=>b.c===c&&!b.locked))),visS=new Set(vis);
    for(const c of cities){const threats=bombs.filter(b=>b.c===c&&!b.locked),threat=threats.length>0;
      if(c.dead){drawRuins(c);if(!visS.has(c))continue;
        ctx.font=`600 ${fs}px ${MONO}`;const P=LBL(c,fs,vis);ctx.textAlign='left';ctx.globalAlpha=c.reveal>0?1:.45;ctx.fillStyle=COL.red;ctx.fillText(lab(c.a),P.x,P.y);
        const tw=ctx.measureText(lab(c.a)).width;ctx.strokeStyle=COL.red;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(P.x-1,P.y-fs*.32);ctx.lineTo(P.x+tw+1,P.y-fs*.32);ctx.stroke();ctx.globalAlpha=1;
        if(c.reveal>0){ctx.globalAlpha=Math.min(1,c.reveal);boxes(c.a.code,3,P.x,P.y+fs*.45,'left',fs*.95,COL.red);ctx.globalAlpha=1;}
        continue;}
      const col=c.flash>0?COL.red:threat?(blinkOn?COL.amb:COL.hi):(c.dmg?COL.mid:COL.hi);
      ctx.fillStyle=col;ctx.fillRect(c.x-9,c.y-5,5,9);ctx.fillRect(c.x-3,c.y-10,6,14);ctx.fillRect(c.x+4,c.y-3,5,7);
      if(c.dmg){ctx.fillStyle=COL.red;for(let k=0;k<Math.min(3,c.dmg);k++)ctx.fillRect(c.x-8+k*6,c.y+7,4,2);}
      if(threat){ctx.strokeStyle=col;ctx.lineWidth=1.5;const r=16;ctx.beginPath();
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{ctx.moveTo(c.x+sx*r,c.y+sy*(r-6));ctx.lineTo(c.x+sx*r,c.y+sy*r);ctx.lineTo(c.x+sx*(r-6),c.y+sy*r);});ctx.stroke();}
      if(!visS.has(c))continue;
      ctx.font=`600 ${fs}px ${MONO}`;const P=LBL(c,fs,vis);P.al='left';ctx.textAlign='left';
      if(P.lead){ctx.save();ctx.strokeStyle=COL.hi;ctx.globalAlpha=.7;ctx.lineWidth=1.2;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(P.lx,P.ly);ctx.stroke();ctx.restore();}
      ctx.fillStyle=threat?col:COL.mid;const tx=P.x;ctx.fillText(lab(c.a),tx,P.y);
      const hl=threats.reduce((m,b)=>Math.max(m,b.hl),0);
      const hy=P.y+fs*.45;
      if(c.reveal>0){ctx.globalAlpha=Math.min(1,c.reveal);boxes(c.a.code,3,tx,hy,P.al,fs*.95,COL.red);ctx.globalAlpha=1;}
      else if(hl===1){const PP=deck.P[c.a.pi]||{x0:4,x1:W-4},t='CLUE: '+c.a.clue.toUpperCase();let fz=fs*.8;ctx.font=`600 ${fz}px ${MONO}`;let cw=ctx.measureText(t).width;
        if(cw>PP.x1-PP.x0-8){fz*=(PP.x1-PP.x0-8)/cw;ctx.font=`600 ${fz}px ${MONO}`;cw=ctx.measureText(t).width;}
        let cx=Math.min(Math.max(tx,PP.x0+4),PP.x1-4-cw);ctx.textAlign='left';
        ctx.fillStyle=COL.bg;ctx.globalAlpha=.8;ctx.fillRect(cx-3,hy+fs*.05,cw+6,fs*1.15);ctx.globalAlpha=1;ctx.fillStyle=COL.amb;ctx.fillText(t,cx,hy+fs*.9);}
      else if(hl>=2)boxes(c.a.code,hl-1,tx,hy,P.al,fs*.95,COL.amb);
    }
    for(const b of bombs){
      const tg=ctx.createLinearGradient(b.sx,b.sy,b.x,b.y);tg.addColorStop(0,'rgba(0,0,0,0)');tg.addColorStop(1,COL.red);
      ctx.strokeStyle=tg;ctx.globalAlpha=.25;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(b.sx,b.sy);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.globalAlpha=.85;ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1;
      if(!b.locked){ctx.setLineDash([3,6]);ctx.strokeStyle=COL.amb;ctx.globalAlpha=.35;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.c.x,b.c.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
      const warn=b.splitAt&&!b.split&&b.prog>b.splitAt-.12;
      if(warn&&blinkOn){ctx.strokeStyle=COL.amb;ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,9,0,7);ctx.stroke();}
      drawNuke(b,warn&&blinkOn);}
    for(const m of missiles){ctx.strokeStyle=COL.hi;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m.sx,m.sy);ctx.lineTo(m.x,m.y);ctx.stroke();ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(m.x,m.y,2.5,0,7);ctx.fill();}
    for(const e of clouds)drawCloud(e);
    for(const e of booms){const k=e.t/.7,r=e.R*Math.min(1,e.t/.22);ctx.globalAlpha=1-k;ctx.fillStyle=e.col;ctx.beginPath();ctx.arc(e.x,e.y,r,0,7);ctx.fill();ctx.globalAlpha=Math.max(0,.8-k);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,r*.7,0,7);ctx.stroke();ctx.globalAlpha=1;}
    ctx.font=`600 ${fs}px ${MONO}`;ctx.textAlign='center';
    for(const p of pops){if(p.big)continue;ctx.globalAlpha=Math.max(0,1-p.t/1.1);ctx.fillStyle=COL.hi;ctx.fillText(p.text,Math.min(Math.max(p.x,60),W-60),p.y-p.t*34);}
    for(const p of pops){if(!p.big)continue;ctx.globalAlpha=Math.max(0,Math.min(1,(1.8-p.t)*2));ctx.font=`800 ${fs*2.6}px ${MONO}`;ctx.fillStyle=COL.bg;ctx.fillRect(W/2-fs*7,p.y-fs*2.3,fs*14,fs*3);ctx.fillStyle=COL.red;ctx.fillText(p.text,W/2,p.y);}
    ctx.globalAlpha=1;
  }
  /* a warhead: body pointing where it's going, red fins, a flickering exhaust */
  function drawNuke(b,warn){const L=b.child?12:15,R=b.child?2.6:3.3;ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.uy,b.ux));
    ctx.globalAlpha=.9;ctx.fillStyle=COL.amb;ctx.shadowColor=COL.red;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(-L*.5,-R*.75);ctx.lineTo(-L*.5-5-Math.random()*5,0);ctx.lineTo(-L*.5,R*.75);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
    ctx.fillStyle=warn?COL.amb:'#E9F4EC';ctx.beginPath();ctx.moveTo(L*.5,0);ctx.quadraticCurveTo(L*.22,-R,-L*.05,-R);ctx.lineTo(-L*.5,-R);ctx.lineTo(-L*.5,R);ctx.lineTo(-L*.05,R);ctx.quadraticCurveTo(L*.22,R,L*.5,0);ctx.fill();
    ctx.fillStyle=COL.red;ctx.fillRect(L*.05,-R,2.2,R*2);
    ctx.beginPath();ctx.moveTo(-L*.25,-R);ctx.lineTo(-L*.55,-R*2.1);ctx.lineTo(-L*.5,-R);ctx.closePath();ctx.moveTo(-L*.25,R);ctx.lineTo(-L*.55,R*2.1);ctx.lineTo(-L*.5,R);ctx.closePath();ctx.fill();
    ctx.restore();}
  /* mushroom cloud: flash, shock ring, rising stem and cap, then it drifts and fades */
  function drawCloud(e){const t=e.t,K=e.big?1.15:.8,fade=t<2.2?1:Math.max(0,1-(t-2.2)/1.2),rise=Math.min(1,t/.9),ease=1-Math.pow(1-rise,3);
    ctx.save();
    if(t<.3){ctx.globalAlpha=(1-t/.3)*.85;ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(e.x,e.y,(30+90*t)*K,0,7);ctx.fill();}
    if(t<1.5){const r=(8+t*120)*K;ctx.globalAlpha=Math.max(0,1-t/1.5)*.9;ctx.strokeStyle=COL.amb;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(e.x,e.y,r,r*.42,0,0,7);ctx.stroke();}
    const h=(12+34*ease)*K,cy=e.y-h-(t>1.2?(t-1.2)*6:0),rx=(8+13*ease)*K,ry=(5+6*ease)*K;
    ctx.globalAlpha=.8*fade;const sg=ctx.createLinearGradient(0,e.y,0,cy);sg.addColorStop(0,COL.amb);sg.addColorStop(1,COL.red);ctx.fillStyle=sg;
    ctx.beginPath();ctx.moveTo(e.x-5*K,e.y);ctx.lineTo(e.x-2.6*K,cy+ry*.4);ctx.lineTo(e.x+2.6*K,cy+ry*.4);ctx.lineTo(e.x+5*K,e.y);ctx.fill();
    ctx.globalAlpha=.9*fade;ctx.fillStyle=COL.red;for(const [dx,dy,r] of [[-.62,.15,.8],[.62,.15,.8],[0,-.3,.95],[-.3,-.05,.85],[.3,-.05,.85]]){ctx.beginPath();ctx.arc(e.x+dx*rx,cy+dy*ry*1.6,ry*r*1.05,0,7);ctx.fill();}
    ctx.fillStyle=COL.amb;ctx.globalAlpha=.85*fade;ctx.beginPath();ctx.ellipse(e.x,cy+ry*.35,rx*.75,ry*.55,0,0,7);ctx.fill();
    ctx.strokeStyle=COL.amb;ctx.lineWidth=1.3;ctx.globalAlpha=.6*fade;ctx.beginPath();ctx.ellipse(e.x,cy+ry*1.4,rx*1.1,ry*.45,0,0,7);ctx.stroke();
    ctx.globalAlpha=.9*fade;ctx.fillStyle=COL.amb;ctx.beginPath();ctx.ellipse(e.x,e.y,(6+12*ease)*K,(3+3*ease)*K,0,0,7);ctx.fill();
    ctx.restore();}
  /* what's left of a city: a crater, rubble and a little smoke */
  function drawRuins(c){const t=clock-c.deadAt;ctx.save();ctx.strokeStyle=COL.red;ctx.globalAlpha=.85;ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(c.x,c.y+2,10,4.5,0,0,7);ctx.stroke();
    ctx.fillStyle=COL.red;ctx.globalAlpha=.7;ctx.fillRect(c.x-7,c.y-1,3,3);ctx.fillRect(c.x-1,c.y-4,3,6);ctx.fillRect(c.x+4,c.y,3,2);
    for(let k=0;k<2;k++){const ph=((t*.35+k*.5)%1);ctx.globalAlpha=(1-ph)*.35;ctx.fillStyle=COL.mid;ctx.beginPath();ctx.arc(c.x+(k?3:-2)+ph*4,c.y-6-ph*16,2+ph*4,0,7);ctx.fill();}
    ctx.restore();}
  function frame(t){const dt=Math.min(.05,(t-last)/1000);last=t;if(!paused&&!over)update(dt);else if(over){clock+=dt;tickFx(dt);}draw();raf=requestAnimationFrame(frame);}
  function gameOver(){over=true;phase='over';bombs=[];missiles=[];endXP=Math.round(score/40);addXP(endXP);
    const L=S.hs[diffKey];const qualifies=score>0&&(L.length<10||score>L[L.length-1].s);
    showOvl(DOOM?'THE LAST CITY HAS FALLEN':'DEFENSES DOWN',`Score ${score} · ${DOOM?'survived to':'reached'} wave ${wave}`);const u=bridge.user&&bridge.user();if(qualifies&&u){initBuf=u.slice(0,16);saveInitials();}else renderEnd(qualifies,-1);}
  function renderEnd(entering,hlIdx){
    const e=$('#endP');e.hidden=false;
    if(entering){initials='';initBuf='';drawBuf();$('#kb').hidden=false;
      e.innerHTML=`<h2 style="font-size:1.3rem">NEW HIGH SCORE</h2><p>Type 3-letter initials for this device's list. You can post to the world leaderboard right after.</p><div class="row"><button class="crt-btn" id="skipI">SKIP</button></div>`;
      $('#msg').textContent='Enter initials';$('#msg').className='msg warn';$('#skipI').onclick=()=>{initials=null;renderEnd(false,-1);};return;}
    initials=null;$('#kb').hidden=true;$('.crt-row').hidden=true;
    const acc=shots?Math.round((shots-misfires)/shots*100)+'%':'—';
    const miss=[...missedCodes].map(c=>`<span class="chip">${c} · ${esc(BY[c].place)}</span>`).join('');
    e.innerHTML=`<div class="hud"><span>SCORE <b>${score}</b></span><span>WAVE <b>${wave}</b></span><span>STOPPED <b>${kills}</b></span><span>NO-HINT KILLS <b>${clean}</b></span><span>ACCURACY <b>${acc}</b></span><span>SPLITS <b>${splits}</b></span>${DOOM?`<span>CITIES LOST <b>${NC-alive().length}/${NC}</b></span>`:''}<span>XP <b>+${endXP}</b></span></div>
      ${miss?`<p>Cities you lost, with their codes. Lock these in:</p><div class="chips">${miss}</div>`:'<p>You never lost a city. Try a harder level.</p>'}
      <h2 style="font-size:1.2rem">HIGH SCORES · ${DIFFS[diffKey].name.toUpperCase()}</h2>${hsTable(diffKey,hlIdx)}
      <div class="row"><button class="crt-btn primary" id="again" style="flex:2">PLAY AGAIN</button><button class="crt-btn" id="setup">SETTINGS</button></div>
      ${bridge.online?'<button class="crt-btn" id="wlb">WORLD LEADERBOARD</button>':''}
      ${miss?`<button class="crt-btn" id="drill">PRACTICE THE CITIES I LOST</button>`:''}`;
    $('#again').onclick=()=>{sfx('wave');go(defenderRun,root,diffKey);};$('#setup').onclick=()=>go(defender);
    const d=$('#drill');if(d)d.onclick=()=>go(recall,{list:groupQueue([...missedCodes])});
    const wl=$('#wlb');if(wl)wl.onclick=()=>bridge.openLeaderboard('defender',diffKey);
    e.scrollIntoView({block:'nearest'});report();}
  function saveInitials(){const n=initBuf;initials=null;const L=S.hs[diffKey];const entry={n,s:score,w:wave,m:root.name,d:today()};
    L.push(entry);L.sort((a,b)=>b.s-a.s);S.hs[diffKey]=L.slice(0,10);save();renderEnd(false,S.hs[diffKey].indexOf(entry));}
  if(bridge.debug)window.__AD={bombs:()=>bombs.map(b=>({code:b.c.a.code,prog:+b.prog.toFixed(2),hl:b.hl,locked:b.locked,child:b.child})),st:()=>({wave,shields,score,phase,over,splits,kills,clean,toSpawn,alive:alive().length,defcon,sector:deck.name,secAlive:secAlive().length}),initials:()=>initials};
  cleanup=()=>{cancelAnimationFrame(raf);ro.disconnect();document.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVis);clearTimeout(msgT);clearTimeout(bufT);};
  hud();startWave();raf=requestAnimationFrame(t=>{last=t;frame(t);});
}
/* ================= TOWER CONTROL ================= */
/* hints: seconds a pilot has been waiting before clue / 1 letter / 2 letters / full code appear */
const TDIFFS={
 trainee:{name:'Trainee',desc:'Light traffic, full tanks, hints come quickly. Fuel stops from shift 2.',endur:95,dec:4,act:s=>Math.min(3,1+Math.floor(s/2)),gap:7,gapMin:3.5,hints:[4,8,12,16],fuelStop:s=>s>=2?.35:0},
 controller:{name:'Controller',desc:'Busier skies and less fuel. Hints come slower. Fuel stops from shift 1.',endur:75,dec:4,act:s=>Math.min(4,2+Math.floor((s-1)/2)),gap:5.5,gapMin:2.6,hints:[7,12,17,22],fuelStop:()=>.45},
 chief:{name:'Chief',desc:'Heavy traffic, tight fuel. Hints only when a pilot is desperate.',endur:58,dec:3,act:s=>Math.min(5,2+Math.floor(s/2)),gap:4.5,gapMin:2,hints:[11,16,21,26],fuelStop:()=>.55},
};
const CALLS=['SKY','PEAK','MESA','HAWK','TETON','BISON','SAGE','RANGER','ELK','BLUFF'];
function hsTableFor(L,label,hlIdx=-1){if(!L.length)return `<p>No scores yet on ${label}. Be the first.</p>`;
  return `<table class="hs"><thead><tr><th>#</th><th>NAME</th><th>MAP</th><th class="n">SHIFT</th><th class="n">SCORE</th></tr></thead><tbody>${L.map((r,i)=>`<tr class="${i===hlIdx?'me':''}"><td>${i+1}</td><td>${esc(r.n)}</td><td>${esc(r.m||'')}</td><td class="n">${r.w}</td><td class="n">${r.s}</td></tr>`).join('')}</tbody></table>`;}
function kbHTML(){return `<div class="kb auto" id="kb">${['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map((r,ri)=>`<div class="r">${[...r].map(ch=>`<button class="key" data-k="${ch}">${ch}</button>`).join('')}${ri===2?'<button class="key wide" data-k="DEL" aria-label="Delete">DEL</button>':''}</div>`).join('')}</div>`;}
function tower(){
  let decks=homeDecks();if(!decks.length){const s=selSet();decks=ALLDECKS.filter(d=>d.airports.filter(a=>s.has(a.code)).length>=3);}
  {const s=selSet();decks=decks.flatMap(d=>d.sub?d.sub.filter(sd=>sd.airports.filter(a=>s.has(a.code)).length>=3):[d]);}
  if(!decks.length){main.innerHTML=topbar('Tower Control')+`<div class="panel"><p>Tower Control needs at least 3 picked codes from one deck.</p><button class="btn primary" id="toPick">Choose codes</button></div>`;$('#toPick').onclick=()=>go(picker);return;}
  let deckId=decks[0].id,diff=S.tdiff;
  function render(){
    main.innerHTML=topbar('Tower Control')+`<div class="defender"><div class="crt radar">
      <div class="ttl">TOWER CONTROL</div>
      <ol>
        <li>You're the air traffic controller. Planes fly onto your radar and the pilots <b>only know city names</b>, not airport codes.</li>
        <li>Each pilot radios in a city. Type that city's <b>3-letter code</b> to send the plane there.</li>
        <li>Some planes need a <b>fuel stop</b> first. After they refuel, they radio in the city where they want to land.</li>
        <li>Type a wrong code and the plane heads the wrong way. Type the right code before it lands to turn it around.</li>
        <li>The longer a pilot waits, the more help you get: <b>1</b> a clue, <b>2</b> the first letter, <b>3</b> two letters, <b>4</b> the whole code.</li>
        <li>A plane that runs out of fuel or lands at the wrong airport costs a safety bar. Lose all 5 and your shift is over.</li>
      </ol>
      <p>With more than one plane, tap a <b>flight strip</b> or a plane on the radar to choose which one you're talking to. The plane lowest on fuel is picked for you.</p>
      ${decks.length>1?`<div class="row">${decks.map(d=>`<button class="crt-btn ${d.id===deckId?'on':''}" data-deck="${d.id}">${esc(d.name.toUpperCase())}</button>`).join('')}</div>`:''}
      <div class="choices">${Object.entries(TDIFFS).map(([k,d])=>`<button class="choice" data-diff="${k}" aria-pressed="${k===diff}"><b>${d.name.toUpperCase()}</b>${d.desc}</button>`).join('')}</div>
      <div class="row"><button class="crt-btn primary" id="launch" style="flex:2">START SHIFT</button><button class="crt-btn ${S.mute?'':'on'}" id="snd">SOUND ${S.mute?'OFF':'ON'}</button></div>
      ${bridge.online?`<button class="crt-btn" id="wlb">WORLD LEADERBOARD · ${TDIFFS[diff].name.toUpperCase()}</button>`:''}
      <h2 style="font-size:1.2rem">THIS DEVICE · ${TDIFFS[diff].name.toUpperCase()}</h2>${hsTableFor(S.ths[diff],TDIFFS[diff].name)}
    </div></div>`;
    main.querySelectorAll('[data-deck]').forEach(b=>b.onclick=()=>{deckId=b.dataset.deck;render();});
    main.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{diff=b.dataset.diff;S.tdiff=diff;save();render();});
    $('#snd').onclick=()=>{S.mute=!S.mute;save();render();};
    $('#launch').onclick=()=>{sfx('wave');go(towerRun,DECKMAP[deckId],diff);};
    const wl=$('#wlb');if(wl)wl.onclick=()=>bridge.openLeaderboard('tower',diff);
  }
  render();
}
function towerRun(deck,dk){
  $('#app').classList.add('wide');
  const D=TDIFFS[dk],s=selSet();
  const ports=deck.airports.filter(a=>s.has(a.code)).map(a=>({a,x:a.x,y:a.y,reveal:0,rcol:''}));
  setWorld(deck);
  main.innerHTML=topbar('Tower Control',TDIFFS[dk].name)+`<div class="defender"><div class="crt radar" id="tc">
    <div class="hud"><span>SCORE <b id="tScore">0</b></span><span>SHIFT <b id="tShift">1</b></span><span>LANDED <b id="tLand">0</b></span><span class="sh" id="tSafe"></span></div>
    <div class="crt-screen"><canvas id="cv" aria-label="Radar map"></canvas><div class="ovl" id="ovl" hidden></div></div>
    <div class="radio" id="radio" aria-live="polite">Radio is quiet. Traffic incoming.</div>
    <div class="crt-row"><div class="buf" id="buf" aria-label="Typed code"><span></span><span></span><span></span></div><div class="msg" id="who">No plane selected</div><button class="crt-btn" id="pz" aria-label="Pause">II</button></div>
    <div class="strips" id="strips"></div>
    ${kbHTML()}
    <div id="endP" hidden></div>
  </div></div>`;
  const root=$('#tc'),cv=$('#cv'),ctx=cv.getContext('2d');let scale=1,dpr=1;
  function size(){const w=cv.clientWidth||W;dpr=Math.min(2,window.devicePixelRatio||1);scale=w/W;cv.width=Math.round(w*dpr);cv.height=Math.round(w*H/W*dpr);}
  fitCanvas(cv);const ro=new ResizeObserver(size);ro.observe(cv);size();
  const cs=getComputedStyle(root),V=n=>cs.getPropertyValue(n).trim();
  const COL={bg:V('--crt-bg'),hi:V('--crt-hi'),mid:V('--crt-mid'),lo:V('--crt-lo'),amb:V('--crt-amber'),red:V('--crt-red'),good:V('--rad-good'),water:V('--crt-water'),sea:V('--crt-sea'),land:V('--crt-land')};
  const LBL=canvasLabeler(ctx,deck,ports,getFamily('mono'));
  const MONO=getFamily('mono'),reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let planes=[],marks=[],pops=[],buf='',score=0,shift=0,safety=5,combo=0,toSpawn=0,spawnT=0,phase='intro',phaseT=0,paused=false,over=false,
      landed=0,legs=0,wrongs=0,emerg=0,clean=0,issues=0,sel=null,clock=0,nextId=1,initials=null,initBuf='',endXP=0,last=performance.now(),raf=0,stripT=0;
  const lostCodes=new Set(),ovl=$('#ovl');
  let reported=false;function report(){if(reported||score<=0)return;reported=true;bridge.onGameOver&&bridge.onGameOver({game:'tower',level:dk,levelName:TDIFFS[dk].name,score,wave:shift,map:deck.name});}
  const mult=()=>1+Math.min(2,Math.floor(combo/3)*.5);
  function showOvl(big,sub,btns=''){ovl.innerHTML=`<div class="big">${big}</div>${sub?`<div class="sub">${sub}</div>`:''}${btns}`;ovl.hidden=false;}
  function hud(){$('#tScore').textContent=score;$('#tShift').textContent=shift;$('#tLand').textContent=landed;
    $('#tSafe').innerHTML='SAFETY '+[0,1,2,3,4].map(k=>`<i class="${k<safety?'on':''}"></i>`).join('');$('#tSafe').setAttribute('aria-label',`Safety: ${Math.max(0,safety)} of 5`);}
  function radio(t,cls=''){const r=$('#radio');r.textContent=t;r.className='radio'+(cls?' '+cls:'');}
  let bufT;function drawBuf(state){const b=$('#buf'),src=initials!==null?initBuf:buf;b.querySelectorAll('span').forEach((sp,k)=>sp.textContent=src[k]||'');b.className='buf'+(state?' '+state:'');
    clearTimeout(bufT);if(state)bufT=setTimeout(()=>{b.className='buf';if(!buf&&initials===null)b.querySelectorAll('span').forEach(sp=>sp.textContent='');},260);}
  const active=()=>planes.filter(p=>p.state!=='gone');
  const needsRoute=p=>p&&p.state!=='gone'&&p.state!=='ground'&&p.target!==p.need;
  function autoSel(force){if(!force&&((sel&&needsRoute(sel))||buf.length))return;const c=active().filter(needsRoute).sort((a,b)=>a.fuel-b.fuel)[0];sel=c||active().find(p=>p.state!=='ground')||active()[0]||null;who();}
  function who(){const w=$('#who');if(!sel||sel.state==='gone'){w.textContent='No plane selected';return;}
    w.innerHTML=`Talking to <b>${sel.call}</b>${sel.state==='ground'?' (refueling)':sel.target===sel.need?` · cleared to ${sel.need.a.code}`:` · needs ${esc(sel.need.a.place)}`}`;}
  function endurance(){return Math.max(D.endur*.6,D.endur-(shift-1)*D.dec);}
  function newCall(){let c;do{c=CALLS[Math.floor(Math.random()*CALLS.length)]+' '+(100+Math.floor(Math.random()*800));}while(planes.some(p=>p.call===c));return c;}
  function pickPort(ex){const busy=new Set(active().map(p=>p.need));let pool=ports.filter(p=>p!==ex&&!busy.has(p));if(!pool.length)pool=ports.filter(p=>p!==ex);
    const ws=pool.map(p=>weight(p.a));let r=Math.random()*ws.reduce((x,y)=>x+y,0);for(let j=0;j<pool.length;j++){r-=ws[j];if(r<=0)return pool[j];}return pool[pool.length-1];}
  function startHold(p,x,y){const r=20;const cx=Math.min(Math.max(x+r,BX.x0+30),BX.x1-30),cy=Math.min(Math.max(y,BX.y0+26),BX.y1-26);p.hold={cx,cy,r,ang:Math.atan2(y-cy,x-cx)};p.state='holding';}
  function request(p){p.wait=0;p.hl=0;p.target=null;p.missed=false;
    radio(p.leg==='fuel'?`${p.call}: Tower, we're low on fuel and need to stop at ${p.need.a.place}. We don't know the code.`:`${p.call}: Tower, we'd like to land at ${p.need.a.place}. What's the code?`);sfx('tick');}
  function spawn(){
    const side=Math.floor(Math.random()*4),r=Math.random();
    const bw=BX.x1-BX.x0,bh=BX.y1-BX.y0;const [x,y]=side===0?[BX.x0+10+r*(bw-20),BX.y0]:side===1?[BX.x0+10+r*(bw-20),BX.y1]:side===2?[BX.x0,BX.y0+16+r*(bh-32)]:[BX.x1,BX.y0+16+r*(bh-32)];
    const fs=ports.length>=2&&Math.random()<D.fuelStop(shift);
    const need=pickPort(),next=fs?pickPort(need):null;
    const NP=(deck.P&&deck.P[need.a.pi])||{x0:BX.x0,y0:BX.y0,x1:BX.x1,y1:BX.y1},iw=Math.max(10,NP.x1-NP.x0-90),ih=Math.max(10,NP.y1-NP.y0-70);
    const wp={x:NP.x0+45+Math.random()*iw,y:NP.y0+35+Math.random()*ih};
    const p={id:nextId++,call:newCall(),x,y,hdg:Math.atan2(wp.y-y,wp.x-x),spd:24*SPD,fuel:fs?52+Math.random()*14:78+Math.random()*18,state:'inbound',wp,hold:null,
      need,next,leg:fs?'fuel':'land',target:null,wait:0,hl:0,routeHl:0,missed:false,trail:[],trT:0,ground:0};
    planes.push(p);request(p);autoSel();}
  function route(code){
    const want=active().filter(x=>x.state!=='ground'&&x.target!==x.need&&x.need.a.code===code).sort((a,b)=>a.fuel-b.fuel);
    if(want.length&&!want.includes(sel))sel=want[0];
    const p=sel;if(!p||p.state==='gone'){radio('Tower: no plane selected. Tap a flight strip first.','warn');drawBuf('bad');return;}
    if(p.state==='ground'){radio(`${p.call}: Still refueling, Tower. Give us a moment.`,'warn');drawBuf('bad');return;}
    const port=ports.find(q=>q.a.code===code);
    if(!port){combo=0;wrongs++;p.missed=true;score=Math.max(0,score-25);drawBuf('bad');sfx('bad');grade(p.need.a.code,false,'recog');
      radio(BY[code]?`${p.call}: ${code} is ${BY[code].place}, Tower. That's not on our map. −25`:`${p.call}: There's no airport called ${code} around here. −25`,'bad');hud();return;}
    p.target=port;p.state='routed';
    if(port===p.need){p.routeHl=p.hl;drawBuf('ok');sfx('fire');grade(code,true,p.hl<=1&&!p.missed?'recall':'hint');
      radio(`${p.call}: Heading to ${code}, ${port.a.place}. Thanks, Tower!`,'ok');autoSel(true);}
    else{combo=0;wrongs++;p.missed=true;score=Math.max(0,score-25);drawBuf('bad');sfx('bad');grade(p.need.a.code,false,'recog');
      radio(`${p.call}: ${code} takes us to ${port.a.place}? We need ${p.need.a.place}! Send us the right code. −25`,'bad');}
    hud();}
  function arrive(p){const port=p.target;p.x=port.x;p.y=port.y;
    if(port===p.need){const pts=Math.round((80+p.fuel*.8)*shift*mult()*HINT_PTS[Math.min(4,p.routeHl)]);score+=pts;combo++;legs++;
      if(p.routeHl===0&&!p.missed)clean++;port.reveal=2.6;port.rcol=COL.good;pops.push({x:port.x,y:port.y-14,t:0,text:'+'+pts});sfx('wave');
      if(p.leg==='fuel'){p.state='ground';p.ground=2.4;radio(`${p.call}: On the ground at ${port.a.place}. Refueling now.`,'ok');}
      else{p.state='gone';landed++;radio(`${p.call}: Landed safely at ${port.a.place}, ${port.a.code}. Good work, Tower.`,'ok');}}
    else{p.state='gone';safety--;issues++;combo=0;port.reveal=2.6;port.rcol=COL.red;p.need.reveal=3.2;p.need.rcol=COL.amb;lostCodes.add(p.need.a.code);grade(p.need.a.code,false,'recall');
      marks.push({x:port.x,y:port.y,t:0});sfx('hit');radio(`${p.call} landed at ${port.a.place} (${port.a.code}) but needed ${p.need.a.place}, which is ${p.need.a.code}.`,'bad');}
    autoSel();hud();if(safety<=0)gameOver();}
  function emergency(p){p.state='gone';safety--;issues++;emerg++;combo=0;p.need.reveal=3.2;p.need.rcol=COL.amb;lostCodes.add(p.need.a.code);grade(p.need.a.code,false,'recall');
    marks.push({x:p.x,y:p.y,t:0});sfx('hit');radio(`${p.call} ran out of fuel and made an emergency landing in a field. Everyone is OK. ${p.need.a.place} was ${p.need.a.code}.`,'bad');
    autoSel();hud();if(safety<=0)gameOver();}
  function startShift(){shift++;toSpawn=3+2*shift;spawnT=1.2;issues=0;phase='intro';phaseT=2.4;sfx('wave');
    showOvl(`SHIFT ${shift}`,shift===1?'Pilots will radio in. Type the code of the city they ask for.':`${toSpawn} flights on the schedule${D.fuelStop(shift)>0&&D.fuelStop(shift-1)===0?' · fuel stops start now':''}`);hud();}
  function shiftClear(){phase='clear';phaseT=2.8;buf='';drawBuf();const bonus=safety*25*shift;score+=bonus;let extra='';
    if(issues===0&&safety<5){safety++;extra=' · Perfect shift: safety bar restored';}else if(issues===0)extra=' · Perfect shift';
    sfx('wave');showOvl(`SHIFT ${shift} COMPLETE`,`Safety bonus +${bonus}${extra}`);hud();}
  function update(dt){
    clock+=dt;
    if(phase==='intro'){phaseT-=dt;if(phaseT<=0){phase='play';ovl.hidden=true;}}
    else if(phase==='play'){spawnT-=dt;
      if(toSpawn>0&&spawnT<=0&&active().length<D.act(shift)){spawn();toSpawn--;spawnT=Math.max(D.gapMin,D.gap-(shift-1)*.4)*(.8+Math.random()*.4);}
      if(toSpawn===0&&!active().length)shiftClear();}
    else if(phase==='clear'){phaseT-=dt;if(phaseT<=0)startShift();}
    const burn=100/endurance();
    for(const p of active()){
      if(p.state==='ground'){p.ground-=dt;p.fuel=Math.min(100,p.fuel+45*dt);
        if(p.ground<=0){p.fuel=100;p.leg='land';p.need=p.next;p.next=null;startHold(p,p.x,p.y);request(p);autoSel();}continue;}
      p.fuel-=burn*dt*(p.state==='holding'?.75:1);
      if(p.target!==p.need){p.wait+=dt;let l=0;while(l<4&&p.wait>=D.hints[l])l++;p.hl=Math.max(p.hl,l);}
      if(p.fuel<=0){emergency(p);if(over)return;continue;}
      if(p.state==='inbound'){const dx=p.wp.x-p.x,dy=p.wp.y-p.y,d=Math.hypot(dx,dy),st=p.spd*dt;p.hdg=Math.atan2(dy,dx);if(d<=st+1)startHold(p,p.wp.x,p.wp.y);else{p.x+=dx/d*st;p.y+=dy/d*st;}}
      else if(p.state==='holding'){const h=p.hold;h.ang+=p.spd/h.r*dt*.8;p.x=h.cx+h.r*Math.cos(h.ang);p.y=h.cy+h.r*Math.sin(h.ang);p.hdg=h.ang+Math.PI/2;}
      else if(p.state==='routed'){const t=p.target,dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy),st=p.spd*1.25*dt;p.hdg=Math.atan2(dy,dx);if(d<=st+1){arrive(p);if(over)return;continue;}p.x+=dx/d*st;p.y+=dy/d*st;}
      p.trT-=dt;if(p.trT<=0){p.trT=.45;p.trail.push({x:p.x,y:p.y});if(p.trail.length>7)p.trail.shift();}
    }
    planes=planes.filter(p=>p.state!=='gone');if(sel&&sel.state==='gone')autoSel(true);
    fx(dt);
  }
  function fx(dt){ports.forEach(q=>q.reveal=Math.max(0,q.reveal-dt));marks=marks.filter(m=>(m.t+=dt)<3);pops=pops.filter(p=>(p.t+=dt)<1.2);}
  function boxes(code,n,x,y,al,fs,col){const bw=fs*1.15,bh=fs*1.35,gap=3,tot=bw*3+gap*2;let sx=al==='left'?x:al==='right'?x-tot:x-tot/2;sx=Math.min(Math.max(sx,4),(W-4)-tot);
    ctx.font=`600 ${fs}px ${MONO}`;ctx.textAlign='center';
    for(let k=0;k<3;k++){const bx=sx+k*(bw+gap);ctx.fillStyle=COL.bg;ctx.fillRect(bx,y,bw,bh);ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.strokeRect(bx,y,bw,bh);ctx.fillStyle=col;ctx.fillText(k<n?code[k]:'_',bx+bw/2,y+bh*.74);}}
  function draw(){
    const fs=Math.max(14,12/scale),sm=Math.max(10,9.5/scale);
    ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);ctx.fillStyle=COL.bg;ctx.fillRect(0,0,W,H);
    const CX=(BX.x0+BX.x1)/2,CY=(BX.y0+BX.y1)/2,RR=Math.hypot(W,H)/2;
    ctx.strokeStyle=COL.lo;ctx.lineWidth=1;for(const k of [.25,.5,.75,1]){ctx.beginPath();ctx.arc(CX,CY,RR*k,0,7);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(CX,0);ctx.lineTo(CX,H);ctx.moveTo(0,CY);ctx.lineTo(W,CY);ctx.stroke();
    drawGeoCanvas(ctx,deck,COL,scale);
    if(!reduce){const a=clock*1.1;for(let k=0;k<14;k++){ctx.globalAlpha=.14*(1-k/14);ctx.strokeStyle=COL.mid;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(CX,CY);ctx.lineTo(CX+RR*1.1*Math.cos(a-k*.035),CY+RR*1.1*Math.sin(a-k*.035));ctx.stroke();}ctx.globalAlpha=1;}
    const blink=Math.floor(clock*4)%2===0,selNeed=sel&&sel.state!=='gone'?sel.need:null;
    const vis=ports.filter(q=>!deck.P[q.a.pi]?.dense||q===selNeed||q.reveal>0||planes.some(p=>p.state!=='gone'&&(p.need===q||p.target===q))),visS=new Set(vis);
    for(const q of ports){
      ctx.strokeStyle=COL.mid;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(q.x,q.y,6,0,7);ctx.stroke();
      ctx.beginPath();[[0,-6,0,-10],[0,6,0,10],[-6,0,-10,0],[6,0,10,0]].forEach(([a,b,c,d])=>{ctx.moveTo(q.x+a,q.y+b);ctx.lineTo(q.x+c,q.y+d);});ctx.stroke();
      if(q===selNeed){ctx.strokeStyle=COL.amb;ctx.lineWidth=1.8;const r=15+(blink?2:0);ctx.beginPath();[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{ctx.moveTo(q.x+sx*r,q.y+sy*(r-6));ctx.lineTo(q.x+sx*r,q.y+sy*r);ctx.lineTo(q.x+sx*(r-6),q.y+sy*r);});ctx.stroke();}
      if(!visS.has(q))continue;
      ctx.font=`600 ${fs}px ${MONO}`;const P=LBL(q,fs,vis);ctx.textAlign='left';
      if(P.lead){ctx.save();ctx.strokeStyle=COL.hi;ctx.globalAlpha=.7;ctx.lineWidth=1.2;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(P.lx,P.ly);ctx.stroke();ctx.restore();}
      ctx.fillStyle=q===selNeed?COL.amb:COL.hi;const tx=P.x;ctx.fillText(lab(q.a),tx,P.y);
      if(q.reveal>0){ctx.globalAlpha=Math.min(1,q.reveal);boxes(q.a.code,3,tx,P.y+fs*.45,'left',fs*.95,q.rcol||COL.good);ctx.globalAlpha=1;}
    }
    for(const m of marks){ctx.globalAlpha=Math.max(0,1-m.t/3);ctx.strokeStyle=COL.red;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(m.x-8,m.y-8);ctx.lineTo(m.x+8,m.y+8);ctx.moveTo(m.x+8,m.y-8);ctx.lineTo(m.x-8,m.y+8);ctx.stroke();ctx.globalAlpha=1;}
    for(const p of planes){
      if(p.state==='routed'){ctx.setLineDash([4,6]);ctx.strokeStyle=p.target===p.need?COL.good:COL.red;ctx.globalAlpha=.7;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.target.x,p.target.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
      p.trail.forEach((t,i)=>{ctx.globalAlpha=(i+1)/p.trail.length*.5;ctx.fillStyle=COL.mid;ctx.fillRect(t.x-1.5,t.y-1.5,3,3);});ctx.globalAlpha=1;
      const isSel=p===sel,low=p.fuel<20&&p.state!=='ground';
      const col=low&&blink?COL.red:p.state==='ground'?COL.good:p.target&&p.target===p.need?COL.good:isSel?COL.amb:COL.hi;
      if(p.state==='ground'){ctx.strokeStyle=COL.good;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,13,-Math.PI/2,-Math.PI/2+Math.PI*2*p.fuel/100);ctx.stroke();}
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.hdg);ctx.fillStyle=col;ctx.beginPath();
      ctx.moveTo(10,0);ctx.lineTo(2,-1.6);ctx.lineTo(-1,-8);ctx.lineTo(-4,-8);ctx.lineTo(-2,-1.6);ctx.lineTo(-7,-1.4);ctx.lineTo(-9,-4.5);ctx.lineTo(-10.5,-4.5);ctx.lineTo(-9.5,0);
      ctx.lineTo(-10.5,4.5);ctx.lineTo(-9,4.5);ctx.lineTo(-7,1.4);ctx.lineTo(-2,1.6);ctx.lineTo(-4,8);ctx.lineTo(-1,8);ctx.lineTo(2,1.6);ctx.closePath();ctx.fill();ctx.restore();
      if(isSel){ctx.strokeStyle=COL.amb;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,16,0,7);ctx.stroke();}
      if(p.state==='ground')continue;
      ctx.font=`600 ${sm*1.1}px ${MONO}`;ctx.textAlign='left';const tl=p.call,t2=p.state==='ground'?'REFUEL':`${Math.max(0,Math.round(p.fuel))}% FUEL`;
      const tw=Math.max(ctx.measureText(tl).width,ctx.measureText(t2).width);let lx=p.x+14,ly=p.y-14;if(lx+tw>(W-4))lx=p.x-14-tw;if(ly<sm*2)ly=p.y+22;
      ctx.fillStyle=isSel?COL.amb:COL.hi;ctx.fillText(tl,lx,ly);ctx.fillStyle=low?COL.red:COL.mid;ctx.fillText(t2,lx,ly+sm*1.2);
    }
    ctx.font=`600 ${fs}px ${MONO}`;ctx.textAlign='center';
    for(const p of pops){ctx.globalAlpha=Math.max(0,1-p.t/1.2);ctx.fillStyle=COL.good;ctx.fillText(p.text,Math.min(Math.max(p.x,50),W-50),p.y-p.t*30);}ctx.globalAlpha=1;
  }
  function hintHTML(p){
    if(p.state==='ground')return `<span class="ok">Refueling ${Math.round(p.fuel)}%</span>`;
    if(p.target===p.need)return `<span class="ok">Cleared to ${p.need.a.code}</span>`;
    if(p.hl===0)return `<span class="dim">Hint in ${Math.max(1,Math.ceil(D.hints[0]-p.wait))}s</span>`;
    if(p.hl===1)return `Clue: ${esc(p.need.a.clue)}`;
    return [0,1,2].map(k=>`<span class="lb">${k<p.hl-1?p.need.a.code[k]:'_'}</span>`).join('');}
  function strips(){
    const el=$('#strips'),act=active();
    if(!act.length){el.innerHTML='<p class="dim">No traffic on your radar right now.</p>';return;}
    el.innerHTML=act.map(p=>{const wrong=p.state==='routed'&&p.target!==p.need;
      const st=p.state==='ground'?'ON GROUND':p.state==='routed'?(wrong?`WRONG WAY → ${p.target.a.code}`:'CLEARED'):p.state==='holding'?'CIRCLING':'ARRIVING';
      return `<button class="strip${p===sel?' sel':''}${p.fuel<20&&p.state!=='ground'?' low':''}${wrong?' wrong':''}" data-id="${p.id}" type="button">
        <span class="cs">${p.call}</span>
        <span class="nd">${p.state==='ground'?`Refueling at ${esc(p.need.a.place)}`:`${p.leg==='fuel'?'Fuel stop':'Land'} at <b>${esc(p.need.a.place)}</b>`}${p.next?` <span class="dim">then ${esc(p.next.a.place)}</span>`:''}</span>
        <span class="stt">${st}</span>
        <span class="fu" aria-label="Fuel ${Math.round(p.fuel)}%"><i style="width:${Math.max(0,p.fuel)}%"></i></span>
        <span class="hn">${hintHTML(p)}</span></button>`;}).join('');who();}
  $('#strips').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-id]');if(!b)return;const p=planes.find(x=>x.id===+b.dataset.id);if(p){sel=p;who();strips();}});
  $('#strips').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b)return;const p=planes.find(x=>x.id===+b.dataset.id);if(p){sel=p;who();}});
  cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/scale,y=(e.clientY-r.top)/scale;
    let best=null,bd=40;for(const p of active()){const d=Math.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=p;}}if(best){sel=best;who();strips();}});
  function cycle(dir){const a=active();if(!a.length)return;const i=a.indexOf(sel);sel=a[(i+dir+a.length)%a.length];who();strips();}
  function press(k){
    if(initials!==null){if(k==='DEL')initBuf=initBuf.slice(0,-1);else if(initBuf.length<3)initBuf+=k;drawBuf();if(initBuf.length===3)saveInitials();return;}
    if(over||paused||phase!=='play')return;
    if(k==='DEL'){buf=buf.slice(0,-1);drawBuf();return;}
    buf+=k;drawBuf();if(buf.length===3){const c=buf;buf='';route(c);strips();who();}}
  $('#kb').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-k]');if(!b)return;e.preventDefault();press(b.dataset.k);});
  const onKey=e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;if(e.target&&e.target.tagName==='INPUT')return;
    if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();press(e.key.toUpperCase());}
    else if(e.key==='Backspace'){e.preventDefault();press('DEL');}
    else if(e.key==='Tab'||e.key==='ArrowDown'){if(initials!==null)return;e.preventDefault();cycle(e.shiftKey?-1:1);}
    else if(e.key==='ArrowUp'){e.preventDefault();cycle(-1);}
    else if(e.key==='Escape'||(e.key===' '&&initials===null)){e.preventDefault();togglePause();}};
  document.addEventListener('keydown',onKey);
  function togglePause(){if(over)return;paused=!paused;
    if(paused){showOvl('PAUSED','Planes are holding.',`<div class="row"><button class="crt-btn primary" id="res">RESUME</button><button class="crt-btn" id="quit">QUIT</button></div>`);$('#res').onclick=togglePause;$('#quit').onclick=()=>go(tower);}
    else{ovl.hidden=true;if(phase==='intro')showOvl(`SHIFT ${shift}`,'');last=performance.now();}}
  $('#pz').onclick=togglePause;
  const onVis=()=>{if(document.hidden&&!paused&&!over)togglePause();};document.addEventListener('visibilitychange',onVis);
  function frame(t){const dt=Math.min(.05,(t-last)/1000);last=t;if(!paused&&!over)update(dt);else if(over){clock+=dt;fx(dt);}else if(paused&&reduce===false){/* frozen */}
    draw();stripT-=dt;if(stripT<=0&&!over){stripT=.2;strips();}raf=requestAnimationFrame(frame);}
  function gameOver(){over=true;phase='over';planes=[];sel=null;endXP=Math.round(score/40);addXP(endXP);const L=S.ths[dk];const q=score>0&&(L.length<10||score>L[L.length-1].s);
    showOvl('SHIFT OVER',`Score ${score} · ${landed} planes landed · reached shift ${shift}`);$('#strips').innerHTML='';const u=bridge.user&&bridge.user();if(q&&u){initBuf=u.slice(0,16);saveInitials();}else renderEnd(q,-1);}
  function renderEnd(entering,hlIdx){const e=$('#endP');e.hidden=false;
    if(entering){initials='';initBuf='';drawBuf();$('#kb').hidden=false;$('#who').textContent='Enter initials';
      e.innerHTML=`<h2 style="font-size:1.3rem">NEW HIGH SCORE</h2><p>Type 3-letter initials for this device's list. You can post to the world leaderboard right after.</p><div class="row"><button class="crt-btn" id="skipI">SKIP</button></div>`;
      $('#skipI').onclick=()=>{initials=null;renderEnd(false,-1);};return;}
    initials=null;$('#kb').hidden=true;root.querySelector('.crt-row').hidden=true;$('#radio').hidden=true;
    const miss=[...lostCodes].map(c=>`<span class="chip">${c} · ${esc(BY[c].place)}</span>`).join('');
    e.innerHTML=`<div class="hud"><span>SCORE <b>${score}</b></span><span>SHIFT <b>${shift}</b></span><span>LANDED <b>${landed}</b></span><span>LEGS FLOWN <b>${legs}</b></span><span>NO-HINT ROUTES <b>${clean}</b></span><span>WRONG CODES <b>${wrongs}</b></span><span>XP <b>+${endXP}</b></span></div>
      ${miss?`<p>Cities pilots needed that went wrong. Lock these in:</p><div class="chips">${miss}</div>`:'<p>Every plane made it. Try a harder level.</p>'}
      <h2 style="font-size:1.2rem">HIGH SCORES · ${TDIFFS[dk].name.toUpperCase()}</h2>${hsTableFor(S.ths[dk],TDIFFS[dk].name,hlIdx)}
      <div class="row"><button class="crt-btn primary" id="again" style="flex:2">NEW SHIFT</button><button class="crt-btn" id="setup">SETTINGS</button></div>
      ${bridge.online?'<button class="crt-btn" id="wlb">WORLD LEADERBOARD</button>':''}
      ${miss?`<button class="crt-btn" id="drill">PRACTICE THOSE CITIES</button>`:''}`;
    $('#again').onclick=()=>{sfx('wave');go(towerRun,deck,dk);};$('#setup').onclick=()=>go(tower);
    const d=$('#drill');if(d)d.onclick=()=>go(recall,{list:groupQueue([...lostCodes])});
    const wl=$('#wlb');if(wl)wl.onclick=()=>bridge.openLeaderboard('tower',dk);
    e.scrollIntoView({block:'nearest'});report();}
  function saveInitials(){const n=initBuf;initials=null;const L=S.ths[dk];const entry={n,s:score,w:shift,m:deck.name,d:today()};
    L.push(entry);L.sort((a,b)=>b.s-a.s);S.ths[dk]=L.slice(0,10);save();renderEnd(false,S.ths[dk].indexOf(entry));}
  if(bridge.debug)window.__TC={planes:()=>planes.map(p=>({id:p.id,call:p.call,need:p.need.a.code,leg:p.leg,state:p.state,fuel:Math.round(p.fuel),hl:p.hl,target:p.target?.a.code||null,sel:p===sel})),
    st:()=>({shift,safety,score,phase,over,landed,legs,wrongs,emerg,toSpawn}),select:id=>{const p=planes.find(x=>x.id===id);if(p){sel=p;who();}},initials:()=>initials};
  cleanup=()=>{cancelAnimationFrame(raf);ro.disconnect();document.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVis);clearTimeout(bufT);};
  hud();startShift();strips();raf=requestAnimationFrame(t=>{last=t;frame(t);});
}

function getFamily(k){return k==='display'?'"Big Shoulders Display", Impact, sans-serif':'"IBM Plex Mono", ui-monospace, monospace';}

rebuild();
go(home);
return ()=>{if(cleanup){cleanup();cleanup=null;}clearTimeout(saveTimer);document.removeEventListener('keydown',mcKey);root.innerHTML='';};
}
