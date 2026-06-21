# 電子保固書 MVP

這個專案是目前正在使用中的 **電子保固書 / LINE 官方帳號 / 報修流程** MVP。

專案位置：`E:/電子保固書`
公開網址：`https://harry0715-glitc.github.io/electronic-warranty-book/`
LIFF 入口：`https://liff.line.me/2010316548-KZgCnSKp`
Apps Script API：`https://script.google.com/macros/s/AKfycbxhiL2RwaD6yOlQJVb8MQwJW6zuz0rvcNQdIiCmtwM7JvlWqWzIvaSiGFF6fWXJbw9NYA/exec`

---

## 目前架構

- 前端：GitHub Pages 靜態頁
- 頁面：`admin.html`、`index.html`、`query.html`、`repair.html`
- 後端：Google Apps Script + Google Sheet
- LINE：LIFF + 官方帳號 webhook / push

目前採用的方向是：

- **Apps Script 當主後端與資料 API**
- **Google Sheet 當資料主體**
- **LINE OA 當客戶通知與資訊卡發送入口**
- 現階段**不導入 n8n**，先維持架構單純

---

## 主要頁面

### `admin.html`
建立保固書用的管理頁。

目前負責：
- 輸入基本保固資料
- 建立新案件
- 檢查 LINE 綁定狀態
- 對已綁定客戶發送保固資訊卡

### `query.html`
查詢既有保固書用的管理頁。

目前可用於：
- 查詢既有案件
- 進入既有案件
- 接續做管理端操作

### `index.html?token=PUBLIC_TOKEN`
正式版電子保固書顯示頁。

目前定位：
- 給客戶查看保固資訊
- 作為保固書正式頁面
- 提供報修入口

### `repair.html?token=PUBLIC_TOKEN`
報修頁。

目前定位：
- 客戶提交報修資料
- 與保固案件關聯

---

## 目前已完成

### 保固資料流程
- 已建立保固書前後台基本流程
- `admin.html` 可建立保固書
- `index.html?token=PUBLIC_TOKEN` 可顯示正式保固書
- `repair.html?token=PUBLIC_TOKEN` 可建立報修
- `query.html` 可查詢 / 進入既有案件

### Apps Script / Google Sheet
- 已建立並綁定本機 `clasp` Apps Script 專案
- Apps Script 已作為主要 API 與資料來源
- Google Sheet 已作為：
  - 保固資料容器
  - LINE 綁定資料容器
  - 報修資料容器
- `api-config.js` 已填入可用 `apiBase`

### LINE / LIFF
- 已將保固書與原本電子名片拆成不同 LIFF
- 保固書目前使用 LIFF ID：`2010316548-KZgCnSKp`
- LINE OA 已具備：
  - 客戶用手機號碼綁定 LINE
  - 管理端依手機查綁定狀態
  - 管理端對已綁定客戶推送保固資訊卡

---

## 本次最新完成

### 已修正 LINE webhook 綁定提示誤觸發問題
先前問題：
- 客戶收到保固資訊卡後，只要在官方 LINE 對話框輸入任何文字
- 系統都會回：
  - `請直接回傳您建立保固書時填寫的手機號碼，例如：0912345678`

根因：
- webhook 先前把所有文字訊息都當成「手機綁定輸入」判斷
- 沒有先檢查該 `userId` 是否已綁定

本次已修正：
- 在 `apps-script/Code.gs` 新增 `findLineContactByUserId_(userId)`
- 邏輯改為：
  - **未綁定用戶** 傳一般文字 → 仍提示回傳手機號碼
  - **已綁定用戶** 傳一般文字 → 直接靜默不回覆

### 已重新部署 Apps Script
- 已用 `clasp push` 推送最新 `Code.gs`
- 已建立版本：`33`
- 已 redeploy 現行 Web App deployment：
  - `AKfycbxhiL2RwaD6yOlQJVb8MQwJW6zuz0rvcNQdIiCmtwM7JvlWqWzIvaSiGFF6fWXJbw9NYA`
- 已用 live health endpoint 驗證部署成功

---

## `api-config.js`

目前設定如下：

```js
window.APP_CONFIG = {
  apiBase: "https://script.google.com/macros/s/AKfycbxhiL2RwaD6yOlQJVb8MQwJW6zuz0rvcNQdIiCmtwM7JvlWqWzIvaSiGFF6fWXJbw9NYA/exec",
  publicBase: "https://harry0715-glitc.github.io/electronic-warranty-book",
  liffId: "2010316548-KZgCnSKp",
  companyName: "楓根室內裝修設計有限公司",
  companyPhone: "0900-000-000",
  companyAddress: "高雄市楠梓區清成街 31 號",
  repairOfficialUrl: "https://line.me/R/ti/p/@yhh1711p",
  repairFormBase: "repair.html",
  warrantyPageBase: "index.html"
};
```

---

## 目前待實測 / 待確認

1. 已綁定客戶在官方 LINE 對話框傳一般文字
   - 應不再收到「請回傳手機號碼」提示
2. 未綁定客戶傳一般文字
   - 應仍收到手機號碼綁定提示
3. 未綁定客戶傳手機號碼
   - 應可正常完成綁定
4. 管理端對已綁定客戶發送保固資訊卡
   - 應維持正常
5. 客戶收到卡片後點擊
   - 保固書頁與報修頁應正常打開

---

## 下一步建議

建議優先做：

1. 用一個**已綁定 LINE 帳號**實測傳一般文字
2. 用一個**未綁定 LINE 帳號**實測綁定流程
3. 確認管理端推卡與客戶點擊流程都正常
4. 若穩定，再考慮：
   - 報修通知優化
   - 已綁定客戶的客服關鍵字自動回覆
   - 保固到期提醒 / 後續自動化

---

## 補充

若後續要擴充自動化（例如保固到期提醒、報修通知分流、跨系統同步），可再評估導入 n8n；但以目前專案階段，**先維持 Apps Script + Sheet + LINE OA 的簡潔架構即可**。

---

## 2026-06 安全調整

- GitHub Pages 公開頁改以 `docs/` 作為準備中的發佈來源，只保留客戶頁：`index.html`、`repair.html` 與 `assets/`。
- `admin.html` / `query.html` 保留在專案根目錄，預期只做本機管理用途。
- 前端已移除 `adminSendPin` 常數；管理頁會改成每個 session 輸入一次 `adminKey`。
- Apps Script 新增 `publicToken` 欄位，客戶頁改為 `?token=` 連結，不再公開遞增 `caseId` 作為網址查詢鍵。
- 管理 API 改由 `adminKey` 保護；若 Script Properties 尚未設定 `ADMIN_API_KEY`，目前會先沿用既有 `LINE_ADMIN_SEND_PIN` 作為相容 fallback。
- 若要讓 GitHub Pages 真正退出 `admin.html` / `query.html`，請把 Pages source 切到 `main / docs`。
