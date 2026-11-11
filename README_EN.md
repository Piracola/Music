<div align="center">

# 🎵 Music

**A plugin-based desktop music player**

[![License](https://img.shields.io/github/license/Piracola/Music?style=flat&color=blue)](./LICENSE)
[![Downloads](https://img.shields.io/github/downloads/Piracola/Music/total?style=flat&color=green)](https://github.com/Piracola/Music/releases)
[![Version](https://img.shields.io/github/package-json/v/Piracola/Music?style=flat&color=orange)](./package.json)

English | **[简体中文](./README.md)**

</div>

---

> [!IMPORTANT]
> **About this project**
>
> Music is a personal fork of [MusicFreeDesktop](https://github.com/maotoumao/MusicFreeDesktop), licensed under [AGPL 3.0](./LICENSE).
>
> 1. UI, plugin management, playback and build pipeline are modified in this repository
> 2. This repository contains **the player only** — no music source plugins
> 3. Please use it legally and comply with the license

---

## ✨ Introduction

A plugin-based, customizable desktop music player for **Windows**, **macOS** and **Linux**.

The player ships with no music sources of its own: search, playback, playlist import and lyrics all come from plugins.

### 📥 Download

Get installers from [Releases](https://github.com/Piracola/Music/releases).

### 🔌 Plugins

Plugins follow the [MusicFree plugin protocol](https://musicfree.catcat.work/plugin/introduction.html) and stay compatible with the Android version.

- Plugins are **not distributed with this repository**; they are provided through the author's channels
- Plugins run in a sandbox with `axios` · `cheerio` · `dayjs` · `big-integer` · `qs` · `he` · `crypto-js` · `webdav`
- Web login is supported — no manual cookie copying

```
Search  ─── tracks / albums / artists / playlists
Playback ─── quality switching · source redirect
Content ─── album detail · artist works · lyrics · comments
Discover ─── charts · recommended playlists · categories
Import  ─── single track · playlist
```

### 🎨 Theme packs

Customize the look and feel with theme packs; **light** and **pure black (AMOLED)** are built in.

```
my-theme/
├── config.json      # required
├── index.css        # required
├── preview.png      # optional
└── iframes/         # optional
    └── app.html
```

`index.css` overrides semantic CSS variables: `--color-bg-*`, `--color-fill-*`, `--color-text-*`, `--color-border-*`, `--color-status-*`, `--shadow-*`. See [`res/builtin-themes/light/index.css`](./res/builtin-themes/light/index.css) for the full list.

---

## 🛠️ Development

| Dependency | Version |
| :--------: | :-----: |
|  Node.js   | >= 18   |
|    pnpm    | latest  |

```bash
git clone https://github.com/Piracola/Music.git
cd Music
pnpm install
pnpm start        # launch
pnpm run dev      # dev mode with DevTools
pnpm run package  # package the app
pnpm run make     # build installers
```

### Release

1. Bump `version` in `package.json` and keep `release/version.json` in sync
2. Run the **Build** workflow manually and wait for all platform artifacts
3. Run **Release** with that build run ID — it creates the tag, a draft release, and syncs `release/version.json` to `master` for update checks
4. Review the draft, then publish

---

## 🙏 Credits

- [MusicFreeDesktop](https://github.com/maotoumao/MusicFreeDesktop) — the foundation of this project
- [MusicFree](https://github.com/maotoumao/MusicFree) — plugin protocol and Android app

Licensed under [AGPL-3.0](./LICENSE).
