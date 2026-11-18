/* 講師簡介與課程型錄產生器：純函式引擎（瀏覽器掛 window.IPC，node 可 require）。
 * 簡介全部用規則組句，只用使用者填的事實；長度不夠放就依優先順序拿掉次要的句子。
 * 改了這個檔要跑 node tools/test_engine.mjs */
(function(root){
'use strict';

function clone(o){ return JSON.parse(JSON.stringify(o)); }
function str(v){ return v == null ? '' : String(v); }
function cut(s, n){ s = str(s); return Array.from(s).slice(0, n).join(''); }
function len(s){ return Array.from(str(s)).length; }
function lines(s, max){ return str(s).split(/\r?\n/).map(function(x){ return x.replace(/^\s*[-*•・●▪]\s*/, '').trim(); }).filter(Boolean).slice(0, max || 99); }
function num(v){ var n = parseFloat(str(v).replace(/[,，\s]/g, '')); return isFinite(n) && n > 0 ? n : 0; }
function fmt(n){ n = Math.round(n); return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
/* 概數：1,234 → 「超過 1,200」；剛好整數就照寫，不誇大 */
function nice(n){
  n = Math.floor(num(n)); if(!n) return '';
  var step = n >= 10000 ? 1000 : n >= 1000 ? 100 : n >= 100 ? 10 : 1, f = Math.floor(n / step) * step;
  return f < n ? '超過 ' + fmt(f) : fmt(n);
}
function joinList(a, max, etc){
  a = a.slice(0, max || a.length);
  if(!a.length) return '';
  if(a.length === 1) return a[0];
  return a.slice(0, -1).join('、') + (etc ? '、' + a[a.length - 1] + '等' : '及' + a[a.length - 1]);
}
function stripEnd(s){ return str(s).replace(/[。．.！!，,；;\s]+$/, ''); }

var HONORS = ['老師', '講師', '顧問', '教授', '博士', '執行長', '總監', '（不加）'];
var THEMES = {
  classic:{n:'典雅', d:'米白紙＋深藍＋金線', c:'#1F3A5F', a:'#B8892E', bg:'#FBF7EE'},
  fresh:{n:'清新', d:'白紙＋綠色標題列', c:'#1E6B52', a:'#7FB77E', bg:'#FFFFFF'},
  bold:{n:'活力', d:'白紙＋橘色大色塊', c:'#C2410C', a:'#1F2937', bg:'#FFFFFF'}
};
var CATS = ['數位行銷', 'AI 應用', '辦公效率', '創業經營', '財務會計', '餐飲烘焙', '職場溝通', '領導管理', '銷售服務', '設計美學', '語言', '樂齡健康', '其他'];

function blankCourse(){
  return {name:'', cat:'', hours:'', who:'', intro:'', goals:'', outline:'', feats:'', method:'', equip:'', fee:'', custom:true};
}
function blank(){
  return {
    p:{name:'', honor:'老師', title:'', slogan:'', photo:'', fields:'', edu:'', certs:'', exp:'', clients:'', works:'', style:'',
       startYear:'', hours:'', sessions:'', people:'', email:'', phone:'', line:'', web:''},
    records:'', useRec:false,
    courses:[],
    look:{theme:'classic', color:'', catTitle:'', year:''}
  };
}

/* ---------- 授課紀錄：貼上表格（Tab／逗號）自動統計 ---------- */
var REC_HEAD = /日期|單位|課程|時數|人數|date|hours/i;
function splitRow(line){
  if(line.indexOf('\t') >= 0) return line.split('\t');
  var out = [], cur = '', q = false;
  for(var i = 0; i < line.length; i++){
    var ch = line[i];
    if(ch === '"'){ if(q && line[i + 1] === '"'){ cur += '"'; i++; } else q = !q; }
    else if((ch === ',' || ch === '，') && !q){ out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
function parseDate(s){
  var m = str(s).match(/(\d{2,4})\s*[\/\-.年]\s*(\d{1,2})(?:\s*[\/\-.月]\s*(\d{1,2}))?/);
  if(!m) return null;
  var y = +m[1]; if(y < 1000) y += 1911; // 民國年
  if(y < 1950 || y > 2100) return null;
  return {y:y, m:+m[2], d:m[3] ? +m[3] : 1};
}
/* 欄位順序：日期、單位、課程名稱、時數、人數（後兩欄可省略）。回傳 {rows, bad} */
function parseRecords(text){
  var rows = [], bad = [];
  str(text).split(/\r?\n/).forEach(function(line, i){
    if(!line.trim()) return;
    var c = splitRow(line).map(function(x){ return x.trim(); });
    if(i === 0 && REC_HEAD.test(line) && !parseDate(c[0])) return;
    var dt = parseDate(c[0]);
    if(!dt || !c[1]){ bad.push(i + 1); return; }
    rows.push({y:dt.y, m:dt.m, d:dt.d, unit:c[1], course:c[2] || '', hours:num(c[3]), people:num(c[4])});
  });
  return {rows:rows, bad:bad};
}
function recStats(rows){
  var s = {sessions:rows.length, hours:0, people:0, units:0, top:[], years:{}, first:0, last:0};
  var u = {};
  rows.forEach(function(r){
    s.hours += r.hours; s.people += r.people;
    u[r.unit] = (u[r.unit] || 0) + (r.hours || 1);
    s.years[r.y] = s.years[r.y] || {sessions:0, hours:0, people:0};
    s.years[r.y].sessions++; s.years[r.y].hours += r.hours; s.years[r.y].people += r.people;
    if(!s.first || r.y < s.first) s.first = r.y;
    if(r.y > s.last) s.last = r.y;
  });
  s.units = Object.keys(u).length;
  s.top = Object.keys(u).sort(function(a, b){ return u[b] - u[a] || (a < b ? -1 : 1); });
  s.hours = Math.round(s.hours * 10) / 10;
  return s;
}

/* ---------- 實績：手填或授課紀錄統計 ---------- */
function stats(st, nowYear){
  var p = st.p, r = {hours:num(p.hours), sessions:num(p.sessions), people:num(p.people), years:0, units:0, clients:lines(p.clients, 30), fromRec:false};
  var y0 = num(p.startYear);
  if(st.useRec){
    var rs = recStats(parseRecords(st.records).rows);
    if(rs.sessions){
      r.hours = rs.hours; r.sessions = rs.sessions; r.people = rs.people; r.units = rs.units; r.fromRec = true;
      rs.top.forEach(function(u){ if(r.clients.indexOf(u) < 0) r.clients.push(u); });
      if(!y0) y0 = rs.first;
    }
  }
  if(!r.units) r.units = r.clients.length;
  if(y0 >= 1950 && nowYear >= y0) r.years = nowYear - y0 + (nowYear > y0 ? 0 : 1);
  return r;
}

/* ---------- 簡介 ---------- */
function honor(p){ return p.honor && p.honor !== '（不加）' ? p.honor : ''; }
function titles(p){ return lines(p.title, 4); }
function facts(st, nowYear){
  var p = st.p, s = stats(st, nowYear);
  return {
    name:str(p.name).trim() || '（講師姓名）', honor:honor(p), titles:titles(p), slogan:stripEnd(p.slogan),
    fields:lines(p.fields, 8), edu:lines(p.edu, 4), certs:lines(p.certs, 12), exp:lines(p.exp, 12),
    works:lines(p.works, 6), style:stripEnd(p.style), s:s
  };
}
function sp(t){ return /^[A-Za-z0-9]/.test(t) ? ' ' + t : t; }
function achieve(f, short){
  var a = [], s = f.s;
  if(s.hours) a.push('累計授課' + sp(nice(s.hours)) + ' 小時');
  if(s.sessions && !short) a.push(nice(s.sessions) + ' 場次');
  if(s.people) a.push((short ? '' : '學員') + sp(nice(s.people)) + ' 人次');
  return a.join('、');
}
/* 每段 [優先序, 文字, 段落]；超過上限時從優先序最低的開始拿掉（9 不拿）；長版依段落分成三段 */
function bioParts(f, o){
  var first = o.voice === 'first', host = o.tone === 'host', warm = o.tone === 'warm' || host;
  var call = f.name + (f.honor || (host ? '老師' : ''));
  var t0 = f.titles[0] || '', more = f.titles.slice(1, 4), parts = [];
  var fl = o.len === 's' ? 2 : o.len === 'm' ? 3 : 5, cl = o.len === 'l' ? 5 : 2, ul = o.len === 'l' ? 6 : 3;
  if(host){
    parts.push([9, '接下來為大家介紹今天的講師——' + call + '。', 0]);
    if(t0) parts.push([8, call + '目前是' + t0 + (more.length && o.len !== 's' ? '，同時也是' + joinList(more, 3) : '') + '。', 0]);
  } else if(first){
    parts.push([9, '我是' + f.name + (t0 ? '，目前是' + t0 : '') + (more.length && o.len !== 's' ? '，同時也是' + joinList(more, 3) : '') + '。', 0]);
  } else {
    parts.push([9, call + (t0 ? '，現任' + t0 : '') + (more.length && o.len !== 's' ? '，並任' + joinList(more, 3) : '') + '。', 0]);
  }
  if(f.fields.length) parts.push([8, (host ? '專長是' : first ? '我的專長是' : '專長為') + sp(joinList(f.fields, fl)) + '。', 0]);
  if(f.s.years >= 2) parts.push([6, first ? '投入教學 ' + f.s.years + ' 年。' : '擁有 ' + f.s.years + ' 年教學與實務經驗。', 0]);
  if(f.exp.length && o.len !== 's') parts.push([o.len === 'l' ? 6 : 4, '曾任' + joinList(f.exp, o.len === 'l' ? 4 : 2) + '。', 1]);
  if(f.edu.length && o.len === 'l') parts.push([3, (first ? '畢業於' : '學歷為') + f.edu[0] + '。', 1]);
  if(f.certs.length) parts.push([o.len === 's' ? 2 : 5, '持有' + sp(joinList(f.certs, cl, f.certs.length > cl)) + (f.certs.length > cl ? '證照。' : '。'), 1]);
  if(f.works.length && o.len === 'l') parts.push([3, '著有' + joinList(f.works.map(function(w){ return /[《〈「]/.test(w) ? w : '《' + w + '》'; }), 3) + '。', 1]);
  var ac = achieve(f, o.len === 's');
  if(ac) parts.push([7, ac + '。', 2]);
  if(f.s.clients.length && o.len !== 's') parts.push([5, '授課單位包括' + joinList(f.s.clients, ul, f.s.clients.length > ul) + '。', 2]);
  if(f.style && o.len !== 's') parts.push([warm ? 6 : 4, (first ? '我的課' : '課程') + (/^[以用透從帶結]/.test(f.style) ? '' : '風格') + f.style + '。', 2]);
  if(f.slogan && (o.len === 'l' || warm)) parts.push([warm ? 5 : 3, (first ? '我相信：' : '理念是：') + '「' + f.slogan + '」。', 2]);
  if(host) parts.push([9, '讓我們用熱烈的掌聲，歡迎' + call + '！', 3]);
  else if(warm && !first && o.len !== 's') parts.push([2, '期待在課堂上與你相見。', 2]);
  return parts;
}
var LIMITS = {s:70, m:180, l:400};
function bio(st, o, nowYear){
  o = o || {}; o.len = LIMITS[o.len] ? o.len : 'm';
  var f = facts(st, nowYear || new Date().getFullYear());
  var parts = bioParts(f, o), max = o.max || LIMITS[o.len];
  var keep = parts.map(function(){ return true; });
  function text(){ return parts.filter(function(_, i){ return keep[i]; }).map(function(x){ return x[1]; }).join(''); }
  while(len(text()) > max){
    var lo = -1;
    parts.forEach(function(x, i){ if(keep[i] && x[0] < 9 && (lo < 0 || x[0] <= parts[lo][0])) lo = i; });
    if(lo < 0) break;
    keep[lo] = false;
  }
  var t = text();
  if(o.len === 'l'){ // 長版分段：身分專長／經歷學歷證照／實績與風格／（主持稿）結尾
    var segs = [[], [], [], []];
    parts.forEach(function(x, i){ if(keep[i]) segs[x[2]].push(x[1]); });
    t = segs.filter(function(a){ return a.length; }).map(function(a){ return a.join(''); }).join('\n\n');
  }
  return t;
}
var BIO_SETS = [
  {k:'s', n:'短版', d:'約 50 字・報名表、名牌、社群簡介'},
  {k:'m', n:'中版', d:'約 150 字・課程介紹頁、招生文宣'},
  {k:'l', n:'完整版', d:'約 300 字・計畫書、型錄、官網'}
];

/* ---------- 課程 ---------- */
function outline(c){
  return lines(c.outline, 30).map(function(x){
    var m = x.match(/^(.*?)[\s｜|／\/,，、]+(\d+(?:\.\d+)?)\s*(?:小時|hr|h|H)?$/);
    return m && m[1].trim() ? {t:m[1].trim(), h:+m[2]} : {t:x, h:0};
  });
}
function outlineHours(c){ return outline(c).reduce(function(a, x){ return a + x.h; }, 0); }
function hoursText(c){
  var h = str(c.hours).trim(), oh = outlineHours(c);
  if(!h && oh) return oh + ' 小時';
  if(/^\d+(\.\d+)?$/.test(h)) return h + ' 小時';
  if(/^[\d.\s／\/、,，]+$/.test(h)) return h.split(/[\s／\/、,，]+/).filter(Boolean).join('／') + ' 小時';
  return h;
}
function courseCheck(c){
  var w = [];
  if(!str(c.name).trim()) w.push('還沒填課程名稱');
  var oh = outlineHours(c), h = str(c.hours).trim();
  if(oh && /^\d+(\.\d+)?$/.test(h) && Math.abs(oh - +h) > 0.01) w.push('大綱時數合計 ' + oh + ' 小時，和課程時數 ' + h + ' 小時不一致');
  if(!lines(c.goals).length) w.push('建議寫 2～4 條學習目標');
  if(!outline(c).length) w.push('還沒有課程大綱');
  return w;
}

/* ---------- 講師資料表（邀課單位常見欄位） ---------- */
function sheetRows(st, nowYear){
  var p = st.p, s = stats(st, nowYear || new Date().getFullYear());
  var ach = [];
  if(s.years) ach.push('教學年資 ' + s.years + ' 年');
  if(s.hours) ach.push('累計授課 ' + fmt(s.hours) + ' 小時');
  if(s.sessions) ach.push(fmt(s.sessions) + ' 場次');
  if(s.people) ach.push('學員 ' + fmt(s.people) + ' 人次');
  var ct = [];
  if(p.email) ct.push('Email：' + p.email);
  if(p.phone) ct.push('電話：' + p.phone);
  if(p.line) ct.push('LINE：' + p.line);
  if(p.web) ct.push('網站：' + p.web);
  return [
    ['姓名', str(p.name).trim()],
    ['現職', titles(p).join('\n')],
    ['專長領域', lines(p.fields).join('、')],
    ['學歷', lines(p.edu).join('\n')],
    ['相關證照', lines(p.certs).join('\n')],
    ['主要經歷', lines(p.exp).join('\n')],
    ['授課實績', ach.join('、')],
    ['授課單位', s.clients.slice(0, 15).join('、')],
    ['著作／作品', lines(p.works).join('\n')],
    ['可授課程', st.courses.filter(function(c){ return str(c.name).trim(); }).map(function(c){ var h = hoursText(c); return c.name + (h ? '（' + h + '）' : ''); }).join('\n')],
    ['聯絡方式', ct.join('\n')]
  ];
}

/* ---------- 文字匯出 ---------- */
function courseMd(c, i){
  var o = [];
  o.push('## ' + (i != null ? (i + 1) + '. ' : '') + (c.name || '（課程名稱）'));
  var meta = [];
  if(c.cat) meta.push('類別：' + c.cat);
  var h = hoursText(c); if(h) meta.push('時數：' + h);
  if(c.who) meta.push('適合對象：' + c.who);
  if(meta.length) o.push(meta.join('｜'));
  if(c.intro) o.push(str(c.intro).trim());
  var g = lines(c.goals); if(g.length) o.push('**學習目標**\n' + g.map(function(x){ return '- ' + x; }).join('\n'));
  var ol = outline(c); if(ol.length) o.push('**課程大綱**\n' + ol.map(function(x, k){ return (k + 1) + '. ' + x.t + (x.h ? '（' + x.h + ' 小時）' : ''); }).join('\n'));
  var ft = lines(c.feats); if(ft.length) o.push('**課程特色**\n' + ft.map(function(x){ return '- ' + x; }).join('\n'));
  if(c.method) o.push('**教學方式**：' + c.method);
  if(c.equip) o.push('**場地設備**：' + c.equip);
  if(c.custom) o.push('*可依單位需求調整內容與時數*');
  if(c.fee) o.push('**費用參考**：' + c.fee);
  return o.join('\n\n');
}
function catalogMd(st, nowYear){
  var p = st.p, o = [];
  o.push('# ' + (st.look.catTitle || ((p.name || '講師') + ' 課程型錄')));
  o.push('## 講師介紹\n\n' + bio(st, {len:'l'}, nowYear));
  sheetRows(st, nowYear).forEach(function(r){ if(r[1] && r[0] !== '姓名' && r[0] !== '可授課程') o.push('**' + r[0] + '**\n' + r[1].split('\n').map(function(x){ return '- ' + x; }).join('\n')); });
  st.courses.forEach(function(c, i){ if(str(c.name).trim()) o.push(courseMd(c, i)); });
  return o.join('\n\n') + '\n';
}
function sheetText(st, nowYear){ return sheetRows(st, nowYear).filter(function(r){ return r[1]; }).map(function(r){ return r[0] + '：' + (r[1].indexOf('\n') >= 0 ? '\n' + r[1].split('\n').map(function(x){ return '　' + x; }).join('\n') : r[1]); }).join('\n'); }

/* ---------- AI 回覆清理與數字檢查 ---------- */
function sanitizeAi(o){
  o = o && typeof o === 'object' ? o : {};
  var r = {};
  [['s', 120], ['m', 260], ['l', 600], ['host', 320]].forEach(function(k){ var v = o[k[0]]; if(typeof v === 'string' && v.trim()) r[k[0]] = cut(v.replace(/<[^>]*>/g, '').trim(), k[1]); });
  return r;
}
function sanitizeCourseAi(o){
  o = o && typeof o === 'object' ? o : {};
  function arr(v, n, m){ return (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\n/) : []).map(function(x){ return cut(str(x).replace(/<[^>]*>/g, '').replace(/^\s*[-*•]\s*/, '').trim(), m); }).filter(Boolean).slice(0, n); }
  return {intro:cut(str(o.intro).replace(/<[^>]*>/g, '').trim(), 220), goals:arr(o.goals, 5, 40), feats:arr(o.feats, 5, 40), who:cut(str(o.who).replace(/<[^>]*>/g, '').trim(), 60)};
}
/* 找出 AI 文字裡出現、但講師資料裡沒有的數字（防止 AI 編造年資、時數、人次） */
function numbersIn(s){ return (str(s).replace(/,(?=\d{3})/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
function unknownNumbers(text, st, nowYear){
  var src = JSON.stringify(st.p) + '\n' + st.courses.map(function(c){ return JSON.stringify(c); }).join('\n') + (st.useRec ? st.records : '');
  var ok = {}, s = stats(st, nowYear || new Date().getFullYear());
  numbersIn(src.replace(/"photo":"[^"]*"/, '')).forEach(function(n){ ok[n] = 1; });
  [s.hours, s.sessions, s.people, s.years, s.units, s.clients.length].forEach(function(n){ if(n){ ok[n] = 1; var f = Math.floor(n); ok[f] = 1; [10, 100, 1000].forEach(function(step){ ok[Math.floor(n / step) * step] = 1; }); } });
  var bad = [];
  numbersIn(text).forEach(function(n){ if(!ok[n] && n > 9 && bad.indexOf(n) < 0) bad.push(n); });
  return bad;
}

/* ---------- 備份 ---------- */
function normalize(x){
  var b = blank();
  if(!x || typeof x !== 'object') return b;
  if(x.p) Object.keys(b.p).forEach(function(k){ if(x.p[k] != null) b.p[k] = typeof b.p[k] === 'string' ? str(x.p[k]) : x.p[k]; });
  if(x.look) Object.keys(b.look).forEach(function(k){ if(x.look[k] != null) b.look[k] = str(x.look[k]); });
  if(!THEMES[b.look.theme]) b.look.theme = 'classic';
  b.records = str(x.records); b.useRec = !!x.useRec;
  if(Array.isArray(x.courses)) b.courses = x.courses.slice(0, 30).map(function(c){ var n = blankCourse(); if(c) Object.keys(n).forEach(function(k){ if(c[k] != null) n[k] = typeof n[k] === 'boolean' ? !!c[k] : str(c[k]); }); return n; });
  return b;
}

/* ---------- 範例（全部虛構） ---------- */
function ex(p, courses, look, records){ var b = blank(); Object.keys(p).forEach(function(k){ b.p[k] = p[k]; }); b.courses = courses.map(function(c){ var n = blankCourse(); Object.keys(c).forEach(function(k){ n[k] = c[k]; }); return n; }); if(look) Object.keys(look).forEach(function(k){ b.look[k] = look[k]; }); if(records){ b.records = records; b.useRec = true; } return b; }
var EXAMPLES = [
  {id:'mkt', n:'林雅文・數位行銷講師', d:'社群經營、AI 文案、3 門課', st:ex({
    name:'林雅文', honor:'老師', title:'晨光數位行銷工作室 創辦人\n青禾科技大學 推廣教育中心 兼任講師', slogan:'行銷不是花大錢，是把對的話說給對的人聽',
    fields:'社群行銷\nAI 文案與生成式工具\n短影音企劃\n小店品牌經營\n數位廣告投放',
    edu:'青禾大學 企業管理研究所 碩士', certs:'Google Analytics 認證\nMeta 數位行銷助理認證\n勞動部 iCAP 職能導向課程講師培訓結業',
    exp:'連鎖烘焙品牌 行銷經理\n電商平台 社群企劃主管\n地方創生計畫 輔導業師', clients:'南方社區大學\n青禾科技大學推廣教育中心\n中區創業育成中心\n某縣市商業會\n婦女創業聯誼協會',
    works:'小店也能做的社群行銷', style:'以實作為主，每個單元都帶學員當場完成一篇貼文或一支短影音腳本',
    startYear:'2016', hours:'1280', sessions:'420', people:'9600', email:'yawen@example.com', phone:'0912-000-111', line:'@sunrise-mkt', web:'https://example.com/yawen'
  }, [
    {name:'小店社群經營實戰', cat:'數位行銷', hours:'6 / 12', who:'小店老闆、行銷新手、想自己經營粉專的人', intro:'從定位、內容規劃到貼文排程，帶你建立一套一個人也能持續的社群經營方法。', goals:'能寫出自己品牌的社群定位\n能規劃一個月的內容行事曆\n能寫出有互動的貼文與限動', outline:'社群定位與目標受眾｜1.5\n內容支柱與行事曆｜1.5\n貼文文案與圖片｜2\n數據檢視與調整｜1', feats:'帶自己的品牌來上課，現場產出\n提供內容行事曆範本\n課後一週社群健檢回饋', method:'講授 30%＋實作 70%', equip:'投影、網路；學員自備手機或筆電', custom:true},
    {name:'AI 文案與圖片生成應用', cat:'AI 應用', hours:'3 / 6', who:'行銷人員、小編、中小企業主', intro:'用免費或常見的 AI 工具，加快文案、圖片與企劃的產出速度，同時避開版權與錯誤資訊的風險。', goals:'會寫有效的提示詞\n能用 AI 產出貼文初稿與配圖\n知道 AI 內容的版權與查證注意事項', outline:'AI 工具地圖與提示詞六要素｜1\n文案生成與改寫｜1\n圖片生成與修圖｜0.5\n版權、查證與工作流程｜0.5', feats:'提示詞範本卡帶回家\n現場演練學員自己的商品', method:'講授＋示範＋實作', equip:'投影、網路；學員自備筆電', custom:true},
    {name:'短影音企劃與手機剪輯', cat:'數位行銷', hours:'6', who:'想用 Reels／Shorts 曝光的品牌與個人', intro:'不用專業器材，用手機從企劃、拍攝到剪輯完成一支 30 秒短影音。', goals:'能寫出 30 秒短影音腳本\n能用手機完成拍攝與剪輯', outline:'爆款短影音拆解｜1\n腳本與分鏡｜1.5\n手機拍攝技巧｜1.5\n剪輯、字幕與發布｜2', feats:'每位學員完成一支作品\n課堂作品現場講評', method:'實作工作坊', equip:'投影、網路；學員自備手機與耳機', custom:true}
  ], {theme:'classic', catTitle:'林雅文 數位行銷課程型錄', year:'2027'})},
  {id:'food', n:'陳志明・餐飲創業顧問', d:'用授課紀錄自動算實績、2 門課', st:ex({
    name:'陳志明', honor:'顧問', title:'志明餐飲顧問有限公司 總經理\n某創業貸款計畫 創業顧問', slogan:'開店前多算一次，開店後少賠一年',
    fields:'餐飲開店規劃\n菜單成本與定價\n門市營運管理\n創業貸款與營運計畫書',
    edu:'海港大學 餐旅管理學系', certs:'中餐烹調乙級技術士\n食品安全管制系統（HACCP）基礎訓練\n門市服務乙級技術士',
    exp:'連鎖早午餐品牌 營運副總\n中央廚房 廠長\n自營餐廳 7 年', clients:'', works:'', style:'用真實店家案例和試算表帶學員算出自己的損益兩平點',
    startYear:'', hours:'', sessions:'', people:'', email:'chiming@example.com', phone:'02-0000-1234', line:'', web:''
  }, [
    {name:'餐飲開店成本與損益兩平', cat:'餐飲烘焙', hours:'6', who:'準備開店或開店未滿兩年的餐飲業者', intro:'把房租、人事、食材成本攤開算，找出每天要賣多少才不會虧錢。', goals:'能算出自己的食材成本率\n能算出每日損益兩平營業額\n能調整菜單定價', outline:'開店資金與固定成本｜1.5\n食材成本與菜單定價｜2\n損益兩平試算演練｜1.5\n常見虧損原因與對策｜1', feats:'附損益試算表\n用學員自己的店當案例', method:'講授＋試算演練', equip:'投影；學員自備筆電或計算機', custom:true, fee:'依單位與人數報價'},
    {name:'創業貸款營運計畫書撰寫', cat:'創業經營', hours:'3', who:'準備申請創業貸款的創業者', intro:'看懂審查重點，把你的開店想法寫成一份有說服力的營運計畫書。', goals:'知道計畫書的審查重點\n能寫出市場分析與財務規劃段落', outline:'計畫書架構與審查重點｜1\n市場與競爭分析｜1\n財務規劃與還款計畫｜1', feats:'提供計畫書範本\n貸款資格請以各計畫公告為準', method:'講授＋撰寫練習', equip:'投影', custom:true}
  ], {theme:'bold', catTitle:'', year:''},
    '日期,單位,課程,時數,人數\n2024/3/5,北區創業育成中心,餐飲開店成本與損益兩平,6,32\n2024/5/18,某市商業會,餐飲開店成本與損益兩平,6,28\n2024/9/2,北區創業育成中心,創業貸款營運計畫書撰寫,3,40\n113/11/20,社區大學,菜單成本與定價,3,25\n2025/2/14,婦女創業聯誼協會,餐飲開店成本與損益兩平,6,30\n2025/6/7,北區創業育成中心,創業貸款營運計畫書撰寫,3,45\n2025/10/11,某市商業會,門市營運管理,6,26')},
  {id:'comm', n:'王美玲・職場溝通講師', d:'企業內訓、清新版型、1 門課', st:ex({
    name:'王美玲', honor:'講師', title:'暖心溝通學苑 首席講師', slogan:'',
    fields:'職場溝通\n跨部門協作\n客訴應對',
    edu:'山城大學 心理學系 碩士', certs:'國際教練聯盟 ACC 教練認證',
    exp:'科技公司 人資發展主管', clients:'某金控公司\n某電子公司\n某醫院', works:'', style:'以角色扮演和情境演練為主，學員會在課堂上反覆練習',
    startYear:'2019', hours:'860', sessions:'', people:'5200', email:'meiling@example.com', phone:'', line:'', web:''
  }, [
    {name:'高效職場溝通：說清楚、聽明白', cat:'職場溝通', hours:'3 / 6', who:'企業內部各層級同仁', intro:'用三個步驟把話說清楚，避免會議與交辦事項的誤會。', goals:'能用結論先行的方式表達\n能有效傾聽並確認需求\n能處理意見不同的對話', outline:'溝通的常見誤會｜0.5\n結論先行的表達｜1\n積極傾聽與提問｜1\n不同意見的對話練習｜0.5', feats:'情境演練\n可依企業個案客製', method:'講授＋角色扮演', equip:'可移動桌椅、白板', custom:true}
  ], {theme:'fresh', catTitle:'', year:''})}
];

var api = {clone:clone, cut:cut, len:len, lines:lines, num:num, fmt:fmt, nice:nice, joinList:joinList,
  HONORS:HONORS, THEMES:THEMES, CATS:CATS, blank:blank, blankCourse:blankCourse, normalize:normalize,
  parseRecords:parseRecords, recStats:recStats, parseDate:parseDate, stats:stats, facts:facts,
  bio:bio, BIO_SETS:BIO_SETS, LIMITS:LIMITS, outline:outline, outlineHours:outlineHours, hoursText:hoursText, courseCheck:courseCheck,
  sheetRows:sheetRows, sheetText:sheetText, courseMd:courseMd, catalogMd:catalogMd,
  sanitizeAi:sanitizeAi, sanitizeCourseAi:sanitizeCourseAi, numbersIn:numbersIn, unknownNumbers:unknownNumbers, EXAMPLES:EXAMPLES};
if(typeof module !== 'undefined' && module.exports) module.exports = api;
else root.IPC = api;
})(this);
