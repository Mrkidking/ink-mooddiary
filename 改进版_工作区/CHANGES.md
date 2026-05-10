# 改进说明

这个目录是源项目的独立副本，源文件未在本次修改中改动。

## 已完成

- 升级 `sw.js` 缓存版本到 `ink-mooddiary-v2`。
- Service Worker 只缓存同源资源，避免把第三方字体等外部响应无差别写入缓存。
- 离线打开页面时优先回退到 `index.html`，减少 PWA 白屏概率。
- 调整 `manifest.json` 内嵌图标文字为稳定的 `INK`。
- 导出数据增加 `version: 2`，方便以后兼容迁移。
- 导入 JSON 时会清洗用户资料和日记字段，限制文本长度，过滤非法图片 data URL，并处理重复或异常日记 ID。
- 搜索逻辑对缺失字段更宽容，避免导入旧数据后因为 `title/content` 为空而报错。

## 建议下一步

- 把 `index.html` 拆成 `styles.css`、`app.js`、`db.js`、`auth.js`。
- 如果日记确实需要隐私保护，应进一步用 WebCrypto 加密 IndexedDB 中的正文和图片。
