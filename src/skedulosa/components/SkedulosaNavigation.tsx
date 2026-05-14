/**
 * Skedulosa sidebar navigation. Same UI/UX as DownloadNavigationBar
 * (collapsible sections, active states, collapse toggle) but data-driven and
 * without download-specific features (no context menus, drag-drop).
 */
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import {
  CATEGORY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  useSkedulosaStore,
} from '@/skedulosa/store/skedulosaStore';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type IconType } from 'react-icons';
// eslint-disable-next-line prettier/prettier
import {
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiGrid,
} from 'react-icons/fi';
// eslint-disable-next-line prettier/prettier
import { FaCircle, FaPlay } from 'react-icons/fa';
// eslint-disable-next-line prettier/prettier
import {
  LuBookMarked,
  LuHistory,
  LuList,
  LuPanelLeftClose,
  LuPanelLeftOpen,
} from 'react-icons/lu';
import { NavLink } from 'react-router-dom';

/** Single nav link entry. */
export interface SkedulosaNavItem {
  to: string;
  label: string;
  icon: IconType;
  iconClassName?: string;
  /** Icon size in pixels. Defaults to 16. */
  iconSize?: number;
}

/** Section with optional default open state. */
export interface SkedulosaNavSection {
  id: string;
  label: string;
  defaultOpen?: boolean;
  items: SkedulosaNavItem[];
}

export interface SkedulosaNavigationProps {
  className?: string;
  collapsed?: boolean;
  toggleCollapse?: () => void;
}

const linkBase =
  'nav-link dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 items-center';
const linkCollapsed =
  'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeNavigation rounded dark:text-gray-200';
const linkActive = 'bg-titleBar dark:bg-darkModeCompliment';

function NavItem({
  item,
  collapsed,
}: {
  item: SkedulosaNavItem;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <TooltipWrapper content={collapsed ? item.label : null} side="left">
      <NavLink
        to={item.to}
        end={item.to === '.' || item.to === ''}
        className={({ isActive }) =>
          `${collapsed ? 'p-2 ' : linkBase} ${isActive ? linkActive : ''} ${
            collapsed ? linkCollapsed : ''
          }`
        }
      >
        <Icon
          size={item.iconSize ?? 16}
          className={`flex-shrink-0 ${item.iconClassName ?? 'text-primary'}`}
        />
        {!collapsed && (
          <span className="ml-2 text-[12px] whitespace-nowrap">
            {item.label}
          </span>
        )}
      </NavLink>
    </TooltipWrapper>
  );
}

/** Filter chip in sidebar: sets status or category filter from store (no route). */
function FilterNavItem<
  TOption extends { id: string; label: string; iconClassName?: string },
>({
  option,
  icon: Icon,
  isActive,
  onSelect,
  collapsed,
  iconSize = 11,
}: {
  option: TOption;
  icon: IconType;
  isActive: boolean;
  onSelect: () => void;
  collapsed: boolean;
  iconSize?: number;
}) {
  return (
    <TooltipWrapper content={collapsed ? option.label : null} side="left">
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex items-center ${
          collapsed ? 'justify-center p-2' : linkBase
        } ${isActive ? linkActive : ''} ${
          collapsed
            ? 'hover:bg-titleBar dark:hover:bg-darkModeNavigation rounded dark:text-gray-200'
            : ''
        }`}
      >
        <Icon
          size={iconSize}
          className={`flex-shrink-0 ${option.iconClassName ?? 'text-primary'}`}
        />
        {!collapsed && (
          <span className="ml-2 text-[12px] whitespace-nowrap">
            {option.label}
          </span>
        )}
      </button>
    </TooltipWrapper>
  );
}

/** Collapsible section for Status or Category filters (store-driven). */
function FilterSection({
  label,
  options,
  icon: Icon,
  iconSize,
  currentSlug,
  onSelectSlug,
  collapsed,
  open,
  onToggle,
}: {
  label: string;
  options: readonly {
    id: string;
    label: string;
    slug: string;
    iconClassName?: string;
  }[];
  icon: IconType;
  iconSize: number;
  currentSlug: string;
  onSelectSlug: (slug: string) => void;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const showItems = open || collapsed;
  return (
    <div>
      <TooltipWrapper content={collapsed ? label : null} side="left">
        <button
          type="button"
          onClick={onToggle}
          className={`w-full flex items-center ${
            collapsed
              ? 'justify-center'
              : 'hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded text-slate-500 dark:text-gray-200 px-2 py-1.5 mb-1.5'
          }`}
        >
          <div
            className={`flex items-center transition-opacity duration-300 ${
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}
          >
            {open ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
            <span className="ml-1 text-md font-semibold text-slate-500 dark:text-gray-400 whitespace-nowrap">
              {label}
            </span>
          </div>
        </button>
      </TooltipWrapper>
      {showItems && (
        <div
          className={`${
            collapsed ? 'flex flex-col items-center' : 'ml-1'
          } space-y-[6px]`}
        >
          {options.map((opt) => (
            <FilterNavItem
              key={opt.id}
              option={opt}
              icon={Icon}
              iconSize={iconSize}
              isActive={currentSlug === opt.slug}
              onSelect={() => onSelectSlug(opt.slug)}
              collapsed={collapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SkedulosaNavigation({
  className,
  collapsed = false,
  toggleCollapse,
}: SkedulosaNavigationProps) {
  const { t } = useTranslation('skedulosa');
  const statusFilter = useSkedulosaStore((s) => s.statusFilter);
  const categoryFilter = useSkedulosaStore((s) => s.categoryFilter);
  const setStatusFilter = useSkedulosaStore((s) => s.setStatusFilter);
  const setCategoryFilter = useSkedulosaStore((s) => s.setCategoryFilter);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    status: true,
    categories: true,
  });

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

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

  return (
    <nav
      className={`${className ?? ''} transition-all duration-300 ${
        collapsed ? 'w-[70px]' : ''
      } relative overflow-x-hidden overflow-y-auto hover-scrollbar`}
    >
      <div
        className={`${
          collapsed ? 'px-2' : 'p-2 ml-0 md:ml-1'
        } mt-2 space-y-2 pb-20`}
      >
        <div
          className={`${
            collapsed ? 'mt-8 gap-6' : 'mt-2 gap-2'
          } flex flex-col items-center justify-center`}
        >
          <NavItem
            item={{
              to: '/skedulosa/subscription',
              label: t('nav.subscription'),
              icon: LuBookMarked,
            }}
            collapsed={collapsed}
          />
          <NavItem
            item={{
              to: '/skedulosa/schedule',
              label: t('nav.scheduled'),
              icon: FiCalendar,
            }}
            collapsed={collapsed}
          />
          <NavItem
            item={{
              to: '/skedulosa/history',
              label: t('nav.history'),
              icon: LuHistory,
            }}
            collapsed={collapsed}
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <FilterSection
              label={t('sections.status')}
              options={STATUS_FILTER_OPTIONS.map((opt) => ({
                ...opt,
                label: t(`statusFilter.${opt.id}`),
              }))}
              icon={FaCircle}
              iconSize={11}
              currentSlug={statusFilter}
              onSelectSlug={setStatusFilterTyped}
              collapsed={collapsed}
              open={openSections.status ?? true}
              onToggle={() => toggleSection('status')}
            />
            <FilterSection
              label={t('sections.categories')}
              options={CATEGORY_FILTER_OPTIONS.map((opt) => ({
                ...opt,
                label: t(`categoryFilter.${opt.id}`),
              }))}
              icon={FaPlay}
              iconSize={12}
              currentSlug={categoryFilter}
              onSelectSlug={setCategoryFilterTyped}
              collapsed={collapsed}
              open={openSections.categories ?? true}
              onToggle={() => toggleSection('categories')}
            />
          </div>
        )}
      </div>

      {toggleCollapse && (
        <div
          className="fixed bottom-4 z-10 ml-2 pointer-events-none"
          style={{
            width: collapsed ? '70px' : '205px',
            transform: 'translateX(-50%)',
            left: collapsed ? '35px' : '102.5px',
          }}
        >
          <TooltipWrapper
            content={collapsed ? t('expand') : t('collapse')}
            side="left"
          >
            <button
              type="button"
              onClick={toggleCollapse}
              className="m-4 flex items-center justify-center hover:bg-titleBar dark:hover:bg-secondary text-slate-600 dark:text-white dark:hover:text-white pointer-events-auto"
            >
              {collapsed ? (
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
