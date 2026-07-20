# 企业签名说明

`pure-reader-unsigned.ipa` 是使用 iPhoneOS SDK 编译的真机 `arm64` 应用，但不包含 Apple 签名。它不能直接安装，需要使用企业证书、对应的 `.mobileprovision` 和匹配的 Bundle ID 重新签名。

当前 Bundle ID：`com.purereader.app`

## 构建无签名 IPA

在装有 Xcode、Node.js 和 CocoaPods 的 macOS 中执行：

```bash
npm ci
bash scripts/build-unsigned-ipa.sh
```

产物位于 `build/pure-reader-unsigned.ipa`。脚本会在成功前验证：

- ZIP/IPA 结构完整；
- 包内存在 `Payload/*.app`；
- 主程序包含 `arm64`；
- `.app` 当前没有有效签名。

也可以把项目推送到 GitHub，手动运行 **Build unsigned iOS IPA** 工作流，再从该次运行的 Artifacts 下载 `pure-reader-unsigned-ipa`。

## 重签注意事项

- 描述文件的 App ID 必须覆盖 `com.purereader.app`，否则应先在 `app.json` 中把 `ios.bundleIdentifier` 改成企业描述文件允许的值并重新构建。
- 签名工具需要签署应用内 Frameworks/PlugIns 等嵌套代码，最后再签署主 `.app`。
- 把企业 `.mobileprovision` 嵌入为 `Payload/*.app/embedded.mobileprovision`。
- 完成后用 `codesign --verify --deep --strict Payload/*.app` 验证，再重新压缩为 IPA。

