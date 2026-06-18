import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Camera, Copy, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { StoryQualityResult, StoryReviewResult } from '../prompts/storyQuality';
import type { RepairLine, RepairOrder } from '../types';
import type { TemplateCategory } from '../lib/templateLibrary';
import { getSuggestions } from '../utils/mercedesKb';
import { BenzBotLoadingPanel, BenzBotPanel, BenzBotStaleBanner } from './BenzBotPanel';
import { StableInput, StableTextarea } from './StableTextField';
import { TemplateLibraryModal } from './TemplateLibraryModal';

interface LineViewProps {
  ro: RepairOrder;
  line: RepairLine;
  isProcessingOCR: boolean;
  ocrProgress: number;
  isGenerating: boolean;
  isReviewing: boolean;
  hasApiKey: boolean;
  storyQuality: StoryQualityResult | null;
  storyReview: StoryReviewResult | null;
  storyQualityStale: boolean;
  onBack: () => void;
  onUpdateLine: (updates: Partial<RepairLine>) => void;
  onAddXentryPhotos: () => void;
  onApplySmartDefaults: () => void;
  onGenerateStory: () => void;
  onReviewStory: () => void;
}

function complaintLabel(labels: string[] | undefined, index: number): string {
  return labels?.[index] || String.fromCharCode(65 + index);
}

export function LineView({
  ro,
  line,
  isProcessingOCR,
  ocrProgress,
  isGenerating,
  isReviewing,
  hasApiKey,
  storyQuality,
  storyReview,
  storyQualityStale,
  onBack,
  onUpdateLine,
  onAddXentryPhotos,
  onApplySmartDefaults,
  onGenerateStory,
  onReviewStory,
}: LineViewProps) {
  const vehicleSummary = [ro.vehicle.year, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
  const mileageStr = ro.vehicle.mileageIn ? `${ro.vehicle.mileageIn} mi` : '';
  const suggestions = getSuggestions(ro);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  useEffect(() => {
    setShowTemplateLibrary(false);
  }, [line.id]);

  const handleInsertTemplate = (content: string, _title: string, category: TemplateCategory) => {
    if (category === 'customer') {
      onUpdateLine({ warrantyStory: content });
      return;
    }
    const existing = line.warrantyStory?.trim();
    const next = existing ? `${existing}\n\n${content}` : content;
    onUpdateLine({ warrantyStory: next });
  };

  const copyStory = async () => {
    if (!line.warrantyStory) return;
    try {
      await navigator.clipboard.writeText(line.warrantyStory);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Clipboard copy failed');
    }
  };

  return (
    <div className="px-5 pt-4 pb-10">
      <button onClick={onBack} className="flex items-center text-[#0a84ff] mb-4">
        <ArrowLeft size={18} className="mr-1" /> Back to RO
      </button>

      <div className="ios-card p-3 mb-4 text-xs">
        <div className="font-semibold mb-0.5">
          {vehicleSummary} {mileageStr ? `• ${mileageStr}` : ''}{' '}
          {ro.vehicle.vin ? `• VIN ${ro.vehicle.vin.slice(0, 10)}...` : ''}
        </div>
        {ro.customer?.name && <div className="text-[#8e8e93]">Customer: {ro.customer.name}</div>}
        {ro.complaints && ro.complaints.length > 0 && (
          <div className="mt-1.5 text-[10px] text-[#8e8e93]">
            Complaints:{' '}
            {ro.complaints
              .map((c, i) => `${complaintLabel(ro.complaintLabels, i)}. ${c.slice(0, 42)}${c.length > 42 ? '…' : ''}`)
              .join('  ')}
          </div>
        )}
      </div>

      <div className="mb-5">
        <div className="text-sm text-[#8e8e93]">LINE {line.lineNumber}</div>
        <StableInput
          fieldKey={`${line.id}-description`}
          value={line.description}
          onChange={(v) => onUpdateLine({ description: v })}
          showVoice={false}
          className="text-xl font-semibold bg-transparent w-full focus:outline-none border-none"
        />
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-[#8e8e93] block mb-1.5">
            CUSTOMER CONCERN (prefilled from scan)
          </label>
          <StableTextarea
            fieldKey={`${line.id}-concern`}
            value={line.customerConcern}
            onChange={(v) => onUpdateLine({ customerConcern: v })}
            className="w-full bg-[#1c1c1e] border border-[#38383a] rounded-2xl p-3.5 text-sm min-h-[80px]"
            placeholder="Customer stated..."
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-[#8e8e93] block mb-1.5">
            TECHNICIAN NOTES + FINDINGS
          </label>
          <StableTextarea
            fieldKey={`${line.id}-notes`}
            value={line.technicianNotes}
            onChange={(v) => onUpdateLine({ technicianNotes: v })}
            className="w-full bg-[#1c1c1e] border border-[#38383a] rounded-2xl p-3.5 text-sm min-h-[100px]"
            placeholder="Road test results, findings, observations..."
          />
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-[#8e8e93] mb-1.5">DIAGNOSTIC EVIDENCE PHOTOS</div>
          <button
            onClick={onAddXentryPhotos}
            disabled={isProcessingOCR}
            className="secondary-btn w-full h-12 flex items-center justify-center gap-2 text-sm mb-2"
          >
            <Camera size={18} />
            {isProcessingOCR ? `ANALYZING PHOTOS... ${ocrProgress}%` : 'ADD XENTRY TESTS / FAULT CODES / GUIDED / WIRING / CONTINUITY'}
          </button>
          <p className="text-[10px] text-[#8e8e93] -mt-1 mb-2">Photos analyzed with OCR. AI uses them for suggestions and stories.</p>

          {line.xentryImages && line.xentryImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {line.xentryImages.map((img) => (
                <img
                  key={img.id}
                  src={img.dataUrl}
                  className="w-full h-16 object-cover rounded border border-[#38383a] cursor-pointer"
                  alt={img.name}
                  onClick={() => window.open(img.dataUrl)}
                />
              ))}
            </div>
          )}
          {line.extractedData &&
            (line.extractedData.codes.length || line.extractedData.guidedTests.length || line.extractedData.measurements.length) > 0 && (
              <div className="text-[10px] bg-[#1c1c1e] p-2 rounded mb-2">
                <div className="font-semibold mb-1">Extracted from photos:</div>
                {line.extractedData.codes.length > 0 && <div>Codes: {line.extractedData.codes.join(', ')}</div>}
                {line.extractedData.guidedTests.length > 0 && (
                  <div>Guided: {line.extractedData.guidedTests.slice(0, 2).join(' | ')}</div>
                )}
                {line.extractedData.measurements.length > 0 && (
                  <div>
                    Meas: {line.extractedData.measurements[0].label}={line.extractedData.measurements[0].value}
                  </div>
                )}
              </div>
            )}
        </div>

        <div className="ios-card p-3 mb-1">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs uppercase tracking-widest text-[#8e8e93]">SMART DEFAULTS &amp; COMMON ISSUES</div>
            <button onClick={onApplySmartDefaults} className="text-[10px] px-2 py-0.5 bg-[#2c2c2e] rounded text-[#0a84ff]">
              APPLY FOR THIS VEHICLE
            </button>
          </div>
          <div className="text-[10px] text-[#8e8e93]">
            {suggestions.bandNote} — {suggestions.issues.slice(0, 2).join(', ')}... Standard:{' '}
            {suggestions.tests.slice(0, 2).map((t) => t.label).join(' / ')}
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowTemplateLibrary(true)}
            disabled={isGenerating || isReviewing}
            className="secondary-btn w-full h-12 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            <BookOpen size={18} />
            TEMPLATE LIBRARY
          </button>

          <button
            onClick={onGenerateStory}
            disabled={isGenerating || isReviewing || !hasApiKey}
            className="primary-btn w-full h-14 text-base disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                GENERATING WITH GROK…
              </>
            ) : (
              'GENERATE WARRANTY STORY (ONE-CLICK)'
            )}
          </button>
          {!hasApiKey && <p className="text-center text-xs text-[#ff9f0a] mt-2">Add xAI Grok API key in Settings to generate.</p>}
        </div>

        {line.warrantyStory && (
          <div className="story-card p-5 mt-2">
            <div className="text-xs uppercase tracking-[1px] text-[#8e8e93] mb-3">
              WARRANTY STORY — NATURAL PARAGRAPHS • BENZBOT 2.0 READY
            </div>
            <StableTextarea
              fieldKey={`${line.id}-story`}
              value={line.warrantyStory}
              onChange={(v) => onUpdateLine({ warrantyStory: v })}
              className="w-full bg-[#1c1c1e] rounded p-3 text-[14.5px] leading-relaxed mb-3 min-h-[200px] resize-y border border-[#38383a]"
            />

            {isGenerating && <BenzBotLoadingPanel mode="generating" />}
            {!isGenerating && isReviewing && <BenzBotLoadingPanel mode="reviewing" />}
            {!isGenerating && !isReviewing && storyQuality && (
              <BenzBotPanel
                quality={storyQuality}
                review={storyReview}
                panelKey={`${line.id}:${storyQuality.scoredAgainstStory ?? ''}:${storyQuality.score}`}
              />
            )}
            {!isGenerating && !isReviewing && !storyQuality && storyQualityStale && (
              <BenzBotStaleBanner onReview={onReviewStory} />
            )}

            <div className="flex gap-2 flex-wrap mt-3">
              <button
                type="button"
                onClick={onReviewStory}
                disabled={isGenerating || isReviewing || !line.warrantyStory?.trim() || !hasApiKey}
                className="flex-1 min-w-[160px] secondary-btn h-11 flex items-center justify-center gap-2 text-sm border-[#0a84ff]/30 text-[#0a84ff] disabled:opacity-60"
              >
                {isReviewing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> REVIEWING…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> BENZBOT 2.0 REVIEW
                  </>
                )}
              </button>
              <button onClick={copyStory} className="flex-1 min-w-[120px] secondary-btn h-11 flex items-center justify-center gap-2 text-sm">
                <Copy size={16} /> COPY
              </button>
              <button
                onClick={onGenerateStory}
                disabled={isGenerating || isReviewing}
                className="secondary-btn h-11 px-5 flex items-center gap-2 text-sm disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                REGENERATE
              </button>
            </div>
          </div>
        )}
      </div>

      <TemplateLibraryModal
        open={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        onInsert={handleInsertTemplate}
      />
    </div>
  );
}