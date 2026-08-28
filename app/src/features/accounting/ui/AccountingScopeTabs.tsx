import cn from "classnames";
import type {
  AccountingTab,
  AccountingTabItem,
} from "../model/accounting-page-types";

type AccountingScopeTabsProps = {
  tabs: AccountingTabItem[];
  activeTab: AccountingTab | null;
  onTabChange: (tab: AccountingTab) => void;
};

export function AccountingScopeTabs({
  tabs,
  activeTab,
  onTabChange,
}: AccountingScopeTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      className="accounting-tabs"
      role="tablist"
      aria-label="Контекст бухгалтерии"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
              "accounting-tabs__item",
              isActive && "accounting-tabs__item--active",
            )}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
