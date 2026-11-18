# instructor-profile-catalog — 講師簡介與課程型錄產生器

給講師、顧問、業師用：講師資料與可授課程填一次 → 講師簡介（短 70／中 180／完整 400 字上限 × 第三人稱正式／親切／第一人稱）、🎤 主持人介紹稿（200 字內）、講師資料表（A4 列印＋下載 Word .doc）、A4 課程型錄（封面＋講師頁＋每門課一頁＋邀課資訊頁，列印／存 PDF、Markdown）、單一課程頁（附講師小簡介）。

2026-11-18 建立。使用者從「講師方向」清單挑了第 14 項，規格由 Claude 決定；沒有說六件套 → **無登入序號**。**尚未上線**（實驗性新工具，部署前先問使用者）。本機 port **8893**（`.claude/launch.json` 的 `instructor-profile-catalog`、程式牆 `LOCAL_APPS`）。

## 檔案
- `data.js`：純函式引擎（`window.IPC`，node 可 require）。`bio(st, {len, voice, tone, max}, nowYear)` 用句型組簡介：每段 `[優先序, 文字, 段落]`，超過 `LIMITS` 從優先序低的拿掉（9 不拿），長版依段落 0/1/2/3 分段。`nice()` 概數不灌水（1,280→「超過 1,200」、1,200 照寫）。`parseRecords`（日期、單位、課程、時數、人數；Tab／逗號／CSV 引號；民國年＋1911；第一行標題略過）→`recStats`；`stats()` 勾 `useRec` 時用紀錄覆蓋時數場次人次、授課單位依時數排序併入。`outline()` 解析「單元｜時數」、`courseCheck` 時數不一致提醒。`sheetRows`（11 列）、`catalogMd`、`sanitizeAi`／`sanitizeCourseAi`、**`unknownNumbers(text, st)`：找出 AI 文字中資料沒有的數字（>9）**。3 個虛構範例（mkt／food 用授課紀錄／comm）。
- `ai.js`：BYOK 7 家，`callLLM` 複製自 course-poster-maker（源頭開店前置清單）。`bioPrompt`（s/m/l/host JSON）、`coursePrompt`（intro/goals/feats/who）；規則禁止新增經歷與數字。金鑰 `ipc.ai`。
- `app.js`：畫面。localStorage `ipc.` 前綴：`state`（含照片 dataURL，縮到 600px JPG）、`tab`、`voice`、`cur`、`open`、`aiBios`、`ai`、`fs`、`fold`、`warnSeen`、`marquee`。輸入綁定 `data-b="p.name"`、課程欄位 `data-cb`。A4 頁是 HTML（不是 canvas）：`page()` 套主題 CSS 變數，`fit()` 把 `--k` 從 1 每次降 0.04 到 0.77，還放不下加 `.over` 紅框；預覽用 CSS `zoom` 縮放；列印把 `.zoomer` innerHTML 複製到 `#printArea`。QR 用 cdnjs qrcodejs 1.0.0（只有填網站才產生）。測試掛鉤 `window._ipc`。
- 主題 `THEMES`：classic（米白＋深藍＋金）、fresh（白＋綠）、bold（白＋橘色塊；課程標題色塊**不能用負邊界**，`.pgin` overflow:hidden 會裁掉）。
- 畫面風格：深藍履歷夾＋米白紙卡＋金色線、標題襯線字（Noto Serif TC），刻意和課程招生海報產生器的綠色切割墊不同。

## 驗證
- 改 `data.js` 跑 `node tools/test_engine.mjs`（248 項：3 範例 × 3 長度 × 4 口吻不超長、有姓名、無怪標點、**規則簡介不得出現資料外數字**、紀錄解析、時數合計、AI 清理）。
- `python tools/e2e_ipc.py [輸出資料夾]`（先開 8893；線上版設 `IPC_BASE`）：警語首訪、五件套入口、簡介 4 卡與口吻、.txt、Word、型錄 6 頁＋QR＋Markdown、三主題不爆框、`page.pdf()` 6 頁、爆框紅框提醒、課程新增／時數提醒／刪除、授課紀錄統計、AI 貼上回覆標出資料外數字、備份還原、⚙ 收合、375px 無橫捲、無 console 錯誤。2026-11-18 全過（30 項），PDF 與三主題截圖目視過。
- 實體印表機、Word 實際開啟 .doc、真實 AI 金鑰呼叫未實測。

## 標準配備
跑馬燈（工作區公告 GAS，不可關）、⚙ 常用設定（收合：顯示、🤖 AI 設定、💾 備份與還原、清除全部資料、關於本工具）、首訪警語＋頁面入口、`manual.html#creator`（改 `tools/manual_body.html` 後跑 `python tools/build_manual.py`）、PWA（`tools/make_icons.py`；上線改版升 `service-worker.js` 的 `CACHE_NAME`）、訪客計數器 `m255525.instructorprofilecatalog`。無序號、無浮水印。

## 上線時要做
`gh repo create`（先 push 再開 Pages，注意 `github-pages` 環境分支規則只允許 main 的坑）→ 程式牆從 `LOCAL_APPS` 移到 `REPO_META`（github-dashboard 一起補）→ AI 工具導航 `data.js` 的 `TOOLS` 加一行並放進情境 → 專案目錄.docx 更新。
