# DKEC 氣球特攻隊

[公開 GitHub 專案](https://github.com/sweet294728/dkec-balloon-game)

這是一款獨立的 60 秒網頁射氣球遊戲。先選擇 D寶、K寶、E寶或 C寶，再從矮牆後方朝飄起的氣球發射飛鏢。

## 遊戲規則

- 每局 60 秒，起始生命值為 5 顆愛心。
- 選 D寶或 K寶時，正確目標是 E、C 氣球。
- 選 E寶或 C寶時，正確目標是 D、K 氣球。
- 射對氣球：分數 +1。
- 射錯氣球：分數 -1、生命 -1。
- 射空或氣球飄出畫面：不扣分、不扣生命。
- 射中愛心補給：受傷時恢復 1 顆愛心；滿血時改為分數 +1。
- 一支飛鏢只會擊中路徑上的第一個目標，不會貫穿。
- 氣球數量會由前段約 6 顆逐步提升至約 12 顆；最後 10 秒依玩家分數增加目標氣球比例與同時出現量，但不額外加速，協助玩家挑戰 A 或 S 級。
- 時間歸零或生命耗盡時結束回合。

## 分級、獎勵與排行榜

| 等級 | 分數 | 結算獎勵 |
| --- | ---: | --- |
| D | 0–9 | 官網購物金 NT$10 |
| C | 10–24 | 官網購物金 NT$20 |
| B | 25–39 | 官網購物金 NT$50 |
| A | 40–54 | 官網購物金 NT$100 |
| S | 55 以上 | 官網購物金 NT$300 |

- 結算時會顯示此次等級，以及距離下一等級還差幾分。
- 玩家可選擇是否輸入暱稱，加入前 20 名排行榜。
- 相同暱稱只保留最佳成績；同分時依錯誤命中較少、提交時間較早排序。
- 排行榜使用 Google Sheet 與 Apps Script，未設定服務網址時不會阻擋玩家領獎或重新遊玩。

| 選擇角色 | 小隊 | 可射目標 |
| --- | --- | --- |
| D寶 | DK | E、C |
| K寶 | DK | E、C |
| E寶 | EC | D、K |
| C寶 | EC | D、K |

## 執行與驗證

在 `balloon-game` 資料夾中執行：

```powershell
npm.cmd run dev
npm.cmd test
npm.cmd run build
npm.cmd run verify:production
npm.cmd run export:html
```

開發伺服器啟動後，依終端顯示的本機網址在瀏覽器中開啟遊戲。正式建置輸出位於 `dist/`。`verify:production` 會重新建置，確認正式包沒有開發驗收入口，並檢查入口檔與十二張遊戲圖片都存在。`export:html` 會產生可直接交付的 `export/DKEC氣球特攻隊-單檔版.html`。

## 主要模組

- `src/App.jsx`：選角、遊戲、結算三個畫面的流程與素材預載。
- `src/components/`：角色選擇、HUD 與結算介面。
- `src/game/GameCanvas.jsx`：Canvas 繪製、動畫迴圈、輸入、生成與碰撞整合。
- `src/game/rules.js`：計分、血量、目標矩陣、倒數與難度等純遊戲規則。
- `src/game/engine.js`：氣球、愛心、飛鏢、縮放與繪製配置的純函式。
- `src/game/geometry.js`：飛鏢與圓形目標的首擊碰撞判定。
- `src/leaderboard/`：暱稱正規化、排行規則與 Apps Script JSONP/表單傳輸。
- `tests/`：規則、幾何、素材與介面契約測試。
- `public/assets/game/`：遊戲使用的完成圖片素材。
- `google-apps-script/`：排行榜後端程式與繁體中文部署流程。

## 啟用 Google Sheet 排行榜

1. 依照 [`google-apps-script/部署說明.md`](google-apps-script/部署說明.md) 建立試算表、貼上 `Code.gs` 並部署為任何人皆可存取的網頁應用程式。
2. 將部署後的 `/exec` 網址填入 `src/leaderboard/config.js` 的 `LEADERBOARD_ENDPOINT`。
3. 重新執行測試、正式驗證及單檔匯出，再發佈更新檔案。

## 圖像素材與交付範圍

`public/assets/game/` 內每一張完成圖片素材，都是專為本遊戲透過 GPT 圖像生成製作；選角使用角色正面圖，遊戲中使用面向氣球的背面圖。

本次交付是獨立遊戲階段。既有 `site/` 的整合刻意延後，待獨立版驗收後再進行。
