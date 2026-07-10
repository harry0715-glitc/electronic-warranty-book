# 後台 Google 登入設定指南（免輸入金鑰）

目標：開瀏覽器、登入自己的 Google 帳號就直接進後台。不用輸入任何金鑰。
原理：程式碼已內建 `?page=admin` / `?page=query` 管理頁 + AdminUsers 名單驗證，只需建立第二個部署。

---

## 架構：同一份程式碼、兩個部署

| 部署 | 用途 | 執行身分 | 存取權 |
|---|---|---|---|
| A（現有） | 客戶頁 API、LINE webhook、報修 | 我（Me） | 任何人（匿名） |
| B（新增） | 管理後台 | 存取的使用者 | 任何擁有 Google 帳號的人 |

部署 B 雖設「任何 Google 帳號」，但進入後台仍需通過 AdminUsers 名單——不在名單上的人會被拒絕，且因為沒有你試算表的權限，連資料都碰不到。實際上只有你（和你日後加入名單並分享試算表的人）能用。

---

## 設定步驟（一次性，約 5 分鐘）

1. **推送最新程式碼**
   ```
   clasp push
   ```
   （appsscript.json 已修正為匿名+以我執行，保護部署 A 不被改壞）

2. **redeploy 部署 A（公開 API）**
   Apps Script 編輯器 → 部署 → 管理部署作業 → 現有部署 → 編輯 → 版本選「新版本」→ 部署。
   確認設定維持：執行身分「我」、存取權「任何人」（匿名）。

3. **建立部署 B（管理後台）**
   部署 → 新增部署作業 → 類型「網頁應用程式」→
   - 執行身分：**存取網頁應用程式的使用者**
   - 誰可以存取：**任何擁有 Google 帳號的使用者**
   → 部署，複製網址（`https://script.google.com/macros/s/部署B_ID/exec`）。

4. **首次開啟後台**
   開 `部署B網址?page=admin` → Google 要求授權（一次性）→ 因為你是試算表擁有者且 AdminUsers 尚無名單，系統會自動把你加為 manager → 直接進入後台。

5. **把部署 B 網址加入書籤 / 給我更新 portal**
   把 `?page=admin` 和 `?page=query` 兩個網址加入瀏覽器書籤即可。
   也可以把部署 B 網址貼給 Alex，我會更新 docs/portal.html 的入口按鈕。

---

## 設定結果（2026-07-10 完成）

部署 B 已建立並實測可用。**把這兩個網址加入書籤：**

- 建立保固書：`https://script.google.com/macros/s/AKfycbxK3U_BbLdI335S6vUn_RX93_CzNARuj4upTDVkwySJBtfpNVqNnriKQZm91qJrf1QsIw/exec?page=admin`
- 查詢保固書：`https://script.google.com/macros/s/AKfycbxK3U_BbLdI335S6vUn_RX93_CzNARuj4upTDVkwySJBtfpNVqNnriKQZm91qJrf1QsIw/exec?page=query`

排錯備忘：卡最久的原因是 manifest 的 `oauthScopes` 少了 `"openid"`——沒有它，`Session.getActiveUser().getEmail()` 一律回空值，Google 登入驗證永遠失敗。已補上。
過程中產生的兩個失敗部署（AKfycbxmhEn1...、AKfycbxvF8e...）可以在「管理部署作業」裡封存。

## 之後的日常使用

- 開書籤 → 已登入 Google 就直接進後台，零輸入。
- 換電腦 / 換瀏覽器：登入 Google 帳號即可，不用記金鑰。
- 加人：AdminUsers 工作表加一列（email / role / active），並把試算表分享給對方。

## 金鑰還需要嗎？

- `ADMIN_API_KEY` 建議仍設定（強隨機值），作為本機 admin.html 的備援入口。
- 平常完全用不到；只有 Google 登入路徑出問題時才需要。

## 安全備忘

- 舊 PIN `521527` 已在公開 repo 歷史中，`LINE_ADMIN_SEND_PIN` 與 `LINE_WEBHOOK_KEY` 仍要更換（LINE Developers 的 webhook URL 同步改）。
- GitHub Pages source 記得切到 `main /docs`（docs 已無管理頁）。
