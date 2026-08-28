import { useSettingsBotTab } from "../../../features/settings/model/useSettingsBotTab";
import { SettingsBotBridgesPanel } from "../../../features/settings/ui/SettingsBotBridgesPanel";
import { SettingsBotChannelPanel } from "../../../features/settings/ui/SettingsBotChannelPanel";
import { SettingsBotConnectPanel } from "../../../features/settings/ui/SettingsBotConnectPanel";
import { SettingsBotGallery } from "../../../features/settings/ui/SettingsBotGallery";
import { SettingsBotTelegramPanel } from "../../../features/settings/ui/SettingsBotTelegramPanel";
import { SettingsBotTestPanel } from "../../../features/settings/ui/SettingsBotTestPanel";

export function SettingsBotTab() {
  const vm = useSettingsBotTab();

  return (
    <div className="settings-tab-page settings-bot-tab">
      <SettingsBotGallery
        loading={vm.loading}
        listError={vm.listError}
        galleryItems={vm.galleryItems}
        panelMode={vm.panelMode}
        selectedTelegramId={vm.selectedTelegramId}
        selectedChannelId={vm.selectedChannelId}
        showConnectPanel={vm.showConnectPanel}
        onReload={() => void vm.reloadAll()}
        onOpenTelegram={vm.openTelegram}
        onOpenChannel={vm.openChannel}
        onOpenConnect={vm.openConnect}
      />

      {vm.showConnectPanel ? (
        <SettingsBotConnectPanel
          connectPlatform={vm.connectPlatform}
          setConnectPlatform={vm.setConnectPlatform}
          connectTitle={vm.connectTitle}
          setConnectTitle={vm.setConnectTitle}
          connectToken={vm.connectToken}
          setConnectToken={vm.setConnectToken}
          connectChatId={vm.connectChatId}
          setConnectChatId={vm.setConnectChatId}
          connectVkGroupId={vm.connectVkGroupId}
          setConnectVkGroupId={vm.setConnectVkGroupId}
          connectLoading={vm.connectLoading}
          connectError={vm.connectError}
          connectHint={vm.connectHint}
          tokenPlaceholder={vm.tokenPlaceholder}
          canConnect={vm.canConnect}
          onConnect={() => void vm.handleConnect()}
        />
      ) : null}

      {vm.showTelegramPanel && vm.selectedTelegram ? (
        <SettingsBotTelegramPanel
          bot={vm.selectedTelegram}
          botPatch={vm.botPatch}
          setBotPatch={vm.setBotPatch}
          botPatchSaving={vm.botPatchSaving}
          botPatchError={vm.botPatchError}
          onSave={() => void vm.handleSaveTelegram()}
          onDelete={() => void vm.handleDeleteTelegram()}
          vars={vm.vars}
          varsLoading={vm.varsLoading}
          varsError={vm.varsError}
          newVarKey={vm.newVarKey}
          setNewVarKey={vm.setNewVarKey}
          newVarValue={vm.newVarValue}
          setNewVarValue={vm.setNewVarValue}
          newVarIsSecret={vm.newVarIsSecret}
          setNewVarIsSecret={vm.setNewVarIsSecret}
          newVarSaving={vm.newVarSaving}
          newVarError={vm.newVarError}
          canCreateVar={vm.canCreateVar}
          onCreateVar={() => void vm.handleCreateVar()}
          onDeleteVar={(key) => void vm.handleDeleteVar(key)}
        />
      ) : null}

      {vm.showChannelPanel && vm.selectedChannel ? (
        <SettingsBotChannelPanel
          channel={vm.selectedChannel}
          channelPatch={vm.channelPatch}
          setChannelPatch={vm.setChannelPatch}
          channelSaving={vm.channelSaving}
          channelError={vm.channelError}
          onSave={() => void vm.handleSaveChannel()}
          onDelete={() => void vm.handleDeleteChannel()}
        />
      ) : null}

      {vm.showTestPanel ? (
        <SettingsBotTestPanel
          testChatId={vm.testChatId}
          setTestChatId={vm.setTestChatId}
          testText={vm.testText}
          setTestText={vm.setTestText}
          testLoading={vm.testLoading}
          testError={vm.testError}
          testOk={vm.testOk}
          canSendTest={vm.canSendTest}
          onSend={() => void vm.handleSendTest()}
        />
      ) : null}

      <SettingsBotBridgesPanel
        bridges={vm.bridges}
        bridgeOptions={vm.bridgeOptions}
        bridgeTitle={vm.bridgeTitle}
        setBridgeTitle={vm.setBridgeTitle}
        bridgePrimaryKey={vm.bridgePrimaryKey}
        setBridgePrimaryKey={vm.setBridgePrimaryKey}
        bridgeMirrorKeys={vm.bridgeMirrorKeys}
        bridgeSaving={vm.bridgeSaving}
        bridgeError={vm.bridgeError}
        canCreateBridge={vm.canCreateBridge}
        onToggleMirror={vm.toggleMirrorKey}
        onCreateBridge={() => void vm.handleCreateBridge()}
        onToggleBridge={(id, enabled) => void vm.handleToggleBridge(id, enabled)}
        onDeleteBridge={(id) => void vm.handleDeleteBridge(id)}
      />
    </div>
  );
}
