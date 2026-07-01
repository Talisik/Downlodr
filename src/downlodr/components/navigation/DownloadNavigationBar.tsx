/**
 * Navigation sidebar for Downlodr.
 * Displays status, category, and tag navigation links with collapsible sections.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BiLayer, BiSolidPlusSquare } from 'react-icons/bi';
import { BsHourglassSplit, BsTag } from 'react-icons/bs';
import {
  FiChevronDown,
  FiChevronRight,
  FiDownload,
  FiFolder,
} from 'react-icons/fi';
import { HiMiniArrowPath } from 'react-icons/hi2';
import { MdPlayArrow, MdSubscriptions } from 'react-icons/md';
import { PiPauseBold } from 'react-icons/pi';
import { TbDeviceTabletSearch } from 'react-icons/tb';
import { NavLink, useMatch, useResolvedPath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDownloadStore } from '../../store/downloadStore';
import CategoryContextMenu from '../contextMenu/CategoryContextMenu';
import TagContextMenu from '../contextMenu/TagContextMenu';

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { FaHeart, FaRegTimesCircle } from 'react-icons/fa';
import { LuNewspaper, LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu';
import { useNavAnimation } from '@/downlodr/hooks/useNavAnimation';

// ── Shared helpers ────────────────────────────────────────────────────────────

type NavItemProps = {
  to: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  activeClass?: string;
  hoverClass?: string;
};

const NavItem: React.FC<NavItemProps> = ({
  to,
  label,
  icon,
  collapsed,
  activeClass = 'bg-titleBar dark:bg-[#3D3D3D]',
  hoverClass = 'hover:bg-titleBar dark:hover:bg-red-100',
}) => {
  // useMatch instead of NavLink's className render-prop so Radix Slot (used by
  // TooltipTrigger asChild) receives a plain string — Slot calls .toString() on
  // non-string values, which turns a function into its source code and strips all
  // CSS classes (including display:flex), causing the icon/label to stack vertically.
  const resolved = useResolvedPath(to);
  const isActive = !!useMatch({ path: resolved.pathname, end: true });

  return (
    <TooltipWrapper content={collapsed ? label : null} side="left">
      <NavLink
        to={to}
        className={`flex flex-nowrap items-center h-7 rounded dark:text-gray-200 ${hoverClass}${
          isActive ? ` ${activeClass}` : ''
        }`}
      >
        <span className="flex items-center justify-center w-[46px] flex-shrink-0">
          {icon}
        </span>
        <span className="nav-label text-[12px] whitespace-nowrap overflow-hidden min-w-0">
          {label}
        </span>
      </NavLink>
    </TooltipWrapper>
  );
};

type SectionHeaderProps = {
  label: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onCollapsedClick: () => void;
};

const SectionHeader: React.FC<SectionHeaderProps> = ({
  label,
  isOpen,
  collapsed,
  onToggle,
  onCollapsedClick,
}) => (
  <TooltipWrapper content={collapsed ? label : null} side="left">
    <button
      onClick={collapsed ? onCollapsedClick : onToggle}
      className={`w-full flex items-center h-7 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200`}
    >
      <span className="nav-label flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0">
        <span className="flex-shrink-0">
          {isOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </span>
    </button>
  </TooltipWrapper>
);

// ── Component ─────────────────────────────────────────────────────────────────

const Navigation = ({
  className,
  collapsed,
  toggleCollapse,
}: {
  className?: string;
  collapsed?: boolean;
  toggleCollapse?: () => void;
}) => {
  const { t } = useTranslation('sidebar');
  const [openSections, setOpenSections] = useState({
    status: true,
    category: false,
    tag: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const expandAndOpen = (section: keyof typeof openSections) => {
    userToggledRef.current = true;
    toggleCollapse?.();
    setTimeout(
      () => setOpenSections((prev) => ({ ...prev, [section]: true })),
      50,
    );
  };

  const [contextMenu, setContextMenu] = useState<{
    category: string;
    x: number;
    y: number;
  } | null>(null);
  const renameCategory = useDownloadStore((state) => state.renameCategory);
  const deleteCategory = useDownloadStore((state) => state.deleteCategory);

  const [tagContextMenu, setTagContextMenu] = useState<{
    tag: string;
    x: number;
    y: number;
  } | null>(null);
  const renameTag = useDownloadStore((state) => state.renameTag);
  const deleteTag = useDownloadStore((state) => state.deleteTag);

  const handleCategoryRightClick = (
    e: React.MouseEvent,
    categoryName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setTagContextMenu(null);
    setContextMenu({ x: e.clientX, y: e.clientY, category: categoryName });
  };

  const handleTagRightClick = (e: React.MouseEvent, tagName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setTagContextMenu({ x: e.clientX, y: e.clientY, tag: tagName });
  };

  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const availableTags = useDownloadStore((state) => state.availableTags);

  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);
  const allAvailableTags = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...availableTags,
          ...articleDownloads.flatMap((a) => a.tags ?? []),
        ]),
      ),
    [availableTags, articleDownloads],
  );
  const allAvailableCategories = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...availableCategories,
          ...articleDownloads.flatMap((a) => a.category ?? []),
        ]),
      ),
    [availableCategories, articleDownloads],
  );

  const [visibleTagCount, setVisibleTagCount] = useState(10);

  const navRef = useRef<HTMLElement>(null);
  const userToggledRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !document
          .querySelector('[data-category-context-menu]')
          ?.contains(target)
      ) {
        setContextMenu(null);
      }
      if (
        !document.querySelector('[data-tag-context-menu]')?.contains(target)
      ) {
        setTagContextMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 800);
  }, []);

  const handleDragOver = (e: React.DragEvent, item?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    if (item) setDragOverItem(item);
  };

  const handleDragLeave = () => setDragOverItem(null);

  const ensureSingleCategory = (downloadId: string, newCategory: string) => {
    const all = [
      ...useDownloadStore.getState().downloading,
      ...useDownloadStore.getState().finishedDownloads,
      ...useDownloadStore.getState().historyDownloads,
      ...useDownloadStore.getState().forDownloads,
    ];
    for (const cat of all.find((d) => d.id === downloadId)?.category ?? []) {
      useDownloadStore.getState().removeCategory(downloadId, cat);
    }
    useDownloadStore.getState().addCategory(downloadId, newCategory);
  };

  const ensureNoDouble = (downloadId: string, newTag: string) => {
    const all = [
      ...useDownloadStore.getState().downloading,
      ...useDownloadStore.getState().finishedDownloads,
      ...useDownloadStore.getState().historyDownloads,
      ...useDownloadStore.getState().forDownloads,
      ...useDownloadStore.getState().queuedDownloads,
    ];
    if (!all.find((d) => d.id === downloadId)?.tags?.includes(newTag)) {
      useDownloadStore.getState().addTag(downloadId, newTag);
    }
  };

  const handleCategoryDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    const downloadId = e.dataTransfer.getData('downloadId');
    if (downloadId) {
      ensureSingleCategory(downloadId, category);
      toast({
        title: t('toast.categorized'),
        description: t('toast.categorizedDesc', { category }),
        duration: 3000,
      });
    }
    setDragOverItem(null);
  };

  const handleTagDrop = (e: React.DragEvent, tag: string) => {
    e.preventDefault();
    const downloadId = e.dataTransfer.getData('downloadId');
    if (downloadId) {
      ensureNoDouble(downloadId, tag);
      toast({
        title: t('toast.tagged'),
        description: t('toast.taggedDesc', { tag }),
        duration: 3000,
      });
    }
    setDragOverItem(null);
  };

  const isCollapsed = !!collapsed;

  useNavAnimation(navRef, isCollapsed, userToggledRef);

  return (
    <nav
      ref={navRef}
      className={`${className} relative overflow-hidden group/scrollarea`}
    >
      <div
        onScroll={handleNavScroll}
        className={`h-full overflow-x-hidden overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb]:duration-200 group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-600 ${
          isScrolling
            ? '[&::-webkit-scrollbar-thumb]:!bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:!bg-gray-600'
            : '[&::-webkit-scrollbar-thumb]:bg-transparent'
        }`}
      >
        <div className="py-2 px-3 mt-2 flex flex-col gap-2 pb-8">
          {/* Status Section */}
          <div>
            <div
              className={`h-8 overflow-hidden ${
                isCollapsed ? 'invisible pointer-events-none' : ''
              }`}
            >
              <SectionHeader
                label={t('sections.status')}
                isOpen={openSections.status}
                collapsed={isCollapsed}
                onToggle={() => toggleSection('status')}
                onCollapsedClick={() => expandAndOpen('status')}
              />
            </div>
            {(openSections.status || isCollapsed) && (
              <div className="flex flex-col gap-[6px]">
                <NavItem
                  to="/status/all"
                  label={t('status.all')}
                  icon={
                    <FiFolder
                      size={16}
                      className="text-primary flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="/status/fetching-metadata"
                  label={t('status.fetchingMetadata')}
                  icon={
                    <TbDeviceTabletSearch
                      size={17}
                      className="text-blue-500 flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="/status/to-download"
                  label={t('status.startDownload')}
                  icon={
                    <FiDownload
                      size={16}
                      className="text-primary flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="/status/queued"
                  label={t('status.queued')}
                  icon={
                    <BiSolidPlusSquare
                      size={16}
                      className="text-primary flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="/status/downloading"
                  label={t('status.downloading')}
                  icon={
                    <BsHourglassSplit
                      size={16}
                      className="text-primary flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="/status/paused"
                  label={t('status.paused')}
                  icon={
                    <PiPauseBold
                      size={16}
                      className="text-blue-500 flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="/status/initializing"
                  label={t('status.initializing')}
                  icon={
                    <HiMiniArrowPath
                      size={17}
                      className="text-blue-500 flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="/status/failed"
                  label={t('status.failed')}
                  icon={
                    <FaRegTimesCircle
                      size={17}
                      className="text-red-500 flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="/status/finished"
                  label={t('status.finished')}
                  icon={
                    <MdPlayArrow
                      size={18}
                      className="text-green-500 flex-shrink-0"
                    />
                  }
                  collapsed={isCollapsed}
                />
              </div>
            )}
          </div>

          {/* Favorites */}
          <NavItem
            to="/status/favorites"
            label="Favorites"
            icon={<FaHeart size={15} className="text-red-400 flex-shrink-0" />}
            collapsed={isCollapsed}
            activeClass="bg-titleBar dark:bg-[#3D3D3D]"
            hoverClass="hover:bg-titleBar dark:hover:bg-darkModeNavigation"
          />

          {/* Subscriptions */}
          <NavItem
            to="/status/subscriptions"
            label={t('subscriptions')}
            icon={
              <MdSubscriptions
                size={16}
                className="text-primary flex-shrink-0"
              />
            }
            collapsed={isCollapsed}
            activeClass="bg-titleBar dark:bg-[#3D3D3D]"
            hoverClass="hover:bg-titleBar dark:hover:bg-darkModeNavigation"
          />

          {/* Articles */}
          <NavItem
            to="/status/articles"
            label="Articles"
            icon={
              <LuNewspaper size={16} className="text-primary flex-shrink-0" />
            }
            collapsed={isCollapsed}
            activeClass="bg-titleBar dark:bg-[#3D3D3D]"
            hoverClass="hover:bg-titleBar dark:hover:bg-darkModeNavigation"
          />

          {/* Categories Section */}
          <div>
            <SectionHeader
              label={t('sections.categories')}
              isOpen={openSections.category}
              collapsed={isCollapsed}
              onToggle={() => toggleSection('category')}
              onCollapsedClick={() => expandAndOpen('category')}
            />
            {openSections.category && !isCollapsed && (
              <div className="flex flex-col gap-[6px]">
                <NavLink
                  to="/category/all"
                  className={({ isActive }) =>
                    `flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-titleBar dark:hover:bg-darkModeCompliment${
                      isActive ? ' bg-titleBar dark:bg-[#3D3D3D]' : ''
                    }`
                  }
                >
                  <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                    <BiLayer size={16} className="text-orange-500" />
                  </span>
                  <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">
                    {t('categories.all')}
                  </span>
                </NavLink>
                <NavLink
                  to="/category/uncategorized"
                  className={({ isActive }) =>
                    `flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-titleBar dark:hover:bg-darkModeCompliment${
                      isActive ? ' bg-titleBar dark:bg-[#3D3D3D]' : ''
                    }`
                  }
                >
                  <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                    <BiLayer size={16} className="text-blue-500" />
                  </span>
                  <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">
                    {t('categories.uncategorized')}
                  </span>
                </NavLink>
                {allAvailableCategories.map((category) => (
                  <NavLink
                    key={category}
                    to={`/category/${encodeURIComponent(category)}`}
                    className={({ isActive }) =>
                      `flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-titleBar dark:hover:bg-darkModeCompliment${
                        isActive || dragOverItem === category
                          ? ' bg-titleBar dark:bg-[#3D3D3D]'
                          : ''
                      }`
                    }
                    onContextMenu={(e) => handleCategoryRightClick(e, category)}
                    onDragOver={(e) => handleDragOver(e, category)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleCategoryDrop(e, category)}
                    aria-dropeffect="link"
                    role="listitem"
                  >
                    <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                      <BiLayer size={16} className="text-yellow-500" />
                    </span>
                    <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0 truncate">
                      {category}
                    </span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div>
            <SectionHeader
              label={t('sections.tags')}
              isOpen={openSections.tag}
              collapsed={isCollapsed}
              onToggle={() => toggleSection('tag')}
              onCollapsedClick={() => expandAndOpen('tag')}
            />
            {openSections.tag && !isCollapsed && (
              <div className="flex flex-col gap-[6px]">
                <NavLink
                  to="/tags/all"
                  className={({ isActive }) =>
                    `flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-titleBar dark:hover:bg-darkModeCompliment${
                      isActive ? ' bg-titleBar dark:bg-[#3D3D3D]' : ''
                    }`
                  }
                >
                  <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                    <BsTag size={16} className="text-orange-500" />
                  </span>
                  <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">{t('tags.all')}</span>
                </NavLink>
                <NavLink
                  to="/tags/untagged"
                  className={({ isActive }) =>
                    `flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-titleBar dark:hover:bg-darkModeCompliment${
                      isActive ? ' bg-titleBar dark:bg-[#3D3D3D]' : ''
                    }`
                  }
                >
                  <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                    <BsTag size={16} className="text-blue-500" />
                  </span>
                  <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">{t('tags.untagged')}</span>
                </NavLink>
                {allAvailableTags.map((tag) => (
                  <NavLink
                    key={tag}
                    to={`/tags/${encodeURIComponent(tag)}`}
                    className={({ isActive }) =>
                      `flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-titleBar dark:hover:bg-darkModeCompliment${
                        isActive || dragOverItem === tag
                          ? ' bg-titleBar dark:bg-[#3D3D3D]'
                          : ''
                      }`
                    }
                    onContextMenu={(e) => handleTagRightClick(e, tag)}
                    onDragOver={(e) => handleDragOver(e, tag)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleTagDrop(e, tag)}
                  >
                    <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                      <BsTag size={16} className="text-yellow-500" />
                    </span>
                    <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0 truncate">{tag}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapse toggle */}
      <div
        className="fixed bottom-4 z-10 ml-8
         mb-4 pointer-events-none"
        style={{
          width: isCollapsed ? '70px' : '205px',
          transform: 'translateX(-50%)',
          left: isCollapsed ? '35px' : '102.5px',
        }}
      >
        <TooltipWrapper
          content={isCollapsed ? t('expand') : t('collapse')}
          side="left"
        >
          <button
            onClick={() => {
              userToggledRef.current = true;
              toggleCollapse?.();
            }}
            className="flex items-center justify-center w-10 h-10 rounded bg-white/70 dark:bg-[#3D3D3D]/70 shadow-lg dark:text-white dark:hover:text-white pointer-events-auto"
          >
            {collapsed ? (
              <LuPanelLeftOpen size={18} />
            ) : (
              <LuPanelLeftClose size={18} />
            )}
          </button>
        </TooltipWrapper>
      </div>

      {contextMenu && (
        <CategoryContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          categoryName={contextMenu.category}
          onClose={() => setContextMenu(null)}
          onRename={renameCategory}
          onDelete={deleteCategory}
        />
      )}

      {tagContextMenu && (
        <TagContextMenu
          position={{ x: tagContextMenu.x, y: tagContextMenu.y }}
          tagName={tagContextMenu.tag}
          onClose={() => setTagContextMenu(null)}
          onRename={(oldName, newName) => {
            renameTag(oldName, newName);
            setTagContextMenu(null);
          }}
          onDelete={(tag) => {
            deleteTag(tag);
            setTagContextMenu(null);
          }}
        />
      )}
    </nav>
  );
};

export default Navigation;
