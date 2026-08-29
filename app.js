const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const genres = ["すべて", ...new Set(RESTAURANTS.flatMap(r => r.genres))];
let selectedGenre = "すべて";
let currentResults = [];

function initDate(){const d=new Date();d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);d.setMinutes(d.getMinutes()+30);const local=new Date(d-d.getTimezoneOffset()*60000);$("#dateTime").value=local.toISOString().slice(0,16)}
function minutesLabel(n){const day=n>=1440?"翌":"";n%=1440;return `${day}${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`}
function scheduleFor(r,date){return r.hours[date.getDay()]||[]}
function statusAt(r,date){
  const rawMins=date.getHours()*60+date.getMinutes();
  const previous=new Date(date);previous.setDate(date.getDate()-1);
  const overnight=scheduleFor(r,previous).filter(([,end])=>end>1440).map(([start,end])=>[start,end,r.lastOrder??end]);
  const current=scheduleFor(r,date).map(([start,end])=>[start,end,r.lastOrder??end]);
  const candidates=rawMins<360?[...overnight,...current].map(([s,e,lo])=>e>1440?[s,e,lo]:[s+1440,e+1440,lo+1440]):current;
  const mins=rawMins<360?rawMins+1440:rawMins;
  if(!candidates.length)return {state:"closed",label:"定休日",detail:"通常営業なし",score:-50};
  for(const [start,end,effectiveEnd] of candidates){
    if(mins<start)return {state:"later",label:`${minutesLabel(start)}開店`,detail:"このあと営業",score:2};
    if(mins>=start&&mins<effectiveEnd){const left=effectiveEnd-mins;if(left<45)return {state:"caution",label:"まもなく受付終了",detail:`受付目安まで約${left}分`,score:6};return {state:"open",label:"営業可能性 高",detail:`${minutesLabel(effectiveEnd)}まで注文目安`,score:16};}
  }
  return {state:"closed",label:"営業時間外",detail:"通常営業時間から判定",score:-50};
}
function hoursToday(r,date){const p=scheduleFor(r,date);if(!p.length)return "定休日";return p.map(([s,e])=>`${minutesLabel(s)}–${minutesLabel(e)}`).join(" / ")+(r.lastOrder?`（受付目安 ${minutesLabel(r.lastOrder)}）`:"")}
function queryUrl(media,name){const q=encodeURIComponent(`${name} 綱島`);const map={Google:`https://www.google.com/maps/search/?api=1&query=${q}`,食べログ:`https://tabelog.com/rstLst/?sk=${q}`,Retty:`https://retty.me/search/?q=${q}`,"ホットペッパー":`https://www.hotpepper.jp/CSP/psh010/doBasic?keyword=${q}`,"Uber Eats":`https://www.ubereats.com/jp/search?q=${q}`,Instagram:`https://www.google.com/search?q=${encodeURIComponent("site:instagram.com "+name)}`,LINE:`https://www.google.com/search?q=${encodeURIComponent("site:page.line.me "+name)}`};return map[media]||`https://www.google.com/search?q=${q}`}
function genreButtons(){$("#genreFilters").innerHTML=genres.map(g=>`<button class="genre ${g===selectedGenre?'active':''}" data-genre="${g}">${g}</button>`).join("");$$('.genre').forEach(b=>b.onclick=()=>{selectedGenre=b.dataset.genre;genreButtons();search()})}
function getDate(){return new Date($("#dateTime").value)}
function fitScore(r,status){return status.score+(r.confidence==="high"?8:4)+(r.reserve?2:0)-r.walk/3}
function search(scroll=false){const date=getDate(), area=$("#area").value,budget=+$("#budget").value,openOnly=$("#openOnly").checked,reservable=$("#reservable").checked,delivery=$("#delivery").checked;currentResults=RESTAURANTS.map(r=>({...r,_status:statusAt(r,date)})).filter(r=>(selectedGenre==="すべて"||r.genres.includes(selectedGenre))&&(area==="all"||area==="station"?area==="all"||r.walk<=5:r.area===area)&&r.budget<=budget&&(!openOnly||["open","caution"].includes(r._status.state))&&(!reservable||r.reserve)&&(!delivery||r.takeout||r.delivery));sortAndRender();const dateText=new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit"}).format(date);$("#resultNote").innerHTML=`<span>${dateText}</span> の通常営業時間から判定。臨時変更・満席は公式サイトで最終確認してください。`;if(scroll)$("#resultsSection").scrollIntoView({behavior:"smooth",block:"start"})}
function sortAndRender(){const mode=$("#sort").value;currentResults.sort((a,b)=>mode==="distance"?a.walk-b.walk:mode==="close"?maxClose(b)-maxClose(a):mode==="fresh"?b.checked.localeCompare(a.checked):fitScore(b,b._status)-fitScore(a,a._status));render()}
function maxClose(r){return Math.max(0,...Object.values(r.hours).flat().map(p=>p[1]))}
function render(){const date=getDate();$("#resultCount").textContent=currentResults.length;$("#empty").hidden=!!currentResults.length;$("#cards").innerHTML=currentResults.map((r,i)=>`<article class="restaurant-card" style="--delay:${i*45}ms"><div class="card-top"><div class="rank">${String(i+1).padStart(2,"0")}</div><div class="status ${r._status.state}"><i></i>${r._status.label}</div></div><div class="card-main"><p class="card-kicker">${r.areaLabel}・徒歩${r.walk}分</p><h3>${r.name}</h3><div class="tag-list">${r.genres.map(g=>`<span>${g}</span>`).join("")}${r.features.slice(0,2).map(g=>`<span>${g}</span>`).join("")}</div><p class="summary">${r.summary}</p></div><div class="fact-row"><div><span>本日の通常営業</span><b>${hoursToday(r,date)}</b></div><div><span>予算目安</span><b>¥${r.budget.toLocaleString()}前後</b></div></div><div class="source-row"><div class="confidence ${r.confidence}"><span>${r.confidence==="high"?"公式確認済み":"公式系情報"}</span><small>${r.checked}確認</small></div><div class="media-dots" aria-label="確認先">${r.media.slice(0,4).map(m=>`<i title="${m}">${m[0]}</i>`).join("")}</div></div><div class="card-actions"><a href="${r.official}" target="_blank" rel="noopener">公式を見る ↗</a><button data-detail="${r.id}">横断カルテを見る <span>→</span></button></div></article>`).join("");$$('[data-detail]').forEach(b=>b.onclick=()=>openDetail(b.dataset.detail))}
function openDetail(id){const r=RESTAURANTS.find(x=>x.id===id), date=getDate(), st=statusAt(r,date);$("#detailContent").innerHTML=`<p class="eyebrow">RESTAURANT FILE</p><div class="detail-title"><div><p>${r.areaLabel}・徒歩${r.walk}分</p><h2>${r.name}</h2></div><span class="status ${st.state}"><i></i>${st.label}</span></div><p class="detail-summary">${r.summary}</p><div class="detail-facts"><div><span>指定日時の判定</span><b>${st.detail}</b></div><div><span>本日の通常営業</span><b>${hoursToday(r,date)}</b></div><div><span>予算目安</span><b>¥${r.budget.toLocaleString()}前後</b></div><div><span>予約</span><b>${r.reserve?"予約先あり":"未確認"}</b></div><div><span>持ち帰り</span><b>${r.takeout?"確認あり":"未確認"}</b></div><div><span>配達</span><b>${r.delivery?"確認あり":"未確認"}</b></div></div><div class="address"><span>所在地</span><p>${r.address}</p></div><h3 class="media-title">媒体を横断して確認</h3><div class="media-links">${r.media.map(m=>`<a href="${queryUrl(m,r.name)}" target="_blank" rel="noopener"><span>${m}</span><small>検索して確認 ↗</small></a>`).join("")}</div><div class="source-box"><span>主要情報源</span><a href="${r.official}" target="_blank" rel="noopener">${r.sourceLabel} ↗</a><small>最終確認 ${r.checked}　｜　臨時休業・貸切・満席は反映されない場合があります。</small></div>`;$("#detailDialog").showModal()}

initDate();genreButtons();search();
$("#searchButton").onclick=()=>search(true);$("#sort").onchange=sortAndRender;["dateTime","area","budget","openOnly","reservable","delivery"].forEach(id=>$("#"+id).onchange=()=>search());
$("#dataButton").onclick=()=>$("#infoDialog").showModal();$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.onclick=e=>{if(e.target===d)d.close()});
