'use strict';
(() => {
  const cfg = window.HIME_CONFIG || {};
  const CATS = ['ライブ・イベント','グッズ','キャンペーン','配信','その他'];
  const THEMES = {
    'ライブ・イベント': {bg:'#fce5ef',fg:'#b84878',emoji:'🎤'},
    'グッズ': {bg:'#e5f2f3',fg:'#337c88',emoji:'🎁'},
    'キャンペーン': {bg:'#fff0d7',fg:'#b8762b',emoji:'🎉'},
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
  function normalizeCategory(value){
    const c = str(value);
    if(c === 'ライブ' || c === 'イベント' || c === 'live' || c === 'event') return 'ライブ・イベント';
    if(c === 'goods' || c === 'グッズ') return 'グッズ';
    if(c === 'campaign' || c === 'キャンペーン') return 'キャンペーン';
    if(c === 'stream' || c === '配信') return '配信';
    return CATS.includes(c) ? c : 'その他';
  }
  function normalize(r) {
    const o = {};
    for(const [key,value] of Object.entries(r)) o[key.trim().toLowerCase()] = value;
    const category = normalizeCategory(o.category || o['区分'] || o['カテゴリ'] || 'その他');
    return {
      category,
      title: str(o.title || o['タイトル']),
      start: readDate(o.start_date || o['開始日']),
      end: readDate(o.end_date || o['終了日']),
      label: str(o.date_label || o['日付表示']),
      time: readTime(o.time ?? o['時刻']),place: str(o.place || o['場所']),
      summary: str(o.summary || o['一覧用の説明'] || o['イベント一覧用の説明'] || o['画像用の説明']),
      details: str(o.details || o['X投稿用の説明'] || o['投稿用の説明']),
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
    const labelDate = e.label ? readDate(e.label) : '';
    let t = '';
    if (e.start && e.end && e.start !== e.end) t = `${dateText(e.start)}〜${dateText(e.end)}`;
    else if (e.start) t = dateText(e.start);
    else if (labelDate) t = dateText(labelDate);
    else if (e.label) t = e.label;
    else t = '日程未定';
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
    // f は書式設定後の表示文字列。v が欠落したときにも確認する。
    let rawRows = resp.table.rows.map(row=>(row.c||[]).map(x=>x?.v??x?.f??''));
    if (!heads.includes('title') && !heads.includes('タイトル') && rawRows[0]?.some(v=>v==='title'||v==='タイトル')) heads = rawRows.shift().map(str);
    if (!heads.some(x=>x==='title'||x==='タイトル')) throw Error('列名 title / タイトル が見つかりません。テンプレートを確認してください');
    return rawRows.map(values=>Object.fromEntries(heads.map((k,i)=>[k,values[i]])));
  }
  // CSV エクスポートを優先する。Visualization API (gviz) は列ごとに型を推定するため、
  // date_label などの列に混在したテキストを null として返すことがある。
  // CSV は元の表示文字列を保持する（セル内改行・カンマ・引用符にも対応）。
  function parseCSV(csv){
    const result=[];
    let row=[],field='',quoted=false;
    const input=String(csv).replace(/^\uFEFF/,'');
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(quoted){
        if(ch==='"' && input[i+1]==='"'){field+='"';i++;}
        else if(ch==='"')quoted=false;
        else field+=ch;
      }else if(ch==='"' && field==='')quoted=true;
      else if(ch===','){row.push(field);field='';}
      else if(ch==='\n' || ch==='\r'){
        if(ch==='\r' && input[i+1]==='\n')i++;
        row.push(field);result.push(row);row=[];field='';
      }else field+=ch;
    }
    if(quoted)throw Error('CSVの引用符が閉じていません');
    if(field!==''||row.length){row.push(field);result.push(row);}
    return result;
  }
  function csvToRows(csv){
    const rows=parseCSV(csv).filter(row=>row.some(c=>String(c).trim()!==''));
    if(!rows.length)throw Error('シートにデータがありません');
    const keys=rows.shift().map(h=>str(h).replace(/^\uFEFF/,''));
    if(!keys.includes('title') && !keys.includes('タイトル'))throw Error('列名 title が見つかりません');
    return rows.map(row=>Object.fromEntries(keys.map((key,i)=>[key,row[i]??''])));
  }
  async function loadSheetCSV(){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const url=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(cfg.sheetId)}/export?format=csv&gid=${encodeURIComponent(cfg.sheetGid || '0')}&_=${Date.now()}`;
      const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});
      if(!response.ok)throw Error(`CSV取得エラー (${response.status})`);
      const content=await response.text();
      if(/^\s*<!doctype html|^\s*<html/i.test(content))throw Error('CSVの代わりにHTMLが返りました');
      return csvToRows(content);
    }finally{clearTimeout(timeout);}
  }
  function loadSheetGviz(){
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
  async function loadSheet(){
    try{return await loadSheetCSV();}
    catch(e){
      console.warn('CSV経由の取得に失敗しました。従来の方式で再試行します。',e);
      return loadSheetGviz();
    }
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
    paintFilters();paintCards();
    if (mode === 'x') renderX();
    notifyEmbedHeight();
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
      const desc=document.createElement('div');desc.className='summary';desc.textContent=e.summary || e.details;c.appendChild(desc);
      const url=safeUrl(e.url);if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className='link';a.textContent='公式情報を見る';c.appendChild(a);}
      root.appendChild(c);
    }
  }
  function renderX(){
    $('post-text').value=buildDraft(shown);
    updatePosterLayout();
    const labels = '夢羽ヒメさんのおしらせ 非公式ファンまとめ ライブ・配信・グッズ・キャンペーン デモ（架空） 日程未定 年月まで 日月火水木金土 0123456789()/〜♡…';
    const glyphs = shown.flatMap(entry => [entry.category, entry.title, entry.label, entry.time, entry.place, entry.summary]).join('');
    posterFontsReady = loadPosterFonts([...new Set(labels + glyphs)].join(''));
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
  function rrect(x,y,w,h,r=15){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function round(x,y,w,h,r,fill,stroke='',sw=1){rrect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}
  function star(x,y,r,color){ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.18,-r*.18,r,0);ctx.quadraticCurveTo(r*.18,r*.18,0,r);ctx.quadraticCurveTo(-r*.18,r*.18,-r,0);ctx.quadraticCurveTo(-r*.18,-r*.18,0,-r);ctx.fill();ctx.restore();}
  function tape(x,y,w,color,ang=0){ctx.save();ctx.translate(x+w/2,y+12);ctx.rotate(ang);ctx.globalAlpha=.8;round(-w/2,-11,w,23,1,color);ctx.strokeStyle='#ffffffb4';ctx.lineWidth=1.6;for(let a=-w/2+8;a<w/2;a+=14){ctx.beginPath();ctx.moveTo(a,-11);ctx.lineTo(a+8,12);ctx.stroke();}ctx.restore();}
  // X用画像は、日付順の行を収まる高さに合わせてページに分ける。
  const canvas = $('poster'), ctx = canvas.getContext('2d');
  const W = 1200, H = 1500, BODY_TOP = 249, BODY_END = 1403;
  const INFO_X = 343, INFO_WIDTH = 787, DATE_WIDTH = 240;
  const TITLE_SIZE = 49, DATE_SIZE = 48, META_SIZE = 42;
  const TITLE_LINE = 55, DATE_LINE = 54, META_LINE = 50, MIN_ROW_HEIGHT = 126;
  const MAX_ROWS = 9, POSTER_FONT = '"M PLUS Rounded 1c", "Zen Maru Gothic", sans-serif';
  const POSTER_COLORS = {
    ink: '#3e2a4c', purple: '#653e80', muted: '#564761',
    deadline: '#793759', divider: '#cbb1d3',
  };
  const POSTER_TAGS = {
    'ライブ・イベント': ['#f8e1ee', '#7a385f'],
    'グッズ': ['#dff1ed', '#275f56'],
    'キャンペーン': ['#faedd2', '#6f481e'],
    '配信': ['#eee3f8', '#624384'],
    'その他': ['#f1edf3', '#695878'],
  };
  let posterPages = [[]];
  let posterFontsReady = Promise.resolve();
  let exporting = false;
  const originalImages = {};
  const posterImagesReady = Promise.all(Object.entries({
    left: 'assets/hime-left.png',
    right: 'assets/hime-right.png',
    left2: 'assets/hime-left2.png',
    right2: 'assets/hime-right2.png',
  }).map(([key, src]) => new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    const hero = key === 'left' || key === 'right' ? document.querySelector(`.hero-art.${key}`) : null;
    image.onload = () => {
      originalImages[key] = image;
      hero?.classList.add('loaded');
      resolve();
      if (mode === 'x' && !exporting) drawPosterPreview();
    };
    image.onerror = () => {
      hero?.querySelector('img')?.remove();
      resolve();
    };
    image.src = src;
  })));

  function posterEntry(event) {
    const date = event.end || event.start || readDate(event.label);
    const deadline = Boolean(event.end && event.end !== event.start);
    const recurring = !date && /(?:毎[日週月年]|隔週|定期)/.test(event.label);
    const label = date ? dateText(date).replace(/^(\d{4})\//, '$1年\n') : event.label || '日程未定';
    const time = deadline ? `${event.time}まで` : event.time;
    const from = deadline && event.start ? `${dateText(event.start)}〜` : '';
    const note = [from, event.place || event.summary].filter(Boolean).join('・');
    return { ...event, date, deadline, recurring, label, time, note };
  }

  function setPosterFont(size) {
    ctx.font = `400 ${size}px ${POSTER_FONT}`;
  }

  function wrapPosterText(text, width, limit, firstWidth = width) {
    if (!text) return [];
    const lines = [];
    let line = '';
    for (const paragraph of text.split(/\r?\n/)) {
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > (lines.length ? width : firstWidth)) {
          lines.push(line.trimEnd());
          line = '';
        }
        if (line || char.trim()) line += char;
      }
      lines.push(line.trimEnd());
      line = '';
    }
    if (lines.length > limit) {
      lines.length = limit;
      const chars = Array.from(lines[limit - 1]);
      const available = limit === 1 ? firstWidth : width;
      while (chars.length && ctx.measureText(chars.join('') + '…').width > available) chars.pop();
      lines[limit - 1] = chars.join('').trimEnd() + '…';
    }
    return lines;
  }

  function measurePosterRow(entry) {
    setPosterFont(TITLE_SIZE);
    const titles = wrapPosterText(entry.title, INFO_WIDTH - 2, 8);
    setPosterFont(DATE_SIZE);
    const dates = wrapPosterText(entry.label, DATE_WIDTH - 8, 4);
    setPosterFont(META_SIZE);
    const times = wrapPosterText(entry.time, DATE_WIDTH, 2);
    const badgeWidth = Math.ceil(ctx.measureText(entry.category).width) + 16;
    const notes = wrapPosterText(entry.note, INFO_WIDTH, 2, INFO_WIDTH - badgeWidth - 10);
    const dateHeight = dates.length * DATE_LINE + times.length * META_LINE;
    const titleHeight = titles.length * TITLE_LINE + Math.max(1, notes.length) * META_LINE + 3;
    const height = Math.max(MIN_ROW_HEIGHT, dateHeight + 18, titleHeight + 18);
    return { ...entry, titles, dates, times, notes, badgeWidth, dateHeight, titleHeight, height };
  }

  function planPosterPages(events) {
    const rows = events.map(posterEntry).sort((a, b) =>
      Number(a.recurring) - Number(b.recurring)
      || (a.date || '9999').localeCompare(b.date || '9999')
      || (a.time || '99:99').localeCompare(b.time || '99:99')
      || a.priority - b.priority
    ).map(measurePosterRow);
    if (!rows.length) return [[]];

    // 収まる分割のうち、最小ページ数を求める。次に件数を均し、同日の分断を避ける。
    const ends = rows.map(() => []);
    const minPages = new Array(rows.length + 1).fill(Infinity);
    minPages[rows.length] = 0;
    for (let start = rows.length - 1; start >= 0; start--) {
      let height = 0;
      for (let end = start; end < rows.length && end < start + MAX_ROWS; end++) {
        height += rows[end].height;
        if (height > BODY_END - BODY_TOP) break;
        ends[start].push(end + 1);
        minPages[start] = Math.min(minPages[start], 1 + minPages[end + 1]);
      }
    }
    const pages = [];
    for (let start = 0; start < rows.length;) {
      const target = Math.ceil((rows.length - start) / minPages[start]);
      let bestEnd = start + 1;
      let bestScore = Infinity;
      for (const end of ends[start]) {
        if (1 + minPages[end] !== minPages[start]) continue;
        const sameDay = Boolean(rows[end]?.date && rows[end].date === rows[end - 1].date);
        const score = Math.abs(end - start - target) + (sameDay ? 1.1 : 0);
        if (score <= bestScore) {
          bestEnd = end;
          bestScore = score;
        }
      }
      pages.push(rows.slice(start, bestEnd));
      start = bestEnd;
    }
    return pages;
  }

  function posterText(value, x, y, size, color, weight = 500, align = 'left') {
    if (!value) return;
    setPosterFont(size);
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    const top = ctx.measureText(value).actualBoundingBoxAscent ?? size * .82;
    if (weight >= 700) {
      ctx.strokeStyle = color;
      ctx.lineJoin = 'round';
      ctx.lineWidth = size >= 80 ? 4 : 2;
      ctx.strokeText(value, x, y + top);
    }
    ctx.fillStyle = color;
    ctx.fillText(value, x, y + top);
  }

  function drawOriginal(side, x, y, maxW, maxH, page) {
    const image = (page > 0 && originalImages[side + '2']) || originalImages[side];
    if (!image) {
      star(x + maxW / 2, y + maxH / 2, 20, '#dec0ed');
      return;
    }
    const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    ctx.drawImage(image, x + (maxW - width) / 2, y + (maxH - height) / 2, width, height);
  }

  function posterBackground(page) {
    ctx.fillStyle = '#eee3f4';
    ctx.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 68) {
      ctx.fillStyle = '#e9d8f0';
      ctx.fillRect(x, 0, 30, H);
      ctx.fillStyle = '#e0cce9';
      for (let y = 0; y < H; y += 68) ctx.fillRect(x, y, 30, 30);
    }
    ctx.fillStyle = '#f4eaf6';
    for (let y = 33; y < H; y += 68) ctx.fillRect(0, y, W, 2);

    round(40, 44, 1120, 1423, 45, '#d9c3e7');
    round(35, 32, 1129, 1428, 45, '#fffaf4', '#c9afd9', 3);
    round(53, 48, 1093, 1394, 36, '#fffaf4', '#ecdce8', 2);
    for (const [x, color] of [[166, '#f5e8f7'], [1028, '#f6e9f4']]) {
      ctx.beginPath();
      ctx.ellipse(x, 150, 83, 66, 0, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
    for (const [x, y, size, color] of [
      [272, 135, 15, '#c693c0'], [310, 101, 9, '#d4a567'],
      [895, 107, 12, '#ca98c5'], [927, 152, 16, '#d8af73'],
      [268, 184, 6, '#dbb8da'], [898, 181, 7, '#d6b6db'],
    ]) star(x, y, size, color);

    round(414, 45, 372, 49, 22, '#f2e2f2');
    posterText('夢羽ヒメさんの', 600, 48, 46, POSTER_COLORS.purple, 700, 'center');
    posterText('おしらせ', 600, 104, 92, '#6c4186', 700, 'center');
    ctx.beginPath();
    ctx.moveTo(369, 183);
    ctx.quadraticCurveTo(600, 212, 829, 183);
    ctx.strokeStyle = '#e5bad5';
    ctx.lineWidth = 5;
    ctx.stroke();
    posterText('非公式ファンまとめ', 600, 202, 40, POSTER_COLORS.muted, 400, 'center');
    drawOriginal('left', 63, 54, 195, 195, page);
    drawOriginal('right', 936, 53, 197, 197, page);
    tape(64, 19, 160, '#e0bbdd', -.23);
    tape(959, 17, 160, '#d8c4eb', .19);
    ctx.fillStyle = '#e6d3e8';
    ctx.fillRect(80, 243, 1040, 2);
    ctx.fillStyle = '#dac3e2';
    for (let y = 263; y < 1387; y += 15) ctx.fillRect(77, y, 2, 7);
  }

  function drawPosterRow(row, y, height, divider) {
    if (row.recurring) round(64, y + 4, 1070, height - 8, 24, '#f2e7f5');
    const dateY = y + (height - row.dateHeight) / 2 + 5;
    const dateInk = row.deadline ? POSTER_COLORS.deadline : POSTER_COLORS.purple;
    round(91, dateY - 5, DATE_WIDTH, row.dates.length * DATE_LINE - 3, 18,
      row.deadline ? '#f9e6eb' : '#f0e3f3');
    row.dates.forEach((line, i) =>
      posterText(line, 211, dateY + i * DATE_LINE, DATE_SIZE, dateInk, 700, 'center')
    );
    row.times.forEach((line, i) =>
      posterText(line, 211, dateY + row.dates.length * DATE_LINE - 2 + i * META_LINE,
        META_SIZE, dateInk, 700, 'center')
    );
    star(78, y + height / 2, 10, row.deadline ? '#c68da9' : '#bb97d0');

    const titleY = y + (height - row.titleHeight) / 2;
    row.titles.forEach((line, i) =>
      posterText(line, INFO_X, titleY + i * TITLE_LINE, TITLE_SIZE, POSTER_COLORS.ink, 700)
    );
    const metaY = titleY + row.titles.length * TITLE_LINE + 3;
    const [badgeBg, badgeInk] = POSTER_TAGS[row.category];
    round(INFO_X, metaY, row.badgeWidth, 48, 4, badgeBg);
    posterText(row.category, INFO_X + 8, metaY + 4, META_SIZE, badgeInk, 700);
    row.notes.forEach((line, i) =>
      posterText(line, i ? INFO_X : INFO_X + row.badgeWidth + 10,
        metaY + 4 + i * META_LINE, META_SIZE, POSTER_COLORS.muted, 400)
    );
    if (divider) {
      ctx.fillStyle = POSTER_COLORS.divider;
      for (let x = INFO_X; x < 1114; x += 16) ctx.fillRect(x, y + height - 1, 7, 3);
    }
  }

  function renderPoster(page, pages = posterPages) {
    ctx.clearRect(0, 0, W, H);
    posterBackground(page);
    const rows = pages[page];
    const extra = rows.length ? (BODY_END - BODY_TOP - rows.reduce((total, row) => total + row.height, 0)) / rows.length : 0;
    // 少ない件数を必要以上に引き伸ばさず、中央に配置する。
    const padding = Math.min(extra, 44);
    let y = BODY_TOP + Math.max(0, extra - padding) * rows.length / 2;
    rows.forEach((row, i) => {
      const height = row.height + padding;
      drawPosterRow(row, y, height, i < rows.length - 1);
      y += height;
    });
    if (!rows.length) {
      posterText('現在、表示するお知らせはありません。', 600, 760, 44, POSTER_COLORS.muted, 400, 'center');
    }
    posterText('♡ ライブ・配信・グッズ・キャンペーン', 78, 1414, 37, POSTER_COLORS.muted, 400);
    const pageLabel = [demo ? 'デモ（架空）' : '', pages.length > 1 ? `${page + 1} / ${pages.length}` : ''].filter(Boolean).join('　');
    posterText(pageLabel, 1122, 1414, 37, POSTER_COLORS.muted, 400, 'right');
  }

  function drawPosterPreview() {
    currentPage = Math.min(currentPage, posterPages.length - 1);
    $('page-no').textContent = `${currentPage + 1} / ${posterPages.length}`;
    $('prev').disabled = exporting || currentPage === 0;
    $('next').disabled = exporting || currentPage === posterPages.length - 1;
    $('download').disabled = exporting;
    $('download-all').disabled = exporting;
    $('download-all').hidden = posterPages.length === 1;
    renderPoster(currentPage);
  }

  function updatePosterLayout() {
    posterPages = planPosterPages(shown);
    if (!exporting) drawPosterPreview();
  }

  async function loadPosterFonts(text) {
    await document.fonts.load('400 49px "M PLUS Rounded 1c"', text).catch(() => []);
    updatePosterLayout();
  }

  async function downloadPoster(all) {
    if (exporting) return;
    exporting = true;
    drawPosterPreview();
    const selected = currentPage;
    try {
      await Promise.all([posterFontsReady, posterImagesReady]);
      const pages = posterPages;
      const indices = all ? pages.map((_, i) => i) : [Math.min(selected, pages.length - 1)];
      for (const index of indices) {
        renderPoster(index, pages);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw Error('PNGの生成に失敗しました');
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url;
        link.download = `yumeha-hime-info-${todayISO}-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (error) {
      showAlert('画像を作成できませんでした。ページを再読み込みしてもう一度お試しください。');
      console.error(error);
    } finally {
      exporting = false;
      drawPosterPreview();
    }
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
    $('prev').addEventListener('click', () => { if (currentPage > 0) { currentPage--; drawPosterPreview(); } });
    $('next').addEventListener('click', () => { if (currentPage < posterPages.length - 1) { currentPage++; drawPosterPreview(); } });
    $('download').addEventListener('click', () => downloadPoster(false));
    $('download-all').addEventListener('click', () => downloadPoster(true));
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
    if (mode === 'x') renderX();
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
