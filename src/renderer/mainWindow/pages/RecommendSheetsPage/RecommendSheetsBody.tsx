import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { RequestStatus } from '@common/constant';
import { MediaGrid } from '../../components/ui/MediaGrid';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { musicSheetRoute } from '../../routes';
import { TagFilter, DEFAULT_TAG } from './TagFilter';
import { useRecommendTags } from './useRecommendTags';
import { useRecommendSheets } from './useRecommendSheets';

interface RecommendSheetsBodyProps {
    pluginHash: string;
}

/**
 * RecommendSheetsBody — 单个插件的推荐歌单内容
 *
 * 概览模式（默认标签）：默认推荐网格 + 带封面的标签组平铺成卡片分区（如「我的歌单」）
 * 筛选模式（选中某个标签）：标签筛选栏 + MediaGrid 歌单卡片网格 + 分页加载
 */
export function RecommendSheetsBody({ pluginHash }: RecommendSheetsBodyProps) {
    const { t } = useTranslation();
    const { tags, status: tagsStatus } = useRecommendTags(pluginHash);
    const [selectedTag, setSelectedTag] = useState<IMedia.IUnique>(DEFAULT_TAG);
    const navigate = useNavigate();

    // 插件切换时重置标签选择
    useEffect(() => {
        setSelectedTag(DEFAULT_TAG);
    }, [pluginHash]);

    const isOverview = selectedTag.id === DEFAULT_TAG.id;

    const { sheets, requestStatus, isEnd, loadMore, retry } = useRecommendSheets(
        pluginHash,
        selectedTag,
    );

    // 条目自带封面的标签组 → 概览页里直接平铺成卡片分区
    const cardGroups = useMemo(
        () => (tags?.data ?? []).filter((group) => (group.data ?? []).some((item) => item.artwork)),
        [tags],
    );

    // 卡片分区已经在页面上铺开了，就不该再作为「筛选标签」出现
    const filterTags = useMemo(() => {
        if (!tags) return tags;
        return {
            ...tags,
            data: (tags.data ?? []).filter((group) => !cardGroups.includes(group)),
        };
    }, [tags, cardGroups]);

    const handleTagChange = useCallback((tag: IMedia.IUnique) => {
        setSelectedTag(tag);
    }, []);

    const handleItemClick = useCallback(
        (item: IMusic.IMusicSheetItem) => {
            navigate(musicSheetRoute(item.platform, item.id), {
                state: { sheetItem: item },
            });
        },
        [navigate],
    );

    // 标签加载中
    if (tagsStatus === RequestStatus.Pending && !tags) {
        return <StatusPlaceholder status={RequestStatus.Pending} />;
    }

    if (isOverview) {
        return (
            <div className="p-recommend-sheets__body">
                <TagFilter
                    tags={filterTags}
                    selectedTag={selectedTag}
                    onTagChange={handleTagChange}
                    moreOnly
                />

                <MediaGrid
                    data={sheets}
                    requestStatus={requestStatus}
                    onRetry={retry}
                    onItemClick={handleItemClick}
                    enableLoadMore={!isEnd && sheets.length > 0}
                    loadMoreStatus={requestStatus}
                    onLoadMore={loadMore}
                    onLoadMoreRetry={retry}
                    emptyTitle={t('playlist.recommend_empty')}
                />

                {cardGroups.map((group, idx) => (
                    <section className="p-recommend-sheets__section" key={group.title ?? idx}>
                        {group.title && (
                            <h3 className="p-recommend-sheets__section-title">{group.title}</h3>
                        )}
                        <MediaGrid
                            data={group.data as IMusic.IMusicSheetItem[]}
                            onItemClick={handleItemClick}
                        />
                    </section>
                ))}
            </div>
        );
    }

    return (
        <div className="p-recommend-sheets__body">
            <TagFilter tags={filterTags} selectedTag={selectedTag} onTagChange={handleTagChange} />

            <MediaGrid
                data={sheets}
                requestStatus={requestStatus}
                onRetry={retry}
                onItemClick={handleItemClick}
                enableLoadMore={!isEnd && sheets.length > 0}
                loadMoreStatus={requestStatus}
                onLoadMore={loadMore}
                onLoadMoreRetry={retry}
                emptyTitle={t('playlist.recommend_empty')}
            />
        </div>
    );
}
