import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Header } from './components/Header';
import { Navigation, TabKey } from './components/Navigation';
import { OverviewView } from './components/views/OverviewView';
import { LedgerView } from './components/views/LedgerView';
import { MoreHubView } from './components/views/MoreHubView';
import { AssetsView } from './components/views/AssetsView';
import { AIAdvisorView } from './components/views/AIAdvisorView';
import { SettingsView } from './components/views/SettingsView';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { TransferModal } from './components/modals/TransferModal';
import { AddAssetModal, AssetCategoryType } from './components/modals/AddAssetModal';
import { GitHubPushModal } from './components/modals/GitHubPushModal';
import { AccountSyncModal } from './components/modals/AccountSyncModal';
import { VoiceTransactionModal, ParsedVoiceTransaction } from './components/modals/VoiceTransactionModal';
import { TripsContactsModal } from './components/modals/TripsContactsModal';
import { ArrowLeft, CloudUpload } from 'lucide-react';

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialDate, setAddModalInitialDate] = useState<string | undefined>(undefined);
  const [voicePrefill, setVoicePrefill] = useState<ParsedVoiceTransaction | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [tripsContactsTab, setTripsContactsTab] = useState<'trips' | 'contacts' | null>(null);
  const [assetsInitialSubTab, setAssetsInitialSubTab] = useState<AssetCategoryType | undefined>(undefined);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [assetModalCategory, setAssetModalCategory] = useState<AssetCategoryType | null>(null);

  const { pendingLocalMigrationCount, mergeLocalToCloud, dismissLocalMigration } = useFinance();

  const handleOpenAddAsset = (cat: AssetCategoryType) => {
    setAssetModalCategory(cat);
  };

  const handleOpenAddDefault = () => {
    setVoicePrefill(null);
    setAddModalInitialDate(undefined);
    setIsAddModalOpen(true);
  };

  const handleOpenAddForDate = (dateStr: string) => {
    setVoicePrefill(null);
    setAddModalInitialDate(dateStr);
    setIsAddModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[var(--app-canvas-bg,#f8fafc)] dark:bg-[var(--app-canvas-dark-bg,#020617)] text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-emerald-500 selection:text-white overflow-x-hidden w-full max-w-full">
      {/* Top sticky header */}
      <Header
        onOpenQuickScan={() => setActiveTab('ai')}
        onOpenQuickAdd={handleOpenAddDefault}
        onOpenSettings={() => setActiveTab('settings')}
        onOpenAccountSync={() => setIsAccountModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 pt-4 pb-36 sm:pb-32 overflow-x-hidden">
        {/* Pending local data merge banner when signing in on a second device */}
        {pendingLocalMigrationCount > 0 && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CloudUpload size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Có {pendingLocalMigrationCount} mục cũ trên máy này chưa có trên Đám mây
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Bấm Gộp để đưa dữ liệu cũ lên tài khoản Google của bạn.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={mergeLocalToCloud}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                Gộp lên Đám mây
              </button>
              <button
                type="button"
                onClick={dismissLocalMigration}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-semibold cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        )}

        {/* Back button for sub-views of 'more' */}
        {(activeTab === 'ai' || activeTab === 'settings') && (
          <button
            type="button"
            onClick={() => setActiveTab('more')}
            className="mb-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft size={14} />
            <span>Quay lại Khác & Tiện ích</span>
          </button>
        )}

        {activeTab === 'home' && (
          <OverviewView
            onNavigateTab={tab => {
              if (tab !== 'assets') setAssetsInitialSubTab(undefined);
              setActiveTab(tab);
            }}
            onOpenAddModal={handleOpenAddDefault}
            onOpenAddForDate={handleOpenAddForDate}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onOpenTripsContacts={t => setTripsContactsTab(t)}
            onOpenDebts={() => {
              setAssetsInitialSubTab('debt');
              setActiveTab('assets');
            }}
            initialSection="overview"
          />
        )}
        {activeTab === 'ledger' && (
          <LedgerView onOpenAddModal={handleOpenAddDefault} />
        )}
        {activeTab === 'report' && (
          <OverviewView
            onNavigateTab={tab => {
              if (tab !== 'assets') setAssetsInitialSubTab(undefined);
              setActiveTab(tab);
            }}
            onOpenAddModal={handleOpenAddDefault}
            onOpenAddForDate={handleOpenAddForDate}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onOpenTripsContacts={t => setTripsContactsTab(t)}
            onOpenDebts={() => {
              setAssetsInitialSubTab('debt');
              setActiveTab('assets');
            }}
            initialSection="report"
          />
        )}
        {activeTab === 'more' && (
          <MoreHubView
            onNavigateSub={sub => setActiveTab(sub)}
            onOpenAddModal={handleOpenAddDefault}
            onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
            onOpenAccountSync={() => setIsAccountModalOpen(true)}
          />
        )}
        {activeTab === 'assets' && (
          <AssetsView
            onOpenAddAsset={handleOpenAddAsset}
            onOpenTransfer={() => setIsTransferModalOpen(true)}
            initialSubTab={assetsInitialSubTab}
          />
        )}
        {activeTab === 'ai' && <AIAdvisorView />}
        {activeTab === 'settings' && (
          <SettingsView
            onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
            onOpenAccountSync={() => setIsAccountModalOpen(true)}
          />
        )}
      </main>

      {/* Bottom Tab Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={tab => {
          if (tab !== 'assets') setAssetsInitialSubTab(undefined);
          setActiveTab(tab);
        }}
        onOpenAddModal={handleOpenAddDefault}
      />

      {/* Modals */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setVoicePrefill(null);
          setAddModalInitialDate(undefined);
        }}
        initialDate={addModalInitialDate}
        prefilledData={voicePrefill}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
      />

      <VoiceTransactionModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onEditInFullModal={parsed => {
          setVoicePrefill(parsed);
          setIsAddModalOpen(true);
        }}
      />

      <TripsContactsModal
        isOpen={tripsContactsTab !== null}
        onClose={() => setTripsContactsTab(null)}
        initialTab={tripsContactsTab || 'trips'}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />

      <AddAssetModal
        isOpen={assetModalCategory !== null}
        onClose={() => setAssetModalCategory(null)}
        initialCategory={assetModalCategory || 'account'}
      />

      <GitHubPushModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
      />

      <AccountSyncModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <MainApp />
      </FinanceProvider>
    </AuthProvider>
  );
}
