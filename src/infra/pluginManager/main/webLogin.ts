/**
 * pluginManager — 网页登录窗口（主进程）
 *
 * 流程：开一个临时窗口加载官方登录页 → 用户正常登录 → 轮询该窗口会话里的
 * Cookie，出现鉴权键即视为登录成功 → 把 Cookie 串交回渲染层填进用户变量。
 *
 * 隔离：使用非持久化 partition（进程退出即失效），窗口关闭时清空会话数据；
 * 不注入 preload、不开放 node，页面拿不到宿主能力。
 */
import { BrowserWindow, session, type Session } from 'electron';
import type { IWebLoginResult } from '@appTypes/infra/pluginManager';
import i18n from '@infra/i18n/main';
import type { IWebLoginPreset } from '../common/webLoginPresets';

/** 最长等待时间：超时自动收起窗口，避免被忘在后台 */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
/** 登录页不会回调宿主，只能轮询 Cookie */
const POLL_INTERVAL_MS = 800;
/** 个别音源按 UA 区分登录方式，默认的 Electron UA 容易被判成异常客户端 */
const LOGIN_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const WINDOW_WIDTH = 1000;
const WINDOW_HEIGHT = 720;
/** 固定分区名：Electron 不会回收 partition，每次新建会累积会话 */
const LOGIN_PARTITION = 'web-login';

function pickCookieValue(cookies: Map<string, string>, keys?: string[]): string {
    for (const key of keys ?? []) {
        const value = cookies.get(key);
        if (value) {
            try {
                return decodeURIComponent(value);
            } catch {
                return value;
            }
        }
    }
    return '';
}

/**
 * 拼 Cookie 串。
 * 白名单只是「额外保留」：鉴权键/账号键始终保留，避免白名单写窄导致登录静默失效。
 */
function buildCookieHeader(map: Map<string, string>, preset: IWebLoginPreset): string {
    const keep = preset.keepCookieKeys
        ? new Set([
              ...preset.keepCookieKeys,
              ...preset.authCookieKeys,
              ...(preset.uidCookieKeys ?? []),
              ...(preset.nicknameCookieKeys ?? []),
          ])
        : null;
    const parts: string[] = [];
    for (const [name, value] of map) {
        if (!name || !value) continue;
        if (keep && !keep.has(name)) continue;
        parts.push(`${name}=${value}`);
    }
    return parts.join('; ');
}

/** 判断目标地址是否仍在登录页同一域（防止页面把我们带跑偏） */
function isSameSite(url: string, domain: string): boolean {
    try {
        const host = new URL(url).hostname;
        return host === domain || host.endsWith(`.${domain}`);
    } catch {
        return false;
    }
}

/**
 * 打开网页登录窗口，resolve 出抓到的 Cookie。
 * 用户关窗 / 超时都会 resolve（success: false），不 reject，调用方按提示处理。
 */
export async function openWebLogin(
    preset: IWebLoginPreset,
    parent?: BrowserWindow | null,
): Promise<IWebLoginResult> {
    // 非 persist: 前缀 → 内存会话，进程退出不留痕；固定分区名避免每次新建累积会话
    const loginSession: Session = session.fromPartition(LOGIN_PARTITION);
    // 上一次登录（含异常退出）可能留下残留数据，开窗前先清一次
    try {
        await loginSession.clearStorageData();
    } catch {
        // 清理失败不阻塞登录
    }
    // 登录页没有任何需要宿主授权的理由：摄像头/麦克风/通知一律拒绝
    loginSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
    });
    loginSession.setPermissionCheckHandler(() => false);

    const win = new BrowserWindow({
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        title: i18n.t('plugin.web_login_window_title', { platform: preset.platform }),
        parent: parent ?? undefined,
        modal: Boolean(parent),
        autoHideMenuBar: true,
        backgroundColor: '#ffffff',
        webPreferences: {
            partition: LOGIN_PARTITION,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
    });
    win.webContents.setUserAgent(LOGIN_USER_AGENT);

    return new Promise<IWebLoginResult>((resolve) => {
        let settled = false;
        /** 登录页是否成功打开过：决定加载失败时是直接报错还是当次忽略 */
        let hasLoaded = false;
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

        const stopTimers = () => {
            if (pollTimer) clearInterval(pollTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
            pollTimer = null;
            timeoutTimer = null;
        };

        const settle = async (result: IWebLoginResult) => {
            if (settled) return;
            settled = true;
            stopTimers();
            try {
                await loginSession.clearStorageData();
            } catch {
                // 清痕失败不影响登录结果
            }
            if (!win.isDestroyed()) win.destroy();
            resolve(result);
        };

        const checkCookies = async () => {
            if (settled) return;
            try {
                const cookies = await loginSession.cookies.get({ domain: preset.cookieDomain });
                const map = new Map(cookies.map((item) => [item.name, item.value]));
                const loggedIn = preset.authCookieKeys.some((key) => Boolean(map.get(key)));
                if (!loggedIn) return;

                await settle({
                    success: true,
                    cookie: buildCookieHeader(map, preset),
                    uid: pickCookieValue(map, preset.uidCookieKeys),
                    nickname: pickCookieValue(map, preset.nicknameCookieKeys),
                });
            } catch (err) {
                // 会话刚建立时读取偶发失败，下一轮会重试
                console.warn('[web-login] read cookies failed:', err);
            }
        };

        pollTimer = setInterval(checkCookies, POLL_INTERVAL_MS);
        timeoutTimer = setTimeout(() => {
            void settle({ success: false, message: 'timeout' });
        }, LOGIN_TIMEOUT_MS);

        win.on('closed', () => {
            void settle({ success: false, message: 'cancelled' });
        });

        // 登录页里的第三方跳转（如 passport 子域）留在本窗口，避免弹出无人托管的新窗
        win.webContents.setWindowOpenHandler(({ url }) => {
            if (isSameSite(url, preset.cookieDomain)) {
                void win.loadURL(url).catch(() => {});
            }
            return { action: 'deny' };
        });

        // 只允许网页导航，挡掉 file:// 与自定义协议
        win.webContents.on('will-navigate', (event, url) => {
            if (!/^https?:\/\//i.test(url)) {
                event.preventDefault();
            }
        });

        // 页面会用自己的 <title> 覆盖窗口标题，这里挡掉，保留「登录后自动关闭」的提示
        win.on('page-title-updated', (event) => {
            event.preventDefault();
        });

        win.webContents.on('did-finish-load', () => {
            hasLoaded = true;
        });

        win.webContents.on(
            'did-fail-load',
            (_event, errorCode, errorDescription, _url, isMainFrame) => {
                // 只关心主框架：子框架（广告/统计）失败不影响登录
                if (!isMainFrame) return;
                // -3 = 导航被中断（重定向、用户点击很常见），不算失败
                if (errorCode === -3) return;
                // 页面已经打开过就忽略，避免登录中的偶发请求失败把窗口关掉
                if (hasLoaded) return;
                void settle({ success: false, message: errorDescription || String(errorCode) });
            },
        );

        win.loadURL(preset.url).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            // 页面自身发起跳转时 loadURL 会以 ERR_ABORTED 失败，这与 did-fail-load 的 -3 同源
            if (message.includes('ERR_ABORTED')) return;
            void settle({ success: false, message });
        });
    });
}
