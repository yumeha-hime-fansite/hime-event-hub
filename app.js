'use strict';
(() => {
  const cfg = window.HIME_CONFIG || {};
  const CATS = ['ライブ','イベント','キャンペーン','グッズ','配信','その他'];
  const THEMES = {
    'ライブ': {bg:'#fce5ef',fg:'#b84878',emoji:'🎤'},
    'イベント': {bg:'#f1e4fb',fg:'#8850bb',emoji:'🎪'},
    'キャンペーン': {bg:'#fff0d7',fg:'#b8762b',emoji:'🎉'},
    'グッズ': {bg:'#e5f2f3',fg:'#337c88',emoji:'🎁'},
    '配信': {bg:'#e7ecff',fg:'#6373be',emoji:'📺'},
    'その他': {bg:'#f1edf3',fg:'#695878',emoji:'✦'}
  };
  // 架空データ。公開する際は必ずシートを接続してください。
  const DEMO = [
    {category:'ライブ',title:'ライブ出演（サンプル）',start_date:'2027-01-16',end_date:'2027-01-16',time:'18:00',place:'都内ライブ会場（架空）',summary:'チケット情報は公式告知をご確認ください',details:'こちらは機能確認用の架空データです。',url:'https://example.com/',priority:'1',show:'TRUE'},
    {category:'イベント',title:'リアルイベント（サンプル）',start_date:'2027-01-24',end_date:'2027-01-24',time:'14:00',place:'都内イベント会場（架空）',summary:'詳細・参加方法は公式リンクから',details:'こちらは機能確認用の架空データです。',url:'https://example.com/',priority:'2',show:'TRUE'},
    {category:'キャンペーン',title:'再生キャンペーン（サンプル）',start_date:'2027-01-01',end_date:'2027-01-31',time:'',place:'',summary:'応募締切 1/31 · 条件は詳細を確認',details:'こちらは機能確認用の架空データです。',url:'https://example.com/',priority:'1',show:'TRUE'},
    {category:'グッズ',title:'期間限定グッズ（サンプル）',start_date:'2027-01-03',end_date:'2027-02-05',time:'',place:'オンライン',summary:'受付終了 2/5 · 売り切れにご注意',details:'こちらは機能確認用の架空データです。',url:'https://example.com/',priority:'3',show:'TRUE'},
    {category:'配信',title:'定期歌枠（サンプル）',date_label:'毎週水曜',start_date:'',end_date:'',time:'20:00',place:'YouTube',summary:'毎週の定期歌枠はこちらから',details:'こちらは機能確認用の架空データです。',url:'https://www.youtube.com/@hime.yumeha',priority:'3',show:'TRUE'}
  ];
  const $ = id => document.getElementById(id);
  function tokyoTodayISO() {
    const p = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get = k => p.find(x=>x.type === k)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  let todayISO = tokyoTodayISO();
  let items = [], shown = [], currentPage = 0, filter = 'すべて', demo = !cfg.sheetId;
  const modeParam = new URLSearchParams(location.search).get('mode');
  const embed = modeParam === 'embed';
  let mode = modeParam === 'x' ? 'x' : 'site';
  if (embed) { document.body.classList.add('embed-mode'); document.documentElement.classList.add('embedded-document'); }
  function readDate(s) {
    if(s instanceof Date && !Number.isNaN(s.getTime())) return `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${String(s.getDate()).padStart(2,'0')}`;
    s = String(s == null ? '' : s).trim();
    if (!s) return '';
    const d = s.match(/^Date\((\d+),\s*(\d+),\s*(\d+)/);
    if (d) return `${d[1]}-${String(Number(d[2])+1).padStart(2,'0')}-${d[3].padStart(2,'0')}`;
    const a = s.match(/^(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/);
    if (a) return `${a[1]}-${a[2].padStart(2,'0')}-${a[3].padStart(2,'0')}`;
    return '';
  }
  // Google Sheets (Visualization API) は「時刻」を Date(1899,11,30,18,0,0) の形式で返すことがある。
  // 表示用の時刻は日付として扱わず、時・分をそのまま取り出す。
  function readTime(value) {
    if(value == null || value === '') return '';
    const pad = n => String(n).padStart(2, '0');
    if(value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    }
    if(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1) {
      const minutes = Math.round(value * 24 * 60);
      return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
    }
    const t = String(value).trim();
    const googleTime = t.match(/^Date\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})(?:\s*,\s*\d{1,2})?\s*\)$/);
    if(googleTime) return `${pad(googleTime[1])}:${pad(googleTime[2])}`;
    const clock = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if(clock) return `${pad(clock[1])}:${clock[2]}`;
    const jp = t.match(/^(\d{1,2})時(?:\s*(\d{1,2})分?)?$/);
    if(jp) return `${pad(jp[1])}:${pad(jp[2] || 0)}`;
    return t;
  }
  function shownValue(x) {return !['0','false','off','no','非表示','×'].includes(String(x??'TRUE').trim().toLowerCase());}
  const str = v => String(v == null ? '' : v).trim();
  function normalize(r) {
    const o = {};
    for(const [key,value] of Object.entries(r)) o[key.trim().toLowerCase()] = value;
    const category = str(o.category || o['区分'] || o['カテゴリ'] || 'その他');
    return {
      category: CATS.includes(category) ? category : 'その他',
      title: str(o.title || o['タイトル']),
      start: readDate(o.start_date || o['開始日']),
      end: readDate(o.end_date || o['終了日']),
      label: str(o.date_label || o['日付表示']),
      time: readTime(o.time ?? o['時刻']),place: str(o.place || o['場所']),
      summary: str(o.summary || o['画像用の説明']),
      details: str(o.details || o['投稿用の説明']),
      url: str(o.url || o['公式url'] || o['url']),
      priority: Math.max(1, Math.min(9, Number(o.priority || o['優先度'] || 5) || 5)),
      show: shownValue(o.show ?? o['表示'] ?? 'TRUE')
    };
  }
  function dateText(date){
    if(!date) return '';
    const [y,m,d]=date.split('-').map(Number);
    const wd=['日','月','火','水','木','金','土'][new Date(y,m-1,d).getDay()];
    return `${y===Number(todayISO.slice(0,4))?'':`${y}/`}${m}/${d}(${wd})`;
  }
  function eventWhen(e) {
    let t = e.label || (e.start ? dateText(e.start) : '日程未定');
    if (e.time) t += ` ${e.time}`;
    return t;
  }
  function extraInfo(e){return [eventWhen(e),e.place].filter(Boolean).join('  ·  ');}
  function isCurrent(e){return !!e.title && e.show && !(e.end && e.end < todayISO) && !(e.start && !e.end && e.start < todayISO);}
  function sorting(a,b){return a.priority - b.priority || (a.start || '9999').localeCompare(b.start || '9999') || CATS.indexOf(a.category)-CATS.indexOf(b.category);}
  function safeUrl(s){try {const u = new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function sheetDataToRows(resp){
    if(resp?.status === 'error') throw Error((resp.errors || []).map(x=>x.message).join(' / ') || 'シート読み込みエラー');
    if(!resp?.table?.rows) throw Error('シートからデータを取得できませんでした');
    let heads = (resp.table.cols || []).map(c=>str(c.label));
    let rawRows = resp.table.rows.map(row=>(row.c||[]).map(x=>x?.v??''));
    if (!heads.includes('title') && !heads.includes('タイトル') && rawRows[0]?.some(v=>v==='title'||v==='タイトル')) heads = rawRows.shift().map(str);
    if (!heads.some(x=>x==='title'||x==='タイトル')) throw Error('列名 title / タイトル が見つかりません。テンプレートを確認してください');
    return rawRows.map(values=>Object.fromEntries(heads.map((k,i)=>[k,values[i]])));
  }
  function loadSheet(){
    return new Promise((resolve,reject)=>{
      const cb='__himeSheetResult';let script;let settled=false;
      const timer=setTimeout(()=>fail(Error('読み込みがタイムアウトしました（公開設定・通信状況を確認してください）')),15000);
      function finish(){clearTimeout(timer);delete window[cb];script?.remove();}
      function fail(error){if(settled)return;settled=true;finish();reject(error);}
      window[cb] = resp=>{if(settled)return;settled=true;finish();try{resolve(sheetDataToRows(resp));}catch(e){reject(e);}};
      script=document.createElement('script');
      script.onerror=()=>fail(Error('シートに接続できません。一般公開設定とID・gidをご確認ください'));
      const tqx=encodeURIComponent(`out:json;responseHandler:${cb}`);
      script.src=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(cfg.sheetId)}/gviz/tq?gid=${encodeURIComponent(cfg.sheetGid || '0')}&headers=1&tqx=${tqx}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }
  let sheetLoadedAt = 0;
  let sheetLoading = false;
  function showAlert(s) {$('alert').textContent=s;$('alert').hidden=false;}
  function hideAlert() {$('alert').textContent='';$('alert').hidden=true;}
  function syncLabel(){
    if(!sheetLoadedAt) return `${todayISO.replaceAll('-','.')} 時点の表示`;
    const fmt=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
    return `情報取得 ${fmt.format(new Date(sheetLoadedAt))}`;
  }
  function render(){
    // 日付をまたいだまま開いている場合も、終了済みの情報を自動で除外する。
    todayISO = tokyoTodayISO();
    shown=items.filter(isCurrent).sort(sorting);
    $('updated-site').textContent=syncLabel(); $('updated-x').textContent=syncLabel();
    $('count').textContent=`${shown.length} 件掲載`;
    $('demo-notice').hidden=!demo;
    $('nav-site').classList.toggle('active',mode==='site');$('nav-x').classList.toggle('active',mode==='x');
    $('site-view').hidden=mode!=='site';$('x-view').hidden=mode!=='x';
    paintFilters();paintCards();renderX();notifyEmbedHeight();
  }
  function paintFilters(){
    const root=$('filters');root.replaceChildren();
    for(const c of ['すべて',...CATS]){
      if(c!=='すべて' && !shown.some(x=>x.category===c)) continue;
      const b=document.createElement('button');b.type='button';b.className=`filter ${filter===c?'active':''}`;b.textContent=c;
      b.onclick=()=>{filter=c;paintFilters();paintCards();notifyEmbedHeight();};root.appendChild(b);
    }
  }
  function paintCards(){
    const root=$('cards');root.replaceChildren();
    const visible=shown.filter(e=>filter==='すべて'||e.category===filter);
    if(!visible.length){const d=document.createElement('div');d.className='empty';d.textContent='現在、表示するお知らせはありません。';root.appendChild(d);return;}
    for(const e of visible){
      const c=document.createElement('article');c.className='event';
      const head=document.createElement('div');head.className='event-top';
      const cat=document.createElement('span');cat.className='cat';cat.textContent=e.category;cat.style.background=THEMES[e.category].bg;cat.style.color=THEMES[e.category].fg;head.appendChild(cat);
      if(e.end){const badge=document.createElement('span');badge.className='deadline';badge.textContent=(e.end===e.start?'開催日':'〜'+dateText(e.end)+'まで');head.appendChild(badge);}
      c.appendChild(head);
      const title=document.createElement('h3');title.textContent=e.title;c.appendChild(title);
      const when=document.createElement('div');when.className='when';when.textContent=extraInfo(e);c.appendChild(when);
      const desc=document.createElement('div');desc.className='summary';desc.textContent=e.details || e.summary;c.appendChild(desc);
      const url=safeUrl(e.url);if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className='link';a.textContent='公式情報を見る';c.appendChild(a);}
      root.appendChild(c);
    }
  }
  function renderX(){
    $('post-text').value=buildDraft(shown);
    const pages=pageCount();
    currentPage=Math.min(Math.max(currentPage,0),pages-1);
    $('page-no').textContent=`${currentPage+1} / ${pages}`;
    $('prev').disabled=currentPage===0;$('next').disabled=currentPage===pages-1;
    renderPoster(currentPage,pages);
  }
  function buildDraft(events){
    const out=['📣#夢羽ヒメ さんのライブ・イベント・グッズ・配信情報👑💜','最新情報をまとめました！'];
    if(demo)out.push('【デモ：以下は架空のサンプルです】');
    for(const cat of CATS){
      const section=events.filter(e=>e.category===cat);if(!section.length)continue;
      out.push('',`━━ ${THEMES[cat].emoji} ${cat}情報 ━━`);
      for(const e of section){
        out.push(`▪ ${e.title}`,`📅 ${eventWhen(e)}${e.place?'　📍'+e.place:''}`);
        if(e.details||e.summary) out.push(e.details||e.summary);
        if(safeUrl(e.url))out.push('🔗'+safeUrl(e.url));
        out.push('');
      }
    }
    out.push('※最新情報・詳細は必ず公式告知をご確認ください。','#夢羽ヒメ');
    return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  // Canvasで16:9のX用画像を直接生成。キャラクターは元PNGを無加工で読み込んで配置します。
  const canvas=$('poster'),ctx=canvas.getContext('2d');
  const W=1600,H=900,posterCats=[
    {label:'ライブ出演情報',cats:['ライブ'],mark:'♪',tint:'#fdeaf3',ink:'#b46e9e'},
    {label:'イベント出演情報',cats:['イベント'],mark:'✧',tint:'#e8effd',ink:'#758dc8'},
    {label:'グッズ・企画情報',cats:['グッズ','キャンペーン'],mark:'♡',tint:'#f8e6f8',ink:'#a77cba'},
    {label:'配信情報',cats:['配信','その他'],mark:'☾',tint:'#efeafd',ink:'#9079bc'}
  ];
  const originalImages={};
  const originalImageFiles={
    left:'assets/hime-left.png',
    right:'assets/hime-right.png',
    left2:'assets/hime-left2.png',
    right2:'assets/hime-right2.png'
  };
  for(const [key,src] of Object.entries(originalImageFiles)){
    const im=new Image(); im.decoding='async';
    im.onload=()=>{
      originalImages[key]=im;
      if(key==='left' || key==='right'){
        const box=document.querySelector(`.hero-art.${key}`);
        if(box) box.classList.add('loaded');
      }
      renderX();
    };
    im.onerror=()=>{
      if(key==='left' || key==='right') document.querySelector(`.hero-art.${key} img`)?.remove();
    };
    im.src=src;
  }
  function posterImageKey(side,page){
    if(page>=1){
      const secondary = `${side}2`;
      if(originalImages[secondary]) return secondary;
    }
    return side;
  }
  function pageCount(){return Math.max(1,...posterCats.map(g=>Math.ceil(shown.filter(e=>g.cats.includes(e.category)).length/2)));}
  function groupItems(group,page){return shown.filter(e=>group.cats.includes(e.category)).slice(page*2,page*2+2);}
  function rrect(x,y,w,h,r=15){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function round(x,y,w,h,r,fill,stroke='',sw=1){rrect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}
  function font(size,weight=700,hand=false){ctx.font=`${weight} ${size}px ${hand?'"Yomogi"':'"Zen Maru Gothic"'}, "Hiragino Maru Gothic ProN", sans-serif`;}
  function fitText(text,maxWidth,size,min=21){text=String(text);font(size,900);let s=size;while(s>min&&ctx.measureText(text).width>maxWidth){--s;font(s,900);}if(ctx.measureText(text).width<=maxWidth)return {text,size:s};let chars=[...text];while(chars.length&&ctx.measureText(chars.join('')+'…').width>maxWidth)chars.pop();return {text:chars.join('')+'…',size:s};}
  function strokeText(text,x,y,color,size,maxWidth,weight=900,align='left'){
    const f=fitText(text,maxWidth,size,Math.max(20,size*.58));font(f.size,weight);
    ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(f.text,x,y);ctx.textAlign='left';
  }
  function star(x,y,r,color){ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.18,-r*.18,r,0);ctx.quadraticCurveTo(r*.18,r*.18,0,r);ctx.quadraticCurveTo(-r*.18,r*.18,-r,0);ctx.quadraticCurveTo(-r*.18,-r*.18,0,-r);ctx.fill();ctx.restore();}
  function flower(x,y,r,c){ctx.save();ctx.translate(x,y);ctx.fillStyle=c;for(let i=0;i<5;i++){ctx.save();ctx.rotate(2*Math.PI*i/5);ctx.beginPath();ctx.ellipse(0,-r*.55,r*.34,r*.55,0,0,2*Math.PI);ctx.fill();ctx.restore();}ctx.beginPath();ctx.arc(0,0,r*.22,0,2*Math.PI);ctx.fillStyle='#fae6b7';ctx.fill();ctx.restore();}
  function heart(x,y,r,c){ctx.save();ctx.translate(x,y);ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,r);ctx.bezierCurveTo(-r*1.8,-r*.2,-r*.7,-r*1.3,0,-r*.55);ctx.bezierCurveTo(r*.7,-r*1.3,r*1.8,-r*.2,0,r);ctx.fill();ctx.restore();}
  function tape(x,y,w,color,ang=0){ctx.save();ctx.translate(x+w/2,y+12);ctx.rotate(ang);ctx.globalAlpha=.8;round(-w/2,-11,w,23,1,color);ctx.strokeStyle='#ffffffb4';ctx.lineWidth=1.6;for(let a=-w/2+8;a<w/2;a+=14){ctx.beginPath();ctx.moveTo(a,-11);ctx.lineTo(a+8,12);ctx.stroke();}ctx.restore();}
  function drawOriginal(side,x,y,maxW,maxH,page=0){
    const key = posterImageKey(side,page);
    const img = originalImages[key] || originalImages[side];
    if(!img){star(x+maxW/2,y+maxH/2,20,'#dec0ed');heart(x+maxW/2+32,y+maxH/2+27,12,'#f0bfdc');return;}
    const scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    ctx.drawImage(img,x+(maxW-w)/2,y+(maxH-h)/2,w,h);
  }
  function posterBackground(page,pages){
    const grad=ctx.createLinearGradient(0,0,W,H);grad.addColorStop(0,'#f3e5fb');grad.addColorStop(.58,'#f9f0ff');grad.addColorStop(1,'#f7e3f3');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    // Soft notebook grid and non-repeating handmade flecks.
    ctx.strokeStyle='#d7c2e82a';ctx.lineWidth=1;for(let x=0;x<W;x+=31){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=31){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    for(let j=0;j<38;j++){const x=(j*139+67)%W,y=(j*97+113)%H;star(x,y,3+(j%3),j%2?'#dcb6df88':'#b6cde888');}
    round(25,20,1550,860,35,'#ffffff5c','#e8cdec',4);
    // Header handwritten memo and cloud-like title plaque.
    round(216,27,1168,190,58,'#fffdfa','#ddc3ee',4);
    ctx.save();ctx.setLineDash([11,11]);rrect(226,37,1148,168,48);ctx.strokeStyle='#f4d5ef';ctx.lineWidth=3;ctx.stroke();ctx.restore();
    drawOriginal('left',35,30,185,180,page);drawOriginal('right',1380,30,185,180,page);
    font(48,900);ctx.textAlign='center';ctx.fillStyle='#8663aa';ctx.fillText('夢羽ヒメ',800,99);
    strokeText('ライブ・イベント・グッズ情報',800,162,'#77539c',60,1030,900,'center');
    font(25,400,true);ctx.fillStyle='#ad7aaf';ctx.fillText('♡ unofficial fan info ♡',800,202);ctx.textAlign='left';
    star(270,67,15,'#eed19e');star(1336,136,17,'#e7afc9');flower(178,187,22,'#deade2');flower(1438,194,25,'#dbbcf0');heart(330,187,13,'#eac6df');heart(1280,70,11,'#eac6df');
    tape(420,30,88,'#eed3f2',-.21);tape(1176,37,87,'#e3d9f8',.17);
  }
  function paperPanel(x,y,w,h,group,entries,idx,page){
    ctx.save();ctx.shadowColor='#ad87c766';ctx.shadowBlur=15;ctx.shadowOffsetY=8;
    round(x,y,w,h,28,'#fffdfb','#ddc8e9',3);ctx.restore();
    // Faint notebook ruling, using clipping so it stays within the note.
    ctx.save();rrect(x+6,y+6,w-12,h-12,23);ctx.clip();ctx.strokeStyle='#e6d7ed54';ctx.lineWidth=1;for(let yy=y+90;yy<y+h-10;yy+=29){ctx.beginPath();ctx.moveTo(x+19,yy);ctx.lineTo(x+w-20,yy);ctx.stroke();}ctx.restore();
    // Color label on a paper sticker.
    round(x+24,y+15,w-48,64,27,group.tint);
    ctx.save();ctx.setLineDash([5,7]);rrect(x+26,y+17,w-52,60,25);ctx.strokeStyle='#c9adda';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    strokeText(group.mark,x+53,y+57,group.ink,40,62);
    strokeText(group.label,x+116,y+59,group.ink,36,w-160);
    tape(x+41,y-6,102,idx%2?'#d8e9fb':'#efcde7',idx%2?-.12:.14);
    star(x+w-32,y+10,15,'#f1d6a3');heart(x+w-57,y+77,8,'#f1cee1');
    if(!entries.length){font(26,500,true);ctx.fillStyle='#ac95b9';ctx.textAlign='center';ctx.fillText(page?'ほかの情報をチェック！':'新しいお知らせをお楽しみに！',x+w/2,y+164);ctx.textAlign='left';return;}
    entries.forEach((e,k)=>{
      const itemY=y+121+k*79;
      // 本文の行間には破線を引かず、文字との重なりを防ぐ。
      heart(x+41,itemY-10,10,group.ink);
      const text=fitText(e.title,w-119,32,23);font(text.size,900);ctx.fillStyle='#655073';ctx.fillText(text.text,x+69,itemY);
      let when=eventWhen(e);if(e.place)when+='　⌖ '+e.place;
      const sub=fitText(when,w-104,25,21);font(sub.size,700);ctx.fillStyle='#987ca4';ctx.fillText(sub.text,x+70,itemY+32);
    });
  }
  function renderPoster(page,pages){
    ctx.clearRect(0,0,W,H);posterBackground(page,pages);
    const spots=[[44,252],[817,252],[44,552],[817,552]],pw=740,ph=266;
    posterCats.forEach((g,i)=>paperPanel(spots[i][0],spots[i][1],pw,ph,g,groupItems(g,page),i,page));
    ctx.fillStyle='#a489b6';font(19,700);ctx.fillText('※ ファンによる非公式まとめ。最新情報・詳細は公式告知をご確認ください。',58,862);
    ctx.textAlign='right';font(21,400,true);ctx.fillStyle='#a585b6';ctx.fillText('♡ 夢羽ヒメ fan page',1534,864);ctx.textAlign='left';
    if(demo){ctx.save();ctx.translate(1408,65);ctx.rotate(.12);round(-8,-23,127,43,9,'#fff1e2','#eac0a5',2);font(23,900);ctx.fillStyle='#a9737c';ctx.fillText('DEMO',4,7);ctx.restore();}
  }
  async function downloadPage(n){
    await document.fonts.ready;
    const count=pageCount();renderPoster(n,count);
    return new Promise(resolve=>canvas.toBlob(blob=>{
      if(!blob){showAlert('画像を作成できませんでした。');resolve();return;}
      const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`yumeha-hime-info-${todayISO}-${n+1}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);resolve();
    },'image/png'));
  }
  // Embed mode: measure the content, not document.scrollHeight.
  // document.scrollHeight can reflect iframe viewport height and create an
  // infinite parent-child resize feedback loop when the parent adds padding.
  let lastEmbedHeight = 0;
  let pendingEmbedFrame = false;
  function notifyEmbedHeight(){
    if(!embed || window.parent===window || pendingEmbedFrame) return;
    pendingEmbedFrame=true;
    requestAnimationFrame(()=>{
      pendingEmbedFrame=false;
      const main = document.querySelector('main.main');
      if(!main) return;
      const height = Math.max(120, Math.ceil(main.getBoundingClientRect().height) + 2);
      if(Math.abs(height-lastEmbedHeight) < 2) return;
      lastEmbedHeight=height;
      // Public height only; parent checks both origin and event source.
      window.parent.postMessage({type:'hime-event-hub:fit',height},'*');
    });
  }
  if(embed){
    const main=document.querySelector('main.main');
    if(typeof ResizeObserver!=='undefined') new ResizeObserver(notifyEmbedHeight).observe(main);
    else window.addEventListener('resize',notifyEmbedHeight);
    document.fonts.ready.then(notifyEmbedHeight);
    window.addEventListener('load',notifyEmbedHeight);
  }
  function bind(){
    $('prev').addEventListener('click',()=>{if(currentPage>0){currentPage--;renderX();}});
    $('next').addEventListener('click',()=>{if(currentPage<pageCount()-1){currentPage++;renderX();}});
    $('download').addEventListener('click',async()=>{await downloadPage(currentPage);renderX();});
    $('download-all').addEventListener('click',async()=>{
      const old=currentPage,pc=pageCount();
      for(let i=0;i<pc;i++){await downloadPage(i);}currentPage=old;renderX();
    });
    $('copy').addEventListener('click',async()=>{
      const value=$('post-text').value;try{await navigator.clipboard.writeText(value);$('copy-status').textContent='コピーしました';}
      catch{const el=$('post-text');el.focus();el.select();$('copy-status').textContent='文章を選択しました。コピーしてください';}
    });
  }
  async function refreshSheet(force=false){
    if(demo || sheetLoading) return;
    // 戻ってきた直後などの短時間の連続リクエストは避ける。
    if(!force && Date.now()-sheetLoadedAt < 30_000) return;
    sheetLoading=true;
    try{
      const incoming = (await loadSheet()).map(normalize);
      items=incoming;
      sheetLoadedAt=Date.now();
      hideAlert();
      render();
    }catch(e){
      console.error('スプレッドシート更新エラー',e);
      // 一時的な通信障害では直前の成功データを保持する。
      showAlert('最新情報を取得できませんでした。前回のデータを表示しています。再読み込みで再試行できます。');
      if(!sheetLoadedAt)render();
    }finally{
      sheetLoading=false;
    }
  }
  function init(){
    bind();
    document.fonts.ready.then(()=>renderX());
    if(demo){items=DEMO.map(normalize);render();return;}
    refreshSheet(true); // 初回ロードは必ず取得
    // 定期ポーリングはしない。初回・通常再読込・タブ復帰時だけ取得する。
    document.addEventListener('visibilitychange',()=>{
      if(mode==='site' && !document.hidden)refreshSheet();
    });
    window.addEventListener('pageshow',event=>{
      if(event.persisted && mode==='site')refreshSheet();
    });
  }
  init();
})();
