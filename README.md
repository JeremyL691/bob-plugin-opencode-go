# OpenCode Go 翻译插件（Bob）

用自己的 OpenCode Go API Key 在 Bob 中翻译文本。支持官方文档列出的 Chat Completions、Responses 和 Messages 三类模型，默认模型为 DeepSeek V4.1 Flash。首版一次性返回译文，不支持流式输出、OCR 或语音合成。

## 安装与设置

1. 安装 Bob 1.21.0 或更新版本。
2. 从 GitHub Release 下载 `opencode-go-translate_0.1.0.bobplugin`，双击安装。
3. 在 Bob 中添加“OpenCode Go 翻译”服务，填入自己的 Go API Key，并选择模型。
4. 如需使用菜单尚未收录的模型，填写不带 `opencode-go/` 前缀的模型 ID，并按 [Go 模型表](https://opencode.ai/docs/go/#endpoints)选择 Chat Completions、Responses 或 Messages 接口。自定义 ID 优先于菜单选择。

模型菜单基于发布时的 [OpenCode Go 官方文档](https://opencode.ai/docs/go/)；模型供应和接口可能随时变化。翻译文本会发送至 OpenCode Go。插件不会记录 API Key 或翻译原文。

**使用范围提醒：**OpenCode Go 官方说明该服务面向编程代理及类似流量，并要求客户端发送典型编程代理请求。Bob 通用翻译的持续可用性尚无官方保证；如果 Go 拒绝请求，插件会报告错误，不尝试规避限制。请自行核对 [Go 使用说明](https://opencode.ai/docs/go/#where-can-i-use-it)。

## 开发与打包

插件代码在 `plugin/main.js`，Bob 元信息在 `plugin/info.json`。运行环境是 Bob 的 JavaScriptCore，没有 Node.js 或浏览器 API。Node.js 仅用于本地测试和打包。

```sh
npm test
npm run build
```

打包命令生成 `dist/opencode-go-translate_0.1.0.bobplugin`，并用安装包实际 SHA-256 更新仓库根目录的 `appcast.json`。发布时应上传该安装包至同版本 GitHub Release，再提交生成的 `appcast.json`，并给仓库添加 `bobplugin` topic。仓库地址、Release 地址及更新地址当前配置为 `JeremyL691/bob-plugin-opencode-go`。

## 联调清单

使用自己的 Go Key 在 Bob 中测试 DeepSeek V4.1 Flash，再分别测试至少一个 Responses 模型和一个 Messages 模型。检查中英互译、长段落与换行、错误密钥、额度限制及服务端拒绝。真实联调通过后再公开发布；模拟测试不代表 Go 服务端接受通用翻译请求。
