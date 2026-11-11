import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs';
import path from 'path';

import { mainConfig } from './config/webpack.main.config';
import { rendererConfig } from './config/webpack.renderer.config';
import { preloadConfig } from './config/webpack.preload.config';

/**
 * 打包瘦身：这两处是「装船但运行时用不到」的死重。
 *
 * 1. Electron 自带 55 个 Chromium 语言包（约 45 MB），界面文案全走 res/lang，
 *    只有这几个语言的原生对话框用得上；其余删掉，系统设置成别的语言时回落到英文界面。
 * 2. better-sqlite3 的 npm 包里带着编译期才用的 sqlite3.c / .h 和 C++ 源码（约 10 MB），
 *    运行时只认 build/Release/better_sqlite3.node。
 *
 * 放在 afterCopy 里删：那时应用目录还是散文件，之后才压成 app.asar。
 */
const KEEP_LOCALES = ['en-US', 'zh-CN', 'zh-TW'];
const DEAD_WEIGHT_IN_APP = [
    'node_modules/better-sqlite3/deps',
    'node_modules/better-sqlite3/src',
    'node_modules/sharp/src',
    'node_modules/sharp/install',
];

/**
 * 注意：forge 传给 afterCopy 的 buildPath 是**应用目录**（…/resources/app），
 * 不是打包出来的平台目录，所以语言包要往上两级去找。
 */
function trimPackagedApp(appPath: string) {
    const platformRoot = path.resolve(appPath, '..', '..');
    const localesDir = path.join(platformRoot, 'locales');
    if (fs.existsSync(localesDir)) {
        for (const name of fs.readdirSync(localesDir)) {
            if (!name.endsWith('.pak')) continue;
            if (KEEP_LOCALES.includes(name.slice(0, -'.pak'.length))) continue;
            fs.rmSync(path.join(localesDir, name), { force: true });
        }
    }
    for (const rel of DEAD_WEIGHT_IN_APP) {
        fs.rmSync(path.join(appPath, rel), { recursive: true, force: true });
    }
}

const config: ForgeConfig = {
    packagerConfig: {
        asar: {
            unpack: '**/node_modules/{sharp,@img}/**/*',
        },
        appBundleId: 'com.piracola.music',
        icon: path.resolve(__dirname, 'res/logo'),
        executableName: 'Music',
        extraResource: [path.resolve(__dirname, 'res')],
        protocols: [
            {
                name: 'Music',
                schemes: ['music', 'musicfree'],
            },
        ],
        // 必须在 afterCopy 阶段（此时资源还是散文件），asar 打包在它之后
        afterCopy: [
            (
                buildPath: string,
                _electronVersion: string,
                _platform: string,
                _arch: string,
                callback: () => void,
            ) => {
                trimPackagedApp(buildPath);
                callback();
            },
        ],
    },
    rebuildConfig: {},
    makers: [
        new MakerDMG({
            format: 'ULFO',
        }),
        new MakerDeb({
            options: {
                bin: 'Music',
                mimeType: ['x-scheme-handler/music'],
            },
        }),
        new MakerRpm({
            options: {
                bin: 'Music',
            },
        }),
    ],
    plugins: [
        new AutoUnpackNativesPlugin({}),
        new WebpackPlugin({
            devContentSecurityPolicy:
                "default-src * self blob: data: gap: file:; style-src * self 'unsafe-inline' blob: data: gap: file:; script-src * 'self' 'unsafe-eval' 'unsafe-inline' blob: data: gap: file:; object-src * 'self' blob: data: gap:; img-src * self 'unsafe-inline' blob: data: gap: file:; connect-src self * 'unsafe-inline' blob: data: gap:; frame-src * self blob: data: gap:;",
            mainConfig,
            renderer: {
                config: rendererConfig,
                entryPoints: [
                    {
                        html: './src/documents/index.html',
                        js: './src/renderer/mainWindow/index.tsx',
                        name: 'main_window',
                        preload: {
                            js: './src/preload/main.ts',
                            config: preloadConfig,
                        },
                    },
                    {
                        html: './src/documents/index.html',
                        js: './src/renderer/lyricWindow/index.tsx',
                        name: 'lyric_window',
                        preload: {
                            js: './src/preload/auxiliary.ts',
                            config: preloadConfig,
                        },
                    },
                    {
                        html: './src/documents/index.html',
                        js: './src/renderer/minimodeWindow/index.tsx',
                        name: 'minimode_window',
                        preload: {
                            js: './src/preload/auxiliary.ts',
                            config: preloadConfig,
                        },
                    },
                ],
            },
        }),
        // Externals plugin must be after WebpackPlugin so that
        // packagerConfig.ignore is already set as a function
        {
            name: '@timfish/forge-externals-plugin',
            config: {
                externals: ['sharp', 'better-sqlite3'],
                includeDeps: true,
            },
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: false,
        }),
    ],
};

export default config;
