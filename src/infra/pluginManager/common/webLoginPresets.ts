/**
 * pluginManager — 网页登录预设
 *
 * 有些音源（酷我等）的登录态只存在于网页会话的 Cookie 里，让用户自己开 F12
 * 复制 Cookie 门槛太高。这里登记「插件平台 → 登录页」，宿主据此开一个临时窗口
 * 让用户正常登录（扫码/验证码都能过），再把 Cookie 抓回来填进用户变量。
 *
 * 新增一个音源只需在这里加一条，渲染层和主进程都不用改。
 */

export interface IWebLoginPreset {
    /** 与插件声明的 platform 完全一致 */
    platform: string;
    /** 登录页地址 */
    url: string;
    /** 抓 Cookie 的域名（含子域） */
    cookieDomain: string;
    /** 出现任意一个键即认为登录成功 */
    authCookieKeys: string[];
    /** 登录成功后写进插件 userVariables 里的哪个键 */
    variableKey: string;
    /** 只保留这些 Cookie 键，其余丢弃；不填则全留 */
    keepCookieKeys?: string[];
    /** 从 Cookie 里读账号昵称 / uid 的键（仅用于提示文案） */
    nicknameCookieKeys?: string[];
    uidCookieKeys?: string[];
}

export const WEB_LOGIN_PRESETS: IWebLoginPreset[] = [
    {
        platform: '酷我音乐',
        url: 'https://www.kuwo.cn/',
        cookieDomain: 'kuwo.cn',
        // 酷我的鉴权键（与插件 session.ts 的判断保持一致）
        authCookieKeys: ['sid', 't3kwid', 'kw_token', 'websid'],
        variableKey: 'kuwoCookie',
        keepCookieKeys: [
            'userid',
            'uid',
            'sid',
            'websid',
            't3kwid',
            'kw_token',
            'uname3',
            'username',
            'nickname',
            'deviceid',
        ],
        nicknameCookieKeys: ['uname3', 'username', 'nickname'],
        uidCookieKeys: ['userid', 'uid'],
    },
];

/** 按平台查找登录预设；找不到说明该插件没接入网页登录 */
export function findWebLoginPreset(platform?: string): IWebLoginPreset | null {
    if (!platform) return null;
    return WEB_LOGIN_PRESETS.find((preset) => preset.platform === platform) ?? null;
}
