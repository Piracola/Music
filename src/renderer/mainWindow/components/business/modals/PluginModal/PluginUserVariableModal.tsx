import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import pluginManager from '@infra/pluginManager/renderer';
import { usePluginMeta } from '@infra/pluginManager/renderer/hooks';
import { findWebLoginPreset } from '@infra/pluginManager/common/webLoginPresets';
import './index.scss';

interface PluginUserVariableModalProps {
    close: () => void;
    plugin: IPlugin.IPluginDelegate;
}

/**
 * PluginUserVariableModal — 用户变量编辑弹窗
 *
 * 根据插件声明的 userVariables 渲染 key-value 编辑列表。
 */
export default function PluginUserVariableModal({ close, plugin }: PluginUserVariableModalProps) {
    const { t } = useTranslation();
    const allPluginMeta = usePluginMeta();

    // 初始化变量值：先从 pluginMeta 中取存储的值
    const initialValues = useMemo(() => {
        const stored = allPluginMeta[plugin.hash]?.userVariables ?? {};
        const values: Record<string, string> = {};
        for (const v of plugin.userVariables ?? []) {
            values[v.key] = stored[v.key] ?? '';
        }
        return values;
    }, [plugin.hash, plugin.userVariables, allPluginMeta]);

    const [values, setValues] = useState<Record<string, string>>(initialValues);
    const [saving, setSaving] = useState(false);
    const [loggingIn, setLoggingIn] = useState(false);

    /** 该平台是否接入了网页登录（目前只有酷我），没有就不显示入口 */
    const loginPreset = useMemo(() => {
        const preset = findWebLoginPreset(plugin.platform);
        if (!preset) return null;
        // 变量键必须真的由插件声明，否则写进去的是一份没有输入框承载的幽灵值
        const declared = (plugin.userVariables ?? []).some((v) => v.key === preset.variableKey);
        return declared ? preset : null;
    }, [plugin.platform, plugin.userVariables]);

    const handleChange = useCallback((key: string, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    /**
     * 网页登录：主进程开临时窗口让用户正常登录，成功后把抓到的 Cookie
     * 填进对应变量，仍需用户点确认才落盘（避免静默改配置）。
     */
    const handleWebLogin = useCallback(async () => {
        if (!loginPreset) return;
        setLoggingIn(true);
        try {
            const result = await pluginManager.openWebLogin(plugin.platform);
            const cookie = result.cookie;
            if (result.success && cookie) {
                setValues((prev) => ({ ...prev, [loginPreset.variableKey]: cookie }));
                const account = result.nickname || result.uid;
                showToast(
                    account
                        ? t('plugin.web_login_success_with_account', { account })
                        : t('plugin.web_login_success'),
                );
            } else if (result.message === 'cancelled') {
                // 用户自己关的窗，不用提示
            } else if (result.message === 'timeout') {
                showToast(t('plugin.web_login_timeout'), { type: 'warn' });
            } else {
                showToast(t('plugin.web_login_failed'), { type: 'warn' });
            }
        } catch {
            showToast(t('plugin.web_login_failed'), { type: 'warn' });
        } finally {
            setLoggingIn(false);
        }
    }, [loginPreset, plugin.platform, t]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            await pluginManager.setPluginMeta(plugin.hash, { userVariables: values });
            showToast(t('plugin.user_variable_success'));
            close();
        } catch {
            showToast(t('plugin.update_failed'), { type: 'warn' });
        } finally {
            setSaving(false);
        }
    }, [plugin.hash, values, close, t]);

    return (
        <Modal
            open
            onClose={close}
            title={`${t('plugin.prop_user_variable')} · ${plugin.platform}`}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={saving}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                        {t('common.confirm')}
                    </Button>
                </>
            }
        >
            <div className="plugin-modal__variables">
                {loginPreset && (
                    <div className="plugin-modal__web-login">
                        <div className="plugin-modal__web-login-row">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleWebLogin}
                                loading={loggingIn}
                            >
                                {t('plugin.web_login')}
                            </Button>
                            <span className="plugin-modal__web-login-hint">
                                {t('plugin.web_login_hint')}
                            </span>
                        </div>
                    </div>
                )}
                <div className="plugin-modal__var-list">
                    {(plugin.userVariables ?? []).map((variable) => (
                        <div key={variable.key} className="plugin-modal__var-row">
                            <label className="plugin-modal__var-label">
                                {variable.name ?? variable.key}
                                {variable.hint && (
                                    <span className="plugin-modal__var-hint">{variable.hint}</span>
                                )}
                            </label>
                            <Input
                                placeholder={variable.hint ?? variable.key}
                                value={values[variable.key] ?? ''}
                                onChange={(e) => handleChange(variable.key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
