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
function queryUrl(media,name){const q=encodeURIComponent(`${name} 綱島`);const map={Google:`https://www.google.com/maps/search/?api=1&query=${q}`,食べログ:`https://tabelog.com/rstLst/?sk=${q}`,ヒトサラ:`https://www.google.com/search?q=${encodeURIComponent('site:hitosara.com '+name+' 綱島')}`,Retty:`https://retty.me/search/?q=${q}`,"ホットペッパー":`https://www.hotpepper.jp/CSP/psh010/doBasic?keyword=${q}`,"Uber Eats":`https://www.ubereats.com/jp/search?q=${q}`,Instagram:`https://www.instagram.com/explore/search/keyword/?q=${q}`,X:`https://x.com/search?q=${encodeURIComponent('"'+name+'" -求人 -バイト')}&src=typed_query&f=live`,LINE:`https://www.google.com/search?q=${encodeURIComponent("site:page.line.me "+name)}`};return map[media]||`https://www.google.com/search?q=${q}`}
function genreButtons(){$("#genreFilters").innerHTML=genres.map(g=>`<button class="genre ${g===selectedGenre?'active':''}" data-genre="${g}">${g}</button>`).join("");$$('.genre').forEach(b=>b.onclick=()=>{selectedGenre=b.dataset.genre;genreButtons();search()})}
function getDate(){return new Date($("#dateTime").value)}
function fitScore(r,status){return status.score+(r.confidence==="high"?8:4)+(r.reserve?2:0)-r.walk/3}
function search(scroll=false){const date=getDate(), area=$("#area").value,budget=+$("#budget").value,openOnly=$("#openOnly").checked,reservable=$("#reservable").checked,delivery=$("#delivery").checked;currentResults=RESTAURANTS.map(r=>({...r,_status:statusAt(r,date)})).filter(r=>(selectedGenre==="すべて"||r.genres.includes(selectedGenre))&&(area==="all"||area==="station"?area==="all"||r.walk<=5:r.area===area)&&r.budget<=budget&&(!openOnly||["open","caution"].includes(r._status.state))&&(!reservable||r.reserve)&&(!delivery||r.takeout||r.delivery));sortAndRender();const dateText=new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit"}).format(date);$("#resultNote").innerHTML=`<span>${dateText}</span> の通常営業時間から判定。臨時変更・満席は公式サイトで最終確認してください。`;if(scroll)$("#resultsSection").scrollIntoView({behavior:"smooth",block:"start"})}
function sortAndRender(){const mode=$("#sort").value;currentResults.sort((a,b)=>mode==="distance"?a.walk-b.walk:mode==="close"?maxClose(b)-maxClose(a):mode==="fresh"?b.checked.localeCompare(a.checked):fitScore(b,b._status)-fitScore(a,a._status));render()}
function maxClose(r){return Math.max(0,...Object.values(r.hours).flat().map(p=>p[1]))}
function visualHtml(r){
  if(!r.photoUrl)return '';
  const destination=r.photosUrl||r.official;
  return `<a class="food-visual has-photo" href="${destination}" target="_blank" rel="noopener" style="background-image:linear-gradient(180deg,transparent 35%,rgba(9,19,14,.75)),url('${r.photoUrl}')"><span>${r.photoLabel||'店舗公式掲載画像'}</span><b>画像を見る ↗</b></a>`;
}
function photosLabel(r){return r.photosUrl?.includes('tabelog.com')?'投稿写真を見る ↗':'公式写真を見る ↗'}
function sourceStatus(r){return r.confidence==='high'?'店舗公式確認':'地域情報・要再確認'}
function sourceAction(r){return r.confidence==='high'?'公式を見る ↗':'情報源を見る ↗'}
function mapSearchUrl(r){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name+' '+r.address)}`}
function directionsUrl(r){return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address)}&travelmode=walking`}
function mapEmbedUrl(r){return `https://www.google.com/maps?q=${encodeURIComponent(r.name+' '+r.address)}&output=embed`}
function ratingsHtml(r,compact=false){
  if(!r.ratings.length)return `<div class="rating-pending">媒体点数を確認中</div>`;
  return `<div class="ratings ${compact?'compact':''}">${r.ratings.map(x=>`<a href="${x.url}" target="_blank" rel="noopener"><span>${x.source}</span><strong>${x.score}</strong><small>${x.count?`${x.count}件`:''}</small></a>`).join('')}<em>8/29確認</em></div>`;
}
function evidenceHtml(r){
  const items=[];
  if(r.hitosaraUrl)items.push(`<a class="evidence verified" href="${r.hitosaraUrl}" target="_blank" rel="noopener"><b>ヒトサラ掲載確認</b><small>店舗ページあり ↗</small></a>`);
  else items.push(`<a class="evidence search" href="${queryUrl('ヒトサラ',r.name)}" target="_blank" rel="noopener"><b>ヒトサラを探す</b><small>掲載は未確認 ↗</small></a>`);
  if(r.reserve)items.push(`<a class="evidence booking" href="${r.official}" target="_blank" rel="noopener"><b>予約先あり</b><small>${r.sourceLabel}で確認 ↗</small></a>`);
  return `<div class="evidence-row">${items.join('')}</div>`;
}
function socialLinksHtml(r){return `<div class="social-search"><a href="${queryUrl('Instagram',r.name)}" target="_blank" rel="noopener"><b>Instagram</b><small>店名で探す ↗</small></a><a href="${queryUrl('X',r.name)}" target="_blank" rel="noopener"><b>Xの最新評判</b><small>求人投稿を除いて検索 ↗</small></a></div>`}
function render(){
  const date=getDate();
  $("#resultCount").textContent=currentResults.length;$("#empty").hidden=!!currentResults.length;
  $("#cards").innerHTML=currentResults.map((r,i)=>`<article class="restaurant-card" style="--delay:${i*45}ms">${visualHtml(r)}<div class="card-top"><div class="rank">${String(i+1).padStart(2,"0")}</div><div class="status ${r._status.state}"><i></i>${r._status.label}</div></div><div class="card-main"><p class="card-kicker">${r.areaLabel}・徒歩${r.walk}分</p><h3>${r.name}</h3>${ratingsHtml(r,true)}${evidenceHtml(r)}<div class="tag-list">${r.genres.map(g=>`<span>${g}</span>`).join("")}${r.features.slice(0,2).map(g=>`<span>${g}</span>`).join("")}</div><p class="summary">${r.summary}</p></div><div class="fact-row"><div><span>本日の通常営業</span><b>${hoursToday(r,date)}</b></div><div><span>予算目安</span><b>¥${r.budget.toLocaleString()}前後</b></div></div><div class="quick-links">${r.menuUrl?`<a href="${r.menuUrl}" target="_blank" rel="noopener">メニューを見る ↗</a>`:''}${r.photosUrl?`<a href="${r.photosUrl}" target="_blank" rel="noopener">${photosLabel(r)}</a>`:''}<a href="${directionsUrl(r)}" target="_blank" rel="noopener">徒歩ルート ↗</a></div><div class="source-row"><div class="confidence ${r.confidence}"><span>${sourceStatus(r)}</span><small>${r.checked}確認</small></div><div class="media-dots" aria-label="確認先">${r.media.slice(0,4).map(m=>`<i title="${m}">${m[0]}</i>`).join("")}</div></div><div class="card-actions"><a href="${r.official}" target="_blank" rel="noopener">${sourceAction(r)}</a><button data-detail="${r.id}">横断カルテを見る <span>→</span></button></div></article>`).join("");
  $$('[data-detail]').forEach(b=>b.onclick=()=>openDetail(b.dataset.detail));
}
function openDetail(id){
  const r=RESTAURANTS.find(x=>x.id===id),date=getDate(),st=statusAt(r,date);
  $("#detailContent").innerHTML=`<p class="eyebrow">RESTAURANT FILE</p><div class="detail-title"><div><p>${r.areaLabel}・徒歩${r.walk}分</p><h2>${r.name}</h2></div><span class="status ${st.state}"><i></i>${st.label}</span></div>${ratingsHtml(r)}${evidenceHtml(r)}<p class="detail-summary">${r.summary}</p><div class="detail-cta">${r.reserve?`<a class="reserve-primary" href="${r.official}" target="_blank" rel="noopener">予約先を開く <span>↗</span></a>`:''}${r.menuUrl?`<a href="${r.menuUrl}" target="_blank" rel="noopener">メニューを見る <span>↗</span></a>`:''}${r.photosUrl?`<a href="${r.photosUrl}" target="_blank" rel="noopener">${photosLabel(r).replace(' ↗','')} <span>↗</span></a>`:''}<a href="${directionsUrl(r)}" target="_blank" rel="noopener">ここまで徒歩で行く <span>↗</span></a></div><div class="detail-facts"><div><span>指定日時の判定</span><b>${st.detail}</b></div><div><span>本日の通常営業</span><b>${hoursToday(r,date)}</b></div><div><span>予算目安</span><b>¥${r.budget.toLocaleString()}前後</b></div><div><span>予約</span><b>${r.reserve?"予約先あり":"未確認"}</b></div><div><span>持ち帰り</span><b>${r.takeout?"確認あり":"未確認"}</b></div><div><span>配達</span><b>${r.delivery?"確認あり":"未確認"}</b></div></div><div class="address"><span>所在地</span><p>${r.address}</p></div><div class="map-block"><iframe src="${mapEmbedUrl(r)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${r.name}の地図"></iframe><div><a href="${mapSearchUrl(r)}" target="_blank" rel="noopener">大きな地図を見る ↗</a><a href="${directionsUrl(r)}" target="_blank" rel="noopener">現在地から徒歩ルート ↗</a></div></div><h3 class="media-title">SNSで最近の空気を見る</h3>${socialLinksHtml(r)}<h3 class="media-title">媒体を横断して確認</h3><div class="media-links">${[...new Set([...r.media,'ヒトサラ'])].map(m=>`<a href="${m==='ヒトサラ'&&r.hitosaraUrl?r.hitosaraUrl:queryUrl(m,r.name)}" target="_blank" rel="noopener"><span>${m}</span><small>${m==='ヒトサラ'&&r.hitosaraUrl?'掲載確認済み':'検索して確認'} ↗</small></a>`).join("")}</div><div class="source-box"><span>主要情報源：${sourceStatus(r)}</span><a href="${r.official}" target="_blank" rel="noopener">${r.sourceLabel} ↗</a><small>最終確認 ${r.checked}　｜　点数は同日確認時点。臨時休業・貸切・満席は反映されない場合があります。</small></div>`;
  $("#detailDialog").showModal();
}

initDate();genreButtons();search();
$("#searchButton").onclick=()=>search(true);$("#sort").onchange=sortAndRender;["dateTime","area","budget","openOnly","reservable","delivery"].forEach(id=>$("#"+id).onchange=()=>search());
$("#dataButton").onclick=()=>$("#infoDialog").showModal();$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.onclick=e=>{if(e.target===d)d.close()});
