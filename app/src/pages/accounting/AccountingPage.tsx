import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import { Link } from "react-router-dom";
import { globalPaths } from "../../app/router/paths";
import { useAccountingPage } from "../../features/accounting/model/useAccountingPage";
import { AccountingCollectionsList } from "../../features/accounting/ui/AccountingCollectionsList";
import { AccountingCreateForm } from "../../features/accounting/ui/AccountingCreateForm";
import { AccountingPageHeader } from "../../features/accounting/ui/AccountingPageHeader";
import { AccountingScopeFilters } from "../../features/accounting/ui/AccountingScopeFilters";
import { AccountingScopeTabs } from "../../features/accounting/ui/AccountingScopeTabs";
import { AdminSectionChrome } from "../../shared/components/admin/AdminSectionChrome";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

export function AccountingPage() {
  const vm = useAccountingPage();

  if (vm.pageBooting) {
    return <PageBootLoader label="Загрузка бухгалтерии…" />;
  }

  const createDisabled = !vm.accessToken || !vm.resolvedTab;
  const showEmptyScopesHint = !vm.resolvedTab && !vm.isLoading;

  return (
    <div className="app-layout accounting-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="accounting-page">
            <AdminSectionChrome activeSection="accounting">
              <AccountingPageHeader
                createBlocked={vm.createBlocked}
                showCreate={vm.showCreate}
                createDisabled={createDisabled}
                onToggleCreate={vm.handleToggleCreate}
              />

              <AccountingScopeTabs
                tabs={vm.visibleTabs}
                activeTab={vm.resolvedTab}
                onTabChange={vm.handleTabChange}
              />

              <AccountingScopeFilters
                resolvedTab={vm.resolvedTab}
                scopes={vm.scopes}
                entityId={vm.entityId}
                troupeId={vm.troupeId}
                theaterTroupeOptions={vm.theaterTroupeOptions}
                projectTroupeOptions={vm.projectTroupeOptions}
                onEntityChange={vm.setEntityId}
                onTroupeChange={vm.setTroupeId}
              />

              {vm.createBlocked ? (
                <p className="accounting-page__hint">
                  Создавать сборы могут владелец и бухгалтер (театр/проект) или
                  владелец/преподаватель студии. Настройте роли в{" "}
                  <Link to={globalPaths.organizations}>Организациях</Link>.
                </p>
              ) : null}

              {vm.errorMessage ? (
                <p className="accounting-page__error">{vm.errorMessage}</p>
              ) : null}

              {showEmptyScopesHint ? (
                <p className="accounting-page__hint">
                  Нет доступных театров, студий или проектов со связанными
                  труппами. Создайте организацию, чтобы вести сборы.
                </p>
              ) : null}

              <AccountingCollectionsList
                isLoading={vm.isLoading}
                collections={vm.collections}
                canCreate={vm.canCreate}
                hasResolvedTab={Boolean(vm.resolvedTab)}
                onCreateFirst={vm.handleToggleCreate}
              />

              {vm.showCreate ? (
                <AccountingCreateForm
                  title={vm.title}
                  onTitleChange={vm.setTitle}
                  formError={vm.formError}
                  tariffs={vm.tariffs}
                  participantDrafts={vm.participantDrafts}
                  memberOptions={vm.memberOptions}
                  creating={vm.creating}
                  onAddTariff={vm.handleAddTariff}
                  onRemoveTariff={vm.handleRemoveTariff}
                  onTariffChange={vm.handleTariffChange}
                  onParticipantChange={vm.handleParticipantChange}
                  onCreate={() => {
                    void vm.handleCreate();
                  }}
                />
              ) : null}
            </AdminSectionChrome>
          </div>
        </main>
      </div>
    </div>
  );
}
