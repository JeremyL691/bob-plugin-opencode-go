# OpenCode Go 翻译插件（Bob）

在 Bob 中使用自己的 OpenCode Go API Key 翻译文本。支持 [Go 官方模型列表](https://opencode.ai/docs/go/#endpoints)中的 Chat Completions、Responses 和 Messages 接口，选择菜单模型后自动切换接口。默认使用 DeepSeek V4.1 Flash 和该模型最低可用的思考等级。

[下载最新版](https://github.com/JeremyL691/bob-plugin-opencode-go/releases/latest) · [查看更新记录](CHANGELOG.md) · [报告问题](https://github.com/JeremyL691/bob-plugin-opencode-go/issues)

## 安装

1. 准备 Bob 1.21.0 或更新版本，以及自己的 OpenCode Go API Key。
2. 从 [最新版 Release](https://github.com/JeremyL691/bob-plugin-opencode-go/releases/latest) 下载 `.bobplugin` 文件并双击安装。
3. 在 Bob 的文本翻译服务中启用“OpenCode Go 翻译”，填入 Key，选择模型和思考等级。

当前仅支持文本翻译和非流式响应，不提供 OCR、语音合成或自定义提示词。

## 模型与思考等级

菜单模型会自动使用对应的 Go 接口。自定义模型 ID 若与菜单中已有 ID 一致，也会自动选择接口。使用尚未收录的 ID 时，请填写不带 `opencode-go/` 前缀的 ID，并根据 [Go 接口表](https://opencode.ai/docs/go/#endpoints)手动选择接口。自定义 ID 优先于菜单选项。

“思考等级”默认是“最低可用”，也可选低、中、高、极高、最高或服务端默认。Bob 的设置菜单是固定的，插件会将所选等级映射到模型支持的最近档位；“服务端默认”不发送思考控制参数。

| 模型 | 已配置的档位 |
| --- | --- |
| GPT Luna | 关闭、低、中、高、极高、最高 |
| Grok 4.6/4.7 | 低、中、高、极高 |
| DeepSeek V4 | 关闭、低、高、最高 |
| GLM-5.2/5.3 | 低、高、最高 |
| Qwen3.8 Max/Flash | 关闭、低、中、极高 |
| Kimi、GLM-5.1、MiMo、LongCat-2.0、Qwen3.6/3.7、MiniMax M3 | 关闭、开启 |
| MiniMax M2.x、Muse、Hy、免费预览模型 | 沿用服务端设置 |

只有开关控制的模型将“低”及更高档位映射为开启思考。MiniMax M2.x 无法关闭思考；对于尚未确认支持控制参数的模型，插件不会发送可能导致请求失败的参数。模型可用性、接口和思考能力可能随 Go 服务更新。

## 隐私与使用范围

翻译原文和 Key 仅用于向 OpenCode Go 发起请求，插件不写入日志或仓库。Bob 将 Key 放在安全输入框中。请求会携带插件自己的 User-Agent 与会话标识。

[OpenCode Go 官方说明](https://opencode.ai/docs/go/#where-can-i-use-it)该服务主要面向编程代理和类似请求，并监控可能影响其他用户的滥用流量。Bob 通用翻译的持续可用性没有官方保证；如果服务拒绝请求，插件会显示错误，不伪装客户端或绕过限制。此项目与 Bob、OpenCode 均无官方关联。

## 常见问题

- **Key 无效或没有权限：**检查是否使用有 Go 访问权限的 API Key。
- **模型或接口不可用：**更新插件；自定义模型请核对 ID 和接口类型。
- **响应慢或没有译文：**尝试“最低可用”或较快的模型，并缩短长段落。实际速度受服务负载、模型和网络影响。
- **达到额度限制：**等待 Go 的用量窗口重置，或在 Go 控制台检查使用量。

## 开发

插件运行在 Bob 的 JavaScriptCore 中；Node.js 只用于测试和打包。

```sh
npm test
npm run build
```

`npm run build` 会在 `dist/` 生成 `.bobplugin` 安装包，并依据安装包实际 SHA-256 生成根目录的 `appcast.json`。发布流程见 [Bob 官方文档](https://bobtranslate.com/plugin/quickstart/publish.html)。

## 许可证

本项目采用 [GPL-3.0-only](LICENSE) 许可证。
