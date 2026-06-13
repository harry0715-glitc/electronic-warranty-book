# 電子保固書 MVP

這個專案現在已從單純的靜態展示頁，升級為 **方案 A（Google Sheet + Apps Script + LINE）導向的 MVP 骨架**。

## 目前已完成

### 前端頁面
- `admin.html`：管理輸入頁
- `index.html`：動態電子保固書頁（可吃 `?id=CASE_ID`）
- `repair.html`：報修頁
- `api-config.js`：前端 API / 公開網址設定

### 後端骨架
- `apps-script/Code.gs`：Apps Script API 骨架
- `apps-script/appsscript.json`：Apps Script manifest
- `apps-script/.claspignore`：clasp 同步限制

### 資料 / 樣板
- `warranty-data.sample.json`：保固書樣板資料
- `line-flex-message.json`：LINE Flex Message 樣板
- `line-push-sample.json`：LINE push payload 樣板

## 建議實際流程

1. 在 `admin.html` 輸入案件資料
2. 先本機儲存到 localStorage 直接預覽
3. 將 `api-config.js` 的 `apiBase` 換成 Apps Script Web App URL
4. 由 Apps Script 寫入 Google Sheet 的 `Warranties` / `Repairs`
5. 客戶從 LINE 收到 Flex Message：
   - 查看完整保固書
   - 我要報修

## LINE 使用方式

### 查看完整保固書
連到：
- `index.html?id=WG-2026-001`

### 我要報修
連到：
- `repair.html?id=WG-2026-001`

## Apps Script / GitHub Pages 分工

### GitHub Pages / Netlify
負責：
- 顯示保固書
- 顯示報修頁
- 顯示管理頁（MVP 可先本機或內部使用）

### Apps Script / Google Sheet
負責：
- 建立 / 更新保固書資料
- 儲存報修資料
- 提供案件查詢 API
- 後續可串 LINE Messaging API

## 目前可直接預覽的頁面
- `admin.html`
- `index.html`
- `repair.html`

## 目前已支援的 MVP 模式

### 1. localStorage 模式
不需要後端即可：
- 建立案件
- 預覽保固書
- 產生 LINE Flex JSON
- 送出報修並先存在本機

### 2. Apps Script 模式（待設定 apiBase）
設定 `api-config.js` 後可進一步改為：
- 保固書寫入 Google Sheet
- 報修寫入 Google Sheet
- `index.html?id=...` 從 Apps Script 讀資料

## `api-config.js` 要改的地方

```js
window.APP_CONFIG = {
  apiBase: "你的 Apps Script Web App URL",
  publicBase: "你的公開前端網址",
  companyName: "楓根室內裝修設計有限公司",
  companyPhone: "0900-000-000",
  companyAddress: "高雄市楠梓區清成街 31 號",
  lineOfficialUrl: "",
  repairFormBase: "repair.html",
  warrantyPageBase: "index.html"
};
```

## 下一步最推薦

1. 建立 Google Sheet
2. 建立 Apps Script 專案並貼上 `apps-script/Code.gs`
3. 部署 Web App
4. 把 Web App URL 填進 `api-config.js`
5. 再把 `admin.html` / `index.html` / `repair.html` 推上 GitHub Pages
6. 最後串 LINE Flex Message 發送

## 注意

- 目前我先把「可實際跑的本機 MVP」做好，這樣你可以先操作流程。
- Apps Script 真正部署到你的 Google 帳號，還需要你提供或建立對應的 Script 專案。
- 如果你之後要，我可以下一步直接幫你做 `clasp` 綁定與 Apps Script 部署流程。
