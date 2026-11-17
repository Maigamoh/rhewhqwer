const $=id=>document.getElementById(id);
const log=m=>{const d=$("log");d.textContent+=new Date().toISOString()+"  "+m+"\n";d.scrollTop=1e9};
const gs=[...document.querySelectorAll(".g")];
gs.forEach(g=>g.onchange=()=>{const ok=gs.every(x=>x.checked);$("demo").disabled=!ok;$("upl").style.opacity=ok?1:.4;$("upl").style.pointerEvents=ok?"auto":"none";if(ok)log("Provenance gate confirmed (4/4)")});

function news2(p){
 const r=[];const add=(n,v,s)=>{r.push({n,v,s})};
 const rr=p.rr;add("Resp. rate",rr,rr<=8?3:rr<=11?1:rr<=20?0:rr<=24?2:3);
 const o=p.spo2;add("SpO₂",o,o<=91?3:o<=93?2:o<=95?1:0);
 add("Supplemental O₂",p.o2?"Yes":"No",p.o2?2:0);
 const b=p.sbp;add("Systolic BP",b,b<=90?3:b<=100?2:b<=110?1:b<=219?0:3);
 const h=p.pulse;add("Pulse",h,h<=40?3:h<=50?1:h<=90?0:h<=110?1:h<=130?2:3);
 add("Consciousness",p.alert?"Alert":"Not alert",p.alert?0:3);
 const t=p.temp;add("Temperature",t,t<=35?3:t<=36?1:t<=38?0:t<=39?1:2);
 return r}
const TIERS=[["Immediate",1,"Now"],["Urgent",2,"≤ 1 hour"],["Elevated",3,"≤ 4 hours"],["Routine+",4,"≤ 12 hours"],["Routine",5,"Standard"]];
function triage(p){
 const f=news2(p),total=f.reduce((a,x)=>a+x.s,0),single3=f.some(x=>x.s===3);
 let t=total>=7?1:total>=5?2:single3?3:total>=1?4:5;const notes=[];
 if(single3&&t>=3)notes.push("A single parameter scored 3 (urgent ward-based review).");
 if(p.img!=null&&p.img>=0.7&&t>1){t--;notes.push("Escalated one tier: imaging flag "+p.img.toFixed(2)+" ≥ 0.70.")}
 return{...p,f,total,t,notes}}
const num=v=>{const x=parseFloat(v);return isNaN(x)?null:x};
function parse(txt){
 const L=txt.trim().split(/\r?\n/);const H=L[0].split(",").map(s=>s.trim().toLowerCase());
 return L.slice(1).filter(Boolean).map((l,i)=>{const c=l.split(",");const g=k=>{const j=H.indexOf(k);return j<0?null:c[j].trim()};
  return{id:g("id")||"Case "+(i+1),age:num(g("age")),rr:num(g("rr")),spo2:num(g("spo2")),o2:+g("o2")===1,sbp:num(g("sbp")),pulse:num(g("pulse")),temp:num(g("temp")),alert:g("alert")!=="0",img:num(g("image_ai_score"))}})}
function synth(){let s=7;const R=()=>(s=(s*16807)%2147483647)/2147483647;
 const rows=[];for(let i=1;i<=14;i++){const sick=R()<.4;
  rows.push({id:"SYN-"+String(i).padStart(3,"0"),age:Math.round(25+R()*60),rr:Math.round(sick?20+R()*12:12+R()*7),spo2:Math.round(sick?88+R()*7:95+R()*5),o2:sick&&R()<.5,sbp:Math.round(sick?80+R()*40:105+R()*35),pulse:Math.round(sick?95+R()*45:58+R()*30),temp:+(sick?37.5+R()*2.3:36.3+R()*.9).toFixed(1),alert:!(sick&&R()<.15),img:R()<.7?+(sick?.4+R()*.55:R()*.5).toFixed(2):null})}
 return rows}
let cases=[];
function render(rows){
 cases=rows.map(triage).sort((a,b)=>a.t-b.t||b.total-a.total||(b.img||0)-(a.img||0));
 $("listcard").hidden=false;$("detail").hidden=true;
 const cnt=[0,0,0,0,0,0];cases.forEach(c=>cnt[c.t]++);
 $("summary").innerHTML=TIERS.map(x=>`<span><span class="pill t${x[1]}">${x[0]}</span> ${cnt[x[1]]}</span>`).join(" ");
 $("body").innerHTML=cases.map((c,i)=>`<tr class="row" data-i="${i}"><td>${i+1}</td><td>${esc(c.id)}${c.age!=null?` <span class="mu">· ${c.age}y</span>`:""}</td><td><span class="pill t${c.t}">${TIERS[c.t-1][0]}</span></td><td>${c.total}</td><td>${c.img!=null?c.img.toFixed(2):"—"}</td><td>${TIERS[c.t-1][2]}</td></tr>`).join("");
 document.querySelectorAll("tr.row").forEach(r=>r.onclick=()=>show(+r.dataset.i));
 log("Scored "+cases.length+" cases; worklist generated")}
const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
function show(i){const c=cases[i],d=$("detail");d.hidden=false;
 d.innerHTML=`<h2>${esc(c.id)} · <span class="pill t${c.t}">${TIERS[c.t-1][0]}</span> · NEWS2 ${c.total}</h2>
 <div class="wrap"><table style="min-width:360px"><thead><tr><th>Parameter</th><th>Value</th><th>Points</th></tr></thead><tbody>${c.f.map(x=>`<tr><td>${x.n}</td><td>${x.v==null||Number.isNaN(x.v)?"missing":x.v}</td><td>${x.s}</td></tr>`).join("")}</tbody></table></div>
 ${c.notes.length?"<ul>"+c.notes.map(n=>"<li>"+n+"</li>").join("")+"</ul>":""}
 <p class="mu">Decision support only. Confirm with the patient's full clinical picture. Missing values score 0, so check for gaps.</p>
 <div class="flex"><button class="sec" onclick="log('Clinician reviewed ${esc(c.id)} (tier ${c.t})')">Mark reviewed</button></div>`;
 d.scrollIntoView({behavior:"smooth"});log("Opened "+c.id)}
$("demo").onclick=()=>{render(synth());log("Loaded synthetic demo data")};
$("file").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{render(parse(r.result));log("Loaded local CSV: "+f.name)}catch(x){log("CSV error")}};r.readAsText(f)};
$("tpl").onclick=()=>{const t="id,age,rr,spo2,o2,sbp,pulse,temp,alert,image_ai_score\nP001,67,24,92,1,98,112,38.6,1,0.81\nP002,45,16,98,0,125,72,36.8,1,0.12\n";
 const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(t);a.download="triage_template.csv";a.click()};
