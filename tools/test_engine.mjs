// 引擎測試：node tools/test_engine.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const D = require('../data.js');
let pass = 0, fail = 0;
function ok(c, msg){ if(c) pass++; else { fail++; console.log('✗ ' + msg); } }
const Y = 2026;

// 概數不灌水
ok(D.nice(1234) === '超過 1,200', 'nice 1234');
ok(D.nice(1200) === '1,200', 'nice 1200 照寫');
ok(D.nice(95) === '95', 'nice 95');
ok(D.nice(12345) === '超過 12,000', 'nice 12345');
ok(D.nice('') === '', 'nice 空');
ok(D.joinList(['a', 'b', 'c']) === 'a、b及c', 'joinList');
ok(D.joinList(['a', 'b', 'c'], 2, true) === 'a、b等', 'joinList 等');

// 授課紀錄
const rec = D.parseRecords('日期,單位,課程,時數,人數\n2025/3/5,甲單位,A,3,30\n114/4/1\t乙單位\tB\t6\t20\n亂打一行\n"2025-05-01","丙, 協會",C,2,10\n2024年6月,甲單位,D,1.5,');
ok(rec.rows.length === 4, '紀錄讀到 4 筆，實得 ' + rec.rows.length);
ok(rec.bad.length === 1 && rec.bad[0] === 4, '壞行是第 4 行');
ok(rec.rows[1].y === 2025, '民國 114 → 2025');
ok(rec.rows[2].unit === '丙, 協會', 'CSV 引號內逗號');
const rs = D.recStats(rec.rows);
ok(rs.hours === 12.5 && rs.people === 60 && rs.units === 3 && rs.sessions === 4, '紀錄統計 ' + JSON.stringify(rs));
ok(rs.first === 2024 && rs.top[0] === '乙單位', '最早年份與時數最多單位');

// 大綱與時數
const c = D.blankCourse();
c.outline = '開場｜0.5\n實作 2 小時\n討論, 1\n沒有時數的單元';
ok(D.outline(c).length === 4 && D.outlineHours(c) === 3.5, '大綱時數合計 ' + D.outlineHours(c));
c.hours = '6'; ok(D.courseCheck(c).some(w => /不一致/.test(w)), '時數不一致提醒');
c.hours = '3.5'; ok(!D.courseCheck(c).some(w => /不一致/.test(w)), '時數一致不提醒');
c.hours = '3 / 6 / 12'; ok(D.hoursText(c) === '3／6／12 小時', '多方案時數 ' + D.hoursText(c));
c.hours = ''; ok(D.hoursText(c) === '3.5 小時', '沒填時數用大綱合計');

// 範例 × 長度 × 口吻
const combos = [['third', 'formal'], ['third', 'warm'], ['first', 'warm'], ['third', 'host']];
for(const e of D.EXAMPLES){
  ok(D.normalize(e.st).courses.length === e.st.courses.length, e.id + ' normalize 保留課程');
  for(const len of ['s', 'm', 'l']) for(const [voice, tone] of combos){
    const t = D.bio(e.st, {len, voice, tone}, Y), tag = `${e.id}/${len}/${voice}/${tone}`;
    ok(t.length > 10, tag + ' 有內容');
    ok(D.len(t.replace(/\n/g, '')) <= D.LIMITS[len], tag + ' 長度 ' + D.len(t) + ' 超過上限');
    ok(t.indexOf(e.st.p.name) >= 0, tag + ' 有姓名');
    ok(!/undefined|NaN|null|。。|，。|、、|\s。/.test(t), tag + ' 有怪字串：' + t);
    ok(D.unknownNumbers(t, e.st, Y).length === 0, tag + ' 規則簡介出現資料外數字 ' + D.unknownNumbers(t, e.st, Y));
    if(tone === 'host') ok(/掌聲/.test(t), tag + ' 主持稿要有掌聲');
    if(voice === 'first') ok(/^我是/.test(t), tag + ' 第一人稱開頭');
  }
  const h = D.bio(e.st, {len:'m', voice:'third', tone:'host', max:200}, Y);
  ok(D.len(h) <= 200 && /掌聲/.test(h), e.id + ' 主持稿 200 字內');
  const rows = D.sheetRows(e.st, Y);
  ok(rows.length === 11 && rows[0][1] === e.st.p.name, e.id + ' 講師資料表');
  const md = D.catalogMd(e.st, Y);
  e.st.courses.forEach(x => ok(md.indexOf(x.name) >= 0, e.id + ' Markdown 有課程 ' + x.name));
  e.st.courses.forEach(x => ok(!D.courseCheck(x).some(w => /不一致|名稱/.test(w)), e.id + ' 範例課程檢查 ' + x.name + ' ' + D.courseCheck(x)));
}
// 用紀錄算實績的範例
const food = D.EXAMPLES.find(e => e.id === 'food').st;
const fs = D.stats(food, Y);
ok(fs.fromRec && fs.sessions === 7 && fs.hours === 33 && fs.people === 226, '餐飲範例紀錄統計 ' + JSON.stringify(fs));
ok(fs.years === 2, '紀錄推年資');

// 空白資料不會壞
const b = D.blank();
for(const len of ['s', 'm', 'l']) ok(typeof D.bio(b, {len}, Y) === 'string', '空白 ' + len);
ok(D.catalogMd(b, Y).length > 0, '空白 Markdown');

// AI 清理與數字檢查
const ai = D.sanitizeAi({s:'<b>你好</b>', m:123, l:'x'.repeat(900), host:'  '});
ok(ai.s === '你好' && !('m' in ai) && D.len(ai.l) === 600 && !('host' in ai), 'sanitizeAi');
const cai = D.sanitizeCourseAi({intro:'介紹', goals:'- 能A\n- 能B', feats:['特色'], who:5});
ok(cai.goals.length === 2 && cai.goals[0] === '能A' && cai.who === '5', 'sanitizeCourseAi');
const mkt = D.EXAMPLES[0].st;
ok(D.unknownNumbers('累計授課 1,280 小時、超過 1,200 小時、10 年', mkt, Y).length === 0, '資料內數字不報');
ok(D.unknownNumbers('累計授課 5,000 小時，學員 99 人', mkt, Y).join() === '5000,99', '資料外數字要報');
ok(D.normalize('亂七八糟').p.name === '' && D.normalize({look:{theme:'x'}}).look.theme === 'classic', 'normalize 防呆');

console.log(`通過 ${pass}，失敗 ${fail}`);
process.exit(fail ? 1 : 0);
