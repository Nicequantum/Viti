import { ArrowLeft } from 'lucide-react';
import { StableInput } from './StableTextField';

interface SettingsViewProps {
  apiKey: string;
  passphrase: string;
  hasEncryptedKey: boolean;
  isUnlocked: boolean;
  onBack: () => void;
  onApiKeyChange: (value: string) => void;
  onPassphraseChange: (value: string) => void;
  onUnlock: () => void;
  onSave: () => void;
  onClear: () => void;
}

export function SettingsView({
  apiKey,
  passphrase,
  hasEncryptedKey,
  isUnlocked,
  onBack,
  onApiKeyChange,
  onPassphraseChange,
  onUnlock,
  onSave,
  onClear,
}: SettingsViewProps) {
  return (
    <div className="px-5 pt-6">
      <button onClick={onBack} className="flex items-center text-[#0a84ff] mb-6">
        <ArrowLeft size={18} className="mr-1" /> Back
      </button>

      <h2 className="text-2xl font-semibold mb-6">Settings</h2>

      <div className="ios-card p-5 mb-6">
        <div className="font-semibold mb-1">xAI Grok API Key (encrypted storage)</div>
        <div className="text-[10px] text-[#8e8e93] mb-3">Key never stored in plain text. Uses AES-GCM encryption with your passphrase.</div>

        {hasEncryptedKey && !isUnlocked && (
          <div className="mb-4 p-3 bg-[#2c2c2e] rounded-xl">
            <div className="text-sm mb-2">Encrypted key detected. Enter passphrase to unlock for this session:</div>
            <StableInput
              fieldKey="settings-passphrase-unlock"
              type="password"
              value={passphrase}
              onChange={onPassphraseChange}
              placeholder="Your encryption passphrase"
              showVoice={false}
              className="w-full bg-[#1c1c1e] border border-[#38383a] rounded-xl p-3 text-sm mb-2"
            />
            <button onClick={onUnlock} className="primary-btn w-full h-10 text-sm">
              UNLOCK KEY
            </button>
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs text-[#8e8e93] mb-1 block">API KEY (xai-...)</label>
          <StableInput
            fieldKey="settings-api-key"
            type="password"
            value={apiKey}
            onChange={onApiKeyChange}
            placeholder="xai-yourkeyhere"
            showVoice={false}
            className="w-full bg-[#2c2c2e] border border-[#444] rounded-xl p-3.5 font-mono text-sm"
          />
        </div>

        <div className="mb-3">
          <label className="text-xs text-[#8e8e93] mb-1 block">PASSPHRASE (for encryption - remember this!)</label>
          <StableInput
            fieldKey="settings-passphrase-save"
            type="password"
            value={passphrase}
            onChange={onPassphraseChange}
            placeholder="Strong passphrase to encrypt key"
            showVoice={false}
            className="w-full bg-[#2c2c2e] border border-[#444] rounded-xl p-3.5 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onSave} className="flex-1 secondary-btn h-11">
            SAVE ENCRYPTED KEY
          </button>
          <button onClick={onClear} className="secondary-btn h-11 px-6 text-[#ff9f0a]">
            CLEAR ALL
          </button>
        </div>
        <p className="text-xs text-[#8e8e93] mt-3 leading-snug">
          Get key at console.x.ai. Encrypted with passphrase using Web Crypto (AES-GCM + 150k PBKDF2).
        </p>
        {isUnlocked && <div className="text-[10px] text-[#30d158] mt-2">✓ Key unlocked in memory for this session.</div>}
      </div>
    </div>
  );
}