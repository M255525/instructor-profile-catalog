/* 講師簡介與課程型錄產生器：AI 潤飾（自備金鑰 BYOK，選用）。
 * 服務商與呼叫方式複製自 行銷內容工具/course-poster-maker/ai.js（源頭是開店前置清單 ai.js）。
 * AI 只能改寫使用者填的事實：不可新增經歷、證照、數字；回傳後用 IPC.unknownNumbers 標出資料裡沒有的數字。
 * 金鑰只存在這台瀏覽器（localStorage ipc.ai）。沒有金鑰可以「複製提示詞」貼到任何 AI，再把回覆貼回來。 */
(function(){
'use strict';
var D = window.IPC;
var A = {lsJson:function(k, d){ try{ var v = JSON.parse(localStorage.getItem('ipc.' + k)); return v == null ? d : v; }catch(e){ return d; } }};
function geminiModelFix(m){ var r = {'gemini-2.5-flash':'gemini-3.6-flash', 'gemini-2.5-flash-lite':'gemini-3.5-flash-lite', 'gemini-2.5-pro':'gemini-3.8-flash', 'gemini-2.0-flash':'gemini-3.6-flash', 'gemini-2.0-flash-001':'gemini-3.6-flash', 'gemini-2.0-flash-lite':'gemini-3.1-flash-lite', 'gemini-1.5-flash':'gemini-3.6-flash', 'gemini-1.5-pro':'gemini-3.1-pro-preview', 'gemini-3-pro':'gemini-3.1-pro-preview', 'gemini-3-pro-preview':'gemini-3.1-pro-preview', 'gemini-3.5-pro':'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview':'gemini-3.1-flash-lite'}; m = String(m || '').trim().replace(/^models\//, ''); return r[m] || m; }
var PROVIDERS = {
  gemini: {label:'Gemini（Google AI Studio）', vision:true, models:[['gemini-3.5-flash', 'Gemini 3.5 Flash（均衡，推薦）'], ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro 預覽版（最強）'], ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite（快速省錢）']]},
  openai: {label:'OpenAI', vision:true, url:'https://api.openai.com/v1/chat/completions', models:[['gpt-5-mini', 'GPT-5 mini（均衡，推薦）'], ['gpt-5', 'GPT-5（最強）'], ['gpt-4o-mini', 'GPT-4o mini（快速省錢）']]},
  claude: {label:'Claude（Anthropic）', vision:true, models:[['claude-sonnet-5-5', 'Claude Sonnet 5.5（均衡，推薦）'], ['claude-opus-5-5', 'Claude Opus 5.5（最強）'], ['claude-haiku-5-5', 'Claude Haiku 5.5（快速省錢）']]},
  openrouter: {label:'OpenRouter', vision:true, url:'https://openrouter.ai/api/v1/chat/completions', models:[['openai/gpt-4o-mini', 'OpenAI GPT-4o mini（推薦）'], ['google/gemini-2.5-flash', 'Google Gemini 2.5 Flash'], ['anthropic/claude-sonnet-4.5', 'Anthropic Claude Sonnet 4.5']]},
  xai: {label:'xAI Grok', vision:true, url:'https://api.x.ai/v1/chat/completions', models:[['grok-4', 'Grok 4'], ['grok-3-mini', 'Grok 3 mini（不支援看圖）']]},
  deepseek: {label:'DeepSeek（只支援文字）', vision:false, url:'https://api.deepseek.com/chat/completions', models:[['deepseek-chat', 'DeepSeek Chat（推薦）'], ['deepseek-reasoner', 'DeepSeek Reasoner（推理）']]},
  custom: {label:'自訂（OpenAI 相容端點，例如 Ollama、LM Studio）', vision:true, models:[]}
};
function cfg(){ var c = A.lsJson('ai', {}); if(!PROVIDERS[c.provider]) c.provider = 'gemini'; return c; }
function aiModel(c){ c = c || cfg(); return (c.modelCustom || '').trim() || c.model || ((PROVIDERS[c.provider].models[0]) || [''])[0]; }
function customUrl(base){ base = (base || '').trim().replace(/\/+$/, ''); return /\/chat\/completions$/.test(base) ? base : base + '/chat/completions'; }
function ready(){ var c = cfg(); return c.provider === 'custom' ? !!(c.base || '').trim() && !!aiModel(c) : !!c.key; }
function status(){ var c = cfg(); return ready() ? PROVIDERS[c.provider].label.replace(/（.*/, '') + '・' + aiModel(c) : '未設定'; }

async function callLLM(prompt, images, wantJson, onStatus){
  var c = cfg(), provider = c.provider, model = aiModel(c), key = c.key, url, headers, body, extract;
  images = PROVIDERS[provider].vision === false ? [] : (images || []);
  if(provider === 'claude'){
    url = 'https://api.anthropic.com/v1/messages';
    headers = {'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true'};
    var content = images.map(function(im){ return {type:'image', source:{type:'base64', media_type:im.mime, data:im.b64}}; });
    content.push({type:'text', text:prompt});
    body = {model:model, max_tokens:4000, messages:[{role:'user', content:content}]};
    extract = function(d){ return (d.content || []).filter(function(b){ return b.type === 'text'; }).map(function(b){ return b.text; }).join(''); };
  } else if(provider !== 'gemini'){
    url = provider === 'custom' ? customUrl(c.base) : PROVIDERS[provider].url;
    headers = {'content-type':'application/json'};
    if(key) headers.authorization = 'Bearer ' + key;
    var msg = images.length ? [{type:'text', text:prompt}].concat(images.map(function(im){ return {type:'image_url', image_url:{url:im.dataUrl}}; })) : prompt;
    body = {model:model, messages:[{role:'user', content:msg}]};
    extract = function(d){ return d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content; };
  } else {
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(geminiModelFix(model)) + ':generateContent';
    headers = {'content-type':'application/json', 'x-goog-api-key':key};
    var parts = images.map(function(im){ return {inline_data:{mime_type:im.mime, data:im.b64}}; });
    parts.push({text:prompt});
    body = {contents:[{parts:parts}]};
    if(wantJson) body.generationConfig = {responseMimeType:'application/json'};
    extract = function(d){ var ps = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []; return ps.map(function(p){ return p.text || ''; }).join(''); };
  }
  for(var attempt = 1; attempt <= 3; attempt++){
    var resp = await fetch(url, {method:'POST', headers:headers, body:JSON.stringify(body), signal:AbortSignal.timeout(150000)});
    var raw = await resp.text();
    if(resp.ok){ var t = extract(JSON.parse(raw)); if(!t) throw new Error('回應中沒有文字內容'); return t; }
    var em = raw.slice(0, 200);
    try{ var e = JSON.parse(raw); em = (e.error && e.error.message) || e.message || em; }catch(x){}
    if({429:1, 500:1, 503:1, 529:1}[resp.status] && attempt < 3){ if(onStatus) onStatus('服務忙碌（' + resp.status + '），' + attempt * 6 + ' 秒後重試…'); await new Promise(function(r){ setTimeout(r, attempt * 6000); }); continue; }
    throw new Error('HTTP ' + resp.status + '：' + em);
  }
}
function parseJson(txt){ var s = txt.indexOf('{'), e = txt.lastIndexOf('}'); if(s < 0 || e < s) throw new Error('AI 回傳的不是 JSON'); return JSON.parse(txt.slice(s, e + 1)); }
function saveCfg(c){ try{ localStorage.setItem('ipc.ai', JSON.stringify(c)); }catch(e){} }


function profileFacts(st){
  var y = new Date().getFullYear(), r = [];
  D.sheetRows(st, y).forEach(function(x){ if(x[1] && x[0] !== '可授課程' && x[0] !== '聯絡方式') r.push(x[0] + '：' + x[1].replace(/\n/g, '；')); });
  var p = st.p;
  if(p.honor && p.honor !== '（不加）') r.push('稱謂：' + p.honor);
  if(p.slogan) r.push('教學理念：' + p.slogan);
  if(p.style) r.push('教學風格：' + p.style);
  var cs = st.courses.filter(function(c){ return c.name; }).map(function(c){ return c.name; });
  if(cs.length) r.push('主要課程：' + cs.join('、'));
  return r.join('\n');
}
var RULES = '1. 一律使用繁體中文（台灣用語），自然、具體，不要浮誇（不可寫「頂尖」「第一」「權威」「保證」這類無法證明的形容）。\n' +
  '2. 只能使用下方資料裡的事實。不可新增資料沒寫的經歷、學歷、證照、獎項、單位名稱或任何數字；年資、時數、人次要和資料完全一致。\n' +
  '3. 不要用條列，寫成通順的段落；不要加 emoji、不要加標題。\n';
function bioPrompt(st){
  return '你是台灣的講師經紀與文案顧問，請把下方講師資料改寫成四個版本的講師簡介。請遵守：\n' + RULES +
    '4. s＝短版 50 字以內（報名表、名牌用）；m＝中版約 150 字（招生文宣）；l＝完整版約 300 字，可分 2～3 段（計畫書、官網）；host＝主持人上台念的介紹稿約 150 字，口語、最後一句請大家掌聲歡迎。s、m、l 用第三人稱。\n' +
    '5. 只輸出 JSON，格式：{"s":"","m":"","l":"","host":""}\n\n【講師資料】\n' + profileFacts(st);
}
function coursePrompt(st, i){
  var c = st.courses[i] || {}, r = [];
  r.push('課程名稱：' + (c.name || '（未填）'));
  if(c.cat) r.push('類別：' + c.cat);
  var h = D.hoursText(c); if(h) r.push('時數：' + h);
  if(c.who) r.push('目前寫的適合對象：' + c.who);
  if(c.intro) r.push('目前的課程簡介：' + c.intro);
  var g = D.lines(c.goals); if(g.length) r.push('目前的學習目標：' + g.join('；'));
  var o = D.outline(c); if(o.length) r.push('課程大綱：' + o.map(function(x){ return x.t + (x.h ? '（' + x.h + '小時）' : ''); }).join('；'));
  var f = D.lines(c.feats); if(f.length) r.push('目前的課程特色：' + f.join('；'));
  if(c.method) r.push('教學方式：' + c.method);
  return '你是台灣的課程設計顧問，請幫這門課寫課程型錄用的介紹文字。請遵守：\n' + RULES.replace('3. 不要用條列，寫成通順的段落；', '3. ') +
    '4. intro＝課程簡介 80～120 字，說清楚學員上完能做到什麼；goals＝學習目標 3～4 條，每條用「能…」開頭、30 字以內；feats＝課程特色 2～4 條，每條 25 字以內；who＝適合對象 40 字以內。不要寫費用、證書、補助。\n' +
    '5. 只輸出 JSON，格式：{"intro":"","goals":["",""],"feats":["",""],"who":""}\n\n【課程資料】\n' + r.join('\n') + '\n\n【講師】' + (st.p.name || '') + (D.lines(st.p.fields).length ? '，專長：' + D.lines(st.p.fields).join('、') : '');
}
async function bios(st, onStatus){ return D.sanitizeAi(parseJson(await callLLM(bioPrompt(st), null, true, onStatus))); }
async function course(st, i, onStatus){ return D.sanitizeCourseAi(parseJson(await callLLM(coursePrompt(st, i), null, true, onStatus))); }

window.IPCAI = {PROVIDERS:PROVIDERS, cfg:cfg, saveCfg:saveCfg, aiModel:aiModel, ready:ready, status:status, bioPrompt:bioPrompt, coursePrompt:coursePrompt, bios:bios, course:course, parseJson:parseJson};
})();
