# 端對端測試：先開 8893（或設 IPC_BASE 測線上版），python tools/e2e_ipc.py [輸出資料夾]
import asyncio, io, json, os, sys, tempfile
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
from playwright.async_api import async_playwright

BASE = os.environ.get('IPC_BASE', 'http://localhost:8893/').rstrip('/') + '/'
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
os.makedirs(OUT, exist_ok=True)
R = []
def ok(c, m):
    R.append(bool(c)); print(('✓ ' if c else '✗ ') + m)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1400, 'height': 1000}, accept_downloads=True)
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'visitor-badge' not in m.text and 'script.google' not in m.text else None)
        await pg.goto(BASE + 'index.html'); await pg.wait_for_timeout(1200)

        ok(await pg.is_visible('#modal.show') and '使用警語' in await pg.inner_text('#modalBox'), '首訪跳出使用警語')
        await pg.click('[data-act="close"]')
        await pg.reload(); await pg.wait_for_timeout(800)
        ok(not await pg.is_visible('#modal.show'), '第二次不再跳警語')
        foot = await pg.inner_html('.foot2')
        ok(all(k in foot for k in ['manual.html', '#creator', 'data-act="warn"', 'visitor-badge', 'tsaimark@gmail.com']), '頁尾五件套入口')
        ok('林雅文' in await pg.inner_text('#pvBody'), '首訪載入範例')

        # 簡介
        cards = await pg.query_selector_all('.bio')
        ok(len(cards) == 4, '簡介 4 張卡（短中長＋主持稿）')
        await pg.click('[data-voice="first"]'); await pg.wait_for_timeout(200)
        ok((await pg.inner_text('.bio .txt')).startswith('我是'), '第一人稱切換')
        await pg.click('[data-voice="formal"]')
        async with pg.expect_download() as d: await pg.click('[data-act="txt"]')
        f = await (await d.value).path(); t = open(f, encoding='utf-8-sig').read()
        ok('【短版】' in t and '【主持人介紹稿】' in t, '下載 .txt')

        # 講師資料表
        await pg.click('[data-tab="sheet"]'); await pg.wait_for_timeout(500)
        ok(await pg.query_selector('.pg.sheet .stab') is not None, '講師資料表頁')
        async with pg.expect_download() as d: await pg.click('[data-act="word"]')
        dl = await d.value; f = await dl.path(); t = open(f, encoding='utf-8-sig').read()
        ok(dl.suggested_filename.endswith('.doc') and '講師資料表' in t and 'Google Analytics' in t, 'Word 檔內容')

        # 型錄
        await pg.click('[data-tab="cat"]'); await pg.wait_for_timeout(900)
        n = len(await pg.query_selector_all('.zoomer .pg'))
        ok(n == 6, f'型錄 6 頁（封面＋講師＋3 課＋邀課），實得 {n}')
        ok(await pg.evaluate('window._ipc.OVER.length') == 0, '範例每頁都放得下')
        await pg.wait_for_timeout(1500)
        ok(await pg.query_selector('.cover img.qr') is not None, '封面 QR code')
        async with pg.expect_download() as d: await pg.click('[data-act="md"]')
        t = open(await (await d.value).path(), encoding='utf-8').read()
        ok(t.startswith('# ') and '短影音企劃與手機剪輯' in t, '下載 Markdown')
        for th in ['fresh', 'bold']:
            await pg.click(f'[data-theme="{th}"]'); await pg.wait_for_timeout(400)
            ok(await pg.query_selector(f'.pg.t-{th}') is not None and await pg.evaluate('window._ipc.OVER.length') == 0, f'{th} 主題不爆框')
        await pg.click('[data-theme="classic"]'); await pg.wait_for_timeout(400)
        await pg.evaluate("document.getElementById('printArea').innerHTML=document.querySelector('.zoomer').innerHTML")
        await pg.emulate_media(media='print')
        pdf = os.path.join(OUT, 'catalog.pdf'); await pg.pdf(path=pdf, format='A4', print_background=True)
        await pg.emulate_media(media='screen')
        try:
            import fitz
            dd = fitz.open(pdf); ok(len(dd) == 6, f'PDF 6 頁，實得 {len(dd)}')
            for i in range(len(dd)): dd[i].get_pixmap(dpi=50).save(os.path.join(OUT, f'pdf{i}.png'))
        except ImportError:
            ok(os.path.getsize(pdf) > 10000, 'PDF 產生')

        # 爆框提醒
        await pg.evaluate("(()=>{const s=window._ipc.S;s.courses[0].outline=Array.from({length:40},(_, i)=>'很長很長的單元名稱第'+i+'單元｜1').join('\\n');window._ipc.renderPreview();})()")
        await pg.wait_for_timeout(400)
        ok(3 in await pg.evaluate('window._ipc.OVER') and '放不下' in await pg.inner_text('#fitMsg'), '內容太多會標紅框提醒')
        await pg.evaluate("window._ipc.loadExample('mkt')"); await pg.wait_for_timeout(300)

        # 課程編輯
        await pg.click('[data-card="course"] > summary')
        await pg.click('[data-act="addCourse"]'); await pg.wait_for_timeout(200)
        await pg.fill('[data-cb="name"]', '測試新課程')
        await pg.fill('[data-cb="hours"]', '6')
        await pg.fill('[data-cb="outline"]', '第一單元｜2\n第二單元｜2')
        await pg.wait_for_timeout(300)
        ok('不一致' in await pg.inner_text('.cwarn'), '時數不一致提醒')
        ok('測試新課程' in await pg.inner_text('.citem.on'), '課程清單即時更新名稱')
        await pg.click('[data-tab="one"]'); await pg.wait_for_timeout(500)
        ok('測試新課程' in await pg.inner_text('.zoomer'), '單一課程頁顯示目前課程')
        await pg.click('.citem.on [data-delc]'); await pg.click('.citem.on [data-delc]'); await pg.wait_for_timeout(200)
        ok(len(await pg.query_selector_all('.citem')) == 3, '刪除課程（按兩次）')

        # 授課紀錄
        await pg.evaluate("window._ipc.loadExample('food')"); await pg.wait_for_timeout(300)
        await pg.click('[data-card="perf"] > summary')
        ok('7' in await pg.inner_text('#perfStat') and '226' in await pg.inner_text('#perfStat'), '授課紀錄統計 7 場 226 人次')
        await pg.click('[data-tab="bio"]'); await pg.wait_for_timeout(300)
        ok('33 小時' in await pg.inner_text('#pvBody'), '簡介用紀錄算出的時數')

        # AI 貼上回覆與數字檢查
        await pg.click('[data-card="ai"] > summary')
        await pg.click('[data-act="aiBioPaste"]')
        await pg.fill('#pasteBox', json.dumps({'s': '陳志明顧問，累計授課 33 小時。', 'm': '陳志明顧問擁有 25 年經驗，累計授課 9999 小時。', 'l': '完整版', 'host': '主持稿'}, ensure_ascii=False))
        await pg.click('[data-act="aiBioPasteOk"]'); await pg.wait_for_timeout(300)
        txt = await pg.inner_text('#pvBody')
        ok('AI 中版' in txt and '9999' in txt and '資料裡沒有的數字' in txt, 'AI 版本顯示並標出資料外數字')
        notes = await pg.query_selector_all('.bio.ai .note')
        ok(len(notes) == 1, 'AI 短版（數字正確）不誤報')

        # 備份還原
        async with pg.expect_download() as d: await pg.click('[data-act="backup"]')
        bk = await (await d.value).path()
        await pg.evaluate("window._ipc.loadExample('comm')"); await pg.wait_for_timeout(200)
        await pg.click('[data-card="ex"] > summary') if not await pg.is_visible('[data-file="backup"] >> xpath=..') else None
        await pg.set_input_files('.panel [data-file="backup"]', bk); await pg.wait_for_timeout(400)
        ok(await pg.evaluate('window._ipc.S.p.name') == '陳志明', '讀取備份還原')

        # ⚙ 設定
        await pg.click('[data-act="settings"]')
        st = await pg.inner_text('#modalBox')
        ok(all(k in st for k in ['顯示', 'AI 設定', '備份與還原', '清除全部資料', '關於本工具']), '⚙ 收合區塊齊全')
        ok(await pg.evaluate("document.querySelectorAll('.set-sec[open]').length") == 0, '⚙ 預設收合')
        await pg.click('[data-act="close"]')

        # 手機寬度
        await pg.set_viewport_size({'width': 375, 'height': 800}); await pg.click('[data-tab="cat"]'); await pg.wait_for_timeout(600)
        ok(await pg.evaluate('document.documentElement.scrollWidth') <= 375, '375px 無橫向捲動')
        await pg.screenshot(path=os.path.join(OUT, 'mobile.png'))
        ok(not errs, '無 console 錯誤 ' + '; '.join(errs[:3]))
        await b.close()
    print(f'\n{sum(R)}/{len(R)} 通過，輸出在 {OUT}')
    sys.exit(0 if all(R) else 1)

asyncio.run(main())
