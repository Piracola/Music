#!/usr/bin/env node
/**
 * build.mjs —— 一个极简的构建面板。
 *
 * 这个仓库里其实有两件互不相干的事要构建：
 *   1. 插件（plugin-kuwo）→ 一个能被宿主加载的 kuwo.js
 *   2. 应用本体（Electron）→ 可运行目录 / 安装包
 * 以前得记住两套命令和两个目录，这个脚本把它们收在一个菜单里。
 *
 * 用法：
 *   node scripts/build.mjs            交互式菜单
 *   node scripts/build.mjs plugin     直接构建插件
 *   node scripts/build.mjs app        直接构建应用（可运行目录）
 *   node scripts/build.mjs make       构建应用 + 打安装包
 *   node scripts/build.mjs repack     跳过构建，用现有 out/ 直接重打安装包
 *   node scripts/build.mjs portable   构建应用 + 打便携版 zip
 *   node scripts/build.mjs all        插件 + 应用
 */
import { spawn, execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_DIR = path.join(ROOT, 'plugin-kuwo');
const PLUGIN_OUT = path.join(PLUGIN_DIR, 'dist', 'kuwo.js');

// ── 终端配色（没有 TTY 或声明了 NO_COLOR 就退化成纯文本） ──
const COLOR_ON = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code) => (text) => (COLOR_ON ? `\u001b[${code}m${text}\u001b[0m` : String(text));
const dim = paint('2');
const bold = paint('1');
const green = paint('32');
const red = paint('31');
const cyan = paint('36');
const yellow = paint('33');

const line = (char = '─', width = 46) => dim(char.repeat(width));

/** 跑一条外部命令，输出直接走当前终端（不接管、不缓冲） */
function run(command, args, cwd) {
    return new Promise((resolve) => {
        // Windows 下 npm/pnpm 是 .cmd，只能借 shell 执行；拼成一条命令串，
        // 避免 spawn(shell:true) + args 数组的弃用警告
        const quote = (value) => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);
        const commandLine = [command, ...args].map(quote).join(' ');
        const child = spawn(commandLine, {
            cwd,
            stdio: 'inherit',
            shell: true,
        });
        child.on('error', (err) => {
            console.log(red(`  ✗ 启动失败：${err.message}`));
            resolve(-1);
        });
        child.on('close', (code) => resolve(code ?? -1));
    });
}

/** 带标题、耗时、成败的小步骤 */
async function step(title, command, args, cwd = ROOT) {
    console.log(`\n${cyan('▶')} ${bold(title)}`);
    const startedAt = Date.now();
    const code = await run(command, args, cwd);
    const cost = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (code === 0) {
        console.log(green(`  ✓ 完成（${cost}s）`));
        return true;
    }
    console.log(red(`  ✗ 失败（退出码 ${code}，${cost}s）`));
    return false;
}

function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function describeArtifact(file) {
    if (!existsSync(file)) return null;
    const stat = statSync(file);
    return `${path.relative(ROOT, file)}  ${dim(humanSize(stat.size))}`;
}

/** 插件依赖被删过就会出现「有 esbuild 目录但没有可执行文件」的半残状态，这里兜一下 */
async function ensurePluginDeps() {
    if (existsSync(path.join(PLUGIN_DIR, 'node_modules', 'esbuild', 'bin', 'esbuild'))) {
        return true;
    }
    console.log(yellow('  插件依赖不完整，先装一次（用 npm，绕开 pnpm 工作区）'));
    return step(
        '安装插件依赖',
        'npm',
        ['install', '--no-package-lock', '--no-audit', '--no-fund'],
        PLUGIN_DIR,
    );
}

async function buildPlugin() {
    if (!(await ensurePluginDeps())) return false;
    const ok = await step(
        '打包插件（esbuild → plugin-kuwo/dist/kuwo.js）',
        'npm',
        ['run', 'build'],
        PLUGIN_DIR,
    );
    if (ok) {
        const info = describeArtifact(PLUGIN_OUT);
        if (info) console.log(dim(`  产物：${info}`));
    }
    return ok;
}

/** 应用依赖没装全（典型情况：装了 --ignore-scripts，没有 Electron 本体）时补一次 */
async function ensureAppDeps() {
    const electronBinary = path.join(
        ROOT,
        'node_modules',
        'electron',
        'dist',
        process.platform === 'win32' ? 'electron.exe' : 'electron',
    );
    if (existsSync(electronBinary)) return true;
    console.log(yellow('  应用依赖不完整（缺 Electron 本体），先装一次，可能要下载上百 MB'));
    return step('安装应用依赖', 'pnpm', ['install']);
}

async function buildApp() {
    if (!(await ensureAppDeps())) return false;
    const ok = await step('构建应用（electron-forge package）', 'pnpm', ['run', 'package']);
    if (ok) {
        const out = path.join(ROOT, 'out');
        if (existsSync(out)) {
            const dirs = readdirSync(out).filter((name) => name !== 'make');
            for (const name of dirs) console.log(dim(`  产物：out/${name}`));
        }
    } else {
        console.log(
            dim(
                '  提示：应用构建需要 Electron 本体，若 node_modules 是 --ignore-scripts 装的，先跑一次 pnpm install',
            ),
        );
    }
    return ok;
}

/**
 * 找 Inno Setup 的编译器。
 * 这仓库的 forge 配置里只有 dmg/deb/rpm（Linux/macOS 用），Windows 的安装包是
 * CI 里用 Inno Setup 跑的（见 .github/workflows/build.yml），所以本地也走同一条路。
 */
function findIscc() {
    const candidates = [
        process.env.ISCC_PATH,
        path.join(process.env.ProgramFiles ?? '', 'Inno Setup 6', 'ISCC.exe'),
        path.join(process.env['ProgramFiles(x86)'] ?? '', 'Inno Setup 6', 'ISCC.exe'),
        path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    ].filter(Boolean);
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function readAppVersion() {
    try {
        const raw = readFileSync(path.join(ROOT, 'package.json'), 'utf8');
        return JSON.parse(raw).version ?? '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/**
 * 便携版靠「exe 同级有个 portable/ 目录」来切换数据目录（见 src/main/index.ts）。
 * 这个标记要是留在 out/ 里，随后打出来的安装包也会装成便携版，所以打完/打前都要清掉。
 */
const PORTABLE_MARKER_DIR = path.join(ROOT, 'out', 'Music-win32-x64', 'portable');

function clearPortableMarker() {
    rmSync(PORTABLE_MARKER_DIR, { recursive: true, force: true });
}

/**
 * 便携版：和 CI 一致，放一个 .portable 标记再压成 zip
 */
async function buildPortable(version) {
    const appDir = path.join(ROOT, 'out', 'Music-win32-x64');
    if (!existsSync(appDir)) {
        console.log(red('  没找到 out/Music-win32-x64，先构建应用'));
        return false;
    }
    mkdirSync(PORTABLE_MARKER_DIR, { recursive: true });
    writeFileSync(path.join(PORTABLE_MARKER_DIR, '.portable'), '');

    const zipPath = path.join(ROOT, 'out', `Music-${version}-win32-x64-portable.zip`);
    rmSync(zipPath, { force: true });
    const ok = await step('打包便携版（zip）', 'tar', [
        '-a',
        '-c',
        '-f',
        zipPath,
        '-C',
        path.join(ROOT, 'out'),
        'Music-win32-x64',
    ]);
    // 标记只用这一次，留着会污染后面的安装包
    clearPortableMarker();
    if (ok) console.log(dim(`  产物：out/${path.basename(zipPath)}`));
    return ok;
}

/**
 * 压缩档位。
 *
 * Inno Setup 的 lzma（默认）压 100+ MB 的 Electron 要一分多钟，本地反复打包太磨人；
 * lzma2/fast 只要十几秒，体积大 25 MB 左右。发版想要小安装包就设环境变量：
 *   MYAPP_COMPRESSION=lzma
 * CI 走的是 .iss 里的默认值（lzma），不受这里影响。
 */
const COMPRESSION = process.env.MYAPP_COMPRESSION ?? 'lzma2/fast';

/** 用现有 out/ 打安装包（不重新构建应用） */
async function packageInstaller() {
    const appDir = path.join(ROOT, 'out', 'Music-win32-x64');
    if (!existsSync(appDir)) {
        console.log(red('  没找到 out/Music-win32-x64，先构建应用'));
        return false;
    }
    const version = readAppVersion();
    const iscc = findIscc();
    if (!iscc) {
        console.log('');
        console.log(yellow('  没找到 Inno Setup（ISCC.exe），没法打安装包'));
        console.log(dim('  想要 .exe 安装包：装一个 Inno Setup 6，或用 ISCC_PATH 指定路径'));
        return false;
    }
    // 之前打过便携版的话，这里可能还留着 portable/ 标记，会让安装包装成便携版
    clearPortableMarker();
    const ok = await step(`生成安装包（Inno Setup · 压缩 ${COMPRESSION}）`, iscc, [
        `/DMyAppVersion=${version}`,
        `/DMyAppId=${process.env.MYAPPID ?? '68AF1690-EE37-4C97-AF52-0F178C335BF3'}`,
        `/DMyCompression=${COMPRESSION}`,
        path.join('release', 'build-windows.iss'),
    ]);
    if (!ok) return false;

    const raw = path.join(ROOT, 'out', 'MusicSetup.exe');
    const named = path.join(ROOT, 'out', `Music-${version}-win32-x64-setup.exe`);
    if (existsSync(raw)) {
        rmSync(named, { force: true });
        renameSync(raw, named);
        const info = describeArtifact(named);
        if (info) console.log(dim(`  产物：${info}`));
    }
    return true;
}

const TASKS = {
    plugin: { label: '构建插件', hint: 'plugin-kuwo → dist/kuwo.js', run: buildPlugin },
    app: { label: '构建应用', hint: '可运行目录 out/（不生成安装包）', run: buildApp },
    make: {
        label: '打安装包',
        hint: `构建应用 → .exe 安装包（压缩 ${COMPRESSION}）`,
        run: async () => (await buildApp()) && packageInstaller(),
    },
    repack: {
        label: '重打安装包',
        hint: '跳过构建，拿现有 out/ 直接压缩（最快的一种）',
        run: packageInstaller,
    },
    portable: {
        label: '打便携版',
        hint: '构建应用 → 便携版 .zip',
        run: async () => (await buildApp()) && buildPortable(readAppVersion()),
    },
    all: {
        label: '插件 + 应用',
        hint: '先构建插件，再构建应用',
        run: async () => {
            const pluginOk = await buildPlugin();
            if (!pluginOk) return false;
            return buildApp();
        },
    },
};

// ── 菜单 ──

const MENU = [
    { key: 'plugin', label: '构建插件 kuwo.js', note: TASKS.plugin.hint },
    { key: 'app', label: '构建应用（可运行目录）', note: TASKS.app.hint },
    { key: 'make', label: '打安装包', note: TASKS.make.hint },
    { key: 'repack', label: '重打安装包（跳过构建）', note: TASKS.repack.hint },
    { key: 'portable', label: '打便携版 zip', note: TASKS.portable.hint },
    { key: 'all', label: '插件 + 应用', note: TASKS.all.hint },
    { key: 'quit', label: '退出', note: '' },
];

function header() {
    let branch = '';
    try {
        branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: ROOT,
            encoding: 'utf8',
        }).trim();
    } catch {
        /* 不在 git 仓库里也无所谓 */
    }
    console.log('');
    console.log(bold('  Music 构建面板'));
    console.log(dim(`  ${branch ? `${branch} · ` : ''}node ${process.version} · ${ROOT}`));
    console.log(`  ${line()}`);
}

/** 方向键选择：返回选中项下标 */
function select(options, initial = 0) {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        if (!stdin.isTTY) {
            // 非交互终端：直接选第一个，别装死
            resolve(initial);
            return;
        }
        let cursor = initial;
        let rendered = 0;

        const draw = () => {
            if (rendered > 0) process.stdout.write(`\u001b[${rendered}A`);
            for (let i = 0; i < options.length; i++) {
                const active = i === cursor;
                const mark = active ? cyan('❯') : ' ';
                const label = active ? bold(options[i].label) : options[i].label;
                const note = options[i].note ? dim(`  ${options[i].note}`) : '';
                process.stdout.write(`\u001b[2K${mark} ${label}${note}\n`);
            }
            rendered = options.length;
        };

        const finish = (index) => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            resolve(index);
        };

        const onData = (chunk) => {
            const key = chunk.toString();
            if (key === '\u0003' || key === 'q') {
                finish(-1);
                return;
            }
            if (key === '\u001b[A' || key === 'k')
                cursor = (cursor - 1 + options.length) % options.length;
            else if (key === '\u001b[B' || key === 'j') cursor = (cursor + 1) % options.length;
            else if (key === '\r' || key === '\n') {
                draw();
                console.log('');
                finish(cursor);
                return;
            }
            draw();
        };

        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        stdin.on('data', onData);
        // 提示行先打，选项块保持在光标上方，重绘时才能整块盖掉
        console.log(dim('  ↑↓ 选择 · Enter 开始 · q 退出'));
        draw();
    });
}

async function main() {
    const cliTask = process.argv[2];
    if (cliTask) {
        const task = TASKS[cliTask];
        if (!task) {
            console.log(red(`未知任务：${cliTask}（可选：${Object.keys(TASKS).join(' / ')}）`));
            process.exitCode = 1;
            return;
        }
        header();
        const ok = await task.run();
        console.log('');
        process.exitCode = ok ? 0 : 1;
        return;
    }

    // 非交互终端（比如被别的脚本调用）不猜你想干嘛，直接把用法列出来
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        header();
        console.log('  当前不是交互终端，用参数指定任务：');
        for (const key of Object.keys(TASKS)) {
            console.log(
                `    node scripts/build.mjs ${cyan(key.padEnd(6))}  ${dim(TASKS[key].hint)}`,
            );
        }
        console.log('');
        return;
    }

    for (;;) {
        header();
        const index = await select(MENU);
        if (index < 0 || MENU[index].key === 'quit') {
            console.log(dim('  再见'));
            return;
        }
        const task = TASKS[MENU[index].key];
        const ok = await task.run();
        console.log('');
        console.log(ok ? green('  ✓ 全部完成') : red('  ✗ 有步骤失败'));
        await new Promise((resolve) => setTimeout(resolve, ok ? 900 : 1600));
    }
}

main().catch((err) => {
    console.error(red(`构建面板崩了：${err?.stack ?? err}`));
    process.exitCode = 1;
});
