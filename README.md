# 電子保固書 MVP

這版已改成你指定的簡化流程：

1. **輸入基本資訊**
2. **直接跳出完整保固書頁**
3. **在保固書頁下方進行報修或分享 LINE Flex**

不再走「管理頁顯示一堆 JSON / code」的做法。

## 目前流程

### `admin.html`
只負責輸入基本資料：
- 案件名稱
- 客戶名稱
- 客戶電話
- 工程地點
- 承攬範圍
- 竣工日期
- 驗收日期
- 保固起日
- 保固迄日
- 結算金額
- 承攬廠商 / 負責人 / 地址
- 保固聲明

### 自動處理項目
- **案件編號**：自動排序產生（目前本機 localStorage 與 Apps Script 都支援）
- **保固狀態**：依保固起日 / 迄日自動判定
  - 尚未生效
  - 保固生效中
  - 已過保
- **客服按鈕**：已移除
- **備註欄**：已移除

## 頁面說明

### `admin.html`
建立保固書用的基本輸入頁。

### `index.html?id=CASE_ID`
完整正式文件版電子保固書頁。

下方只保留：
- `我要報修`（直接開 LINE 官方帳號）
- `分享給 LINE 好友`

### `repair.html?id=CASE_ID`
報修頁。

## LINE 分享

目前保固書頁已預留「**分享給 LINE 好友**」按鈕。

### 若要真的直接送出 Flex 卡片
需在 `api-config.js` 設定：
- `liffId`

目前已填入你提供的：
- `2010316548-KZgCnSKp`

這樣在 LINE App 內開啟保固書頁時，就可以用 `liff.shareTargetPicker` 直接把 Flex 卡片分享給好友。

## `api-config.js`

```js
window.APP_CONFIG = {
  apiBase: "你的 Apps Script Web App URL",
  publicBase: "你的公開前端網址",
  liffId: "你的 LIFF ID",
  companyName: "楓根室內裝修設計有限公司",
  companyPhone: "0900-000-000",
  companyAddress: "高雄市楠梓區清成街 31 號",
  repairFormBase: "repair.html",
  warrantyPageBase: "index.html"
};
```

## Apps Script 狀態

已完成：
- 已建立 Google Sheet 資料庫容器
- 已建立並綁定本機 `clasp` Apps Script 專案
- 已推送 `Code.gs` 與 `appsscript.json`
- 已把報修連結改為 LINE 官方帳號

目前卡點：
- `clasp deploy` 雖可建立 deployment，但目前實測沒有產生可用的 Web App entry point
- 因此 `apiBase` 目前先保持空白，避免前端指向失效 `/exec`
- 下一步需在 Apps Script 編輯器內完成一次正式 Web App deployment，拿到可用 `/exec` URL 後再回填 `api-config.js`

## 目前已完成

- `admin.html`：簡化輸入頁
- `index.html`：正式文件版保固書 + 報修 / LINE 分享
- `repair.html`：報修頁
- `api-config.js`：加入 `liffId`
- `apps-script/Code.gs`：案件編號 / 保固狀態自動化
- `line-flex-message.json`：精簡為保固書 + 報修兩按鈕
- `line-push-sample.json`：同步更新

## 下一步最推薦

1. 建立 / 綁定 Apps Script 專案
2. 部署 Web App
3. 設定 `api-config.js` 的 `apiBase`
4. 建立 LIFF App 並填入 `liffId`
5. 測試在 LINE 內直接分享 Flex 卡片
