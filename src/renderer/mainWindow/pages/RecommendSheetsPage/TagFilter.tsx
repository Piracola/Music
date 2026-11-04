import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@common/cn';
import { Chip } from '../../components/ui/Chip';

/** 默认标签（所有插件通用） */
const DEFAULT_TAG: IMedia.IUnique = { id: '', title: '' };

export interface TagFilterProps {
    /** 标签数据 */
    tags: IPlugin.IGetRecommendSheetTagsResult | null;
    /** 当前选中的标签 */
    selectedTag: IMedia.IUnique;
    /** 选中标签变更回调 */
    onTagChange: (tag: IMedia.IUnique) => void;
    /** 概览模式：顶行只留「更多标签」，标签不占首屏 */
    moreOnly?: boolean;
}

/**
 * TagFilter — 标签筛选栏
 *
 * 顶行：默认标签（带下拉箭头） + pinned 标签
 * 下拉面板：按分组展示全部标签
 * moreOnly：顶行只留一个「更多标签」，其余标签全在面板里
 */
export function TagFilter({ tags, selectedTag, onTagChange, moreOnly = false }: TagFilterProps) {
    const { t } = useTranslation();
    const [panelOpen, setPanelOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭面板
    useEffect(() => {
        if (!panelOpen) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [panelOpen]);

    const togglePanel = useCallback(() => {
        setPanelOpen((prev) => !prev);
    }, []);

    const backToDefault = useCallback(() => {
        onTagChange(DEFAULT_TAG);
        setPanelOpen(false);
    }, [onTagChange]);

    const handlePinnedClick = useCallback(
        (tag: IMedia.IUnique) => {
            onTagChange(tag);
        },
        [onTagChange],
    );

    const handlePanelTagClick = useCallback(
        (tag: IMedia.IUnique) => {
            onTagChange(tag);
            setPanelOpen(false);
        },
        [onTagChange],
    );

    const pinnedTags = tags?.pinned ?? [];
    const groupedTags = tags?.data ?? [];
    const hasDropdown = groupedTags.length > 0;
    const defaultLabel = t('playlist.default_tag');

    const chevron = hasDropdown ? (
        <ChevronDown
            size={14}
            className={cn('p-recommend-sheets__tag-filter-chevron', panelOpen && 'is-open')}
        />
    ) : undefined;

    const renderFirstChip = () => {
        // 概览模式：一个「更多标签」入口，够用又不占地方
        if (moreOnly && hasDropdown) {
            return (
                <Chip
                    label={t('playlist.more_tags')}
                    active={panelOpen}
                    onClick={togglePanel}
                    suffix={chevron}
                />
            );
        }
        // 筛选模式：当前选中的标签不可再选，所以给一个明确的「默认」回入口
        if (!moreOnly && selectedTag.id !== DEFAULT_TAG.id) {
            return (
                <>
                    <Chip label={defaultLabel} onClick={backToDefault} />
                    <Chip
                        label={selectedTag.title ?? defaultLabel}
                        active
                        onClick={hasDropdown ? togglePanel : undefined}
                        suffix={chevron}
                    />
                </>
            );
        }
        return (
            <Chip
                label={defaultLabel}
                active={panelOpen}
                onClick={hasDropdown ? togglePanel : undefined}
                suffix={chevron}
            />
        );
    };

    return (
        <div className="p-recommend-sheets__tag-filter" ref={panelRef}>
            {/* 标签行 */}
            <div className="p-recommend-sheets__tag-filter-row">
                {renderFirstChip()}
                {pinnedTags.map((tag) => (
                    <Chip
                        key={tag.id}
                        label={tag.title}
                        active={selectedTag.id === tag.id}
                        onClick={() => handlePinnedClick(tag)}
                    />
                ))}
            </div>

            {/* 下拉面板 */}
            {panelOpen && groupedTags.length > 0 && (
                <div className="p-recommend-sheets__tag-filter-panel">
                    {groupedTags.map((group, idx) => (
                        <div className="p-recommend-sheets__tag-filter-panel-group" key={idx}>
                            {group.title && (
                                <div className="p-recommend-sheets__tag-filter-group-title">
                                    {group.title}
                                </div>
                            )}
                            <div className="p-recommend-sheets__tag-filter-group-tags">
                                {(group.data ?? []).map((tag) => (
                                    <Chip
                                        key={tag.id}
                                        label={tag.title}
                                        active={selectedTag.id === tag.id}
                                        onClick={() => handlePanelTagClick(tag)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export { DEFAULT_TAG };
