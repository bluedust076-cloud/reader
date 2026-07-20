# 纯阅

纯阅是一款无广告、无账号、无行为追踪的 Expo/React Native 小说阅读器。它支持导入自定义 JSON 书源、跨已启用书源搜索、书架管理、章节缓存、阅读进度和纸张/亮色/暗色主题。

## 本地运行

```bash
npm install
npm start
```

应用内置原创短篇《风从旧书馆来》，无需网络即可验证完整阅读流程。

## 书源格式

在“书源”页可以从 iOS“文件”选择器导入单个书源对象或书源数组，也可以新建/粘贴 JSON，并通过系统分享面板导出备份。规则支持 HTML CSS 选择器与 JSONPath：

- 模板变量：`{{keyword}}`、`{{bookUrl}}`、`{{chapterUrl}}`
- HTML 文本：`.title::text`
- HTML 属性：`a::attr(href)`
- JSON 字段：`$.title`
- JSON 列表：`$.items[*]`

应用中的停用书源模板包含完整结构，可以复制后修改。请只连接你信任且有权访问的来源。

## 验证

```bash
npm run typecheck
npm test
npm run build:ios-js
```

## 生成 iPhone 可安装的 IPA

Windows 不能在本机完成 iOS 原生签名。本项目已提供 EAS `preview` 内部分发配置，可在 Windows 上触发 Expo 的 macOS 云构建：

```bash
npx eas-cli@latest login
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

首次执行时，EAS 会要求关联 Expo 项目，并登录具有有效会籍的 Apple Developer 账号来创建/选择分发证书和 Ad Hoc 描述文件。`device:create` 用于登记需要安装 IPA 的 iPhone；构建完成后下载页面会提供 `.ipa` 与设备安装链接。

要上传 TestFlight/App Store，使用：

```bash
npx eas-cli@latest build --platform ios --profile production
```

当前为支持用户自定义的 HTTP/局域网书源，iOS 配置允许非 HTTPS 请求。若准备提交 App Store，建议改为只支持 HTTPS，移除 `NSAllowsArbitraryLoads`，以降低审核与安全风险。

### 使用企业证书自行签名

如果只需要可供企业证书重签的真机 IPA，可在 macOS 执行：

```bash
npm ci
bash scripts/build-unsigned-ipa.sh
```

也可以运行仓库内的 GitHub Actions 工作流 **Build unsigned iOS IPA**。两种方式都会生成 `build/pure-reader-unsigned.ipa`，并验证真机 `arm64` 架构和未签名状态。详细说明见 `SIGNING.md`。

注意：未签名 IPA 不能直接安装；需要用企业证书和匹配 `com.purereader.app` 的描述文件重签。
