<div align="center">

# 🎵 Music

**插件化的桌面音乐播放器**

[![License](https://img.shields.io/github/license/Piracola/Music?style=flat&color=blue)](./LICENSE)
[![Downloads](https://img.shields.io/github/downloads/Piracola/Music/total?style=flat&color=green)](https://github.com/Piracola/Music/releases)
[![Version](https://img.shields.io/github/package-json/v/Piracola/Music?style=flat&color=orange)](./package.json)

**[English](./README_EN.md)** | 简体中文

</div>

---

> [!IMPORTANT]
> **关于本项目**
>
> Music 是基于 [MusicFreeDesktop](https://github.com/maotoumao/MusicFreeDesktop) 二次开发的个人维护版本，遵循 [AGPL 3.0](./LICENSE) 协议。
>
> 1. 界面、插件管理、播放与构建流程在本仓库中均有修改，代码出处见上方原项目链接
> 2. 本仓库**只包含播放器本体**，不包含任何音源插件
> 3. 请遵守开源协议，合法合规使用

---

## ✨ 简介

一个插件化、可定制的桌面音乐播放器，支持 **Windows**、**macOS** 和 **Linux**。

播放器本身不内置任何音源：搜索、播放、歌单导入、歌词等功能全部由插件提供。

### 📥 下载

前往 [Releases](https://github.com/Piracola/Music/releases) 获取安装包。

### 🔌 插件

插件遵循 [MusicFree 插件协议](https://musicfree.catcat.work/plugin/introduction.html)，与安卓版保持兼容。

- 插件**不随本仓库分发**，通过作者指定的渠道获取
- 插件运行在沙箱中，可使用 `axios` · `cheerio` · `dayjs` · `big-integer` · `qs` · `he` · `crypto-js` · `webdav` 等模块
- 支持网页登录，无需手动复制 Cookie

插件支持的能力：

```
搜索 ─── 音乐 / 专辑 / 作者 / 歌单
播放 ─── 多音质切换 · 音源重定向
内容 ─── 专辑详情 · 作者作品 · 歌词 · 歌曲评论
发现 ─── 排行榜 · 推荐歌单 · 歌单分类
导入 ─── 单曲导入 · 歌单导入
```

### 🎨 主题包

支持通过主题包自定义外观，内置**浅色**和**纯黑（AMOLED）**两套主题。

```
my-theme/
├── config.json      # 主题配置（必需）
├── index.css        # 样式定义（必需）
├── preview.png      # 预览图（可选）
└── iframes/         # iframe 背景（可选）
    └── app.html
```

`config.json` 示例：

```jsonc
{
    "name": "主题名称", // 必需
    "preview": "#000000", // 预览色或图片路径
    "description": "主题描述",
    "author": "作者",
    "version": "1.0.0",
    "srcUrl": "https://..." // 远程更新地址
}
```

`index.css` 通过语义化 CSS 变量定制配色：`--color-bg-*`（背景）、`--color-fill-*`（填充）、`--color-text-*`（文本）、`--color-border-*`（边框）、`--color-status-*`（状态）、`--shadow-*`（阴影）。完整变量见 [`res/builtin-themes/light/index.css`](./res/builtin-themes/light/index.css)。

---

## 🛠️ 本地开发

|  依赖   |  版本  |
| :-----: | :----: |
| Node.js | >= 18  |
|  pnpm   | latest |

```bash
git clone https://github.com/Piracola/Music.git
cd Music
pnpm install
pnpm start        # 启动
pnpm run dev      # 开发模式（带 DevTools）
pnpm run package  # 打包应用
pnpm run make     # 生成安装包
```

Windows 下也可以直接双击 `build.cmd` 打开构建面板（应用 / 插件 / 安装包一站打包）。

### 发布

1. 改 `package.json` 的 `version`，同步 `release/version.json` 的 `version` 与 `changeLog`
2. 在 Actions 里手动跑 **Build**，等各平台产物就绪
3. 用该次 run 的 ID 跑 **Release**，会创建 tag、草稿 Release，并把 `release/version.json` 同步到 `master` 供客户端检查更新
4. 检查草稿无误后手动发布

---

## 📸 截图

![主页](./.imgs/screenshot-home.png)
![搜索](./.imgs/screenshot-search.png)
![插件管理](./.imgs/screenshot-plugin.png)
![主题](./.imgs/screenshot-theme.png)

---

## 🙏 致谢

- [MusicFreeDesktop](https://github.com/maotoumao/MusicFreeDesktop) — 本项目的基础
- [MusicFree](https://github.com/maotoumao/MusicFree) — 插件协议与安卓版

本项目遵循 [AGPL-3.0](./LICENSE)。
