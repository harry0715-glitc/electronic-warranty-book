# 電子保固書系統

室內設計工作室使用中的 **電子保固書 / LINE 官方帳號 / 報修流程** 系統。

- 專案位置：`E:/電子保固書`
- 公開網址：`https://harry0715-glitc.github.io/electronic-warranty-book/`
- LIFF 入口：`https://liff.line.me/2010316548-KZgCnSKp`

---

## 架構總覽

```
客戶端（公開）                管理端（Google 登入）          後端
────────────────            ────────────────────         ─────────────────
index.html?token=    ──┐    部署 B ?page=admin     ──┐   Apps Script (Code.gs)
repair.html?token=   ──┤→   部署 B ?page=query     ──┤→  Google Sheet
LINE OA webhook/push ──┘    （AdminUsers 名單控管）  ──┘   ├ Warranties
                                                          ├ LineContacts
                                                          ├ Repairs
                                                          └ AdminUsers
```

- 前端：GitHub Pages 靜態頁，發佈來源為 `docs/`（僅客戶頁）
- 後端：Google Apps Script + Google Sheet（電子保固書資料庫）
- LINE：LIFF + 官方帳號 webhook（手機綁定）/ push（保固卡、報修通知）

## 兩個部署（同一份程式碼）

| 部署 | 用途 | 執行身分 | 存取權 | 部署 ID 開頭 |
|---|---|---|---|---|
| A 公開 API | 客戶頁讀取、報修、LINE webhook | 我（擁有者） | 任何人（匿名） | `AKfycbyIq4j6NPL...`（名稱：Rollback admin deployment） |
| B 管理後台 | `?page=admin` / `?page=query` | 存取的使用者 | 任何 Google 帳號 | `AKfycbxK3U_BbLdI...` |

- `api-config.js` 的 `apiBase` 指向部署 A
- `docs/portal.html` 的按鈕指向部署 B
- 部署 B 的授權由 AdminUsers 工作表控管（email / role / active），僅名單內帳號可進入
- **manifest（appsscript.json）注意**：`oauthScopes` 必須包含 `"openid"`，否則 `Session.getActiveUser().getEmail()` 回空值，Google 登入驗證會失敗；`webapp` 區塊預設維持匿名（`ANYONE_ANONYMOUS` + `USER_DEPLOYING`），建立管理部署時才在部署對話框改選

## 頁面說明

| 頁面 | 位置 | 用途 |
|---|---|---|
| `index.html?token=` | docs/（公開） | 客戶查看保固書，token 化連結 |
| `repair.html?token=` | docs/（公開） | 客戶報修，必須帶有效 token |
| `portal.html` | docs/（公開） | 後台入口，連到部署 B |
| `admin.html` / `query.html` | 專案根目錄（不公開） | 本機備援管理頁，需 ADMIN_API_KEY，改走 POST |
| AdminApp / QueryApp / DashboardApp | Apps Script 內建（部署 B 提供） | Google 登入後台 |

## 安全設計（2026-07-10 P0 修正後）

1. 程式碼中無任何硬編碼金鑰；管理金鑰只認 Script Properties 的 `ADMIN_API_KEY`
2. 管理 API 走 POST，`adminKey` 放 request body，不進 URL / 執行紀錄
3. LINE webhook 必須帶正確 `?key=`（`LINE_WEBHOOK_KEY`），未設定一律拒絕（Apps Script 讀不到 header，無法驗 X-Line-Signature，以此替代）
4. 公開報修必須帶有效 `publicToken`，並有頻率限制（單一 token 10 分鐘 5 筆、全站 1 小時 30 筆）
5. 客戶頁全面 token 化，不暴露連號 caseId
6. `docs/` 不含任何管理頁

## Script Properties（Apps Script → 專案設定）

| 屬性 | 用途 |
|---|---|
| `ADMIN_API_KEY` | 本機管理頁金鑰（強隨機值） |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE Messaging API |
| `LINE_WEBHOOK_KEY` | webhook URL 的 `?key=` 驗證 |
| `LINE_LIFF_ID` | LIFF |
| `LINE_ADMIN_SEND_PIN` | 舊 PIN（已不作為金鑰 fallback，僅相容保留） |
| `ADMIN_ALLOWED_EMAILS` / `ADMIN_MANAGER_EMAILS` | （備用）email 名單 |

## 開發與部署流程

1. 本機改 `apps-script/` 下的檔案
2. `cd /d E:\電子保固書` → `clasp push`（manifest 變更時回答 `y`）
3. Apps Script 編輯器 → 部署 → 管理部署作業 → 選對應部署 → 編輯 → 版本「新版本」→ 部署
   - 改到公開 API 邏輯 → 更新部署 A
   - 改到管理頁（AdminApp/QueryApp）→ 更新部署 B
4. 前端（docs/）改動 → `git add -A` → `git commit` → `git push`（GitHub Pages source：`main /docs`）

## 相關文件

- `架構掃描與優化建議_2026-07-10.md` — 完整問題清單（P0–P2）與擴充方案
- `後台Google登入設定指南.md` — 部署 B 設定過程與排錯紀錄
- `電子保固卡進度紀錄.md` — 目前進度快照
