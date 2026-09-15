/**
 * Skedulosa sidebar navigation. Same UI/UX as DownloadNavigationBar
 * (collapsible sections, active states, collapse toggle) but data-driven and
 * without download-specific features (no context menus, drag-drop).
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiFolder,
} from 'react-icons/fi';
import { BiLayer } from 'react-icons/bi';
import { BsHourglassSplit } from 'react-icons/bs';
import { FaRegTimesCircle } from 'react-icons/fa';
import { MdPlayArrow, MdSubscriptions } from 'react-icons/md';
import { PiPauseBold } from 'react-icons/pi';
import {
  LuHistory,
  LuNewspaper,
  LuPanelLeftClose,
  LuPanelLeftOpen,
} from 'react-icons/lu';
import { NavLink, useMatch, useResolvedPath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CATEGORY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  useSkedulosaStore,
} from '@/skedulosa/store/skedulosaStore';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
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
  hoverClass = 'hover:bg-titleBar dark:hover:bg-[#474747]',
}) => {
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

type FilterNavItemProps = {
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  isActive: boolean;
  onSelect: () => void;
};

const FilterNavItem: React.FC<FilterNavItemProps> = ({
  label,
  icon,
  collapsed,
  isActive,
  onSelect,
}) => (
  <TooltipWrapper content={collapsed ? label : null} side="left">
    <button
      onClick={onSelect}
      className={`flex flex-nowrap items-center h-7 w-full rounded dark:text-gray-200 hover:bg-titleBar dark:hover:bg-darkModeCompliment${
        isActive ? ' bg-titleBar dark:bg-[#3D3D3D]' : ''
      }`}
    >
      <span className="flex items-center justify-center w-[46px] flex-shrink-0">
        {icon}
      </span>
      <span className="nav-label text-[12px] whitespace-nowrap overflow-hidden min-w-0">
        {label}
      </span>
    </button>
  </TooltipWrapper>
);

type SectionHeaderProps = {
  label: string;
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
      className="w-full flex items-center h-7 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200"
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

// ── Icon helpers ──────────────────────────────────────────────────────────────

function statusIcon(id: string): React.ReactNode {
  switch (id) {
    case 'all':
      return <FiFolder size={16} className="text-primary flex-shrink-0" />;
    case 'active':
      return <MdPlayArrow size={18} className="text-green-500 flex-shrink-0" />;
    case 'paused':
      return <PiPauseBold size={16} className="text-amber-500 flex-shrink-0" />;
    case 'needs-attention':
      return (
        <BsHourglassSplit size={16} className="text-amber-600 flex-shrink-0" />
      );
    case 'error':
      return (
        <FaRegTimesCircle size={16} className="text-red-500 flex-shrink-0" />
      );
    default:
      return <FiFolder size={16} className="text-primary flex-shrink-0" />;
  }
}

function categoryIcon(id: string): React.ReactNode {
  switch (id) {
    case 'all':
      return <BiLayer size={16} className="text-orange-500 flex-shrink-0" />;
    case 'youtube':
      return <MdPlayArrow size={18} className="text-green-500 flex-shrink-0" />;
    case 'afda':
      return <LuNewspaper size={16} className="text-blue-500 flex-shrink-0" />;
    default:
      return <BiLayer size={16} className="text-primary flex-shrink-0" />;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface SkedulosaNavigationProps {
  className?: string;
  collapsed?: boolean;
  toggleCollapse?: () => void;
}

export function SkedulosaNavigation({
  className,
  collapsed,
  toggleCollapse,
}: SkedulosaNavigationProps) {
  const { t } = useTranslation('skedulosa');
  const statusFilter = useSkedulosaStore((s) => s.statusFilter);
  const categoryFilter = useSkedulosaStore((s) => s.categoryFilter);
  const setStatusFilter = useSkedulosaStore((s) => s.setStatusFilter);
  const setCategoryFilter = useSkedulosaStore((s) => s.setCategoryFilter);

  const [openSections, setOpenSections] = useState({
    status: true,
    categories: false,
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

  const setStatusFilterTyped = useCallback(
    (slug: string) =>
      setStatusFilter(slug as Parameters<typeof setStatusFilter>[0]),
    [setStatusFilter],
  );
  const setCategoryFilterTyped = useCallback(
    (slug: string) =>
      setCategoryFilter(slug as Parameters<typeof setCategoryFilter>[0]),
    [setCategoryFilter],
  );

  const navRef = useRef<HTMLElement>(null);
  const userToggledRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const isCollapsed = !!collapsed;
  useNavAnimation(navRef, isCollapsed, userToggledRef);

  const handleNavScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 800);
  }, []);

  return (
    <nav ref={navRef} className={`${className ?? ''} relative overflow-hidden group/scrollarea`}>
      <div
        onScroll={handleNavScroll}
        className={`h-full overflow-x-hidden overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb]:duration-200 group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-600 ${
          isScrolling
            ? '[&::-webkit-scrollbar-thumb]:!bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:!bg-gray-600'
            : '[&::-webkit-scrollbar-thumb]:bg-transparent'
        }`}
      >
        <div className="py-2 px-3 mt-7 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {/* Top nav links */}
            <NavItem
              to="/skedulosa/subscription"
              label={t('nav.subscription')}
              icon={
                <MdSubscriptions
                  size={16}
                  className="text-primary flex-shrink-0"
                />
              }
              collapsed={isCollapsed}
            />
            <NavItem
              to="/skedulosa/schedule"
              label={t('nav.scheduled')}
              icon={
                <FiCalendar size={16} className="text-primary flex-shrink-0" />
              }
              collapsed={isCollapsed}
            />
            <NavItem
              to="/skedulosa/history"
              label={t('nav.history')}
              icon={
                <LuHistory size={16} className="text-primary flex-shrink-0" />
              }
              collapsed={isCollapsed}
            />
          </div>
          {/* Status Section */}
          <div>
            <div
              className={`h-7 overflow-hidden ${
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

            {/* Always mounted — CSS grid transition prevents pop-out flicker
                when the nav collapses before React can remove the items. */}
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                openSections.status ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-[6px]">
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <FilterNavItem
                      key={opt.id}
                      label={t(`statusFilter.${opt.id}`)}
                      icon={statusIcon(opt.id)}
                      collapsed={isCollapsed}
                      isActive={statusFilter === opt.slug}
                      onSelect={() => setStatusFilterTyped(opt.slug)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Categories Section */}
          <div>
            <SectionHeader
              label={t('sections.categories')}
              isOpen={openSections.categories}
              collapsed={isCollapsed}
              onToggle={() => toggleSection('categories')}
              onCollapsedClick={() => expandAndOpen('categories')}
            />
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                openSections.categories ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-[6px]">
                  {CATEGORY_FILTER_OPTIONS.map((opt) => (
                    <FilterNavItem
                      key={opt.id}
                      label={t(`categoryFilter.${opt.id}`)}
                      icon={categoryIcon(opt.id)}
                      collapsed={isCollapsed}
                      isActive={categoryFilter === opt.slug}
                      onSelect={() => setCategoryFilterTyped(opt.slug)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collapse toggle */}
      {toggleCollapse && (
        <div
          className="fixed bottom-4 z-10 ml-8 mb-4 pointer-events-none"
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
              {isCollapsed ? (
                <LuPanelLeftOpen size={18} />
              ) : (
                <LuPanelLeftClose size={18} />
              )}
            </button>
          </TooltipWrapper>
        </div>
      )}
    </nav>
  );
}

export default SkedulosaNavigation;
