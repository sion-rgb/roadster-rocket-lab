# 驗證及交付記錄

驗證日期：2026-10-19（香港）。本專案為非官方概念模擬器；所有飛行參數皆屬虛構設定。

## 結果

已完成可玩的 MVP，先在真正 Chrome / WebGL2 瀏覽器通過道路加速、三視角、起飛及降落，再進行材質、環境、手機 LOD、陰影及深度精度調整。最終正式 build 的 17 項瀏覽器測試通過，頁面錯誤及 HTTP 資源錯誤皆為 0。另有 12 項真實 Rapier WASM 物理檢查通過。

GitHub [公開儲存庫](https://github.com/sion-rgb/roadster-rocket-lab) 的 visibility 已透過 API 確認為 PUBLIC。[Pages 線上版本](https://sion-rgb.github.io/roadster-rocket-lab/) HTTP 200，源碼 commit `52b5d2c5063154baf37eae2287f36c932c3d1409` 的 [Actions 測試、建置及部署](https://github.com/sion-rgb/roadster-rocket-lab/actions/runs/39187605556) 全部成功。

部署後再以 Chrome 真實操作網站，通過 7 項線上檢查：GLB / Draco 載入、W 駕駛、起飛按鈕、三視角、輔助降落、不完整 Gamepad 資料不產生 NaN、一般入口不暴露 QA hooks。頁面及 HTTP 資源錯誤均為 0。[公開站點驗證 JSON](public-live.json) / [畫面](captures/public-live.png)。文件與證據後續提交不改動應用程式碼。

- [瀏覽器完整 JSON](browser-report.json)
- [操作錄影](motion/desktop-playthrough.webm)
- [核心物理測試](../tests/physics.ts)
- [瀏覽器重現腳本](../tests/browser.mjs)
- [當次截圖覆蓋清單](evidence.json)

錄影為 1440×960 WebM，44.36 秒；Chrome 本地媒體播放可解碼並前進，沒有 MediaError。此處沒有聲稱 FFmpeg 全段解碼檢查。

## 真實輸入驗證

Chrome 以 Playwright 真實鍵盤 / 滑鼠操作。手機使用 390×844 touch emulation 及 Chromium touchStart / touchEnd，並非只修改畫面狀態。

| 驗證 | 實際結果 |
| --- | --- |
| 授權車模 | 桌面及手機均為 `licensed-glb`，未使用備用車 |
| 道路 | W 油門造成 −Z 位移；D 造成向右位移；輪胎射線接地 |
| 攝影機 | 1 / 2 / 3 成功；GSAP 切換中及完成狀態均檢查；觀眾視點滑鼠拖曳及縮放改變位置 |
| 起飛 | 真實 Space 按住後高度 >10m，四輪離地，能量減少 |
| 姿態 | E 翻滾及 I 俯仰均改變車身姿態 |
| 輔助降落 | 姿態操作後按 L，四輪重新接地，返回道路模式，沒有硬著陸，停機區計數增加 |
| 手動降落 | Space 起飛後持續按 Ctrl，近地緩衝成功完成接地 |
| 音訊 | 點擊音效鍵後 AudioContext=running，靜音狀態可再次切換；沒有音訊初始化錯誤 |
| 暫停 / 重置 | 暫停期間物理位置不變；繼續後運作；R 補滿能量及重置車輛 |
| 操作說明 | 可開啟 / 關閉，授權與概念提示可讀 |
| 手機油門 | 真實 touch hold 造成加速，放手後按鍵解除 |
| 手機起飛 / 降落 | 觸控上升造成高度增加；L 觸控降落重新接地 |
| 手機排版 | HUD 無水平溢出，已顯示觸控按鈕的 bounds 在 viewport 內 |

物理測試另覆蓋：能量耗盡的緊急下降、飛行 B 煞車、CCD 實體牆碰撞、懸掛高度。水平初速 10m/s，一秒後無煞車約 7.26m/s，B 煞車約 1.46m/s；靜止底盤約 y=0.658m，與輪胎視覺尺度對齊。

## 畫面及效能證據

| 正式版本畫面 | 連結 |
| --- | --- |
| 車輛展示 | [desktop-showcase.png](captures/desktop-showcase.png) |
| 道路駕駛 | [desktop-driving.png](captures/desktop-driving.png) |
| 飛行 | [desktop-flight.png](captures/desktop-flight.png) |
| 地面駕駛艙 | [desktop-cockpit-ground.png](captures/desktop-cockpit-ground.png) |
| 飛行駕駛艙 | [desktop-cockpit-flight.png](captures/desktop-cockpit-flight.png) |
| 自由觀眾 | [desktop-spectator.png](captures/desktop-spectator.png) |
| 完成降落 | [desktop-landing.png](captures/desktop-landing.png) |
| 手機飛行 | [mobile-flight.png](captures/mobile-flight.png) |
| 手機降落 | [mobile-landing.png](captures/mobile-landing.png) |

獨立 canvas inspector 以 acknowledged state hooks 準備畫面，立即停止物理並繼續繪圖。五個當次 viewport / state 全數通過非空畫面檢查，沒有 shader / JS 錯誤；capture manifest checker 通過 9 個必要報告 / 素材項目。這只證明覆蓋及非空畫面；功能另由真實輸入測試證明。

| 狀態 | 色彩 entropy | Edge density | Luminance contrast |
| --- | ---: | ---: | ---: |
| 桌面道路 | 5.35 | 0.247 | 168.4 |
| 桌面飛行 | 6.25 | 0.314 | 163.8 |
| 駕駛艙 | 6.53 | 0.250 | 159.7 |
| 觀眾 | 6.08 | 0.203 | 162.2 |
| 手機飛行 | 6.14 | 0.369 | 171.9 |

當次 Chrome 使用 ANGLE / NVIDIA GeForce RTX 2070 SUPER / Direct3D11，桌面 1440×960、手機模擬 390×844、DPR=1；主要操作樣本約 75 FPS。此數字屬該桌面 GPU，**不能代表實體手機表現**。

| 測量 | 桌面飛行 | 手機模擬飛行 |
| --- | ---: | ---: |
| Draw calls，含陰影 | 107 | 107 |
| Triangles，含陰影 | 1,016,285 | 555,890 |
| Geometries / Textures | 74 / 18 | 74 / 18 |
| 車模 triangles | 608,769 | 201,937 |
| 陰影圖尺寸 | 2048 | 1024 |

桌面 / 手機幾何量仍超過技能建議的 750k / 300k 起始預算，沒有把這兩項報成通過。保留車體細節與整個海岸的實例化棕櫚及窗格是本版取捨；手機模型減少 66.8% triangles，詳細車模陰影改用簡化代理後，桌面 draw calls 161→107、triangles 約 1.52M→1.02M；手機 triangles 約 712k→556k。低階手機仍可能需要更低 world LOD。沒有額外全螢幕後製通道，DPR 上限 1.75 / 1.25。

Rapier：1 個動態車身、88 個 collider、4 個 ray wheels、60Hz fixed step、車身 CCD；建築 / 地面使用簡單碰撞代理。海面沒有地板，落海及越界會安全重置。飛行是穩定的 arcade 控制，世界向上的虛構升力配合姿態速率；不是氣動或噴射工程模型。

## 先 MVP、後畫質的記錄

早期 [probe.json](probe.json) 及 [MVP 截圖](mvp-captures/01-showcase.png) 記錄道路加速約 83km/h、起飛約 26m、三種視角及成功輔助降落。當時一個 favicon 404 已補上，最終測試 HTTP 錯誤為 0。

第一輪手動下降測試發現固定 −9m/s 下降會造成硬著陸；[修正前測試記錄](qa-manual-descent-before.json) 保留實際 timeout。其後加入近地下降緩衝並改成持續按 Ctrl 直至接地的測試，最終通過。另修正飛行 B 煞車無效、傾斜時切鏡 roll 突變、輪胎不隨懸掛更新，以及遠距地面 z-fighting。地面精度採 logarithmic depth，天空及海水 shader 使用相同深度 chunks。

畫質自評（依已讀取的 2 / 3 級校準圖，0–3）：Art direction 2.5、Hero 3、道路 / 建築障礙 2、停機區互動 2、World 2、Materials 2.5、Lighting 2.5、VFX 2、HUD 2.5、Performance evidence 2；平均 2.3。此為有證據的專案自評，沒有聲稱寫實 AAA 或所有裝置效能認證。環境仍屬程序化風格，建築 / 植被細節低於車模。

## 素材與來源

[ASSET_CREDITS.md](../ASSET_CREDITS.md) 含原始 Sketchfab、作者、CC BY 4.0、公開 mirror、授權查核證據及原始 SHA-256。手機簡化版保留所有材質、紋理及輪胎節點，原始 GLB 沒有覆寫。環境及推進器為原創幾何，音效為本地合成。不存在 API 金鑰或第三方生成帳戶依賴。

## 材料限制與未驗證項目

- 實體手機、Safari、Firefox、實體 Gamepad 及喇叭聽感未驗證；手機結果為 Chrome 觸控模擬。Gamepad 標準映射已預留。
- 沒有真實 Tesla 飛行、氣動、電池或推進器性能資料。緊急下降使用虛構備援控制。
- 近地降落需保持輪胎朝下；硬著陸判定以輪胎接觸及姿態為基礎，不是完整車體損壞或翻覆回復系統。R 隨時可重置。
- 模型 LOD 在初次載入時選擇；單純調整既有桌面分頁寬度不會換模型。
- TypeScript / Vite 正式 build 通過，保留 Rapier bundle 大小提示。Rapier / Draco 依賴可能輸出上游初始化棄用警告，未造成資源、物理或解碼錯誤。

## 使用的工作流程

實際讀取 Three.js Game Director、Gameplay Systems、AAA Graphics Builder、Game UI Designer、Debug Profiler、QA Release、GSAP、Local Dev Efficiency、Ponytail、Find Docs 及 Playwright 指引；以官方 Rapier / 已安裝 Three.js 原始碼確認 API 與深度處理。模型與環境並行實作，整合及最終功能 / 畫面驗證由主代理執行。
