import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeView } from './components/HomeView';
import { LineView } from './components/LineView';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ROView } from './components/ROView';
import { SettingsView } from './components/SettingsView';
import { useRepairOrders } from './hooks/useRepairOrders';
import {
  clearStoredKeys,
  hasStoredEncryptedKey,
  loadEncryptedKey,
  PLAIN_KEY_STORAGE,
  saveEncryptedKey,
  savePlainKeyLegacy,
} from './lib/apiKey';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const ro = useRepairOrders({ apiKey });

  useEffect(() => {
    setHasEncryptedKey(hasStoredEncryptedKey());
    const legacy = localStorage.getItem(PLAIN_KEY_STORAGE);
    if (legacy && !hasStoredEncryptedKey()) {
      setApiKey(legacy);
      setIsUnlocked(true);
    }
  }, []);

  const saveApiKey = async () => {
    if (passphrase && apiKey) {
      await saveEncryptedKey(apiKey, passphrase);
      setHasEncryptedKey(true);
      setIsUnlocked(true);
      setPassphrase('');
      toast.success('Key encrypted and saved locally. Remember your passphrase to unlock on future sessions.');
    } else if (apiKey) {
      savePlainKeyLegacy(apiKey);
      setHasEncryptedKey(false);
      toast.message('Saved without encryption (legacy). Enter passphrase next time to encrypt.');
    } else {
      await saveEncryptedKey('', '');
      setHasEncryptedKey(false);
      setIsUnlocked(false);
      toast.success('API key cleared');
    }
  };

  const unlockWithPassphrase = async () => {
    const k = await loadEncryptedKey(passphrase);
    if (k) {
      setApiKey(k);
      setIsUnlocked(true);
      setPassphrase('');
      toast.success('API key unlocked for this session');
      return true;
    }
    toast.error('Unlock failed. Check passphrase.');
    return false;
  };

  const clearAllKeys = () => {
    clearStoredKeys();
    setApiKey('');
    setHasEncryptedKey(false);
    setIsUnlocked(false);
    setPassphrase('');
    toast.success('All keys cleared');
  };

  const requireApiKey = (): boolean => {
    if (apiKey) return true;
    if (hasEncryptedKey && !isUnlocked) {
      toast.error('Unlock your encrypted xAI key in Settings using your passphrase.');
      ro.setView('settings');
      return false;
    }
    toast.error('Please enter / unlock your xAI Grok API key in Settings.');
    ro.setView('settings');
    return false;
  };

  const handleGenerateStory = () => {
    if (!requireApiKey() || !ro.currentLineId) return;
    ro.generateStory(ro.currentLineId, apiKey);
  };

  const handleReviewStory = () => {
    if (!requireApiKey() || !ro.currentLineId) return;
    ro.reviewStory(ro.currentLineId, apiKey);
  };

  const showLoading = ro.isProcessingOCR || ro.isGenerating || ro.isReviewing;

  return (
    <ErrorBoundary>
      <div className="app-container">
        <Toaster theme="dark" position="top-center" richColors closeButton />

        {ro.view !== 'home' && ro.view !== 'settings' && (
          <header className="ios-header h-14 px-4 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <img src="/icon-512.png" alt="Benz Tech" className="w-6 h-6 rounded" />
              Benz Tech
            </div>
            <button onClick={() => ro.setView('settings')} className="p-2 text-[#8e8e93]">
              <Settings size={20} />
            </button>
          </header>
        )}

        {ro.view === 'home' && (
          <HomeView
            filteredROs={ro.filteredROs}
            searchTerm={ro.searchTerm}
            pendingROImages={ro.pendingROImages}
            isProcessingOCR={ro.isProcessingOCR}
            ocrProgress={ro.ocrProgress}
            onSearchChange={ro.setSearchTerm}
            onAddROPhoto={ro.addROPhoto}
            onCreateManualRO={ro.createManualRO}
            onClearPending={ro.clearPendingROImages}
            onRemovePending={(idx) => ro.setPendingROImages((prev) => prev.filter((_, i) => i !== idx))}
            onProcessPending={ro.processPendingROImages}
            onOpenRO={ro.openRO}
            onDeleteRO={ro.deleteRO}
            onOpenSettings={() => ro.setView('settings')}
          />
        )}

        {ro.view === 'ro' && ro.currentRO && (
          <ROView
            ro={ro.currentRO}
            isProcessingOCR={ro.isProcessingOCR}
            ocrProgress={ro.ocrProgress}
            onDone={() => ro.setView('home')}
            onUpdateRONumber={ro.updateRONumber}
            onUpdateVehicle={(field, value) => ro.updateVehicle({ [field]: value })}
            onUpdateCustomer={ro.updateCustomer}
            onAddComplaint={ro.addComplaint}
            onEditComplaint={ro.editComplaint}
            onRemoveComplaint={ro.removeComplaint}
            onAddROXentryPhotos={ro.addROXentryPhotos}
            onAddRepairLine={ro.addRepairLine}
            onOpenLine={(lineId) => ro.setView('line', lineId)}
            onDeleteRO={() => ro.deleteRO(ro.currentRO!.id)}
          />
        )}

        {ro.view === 'line' && ro.currentRO && ro.currentLine && (
          <LineView
            ro={ro.currentRO}
            line={ro.currentLine}
            isProcessingOCR={ro.isProcessingOCR}
            ocrProgress={ro.ocrProgress}
            isGenerating={ro.isGenerating}
            isReviewing={ro.isReviewing}
            hasApiKey={!!apiKey}
            storyQuality={ro.storyQualityForLine}
            storyReview={ro.storyReviewForLine}
            storyQualityStale={ro.storyQualityStaleForLine}
            onBack={() => ro.setView('ro')}
            onUpdateLine={(updates) => ro.updateLine(ro.currentLine!.id, updates)}
            onAddXentryPhotos={() => ro.addXentryPhotos(ro.currentLine!.id)}
            onApplySmartDefaults={() => ro.applySmartDefaultsToLine(ro.currentLine!.id)}
            onGenerateStory={handleGenerateStory}
            onReviewStory={handleReviewStory}
          />
        )}

        {ro.view === 'settings' && (
          <SettingsView
            apiKey={apiKey}
            passphrase={passphrase}
            hasEncryptedKey={hasEncryptedKey}
            isUnlocked={isUnlocked}
            onBack={() => ro.setView(ro.currentRO ? 'ro' : 'home')}
            onApiKeyChange={setApiKey}
            onPassphraseChange={setPassphrase}
            onUnlock={unlockWithPassphrase}
            onSave={saveApiKey}
            onClear={clearAllKeys}
          />
        )}

        <LoadingOverlay
          visible={showLoading}
          message={ro.loadingMessage || (ro.isGenerating ? 'Generating with Grok…' : 'Processing…')}
          progress={ro.isProcessingOCR ? ro.ocrProgress : undefined}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;