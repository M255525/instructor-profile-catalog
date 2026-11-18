/* 講師簡介與課程型錄產生器：畫面
   狀態存 localStorage（ipc. 前綴）：state（含講師照片 dataURL）、tab、voice、cur、open、aiBios、ai、fs、fold、warnSeen、marquee。 */
(function(){
'use strict';
var D = window.IPC, AI = window.IPCAI;
var PFX = 'ipc.';
var $ = function(id){ return document.getElementById(id); };
function lsGet(k){ try{ return localStorage.getItem(PFX + k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(PFX + k, v); return true; }catch(e){ return false; } }
function lsDel(k){ try{ localStorage.removeItem(PFX + k); }catch(e){} }
function lsJson(k, d){ try{ var v = JSON.parse(lsGet(k)); return v == null ? d : v; }catch(e){ return d; } }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
function br(s){ return esc(s).replace(/\n/g, '<br>'); }
var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
var YEAR = new Date().getFullYear();

/* ---------- 狀態 ---------- */
var firstRun = !lsGet('state');
var S = D.normalize(lsJson('state', null));
var TAB = lsGet('tab') || 'bio';
var VOICE = lsGet('voice') || 'formal';
var CUR = Math.max(0, Math.min(+lsGet('cur') || 0, S.courses.length - 1));
var OPEN = lsJson('open', {ex:true, basic:true});
var AIB = lsJson('aiBios', null);
var aiMsg = '', aiBusy = false;
function save(){ if(!lsSet('state', JSON.stringify(S))){ var t = D.clone(S); t.p.photo = ''; lsSet('state', JSON.stringify(t)); toast('瀏覽器空間不足，照片這次不會記住'); } }
function getPath(p){ var a = p.split('.'), o = S; for(var i = 0; i < a.length - 1; i++) o = o[a[i]]; return o[a[a.length - 1]]; }
function setPath(p, v){ var a = p.split('.'), o = S; for(var i = 0; i < a.length - 1; i++) o = o[a[i]]; o[a[a.length - 1]] = v; }
function curCourse(){ return S.courses[CUR] || null; }

var toastT;
function toast(s){ var t = document.querySelector('.toast'); if(!t){ t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = s; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function(){ t.hidden = true; }, 3000); }
function openModal(h){ $('modalBox').innerHTML = h; $('modal').classList.add('show'); }
function closeModal(){ $('modal').classList.remove('show'); }
function download(blob, name){ var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function safeName(s){ return String(s || '講師').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30) || '講師'; }
function copyText(t, msg){
  function fb(){ var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); }
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).catch(fb); else fb();
  toast(msg || '已複製');
}

/* ---------- QR（cdnjs qrcodejs，選用：只有填網站時才用） ---------- */
var qrLib = null, QR = {};
function loadQRLib(){
  if(window.QRCode) return Promise.resolve();
  if(!qrLib) qrLib = new Promise(function(ok, no){ var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = ok; s.onerror = function(){ qrLib = null; no(new Error('QR 元件載入失敗')); }; document.head.appendChild(s); });
  return qrLib;
}
function qrUrl(text){
  if(!text) return '';
  if(QR[text]) return QR[text];
  loadQRLib().then(function(){
    var box = $('qrTmp'); box.innerHTML = '';
    new window.QRCode(box, {text:text, width:400, height:400, colorDark:'#000000', colorLight:'#FFFFFF', correctLevel:window.QRCode.CorrectLevel.M});
    var cv = box.querySelector('canvas'); if(cv){ QR[text] = cv.toDataURL('image/png'); renderPreview(); }
  }).catch(function(){});
  return '';
}

/* ---------- 頁面組裝（A4 HTML） ---------- */
function themeOf(){ var t = D.THEMES[S.look.theme] || D.THEMES.classic; return {k:S.look.theme in D.THEMES ? S.look.theme : 'classic', c:S.look.color || t.c, a:t.a, bg:t.bg}; }
function page(cls, inner, no, foot){
  var t = themeOf();
  return '<section class="pg t-' + t.k + ' ' + cls + '" style="--c:' + t.c + ';--a:' + t.a + ';--bg:' + t.bg + '"><div class="pgin">' + inner + '</div>' +
    (foot ? '<div class="foot">' + esc(foot) + '</div>' : '') + (no ? '<div class="pno">' + no + '</div>' : '') + '</section>';
}
function callName(){ var p = S.p; return (p.name || '（講師姓名）') + (p.honor && p.honor !== '（不加）' ? p.honor : ''); }
function photo(){ var p = S.p; return p.photo ? '<img class="photo" src="' + p.photo + '" alt="">' : '<div class="photo ph">' + esc(Array.from(p.name || '講')[0]) + '</div>'; }
function catTitle(){ return S.look.catTitle || ((S.p.name || '講師') + ' 課程型錄'); }
function namedCourses(){ return S.courses.map(function(c, i){ return {c:c, i:i}; }).filter(function(x){ return String(x.c.name).trim(); }); }
function list(a){ return a.length ? '<ul>' + a.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
function tags(a){ return '<div class="tags">' + a.map(function(x){ return '<span>' + esc(x) + '</span>'; }).join('') + '</div>'; }
function sect(t, body){ return body ? '<div><div class="sect">' + esc(t) + '</div>' + body + '</div>' : ''; }
function numsHtml(){
  var s = D.stats(S, YEAR), a = [];
  if(s.years) a.push([s.years, '教學年資（年）']);
  if(s.hours) a.push([D.fmt(s.hours), '累計授課時數']);
  if(s.sessions) a.push([D.fmt(s.sessions), '授課場次']);
  if(s.people) a.push([D.fmt(s.people), '學員人次']);
  if(a.length < 4 && s.units) a.push([s.units, '合作單位']);
  return a.length ? '<div class="nums" style="grid-template-columns:repeat(' + a.length + ',1fr)">' + a.map(function(x){ return '<div><b>' + esc(x[0]) + '</b>' + esc(x[1]) + '</div>'; }).join('') + '</div>' : '';
}
function contactRows(){ var p = S.p, r = []; if(p.email) r.push(['Email', p.email]); if(p.phone) r.push(['電話', p.phone]); if(p.line) r.push(['LINE', p.line]); if(p.web) r.push(['網站', p.web]); return r; }
function coverPage(){
  var p = S.p, cs = namedCourses(), ct = contactRows(), q = qrUrl(p.web);
  var fields = D.lines(p.fields, 5);
  return page('cover',
    '<div class="band"><div class="yr">' + esc(S.look.year || '') + '</div><div class="ct">' + esc(catTitle()) + '</div>' + (fields.length ? '<div class="cs">' + esc(fields.join('・')) + '</div>' : '') + '</div>' +
    '<div class="who">' + photo() + '<div><div class="nm">' + esc(p.name || '（講師姓名）') + (p.honor && p.honor !== '（不加）' ? '<small>' + esc(p.honor) + '</small>' : '') + '</div><div class="tt">' + br(D.lines(p.title, 3).join('\n')) + '</div></div></div>' +
    (p.slogan ? '<div class="slg">' + esc(p.slogan) + '</div>' : '') +
    (cs.length ? '<div class="toc"><div class="sect">課程目錄</div><ol>' + cs.map(function(x){ return '<li>' + esc(x.c.name) + '</li>'; }).join('') + '</ol></div>' : '') +
    '<div class="ctc"><div>' + ct.map(function(r){ return esc(r[0]) + '：' + esc(r[1]); }).join('<br>') + '</div>' + (q ? '<div class="qrbox"><img class="qr" src="' + q + '" alt="網站 QR code"><br>掃描看更多</div>' : '') + '</div>');
}
function profilePage(no){
  var p = S.p, s = D.stats(S, YEAR);
  var certs = D.lines(p.certs), edu = D.lines(p.edu), exp = D.lines(p.exp), works = D.lines(p.works);
  return page('prof',
    '<div class="prof-head">' + photo() + '<div><div class="nm">' + esc(callName()) + '</div><div class="tt">' + br(D.lines(p.title, 4).join('\n')) + '</div></div></div>' +
    numsHtml() +
    sect('講師介紹', '<div class="biotext">' + esc(D.bio(S, {len:'l', voice:'third', tone:'formal'}, YEAR)) + '</div>') +
    sect('專長領域', D.lines(p.fields).length ? tags(D.lines(p.fields)) : '') +
    '<div class="two">' + sect('學歷', list(edu)) + sect('專業證照', list(certs)) + '</div>' +
    '<div class="two">' + sect('主要經歷', list(exp)) + sect('著作／作品', list(works)) + '</div>' +
    sect('授課單位', s.clients.length ? tags(s.clients.slice(0, 18)) : ''), no, catTitle());
}
function coursePage(c, no, withProfile){
  var ol = D.outline(c), oh = D.outlineHours(c), h = D.hoursText(c);
  var goals = D.lines(c.goals), feats = D.lines(c.feats);
  var meta = [];
  if(h) meta.push('<span><b>時數</b>　' + esc(h) + '</span>');
  if(c.who) meta.push('<span><b>適合對象</b>　' + esc(c.who) + '</span>');
  var extra = [];
  if(c.method) extra.push(['教學方式', c.method]);
  if(c.equip) extra.push(['場地設備', c.equip]);
  if(c.fee) extra.push(['費用參考', c.fee]);
  return page('course',
    '<div class="chead">' + (c.cat ? '<span class="cat">' + esc(c.cat) + '</span>' : '') + '<h2>' + esc(c.name || '（課程名稱）') + '</h2><div class="meta">' + meta.join('') + '</div></div>' +
    (c.intro ? '<div class="intro">' + br(c.intro) + '</div>' : '') +
    (goals.length || feats.length ? '<div class="two">' + sect('學習目標', list(goals)) + sect('課程特色', list(feats)) + '</div>' : '') +
    (ol.length ? sect('課程大綱', '<table class="otab"><thead><tr><th>#</th><th>單元</th><th style="text-align:right">時數</th></tr></thead><tbody>' +
      ol.map(function(x, k){ return '<tr><td class="n">' + (k + 1) + '</td><td>' + esc(x.t) + '</td><td class="h">' + (x.h ? x.h + ' 小時' : '') + '</td></tr>'; }).join('') + '</tbody>' +
      (oh ? '<tfoot><tr><td></td><td>合計</td><td class="h">' + oh + ' 小時</td></tr></tfoot>' : '') + '</table>') : '') +
    (extra.length ? '<table class="ctab">' + extra.map(function(r){ return '<tr><td>' + esc(r[0]) + '</td><td>' + br(r[1]) + '</td></tr>'; }).join('') + '</table>' : '') +
    (c.custom ? '<div class="custom">✔ 可依單位需求調整內容與時數</div>' : '') +
    (withProfile ? '<div style="margin-top:auto">' + sect('講師', '<div class="prof-head" style="gap:5mm">' + photo().replace('class="photo', 'style="width:26mm;height:26mm" class="photo') + '<div class="biotext" style="font-size:.95em">' + esc(D.bio(S, {len:'m', voice:'third', tone:'formal'}, YEAR)) + '</div></div>') +
      (contactRows().length ? '<div class="small" style="margin-top:2mm;color:#4B5160">' + contactRows().map(function(r){ return esc(r[0]) + '：' + esc(r[1]); }).join('　') + '</div>' : '') + '</div>' : ''),
    no, withProfile ? '' : catTitle());
}
var STEPS = ['需求洽談<br><small>對象、人數、想解決的問題</small>', '確認大綱<br><small>依需求調整內容與時數</small>', '報價與確認<br><small>日期、場地、設備</small>', '上課<br><small>講義與實作</small>', '課後回饋<br><small>滿意度與後續建議</small>'];
function contactPage(no){
  var cs = namedCourses(), ct = contactRows(), q = qrUrl(S.p.web);
  return page('contact',
    sect('邀課流程', '<div class="steps">' + STEPS.map(function(s){ return '<div>' + s + '</div>'; }).join('') + '</div>') +
    (cs.length ? sect('可授課程一覽', '<table class="otab"><thead><tr><th>#</th><th>課程</th><th>類別</th><th style="text-align:right">時數</th></tr></thead><tbody>' + cs.map(function(x, k){ return '<tr><td class="n">' + (k + 1) + '</td><td><b>' + esc(x.c.name) + '</b>' + (x.c.who ? '<br><small style="color:#5E6472">' + esc(x.c.who) + '</small>' : '') + '</td><td>' + esc(x.c.cat) + '</td><td class="h">' + esc(D.hoursText(x.c)) + '</td></tr>'; }).join('') + '</tbody></table>') : '') +
    sect('邀課聯絡', (ct.length ? '<div style="display:flex;gap:6mm;align-items:flex-start"><table class="ctab" style="flex:1">' + ct.map(function(r){ return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' + (q ? '<div class="qrbox"><img class="qr" src="' + q + '" alt="網站 QR code"><br>掃描看更多</div>' : '') + '</div>' : '<p>（請在左邊「聯絡方式」填寫）</p>') +
      '<p style="margin:3mm 0 0;color:#4B5160">課程內容、時數與上課方式皆可依單位需求調整，歡迎來信洽談。</p>'), no, catTitle());
}
function sheetPage(){
  var rows = D.sheetRows(S, YEAR), p = S.p;
  rows.splice(7, 0, ['講師簡介', D.bio(S, {len:'m', voice:'third', tone:'formal'}, YEAR)]);
  var body = '<table class="stab">' + rows.map(function(r, i){
    var td = '<td' + (i === 0 ? '' : ' colspan="2"') + '>' + esc(r[1]) + '</td>';
    if(i === 0) td += '<td class="ph" rowspan="3">' + (p.photo ? '<img src="' + p.photo + '" alt="">' : '（照片）') + '</td>';
    else if(i < 3) td = '<td>' + esc(r[1]) + '</td>';
    return '<tr><th>' + esc(r[0]) + '</th>' + td + '</tr>';
  }).join('') + '</table>';
  return page('sheet', '<h2>講 師 資 料 表</h2>' + body, '', '');
}
function pagesFor(tab){
  if(tab === 'sheet') return [sheetPage()];
  if(tab === 'one'){ var c = curCourse(); return c ? [coursePage(c, '', true)] : []; }
  var out = [coverPage(), profilePage(2)], n = 3;
  namedCourses().forEach(function(x){ out.push(coursePage(x.c, n++, false)); });
  out.push(contactPage(n));
  return out;
}

/* ---------- 版面縮字：放不下就把字縮小（最小 0.76 倍），還是放不下就畫紅框 ---------- */
var OVER = [];
function fit(root){
  OVER = [];
  root.querySelectorAll('.pg').forEach(function(pg, i){
    var inn = pg.querySelector('.pgin'), k = 1;
    pg.style.setProperty('--k', '1'); pg.classList.remove('over');
    if(pg.classList.contains('cover')) return;
    while(inn.scrollHeight > inn.clientHeight + 1 && k > 0.77){ k = Math.round((k - 0.04) * 100) / 100; pg.style.setProperty('--k', String(k)); }
    if(inn.scrollHeight > inn.clientHeight + 1){ pg.classList.add('over'); OVER.push(i + 1); }
  });
}
function zoom(){
  var st = document.querySelector('.stage'), z = document.querySelector('.zoomer');
  if(!st || !z) return;
  var w = st.clientWidth - (window.innerWidth < 480 ? 20 : 44);
  z.style.zoom = String(Math.min(1, Math.max(.3, w / 794)));
}

/* ---------- 左側面板 ---------- */
function card(id, no, title, sv, body){ return '<details class="card" data-card="' + id + '"' + (OPEN[id] ? ' open' : '') + '><summary><span class="no">' + no + '</span>' + title + '<span class="sv" data-sv="' + id + '">' + esc(sv) + '</span></summary><div class="cb">' + body + '</div></details>'; }
function inp(path, label, o){
  o = o || {}; var v = getPath(path);
  var a = ' data-b="' + path + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '');
  var f = o.rows ? '<textarea rows="' + o.rows + '"' + a + '>' + esc(v) + '</textarea>' : '<input' + (o.type ? ' type="' + o.type + '"' : '') + (o.mode ? ' inputmode="' + o.mode + '"' : '') + a + ' value="' + esc(v) + '">';
  return '<label class="fld">' + label + f + (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</label>';
}
function cinp(k, label, o){
  o = o || {}; var c = curCourse(), v = c ? c[k] : '';
  var a = ' data-cb="' + k + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.list ? ' list="' + o.list + '"' : '');
  var f = o.rows ? '<textarea rows="' + o.rows + '"' + a + '>' + esc(v) + '</textarea>' : '<input' + a + ' value="' + esc(v) + '">';
  return '<label class="fld">' + label + f + (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</label>';
}
function sums(){
  var p = S.p, s = D.stats(S, YEAR);
  return {basic:p.name ? callName() : '未填', bg:D.lines(p.fields).length + ' 項專長・' + D.lines(p.certs).length + ' 張證照',
    perf:(s.hours ? D.fmt(s.hours) + ' 小時' : '未填') + (s.fromRec ? '（紀錄）' : ''), course:S.courses.length + ' 門課',
    contact:contactRows().length ? contactRows().map(function(r){ return r[0]; }).join('・') : '未填', ai:AI.status()};
}
function updateSums(){ var s = sums(); Object.keys(s).forEach(function(k){ var e = document.querySelector('[data-sv="' + k + '"]'); if(e) e.textContent = s[k]; }); }
function perfStat(){
  var r = D.parseRecords(S.records), rs = D.recStats(r.rows);
  if(!S.records.trim()) return '';
  return '<div class="stat"><div><b>' + rs.sessions + '</b>場次</div><div><b>' + D.fmt(rs.hours) + '</b>小時</div><div><b>' + D.fmt(rs.people) + '</b>人次</div><div><b>' + rs.units + '</b>單位</div></div>' +
    (r.bad.length ? '<p class="small" style="color:var(--bad)">第 ' + r.bad.slice(0, 8).join('、') + ' 行讀不懂（要有日期和單位），已略過。</p>' : '') +
    (Object.keys(rs.years).length ? '<p class="small">' + Object.keys(rs.years).sort().map(function(y){ var v = rs.years[y]; return y + ' 年 ' + v.sessions + ' 場／' + D.fmt(v.hours) + ' 小時'; }).join('；') + '</p>' : '');
}
function courseForm(){
  var c = curCourse();
  if(!c) return '<p class="small">還沒有課程，按「＋ 新增課程」。</p>';
  var w = D.courseCheck(c);
  return '<div style="border-top:1px dashed var(--line);padding-top:.5rem;display:flex;flex-direction:column;gap:.55rem">' +
    '<p class="small"><b>正在編輯第 ' + (CUR + 1) + ' 門</b></p>' +
    cinp('name', '課程名稱', {ph:'例：小店社群經營實戰'}) +
    '<div class="row2">' + cinp('cat', '類別', {list:'catList', ph:'選或自己打'}) + cinp('hours', '時數', {ph:'6 或 3 / 6 / 12', hint:'可寫多種方案'}) + '</div>' +
    '<datalist id="catList">' + D.CATS.map(function(x){ return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
    cinp('who', '適合對象', {ph:'例：小店老闆、行銷新手'}) +
    cinp('intro', '課程簡介', {rows:3, ph:'上完這門課，學員能做到什麼？'}) +
    cinp('goals', '學習目標（一行一條）', {rows:3}) +
    cinp('outline', '課程大綱（一行一個單元，後面可加「｜時數」）', {rows:5, ph:'社群定位與目標受眾｜1.5\n內容支柱與行事曆｜1.5', hint:'時數會自動加總，和上面的時數對不起來會提醒你'}) +
    cinp('feats', '課程特色（一行一條）', {rows:3}) +
    '<div class="row2">' + cinp('method', '教學方式', {ph:'講授＋實作'}) + cinp('equip', '場地設備', {ph:'投影、網路'}) + '</div>' +
    cinp('fee', '費用參考（選填）', {ph:'例：依單位與人數報價'}) +
    '<label class="chk"><input type="checkbox" data-cb="custom"' + (c.custom ? ' checked' : '') + '>可依單位需求調整（型錄上會註明）</label>' +
    (w.length ? '<ul class="cwarn">' + w.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
    '<div class="aibox"><p class="small" style="margin-bottom:.4rem"><b>🤖 AI 幫我寫這門課的簡介、目標、特色</b>（選用；只會用你填的課名和大綱）</p><div class="stack">' +
      '<button type="button" class="btn gold sm" data-act="aiCourse"' + (aiBusy ? ' disabled' : '') + '>' + (AI.ready() ? 'AI 產生' : '先到 ⚙ 設定金鑰') + '</button>' +
      '<button type="button" class="btn alt sm" data-act="aiCourseCopy">複製提示詞</button><button type="button" class="btn alt sm" data-act="aiCoursePaste">貼上 AI 回覆</button></div></div>' +
  '</div>';
}
function renderPanel(){
  var p = S.p;
  var h = card('ex', '例', '範例與存檔', '', '<div class="exs">' + D.EXAMPLES.map(function(e){ return '<button type="button" class="ex" data-ex="' + e.id + '">' + esc(e.n) + '<small>' + esc(e.d) + '（虛構）</small></button>'; }).join('') + '</div>' +
      '<div class="stack"><button type="button" class="btn alt sm" data-act="blank">＋ 從空白開始</button><button type="button" class="btn alt sm" data-act="backup">⬇ 下載備份</button><label class="btn alt sm" style="cursor:pointer">⬆ 讀取備份<input type="file" accept=".json,application/json" data-file="backup" hidden></label></div>' +
      '<p class="small">資料只存在這台瀏覽器。換電腦或清瀏覽器前，記得先下載備份。</p>') +
    card('basic', '一', '講師基本資料', sums().basic,
      '<div class="row2">' + inp('p.name', '姓名', {ph:'例：林雅文', max:20}) + '<label class="fld">稱謂<select data-b="p.honor">' + D.HONORS.map(function(x){ return '<option' + (p.honor === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label></div>' +
      inp('p.title', '現職（一行一個職稱）', {rows:2, ph:'晨光數位行銷工作室 創辦人\n某大學推廣教育中心 兼任講師'}) +
      inp('p.slogan', '一句話教學理念（選填）', {ph:'例：行銷不是花大錢，是把對的話說給對的人聽', max:40}) +
      '<div class="imgbox">' + (p.photo ? '<img src="' + p.photo + '" alt="講師照片">' : '<span class="ph">👤</span>') + '<label>選擇照片<input type="file" accept="image/*" data-file="photo" hidden></label>' + (p.photo ? '<button type="button" data-act="delPhoto">移除</button>' : '') + '<span class="small" style="flex-basis:100%">建議用正面半身照；只存在這台瀏覽器。</span></div>') +
    card('bg', '二', '專長與學經歷', sums().bg,
      inp('p.fields', '專長領域（一行一項，前面的優先寫進簡介）', {rows:4}) +
      inp('p.edu', '學歷（一行一個，最高學歷放第一行）', {rows:2}) +
      inp('p.certs', '證照與培訓（一行一張）', {rows:3}) +
      inp('p.exp', '主要經歷（一行一個，重要的放前面）', {rows:3}) +
      inp('p.works', '著作／作品（選填）', {rows:2}) +
      inp('p.style', '教學風格（選填）', {rows:2, ph:'例：以實作為主，每個單元都帶學員當場完成作品'})) +
    card('perf', '三', '授課實績', sums().perf,
      '<div class="row2">' + inp('p.startYear', '開始授課年份（西元）', {mode:'numeric', ph:'2016', hint:'自動算年資'}) + inp('p.hours', '累計授課時數', {mode:'numeric', ph:'1280'}) + '</div>' +
      '<div class="row2">' + inp('p.sessions', '授課場次', {mode:'numeric'}) + inp('p.people', '學員人次', {mode:'numeric'}) + '</div>' +
      inp('p.clients', '授課單位（一行一個）', {rows:3}) +
      '<label class="chk"><input type="checkbox" data-b="useRec"' + (S.useRec ? ' checked' : '') + '>改用授課紀錄自動統計時數、場次、人次</label>' +
      (S.useRec ? inp('records', '授課紀錄（從 Excel 複製貼上）', {rows:6, ph:'日期,單位,課程,時數,人數\n2025/3/5,某社區大學,社群行銷,3,30', hint:'欄位順序：日期、單位、課程、時數、人數。可用 Tab 或逗號分隔，民國年也可以。'}) + '<div id="perfStat">' + perfStat() + '</div>' : '') +
      '<p class="small">數字只寫查得到的；1,234 小時在簡介會寫成「超過 1,200 小時」，不會灌水。</p>') +
    card('course', '四', '課程', sums().course,
      '<div class="clist">' + S.courses.map(function(c, i){ return '<div class="citem' + (i === CUR ? ' on' : '') + '"><button type="button" class="cname" data-cur="' + i + '">' + (i + 1) + '. ' + esc(c.name || '（未命名課程）') + '</button><button type="button" class="mini" data-mv="' + i + ':-1" aria-label="往上"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="mini" data-mv="' + i + ':1" aria-label="往下"' + (i < S.courses.length - 1 ? '' : ' disabled') + '>↓</button><button type="button" class="mini" data-delc="' + i + '" aria-label="刪除">✕</button></div>'; }).join('') + '</div>' +
      '<div class="stack"><button type="button" class="btn sm" data-act="addCourse">＋ 新增課程</button>' + (curCourse() ? '<button type="button" class="btn alt sm" data-act="dupCourse">複製這門</button>' : '') + '</div>' + courseForm()) +
    card('contact', '五', '聯絡方式', sums().contact,
      '<div class="row2">' + inp('p.email', 'Email', {type:'email'}) + inp('p.phone', '電話', {type:'tel'}) + '</div>' +
      '<div class="row2">' + inp('p.line', 'LINE ID', {}) + inp('p.web', '網站／個人頁', {type:'url', ph:'https://', hint:'有填會在型錄印 QR code'}) + '</div>') +
    card('ai', '六', '🤖 AI 潤飾簡介（選用）', sums().ai,
      '<p class="small">規則產生的簡介已經可以直接用。想要更自然的文筆，可以讓 AI 依你填的資料改寫；<b>AI 不會被允許新增經歷或數字</b>，寫出資料裡沒有的數字時會標紅提醒。</p>' +
      '<div class="stack"><button type="button" class="btn gold" data-act="aiBio"' + (aiBusy ? ' disabled' : '') + '>' + (AI.ready() ? '✨ AI 改寫四個版本' : '⚙ 先設定 AI 金鑰') + '</button>' +
      '<button type="button" class="btn alt sm" data-act="aiBioCopy">複製提示詞（免金鑰）</button><button type="button" class="btn alt sm" data-act="aiBioPaste">貼上 AI 回覆</button></div>' +
      (aiMsg ? '<p class="small" id="aiMsg">' + esc(aiMsg) + '</p>' : '') + (AIB ? '<p class="small">AI 版本顯示在右邊「簡介」分頁的最下面。</p>' : ''));
  $('panel').innerHTML = h;
}

/* ---------- 右側預覽 ---------- */
var TABS = [['bio', '📝 簡介'], ['sheet', '📋 講師資料表'], ['cat', '📚 課程型錄'], ['one', '📄 單一課程頁']];
var VOICES = [['formal', '第三人稱・正式'], ['warm', '第三人稱・親切'], ['first', '第一人稱']];
function voiceOpt(){ return VOICE === 'first' ? {voice:'first', tone:'warm'} : {voice:'third', tone:VOICE}; }
function bioCard(title, sub, text, key, ai){
  var bad = ai ? D.unknownNumbers(text, S, YEAR) : [];
  return '<div class="bio' + (ai ? ' ai' : '') + '"><h3>' + esc(title) + '<small>' + esc(sub) + '</small><span class="cnt">' + D.len(text.replace(/\n/g, '')) + ' 字</span></h3>' +
    (bad.length ? '<p class="note">⚠ 這段出現資料裡沒有的數字：' + bad.join('、') + '，請確認是不是 AI 自己編的。</p>' : '') +
    '<div class="txt">' + esc(text) + '</div><div class="stack"><button type="button" class="btn sm" data-copy="' + key + '">📋 複製</button></div></div>';
}
var BIOTXT = {};
function bioTab(){
  var o = voiceOpt(), h = '';
  BIOTXT = {};
  D.BIO_SETS.forEach(function(b){ var t = D.bio(S, {len:b.k, voice:o.voice, tone:o.tone}, YEAR); BIOTXT[b.k] = t; h += bioCard(b.n, b.d, t, b.k); });
  BIOTXT.host = D.bio(S, {len:'m', voice:'third', tone:'host', max:200}, YEAR);
  h += bioCard('🎤 主持人介紹稿', '開場時給主持人念，約 1 分鐘', BIOTXT.host, 'host');
  if(AIB){
    [['s', 'AI 短版'], ['m', 'AI 中版'], ['l', 'AI 完整版'], ['host', 'AI 主持人介紹稿']].forEach(function(x){ if(AIB[x[0]]){ BIOTXT['ai' + x[0]] = AIB[x[0]]; h += bioCard('✨ ' + x[1], 'AI 改寫，請自行核對', AIB[x[0]], 'ai' + x[0], true); } });
    h += '<div class="stack"><button type="button" class="btn alt sm" data-act="aiBioClear">移除 AI 版本</button></div>';
  }
  return '<div class="bios">' + h + '</div>';
}
function renderBar(){
  var h = '<div class="tabs" role="tablist">' + TABS.map(function(t){ return '<button type="button" class="tab" role="tab" data-tab="' + t[0] + '" aria-selected="' + (TAB === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><div class="bar">';
  if(TAB === 'bio'){
    h += '<div class="opts"><span class="lbl">口吻</span>' + VOICES.map(function(v){ return '<button type="button" class="seg" data-voice="' + v[0] + '" aria-pressed="' + (VOICE === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div>' +
      '<div class="exports"><button type="button" class="btn" data-act="copyAll">📋 複製全部版本</button><button type="button" class="btn alt" data-act="txt">⬇ 下載 .txt</button></div>';
  } else {
    if(TAB !== 'sheet') h += '<div class="opts"><span class="lbl">風格</span>' + Object.keys(D.THEMES).map(function(k){ var t = D.THEMES[k]; return '<button type="button" class="thm" data-theme="' + k + '" aria-pressed="' + (S.look.theme === k) + '" title="' + esc(t.d) + '"><i style="background:' + t.c + '"></i>' + t.n + '</button>'; }).join('') +
      '<span class="lbl" style="margin-left:.4rem">主色</span><input type="color" data-color value="' + esc(S.look.color || D.THEMES[S.look.theme].c) + '" aria-label="自訂主色">' + (S.look.color ? '<button type="button" class="btn alt sm" data-act="nocolor">還原</button>' : '') + '</div>';
    if(TAB === 'cat') h += '<div class="opts"><label class="fld" style="flex:2 1 12rem">型錄標題<input data-b="look.catTitle" placeholder="' + esc((S.p.name || '講師') + ' 課程型錄') + '" value="' + esc(S.look.catTitle) + '"></label><label class="fld" style="flex:1 1 6rem">年度（選填）<input data-b="look.year" placeholder="2027" value="' + esc(S.look.year) + '"></label></div>';
    if(TAB === 'one') h += '<div class="opts"><span class="lbl">課程</span><select data-pick>' + S.courses.map(function(c, i){ return '<option value="' + i + '"' + (i === CUR ? ' selected' : '') + '>' + (i + 1) + '. ' + esc(c.name || '（未命名）') + '</option>'; }).join('') + '</select></div>';
    h += '<div class="exports"><button type="button" class="btn gold" data-act="print">🖨 列印／存成 PDF</button>' +
      (TAB === 'sheet' ? '<button type="button" class="btn" data-act="word">⬇ 下載 Word</button><button type="button" class="btn alt" data-act="sheetCopy">📋 複製文字</button>' : '') +
      (TAB === 'cat' ? '<button type="button" class="btn alt" data-act="md">⬇ 下載 Markdown</button>' : '') +
      (TAB === 'one' ? '<button type="button" class="btn alt" data-act="courseCopy">📋 複製課程文字</button>' : '') + '</div><div id="fitMsg"></div>';
  }
  $('bar').innerHTML = h + '</div>';
}
function renderPreview(){
  var box = $('pvBody');
  if(TAB === 'bio'){ box.innerHTML = bioTab(); return; }
  var pgs = pagesFor(TAB);
  if(!pgs.length){ box.innerHTML = '<div class="bio"><p>還沒有課程，請先在左邊「四 課程」新增一門。</p></div>'; return; }
  box.innerHTML = '<div class="stage"><div class="zoomer">' + pgs.join('') + '</div></div>';
  zoom(); fit(box);
  var m = $('fitMsg');
  if(m) m.innerHTML = OVER.length ? '<div class="alert bad">第 ' + OVER.join('、') + ' 頁內容太多，縮小字級後還是放不下（紅框）。請刪減大綱、目標或經歷的行數。</div>' : '<div class="alert ok">✔ 共 ' + pgs.length + ' 頁 A4，每頁都放得下。列印時選「A4」「邊界：無」，並勾選「背景圖形」。</div>';
}
var rT;
function soon(){ clearTimeout(rT); rT = setTimeout(renderPreview, 180); }
function render(){
  $('app').innerHTML = '<div class="top"><h1><span class="badge" aria-hidden="true">師</span><span>講師簡介與課程型錄產生器 <small>簡介三種長度・主持稿・講師資料表・A4 型錄</small></span></h1>' +
    '<a class="ibtn" href="manual.html">📖 操作手冊</a><button class="ibtn" type="button" data-act="settings" aria-label="常用設定">⚙</button></div>' +
    '<p class="warn-line">簡介只用你填的事實組成；資料與照片只存在這台瀏覽器。<button type="button" data-act="warn">⚠ 使用警語</button></p>' +
    '<div class="work"><div class="panel" id="panel"></div><div class="pv"><div id="bar"></div><div id="pvBody"></div></div></div>' + footer();
  renderPanel(); renderBar(); renderPreview();
}
function footer(){
  return '<footer class="foot2">👤 創作者 Mark Tsai（蔡豐全）<a href="mailto:tsaimark@gmail.com">tsaimark@gmail.com</a><br><a href="manual.html">📖 操作手冊</a><a href="manual.html#creator">👤 創作者資訊</a><a href="#" data-act="warn">⚠ 使用警語</a>' +
    (standalone ? '' : '<a href="#" data-act="install">📲 加入主畫面</a>') +
    '<br><img src="https://visitor-badge.laobi.icu/badge?page_id=m255525.instructorprofilecatalog" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle;margin-top:.4rem"></footer>';
}

/* ---------- 列印與匯出 ---------- */
function doPrint(){
  renderPreview();
  var pa = $('printArea'), z = document.querySelector('.zoomer');
  if(!z){ toast('沒有可以列印的頁面'); return; }
  pa.innerHTML = z.innerHTML;
  toast(OVER.length ? '有頁面放不下，印出來會被裁掉，請先刪減內容' : '準備列印…');
  var imgs = Array.prototype.map.call(pa.querySelectorAll('img'), function(im){ return im.decode ? im.decode().catch(function(){}) : null; });
  Promise.all(imgs).then(function(){ setTimeout(function(){ window.print(); }, 80); });
}
function wordDoc(){
  var rows = D.sheetRows(S, YEAR);
  rows.splice(7, 0, ['講師簡介', D.bio(S, {len:'m', voice:'third', tone:'formal'}, YEAR)]);
  var cell = 'border:1px solid #000;padding:6px 8px;vertical-align:top;font-family:"微軟正黑體",sans-serif;font-size:11pt';
  var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>講師資料表</title>' +
    '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--><style>@page{size:21cm 29.7cm;margin:2cm}</style></head><body>' +
    '<p style="text-align:center;font-family:\'微軟正黑體\';font-size:18pt;font-weight:bold;letter-spacing:6pt">講師資料表</p>' +
    '<table style="border-collapse:collapse;width:100%">' + rows.map(function(r){ return '<tr><td style="' + cell + ';width:3cm;background:#F1EEE6;font-weight:bold">' + esc(r[0]) + '</td><td style="' + cell + '">' + br(r[1]) + '</td></tr>'; }).join('') + '</table>' +
    '<p style="font-size:9pt;color:#666">照片請在 Word 裡自行插入。</p></body></html>';
  return new Blob(['﻿', html], {type:'application/msword'});
}
function allBiosText(){
  var o = voiceOpt(), out = [];
  D.BIO_SETS.forEach(function(b){ out.push('【' + b.n + '】\n' + D.bio(S, {len:b.k, voice:o.voice, tone:o.tone}, YEAR)); });
  out.push('【主持人介紹稿】\n' + D.bio(S, {len:'m', voice:'third', tone:'host', max:200}, YEAR));
  if(AIB) [['s', 'AI 短版'], ['m', 'AI 中版'], ['l', 'AI 完整版'], ['host', 'AI 主持人介紹稿']].forEach(function(x){ if(AIB[x[0]]) out.push('【' + x[1] + '】\n' + AIB[x[0]]); });
  return out.join('\n\n');
}
function readImg(file, max){
  return new Promise(function(ok, no){
    if(!file || !/^image\//.test(file.type)) return no(new Error('請選 PNG、JPG 或 WebP 圖片'));
    var fr = new FileReader();
    fr.onload = function(){ var im = new Image(); im.onload = function(){ var k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height); ok(cv.toDataURL('image/jpeg', .86)); }; im.onerror = function(){ no(new Error('讀不懂這張圖片')); }; im.src = fr.result; };
    fr.onerror = function(){ no(new Error('讀檔失敗')); };
    fr.readAsDataURL(file);
  });
}
function apply(st, msg){ S = D.normalize(D.clone(st)); CUR = 0; lsSet('cur', '0'); AIB = null; lsDel('aiBios'); save(); render(); if(msg) toast(msg); }
function loadExample(id){ var e = D.EXAMPLES.filter(function(x){ return x.id === id; })[0]; if(e) apply(e.st, '已載入範例「' + e.n + '」（內容全部虛構）'); }

/* ---------- AI ---------- */
async function aiBio(){
  if(!AI.ready()){ openSettings('ai'); return; }
  aiBusy = true; aiMsg = 'AI 改寫中…（約 10～40 秒）'; renderPanel();
  try{ AIB = await AI.bios(S, function(m){ aiMsg = m; var e = $('aiMsg'); if(e) e.textContent = m; }); lsSet('aiBios', JSON.stringify(AIB)); aiMsg = '完成，AI 版本在右邊「簡介」分頁最下面。'; TAB = 'bio'; lsSet('tab', TAB); renderBar(); renderPreview(); }
  catch(e){ aiMsg = '失敗：' + e.message; }
  aiBusy = false; renderPanel();
}
function applyCourseAi(r){
  var c = curCourse(); if(!c) return;
  if(r.intro) c.intro = r.intro;
  if(r.goals.length) c.goals = r.goals.join('\n');
  if(r.feats.length) c.feats = r.feats.join('\n');
  if(r.who && !c.who) c.who = r.who;
  save(); renderPanel(); soon();
  var bad = D.unknownNumbers([r.intro, r.goals.join(' '), r.feats.join(' '), r.who].join(' '), S, YEAR);
  toast(bad.length ? '已套用，但出現資料裡沒有的數字：' + bad.join('、') + '，請檢查' : '已套用到這門課的簡介、目標與特色，請再看一次');
}
async function aiCourse(){
  if(!AI.ready()){ openSettings('ai'); return; }
  if(!curCourse() || !curCourse().name){ toast('請先填課程名稱'); return; }
  aiBusy = true; renderPanel(); toast('AI 撰寫中…');
  try{ applyCourseAi(await AI.course(S, CUR)); }catch(e){ toast('失敗：' + e.message); }
  aiBusy = false; renderPanel();
}

/* ---------- 設定 ---------- */
var WARN_HTML = '<h2>⚠ 使用警語</h2><ul>' +
  '<li>簡介、資料表與型錄的內容都來自你填的資料，<b>請確認經歷、證照、時數、人次屬實</b>。不實的學經歷或實績可能違反邀課單位規定，甚至涉及法律責任。</li>' +
  '<li>寫到其他單位（授課單位、合作企業）名稱前，最好先確認對方同意公開；照片請用你本人或有權使用的圖片。</li>' +
  '<li>使用「AI 改寫」時，講師資料會送到你在 ⚙ 選的 AI 服務。AI 可能寫錯或誇大，畫面會標出資料裡沒有的數字，<b>仍請逐字核對後再使用</b>。</li>' +
  '<li>資料與照片只存在這台瀏覽器，不會上傳；換電腦或清除瀏覽器資料前請先「下載備份」。公用電腦用完請到 ⚙ 清除全部資料。</li>' +
  '<li>範例中的講師、單位、聯絡方式全部虛構。</li></ul>';
function showWarn(){ openModal(WARN_HTML + '<div class="stack"><button type="button" class="btn" data-act="close">我知道了</button></div>'); }
function sec(id, title, val, body){ return '<details class="set-sec" data-sec="' + id + '"><summary><span class="sst">' + title + '</span><span class="ssv">' + esc(val) + '</span></summary><div class="set-body">' + body + '</div></details>'; }
function aiSettings(){
  var c = AI.cfg(), pv = AI.PROVIDERS[c.provider];
  return '<label class="fld">AI 服務<select data-aicfg="provider">' + Object.keys(AI.PROVIDERS).map(function(k){ return '<option value="' + k + '"' + (c.provider === k ? ' selected' : '') + '>' + esc(AI.PROVIDERS[k].label) + '</option>'; }).join('') + '</select></label>' +
    (c.provider === 'custom' ? '<label class="fld">端點網址<input data-aicfg="base" value="' + esc(c.base || '') + '" placeholder="http://localhost:11434/v1"></label>' : '') +
    '<label class="fld">API 金鑰' + (c.provider === 'custom' ? '（沒有可空白）' : '') + '<input type="password" data-aicfg="key" value="' + esc(c.key || '') + '" autocomplete="off" spellcheck="false"></label>' +
    (pv.models.length ? '<label class="fld">模型<select data-aicfg="model">' + pv.models.map(function(m){ return '<option value="' + m[0] + '"' + (AI.aiModel(c) === m[0] ? ' selected' : '') + '>' + esc(m[1]) + '</option>'; }).join('') + '</select></label>' : '') +
    '<label class="fld">自訂模型名稱（選填）<input data-aicfg="modelCustom" value="' + esc(c.modelCustom || '') + '"></label>' +
    '<p class="small">金鑰只存在這台瀏覽器。公用電腦用完請清空。</p><div class="stack"><button type="button" class="btn red sm" data-act="aiClear">清除金鑰</button></div>';
}
function openSettings(openId){
  var xl = lsGet('fs') === 'xl';
  var h = '<div class="top"><h2 style="flex:1 1 0">⚙ 常用設定</h2><button type="button" class="btn alt sm" data-act="foldall">全部展開／收合</button></div>' +
    sec('view', '顯示', xl ? '大字' : '標準字', '<div class="stack"><button type="button" class="btn' + (xl ? ' alt' : '') + '" data-fontsize="m">標準字</button><button type="button" class="btn' + (xl ? '' : ' alt') + '" data-fontsize="xl">大字</button></div><p class="small">只影響操作畫面，不影響型錄。</p>') +
    sec('ai', '🤖 AI 設定', AI.status(), aiSettings()) +
    sec('bak', '💾 備份與還原', '', '<p class="small">備份檔（.json）包含講師資料、照片與所有課程，可以搬到另一台電腦。</p><div class="stack"><button type="button" class="btn" data-act="backup">⬇ 下載備份</button><label class="btn alt" style="cursor:pointer">⬆ 讀取備份<input type="file" accept=".json,application/json" data-file="backup" hidden></label></div>') +
    sec('wipe', '🧹 清除全部資料', '', '<p class="small">清掉講師資料、照片、課程、AI 改寫結果與 AI 金鑰。</p><div class="stack"><button type="button" class="btn red" data-act="wipeAll">清除全部資料</button></div>') +
    sec('about', '關於本工具', '', '<p>👤 創作者 Mark Tsai（蔡豐全）<br><a href="mailto:tsaimark@gmail.com">tsaimark@gmail.com</a></p><div class="stack"><a class="btn alt" href="manual.html">📖 操作手冊</a><a class="btn alt" href="manual.html#creator">👤 創作者資訊</a><button type="button" class="btn alt" data-act="warn">⚠ 使用警語</button>' +
      (standalone ? '' : '<button type="button" class="btn alt" data-act="install">📲 加入主畫面</button>') + '</div><p class="small" style="margin-top:.5rem">訪客數 <img src="https://visitor-badge.laobi.icu/badge?page_id=m255525.instructorprofilecatalog" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle"></p>') +
    '<div class="stack"><button type="button" class="btn" data-act="close">關閉</button></div>';
  openModal(h);
  var open = lsJson('fold', []);
  if(typeof openId === 'string' && open.indexOf(openId) < 0) open.push(openId);
  document.querySelectorAll('.set-sec').forEach(function(d){ d.open = open.indexOf(d.dataset.sec) >= 0; d.addEventListener('toggle', saveFold); });
}
function saveFold(){ var o = []; document.querySelectorAll('.set-sec').forEach(function(d){ if(d.open) o.push(d.dataset.sec); }); lsSet('fold', JSON.stringify(o)); }
function applyView(){ document.documentElement.dataset.fs = lsGet('fs') === 'xl' ? 'xl' : 'm'; }
function install(){
  if(window._dp){ window._dp.prompt(); window._dp = null; return; }
  openModal('<h2>📲 加入主畫面</h2><ul><li><b>電腦（Chrome／Edge）</b>：網址列右邊的安裝圖示。</li><li><b>iPhone／iPad（Safari）</b>：「分享」→「加入主畫面」。</li><li><b>Android（Chrome）</b>：右上角「⋮」→「安裝應用程式」。</li></ul><div class="stack"><button type="button" class="btn" data-act="close">知道了</button></div>');
}
function pasteBox(title, act){ openModal('<h2>📥 ' + title + '</h2><p class="small">把 AI 回的 JSON（大括號 { } 那一段）整段貼進來。</p><textarea id="pasteBox"></textarea><div class="stack"><button type="button" class="btn" data-act="' + act + '">讀取</button><button type="button" class="btn alt" data-act="close">取消</button></div>'); }

var ACT = {
  close:closeModal, warn:showWarn, settings:openSettings, install:install,
  foldall:function(){ var ds = document.querySelectorAll('.set-sec'), any = Array.prototype.some.call(ds, function(d){ return !d.open; }); ds.forEach(function(d){ d.open = any; }); saveFold(); },
  blank:function(){ openModal('<h2>從空白開始？</h2><p>目前填的講師資料與課程會清空（建議先下載備份）。</p><div class="stack"><button type="button" class="btn red" data-act="blankOk">清空重來</button><button type="button" class="btn alt" data-act="close">取消</button></div>'); },
  blankOk:function(){ closeModal(); var b = D.blank(); b.courses.push(D.blankCourse()); apply(b, '已清空，從講師基本資料開始填'); },
  backup:function(){ download(new Blob([JSON.stringify({app:'instructor-profile-catalog', v:1, saved:new Date().toISOString(), state:S}, null, 1)], {type:'application/json'}), safeName(S.p.name) + '_講師資料備份.json'); toast('已下載備份'); },
  delPhoto:function(){ S.p.photo = ''; save(); renderPanel(); soon(); },
  addCourse:function(){ if(S.courses.length >= 30){ toast('最多 30 門課'); return; } S.courses.push(D.blankCourse()); CUR = S.courses.length - 1; lsSet('cur', String(CUR)); save(); renderPanel(); soon(); var e = document.querySelector('[data-cb="name"]'); if(e) e.focus(); },
  dupCourse:function(){ var c = curCourse(); if(!c || S.courses.length >= 30) return; var n = D.clone(c); n.name = (n.name || '課程') + '（副本）'; S.courses.splice(CUR + 1, 0, n); CUR++; lsSet('cur', String(CUR)); save(); renderPanel(); soon(); },
  print:doPrint,
  word:function(){ download(wordDoc(), safeName(S.p.name) + '_講師資料表.doc'); toast('已下載 Word 檔（照片請在 Word 裡自行插入）'); },
  sheetCopy:function(){ copyText(D.sheetText(S, YEAR), '已複製講師資料表文字'); },
  md:function(){ download(new Blob([D.catalogMd(S, YEAR)], {type:'text/markdown;charset=utf-8'}), safeName(catTitle()) + '.md'); toast('已下載 Markdown'); },
  courseCopy:function(){ var c = curCourse(); if(c) copyText(D.courseMd(c).replace(/\*\*/g, '').replace(/^## /m, '').replace(/^\*(.*)\*$/m, '$1'), '已複製課程介紹文字'); },
  copyAll:function(){ copyText(allBiosText(), '已複製全部簡介版本'); },
  txt:function(){ download(new Blob(['﻿' + allBiosText()], {type:'text/plain;charset=utf-8'}), safeName(S.p.name) + '_講師簡介.txt'); toast('已下載 .txt'); },
  nocolor:function(){ S.look.color = ''; save(); renderBar(); renderPreview(); },
  aiBio:aiBio,
  aiBioCopy:function(){ copyText(AI.bioPrompt(S), '已複製提示詞，貼到 ChatGPT／Gemini／Claude，再把回覆貼回來'); },
  aiBioPaste:function(){ pasteBox('貼上 AI 改寫的簡介', 'aiBioPasteOk'); },
  aiBioPasteOk:function(){ try{ var r = D.sanitizeAi(AI.parseJson($('pasteBox').value)); if(!Object.keys(r).length) throw new Error('找不到 s／m／l／host 欄位'); AIB = r; lsSet('aiBios', JSON.stringify(AIB)); closeModal(); TAB = 'bio'; lsSet('tab', TAB); renderBar(); renderPreview(); renderPanel(); toast('已讀取 AI 版本'); }catch(e){ toast('讀不懂：' + e.message); } },
  aiBioClear:function(){ AIB = null; lsDel('aiBios'); renderPreview(); renderPanel(); },
  aiCourse:aiCourse,
  aiCourseCopy:function(){ if(!curCourse()) return; copyText(AI.coursePrompt(S, CUR), '已複製提示詞，把 AI 回覆貼回「貼上 AI 回覆」'); },
  aiCoursePaste:function(){ pasteBox('貼上 AI 寫的課程介紹', 'aiCoursePasteOk'); },
  aiCoursePasteOk:function(){ try{ var r = D.sanitizeCourseAi(AI.parseJson($('pasteBox').value)); closeModal(); applyCourseAi(r); }catch(e){ toast('讀不懂：' + e.message); } },
  aiClear:function(){ lsDel('ai'); closeModal(); openSettings('ai'); updateSums(); toast('已清除金鑰'); },
  wipeAll:function(){ openModal('<h2>🧹 清除全部資料？</h2><p>講師資料、照片、課程、AI 改寫結果與 AI 金鑰都會刪掉，不能復原。</p><div class="stack"><button type="button" class="btn red" data-act="wipeOk">確定清除</button><button type="button" class="btn alt" data-act="close">取消</button></div>'); },
  wipeOk:function(){ ['state', 'ai', 'aiBios', 'open', 'fold', 'cur', 'tab', 'voice'].forEach(lsDel); S = D.blank(); S.courses.push(D.blankCourse()); CUR = 0; AIB = null; OPEN = {basic:true}; closeModal(); save(); render(); toast('已清除'); }
};

document.addEventListener('click', function(e){
  var t = e.target.closest('[data-act],[data-ex],[data-tab],[data-voice],[data-theme],[data-cur],[data-mv],[data-delc],[data-copy],[data-fontsize]');
  if(!t || t.disabled) return;
  if(t.tagName === 'A' && t.getAttribute('href') === '#') e.preventDefault();
  var d = t.dataset;
  if(d.act && ACT[d.act]){ e.preventDefault(); ACT[d.act](); return; }
  if(d.ex){ loadExample(d.ex); return; }
  if(d.tab){ TAB = d.tab; lsSet('tab', TAB); renderBar(); renderPreview(); return; }
  if(d.voice){ VOICE = d.voice; lsSet('voice', VOICE); renderBar(); renderPreview(); return; }
  if(d.theme){ S.look.theme = d.theme; S.look.color = ''; save(); renderBar(); renderPreview(); return; }
  if(d.cur){ CUR = +d.cur; lsSet('cur', String(CUR)); renderPanel(); if(TAB === 'one'){ renderBar(); renderPreview(); } return; }
  if(d.mv){ var a = d.mv.split(':'), i = +a[0], j = i + (+a[1]); if(j < 0 || j >= S.courses.length) return; var x = S.courses[i]; S.courses[i] = S.courses[j]; S.courses[j] = x; CUR = j; lsSet('cur', String(CUR)); save(); renderPanel(); soon(); return; }
  if(d.delc){ var k = +d.delc, nm = S.courses[k] && S.courses[k].name; if(nm && !t.dataset.sure){ t.dataset.sure = '1'; t.textContent = '確定?'; t.style.width = 'auto'; t.style.padding = '0 .4rem'; t.style.color = 'var(--bad)'; setTimeout(function(){ if(t.isConnected){ delete t.dataset.sure; t.textContent = '✕'; t.style.cssText = ''; } }, 3000); return; } S.courses.splice(k, 1); CUR = Math.max(0, Math.min(CUR, S.courses.length - 1)); lsSet('cur', String(CUR)); save(); renderPanel(); soon(); toast('已刪除課程'); return; }
  if(d.copy){ var tx = BIOTXT[d.copy]; if(tx) copyText(tx, '已複製'); return; }
  if(d.fontsize){ lsSet('fs', d.fontsize); applyView(); openSettings(); return; }
});
document.addEventListener('input', function(e){
  var t = e.target;
  if(t.dataset.b){ setPath(t.dataset.b, t.type === 'checkbox' ? t.checked : t.value); save(); updateSums(); if(t.dataset.b === 'useRec'){ renderPanel(); } else if(t.dataset.b === 'records'){ var ps = $('perfStat'); if(ps) ps.innerHTML = perfStat(); } soon(); return; }
  if(t.dataset.cb){ var c = curCourse(); if(!c) return; c[t.dataset.cb] = t.type === 'checkbox' ? t.checked : t.value; save(); updateSums();
    if(t.dataset.cb === 'name'){ var it = document.querySelector('.citem.on .cname'); if(it) it.textContent = (CUR + 1) + '. ' + (t.value || '（未命名課程）'); }
    var w = D.courseCheck(c), ul = document.querySelector('.cwarn'); if(ul) ul.innerHTML = w.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join(''); soon(); return; }
  if(t.hasAttribute('data-color')){ S.look.color = t.value; save(); soon(); if(!document.querySelector('[data-act="nocolor"]')) renderBar(); return; }
  if(t.dataset.aicfg){ var g = AI.cfg(); g[t.dataset.aicfg] = t.value; if(t.dataset.aicfg === 'provider') g.model = ''; AI.saveCfg(g); updateSums(); if(t.dataset.aicfg === 'provider') openSettings('ai'); return; }
});
document.addEventListener('change', function(e){
  var t = e.target;
  if(t.hasAttribute('data-pick')){ CUR = +t.value; lsSet('cur', String(CUR)); renderPanel(); renderPreview(); return; }
  if(t.dataset.file === 'photo' && t.files && t.files[0]){ readImg(t.files[0], 600).then(function(u){ S.p.photo = u; save(); renderPanel(); soon(); }).catch(function(err){ toast(err.message); }); return; }
  if(t.dataset.file === 'backup' && t.files && t.files[0]){
    var fr = new FileReader();
    fr.onload = function(){ try{ var j = JSON.parse(fr.result); if(!j || !j.state || !j.state.p) throw new Error('不是這個工具的備份檔'); closeModal(); apply(j.state, '已讀取備份'); }catch(err){ toast('讀不懂：' + err.message); } };
    fr.readAsText(t.files[0]); t.value = '';
  }
});
document.addEventListener('toggle', function(e){ var d = e.target; if(d.classList && d.classList.contains('card')){ OPEN[d.dataset.card] = d.open; lsSet('open', JSON.stringify(OPEN)); } }, true);
$('modal').addEventListener('click', function(e){ if(e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && $('modal').classList.contains('show')) closeModal(); });
window.addEventListener('resize', function(){ clearTimeout(rT); rT = setTimeout(function(){ if(TAB !== 'bio'){ zoom(); } }, 150); });
window.addEventListener('afterprint', function(){ $('printArea').innerHTML = ''; });

/* ---------- 跑馬燈（工作區共用公告，不可關） ---------- */
function initMarquee(){
  var URL_ = "https://script.google.com/macros/s/AKfycbwKX0DNNbY8y4nf90BFTHtxgfqJcHHcZasRrgycl4QAe52_hkjMWSkYk4xOsqU-JPCROw/exec";
  var REFRESH = 20 * 60 * 1000, bar = $('marqueeBar'), track = $('marqueeTrack'), lastKey = null;
  function appendText(c, text){ var re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, li = 0, m; while((m = re.exec(text))){ if(m.index > li) c.appendChild(document.createTextNode(text.slice(li, m.index))); var a = document.createElement('a'); a.href = m[2]; a.textContent = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = 'inherit'; a.style.textDecoration = 'underline'; c.appendChild(a); li = re.lastIndex; } if(li < text.length) c.appendChild(document.createTextNode(text.slice(li))); }
  function renderM(items){
    if(!items || !items.length) return;
    var k = JSON.stringify(items); if(k === lastKey) return; lastKey = k; track.innerHTML = '';
    var fr = document.createDocumentFragment();
    function pass(){ items.forEach(function(it, i){ if(i > 0) fr.appendChild(document.createTextNode('　★　')); appendText(fr, String(it)); }); }
    pass(); fr.appendChild(document.createTextNode('　★　')); pass(); track.appendChild(fr);
    bar.classList.add('show'); document.body.classList.add('has-marquee');
    track.style.animationDuration = Math.max(track.scrollWidth / 2 / 60, 12) + 's';
  }
  function fetchM(){ fetch(URL_, {method:'POST', body:JSON.stringify({serial:''})}).then(function(r){ return r.json(); }).then(function(d){ if(d && Array.isArray(d.marquee) && d.marquee.length){ lsSet('marquee', JSON.stringify(d.marquee)); renderM(d.marquee); } }).catch(function(){}); }
  renderM(lsJson('marquee', [])); fetchM(); setInterval(fetchM, REFRESH);
}

window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window._dp = e; });
if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(function(){});

applyView();
if(firstRun){ S = D.normalize(D.clone(D.EXAMPLES[0].st)); save(); }
if(!S.courses.length){ S.courses.push(D.blankCourse()); }
if(TABS.every(function(t){ return t[0] !== TAB; })) TAB = 'bio';
render(); initMarquee();
if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if(TAB !== 'bio') renderPreview(); });
if(!lsGet('warnSeen')){ showWarn(); lsSet('warnSeen', '1'); }
window._ipc = {get S(){ return S; }, get OVER(){ return OVER; }, get TAB(){ return TAB; }, ACT:ACT, loadExample:loadExample, renderPreview:renderPreview, pagesFor:pagesFor, wordDoc:wordDoc, allBiosText:allBiosText};
})();
