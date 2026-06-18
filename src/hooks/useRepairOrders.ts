import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { deleteROFromDB, loadAllROs, saveROToDB } from '../lib/db';
import { debounce } from '../lib/debounce';
import { formatVinInput } from '../lib/vin';
import {
  extractROWithGrok,
  generateWarrantyStoryWithGrok,
  reviewWarrantyStoryWithGrok,
  scoreWarrantyStoryWithGrok,
} from '../services/grok';
import type { StoryQualityResult, StoryReviewResult } from '../prompts/storyQuality';
import { preprocessImageForOCR, runOCR } from '../services/ocr';
import type { AppView, ExtractedData, ImageAttachment, PendingROImage, RepairLine, RepairOrder } from '../types';
import { emptyExtractedData, mergeExtracted, parseDiagnosticText } from '../utils/diagnosticParser';
import { compressImageForStorage, dataUrlToFile } from '../utils/imageCompression';
import { getSuggestions } from '../utils/mercedesKb';
import {
  buildROFromExtraction,
  createManualRepairOrder,
  createNewRepairLine,
  ensureComplaintMeta,
  syncRepairLinesWithComplaints,
} from '../utils/repairOrderFactory';
import { parseStructuredROText } from '../utils/roExtractor';

interface UseRepairOrdersOptions {
  apiKey: string;
}

function cloneRO(ro: RepairOrder): RepairOrder {
  return structuredClone(ro);
}

export function useRepairOrders({ apiKey }: UseRepairOrdersOptions) {
  const [view, setView] = useState<AppView>('home');
  const [currentRO, setCurrentRO] = useState<RepairOrder | null>(null);
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [allROs, setAllROs] = useState<RepairOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingROImages, setPendingROImages] = useState<PendingROImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [storyQualityByLine, setStoryQualityByLine] = useState<Record<string, StoryQualityResult>>({});
  const [storyReviewByLine, setStoryReviewByLine] = useState<Record<string, StoryReviewResult>>({});

  const roRef = useRef<RepairOrder | null>(null);
  const allROsRef = useRef<RepairOrder[]>([]);

  useEffect(() => {
    roRef.current = currentRO;
  }, [currentRO]);

  useEffect(() => {
    allROsRef.current = allROs;
  }, [allROs]);

  const persistToDB = useRef(
    debounce(async (ro: RepairOrder) => {
      try {
        await saveROToDB(ro);
      } catch (e) {
        console.error('IDB save failed', e);
        toast.error('Failed to save repair order locally');
      }
    }, 450)
  ).current;

  const applyROUpdate = useCallback(
    (updater: (ro: RepairOrder) => RepairOrder, options?: { immediate?: boolean }) => {
      const base = roRef.current;
      if (!base) return null;
      const updated = ensureComplaintMeta(updater(cloneRO(base)));
      roRef.current = updated;
      setCurrentRO(updated);
      setAllROs((prev) => {
        const idx = prev.findIndex((r) => r.id === updated.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        return [updated, ...prev];
      });
      if (options?.immediate) {
        persistToDB.flush();
        void saveROToDB(updated);
      } else {
        persistToDB(updated);
      }
      return updated;
    },
    [persistToDB]
  );

  const flushPendingSave = useCallback(() => {
    persistToDB.flush();
    if (roRef.current) void saveROToDB(roRef.current);
  }, [persistToDB]);

  useEffect(() => {
    (async () => {
      const saved = (await loadAllROs()).map(ensureComplaintMeta);
      setAllROs(saved);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (view === 'ro' && !currentRO) setView('home');
    if (view === 'line') {
      const lineExists =
        !!currentRO && !!currentLineId && currentRO.repairLines.some((l) => l.id === currentLineId);
      if (!lineExists) setView(currentRO ? 'ro' : 'home');
    }
  }, [view, currentRO, currentLineId]);

  const navigateTo = useCallback(
    (next: AppView, lineId?: string | null) => {
      flushPendingSave();
      if (lineId !== undefined) setCurrentLineId(lineId);
      setView(next);
    },
    [flushPendingSave]
  );

  const deleteRO = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this RO and all its data?')) return;
      try {
        await deleteROFromDB(id);
        setAllROs((prev) => prev.filter((r) => r.id !== id));
        if (currentRO?.id === id) {
          roRef.current = null;
          setCurrentRO(null);
          setCurrentLineId(null);
          setView('home');
        }
        toast.success('Repair order deleted');
      } catch {
        toast.error('Failed to delete repair order');
      }
    },
    [currentRO]
  );

  const openRO = useCallback(
    (ro: RepairOrder) => {
      const normalized = ensureComplaintMeta(ro);
      roRef.current = normalized;
      setCurrentRO(normalized);
      setCurrentLineId(null);
      setView('ro');
    },
    []
  );

  const addROPhoto = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      const newImgs: PendingROImage[] = [];
      for (const file of files) {
        const compressed = await compressImageForStorage(file);
        newImgs.push({
          id: 'roimg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          dataUrl: compressed.dataUrl,
          name: file.name || `page-${newImgs.length + 1}.jpg`,
        });
      }
      setPendingROImages((prev) => [...prev, ...newImgs]);
    };
    input.click();
  }, []);

  const clearPendingROImages = useCallback(() => setPendingROImages([]), []);

  const processPendingROImages = useCallback(async () => {
    if (pendingROImages.length === 0) return;
    setIsProcessingOCR(true);
    setOcrProgress(0);
    setLoadingMessage(apiKey ? 'Analyzing RO with Grok vision…' : 'Running on-device OCR…');

    try {
      const dataUrls = pendingROImages.map((img) => img.dataUrl);
      let extracted;
      if (apiKey) {
        setOcrProgress(20);
        extracted = await extractROWithGrok(dataUrls, apiKey);
        setOcrProgress(90);
      } else {
        let combinedText = '';
        for (let i = 0; i < pendingROImages.length; i++) {
          const img = pendingROImages[i];
          const file = await dataUrlToFile(img.dataUrl, img.name);
          const preprocessed = await preprocessImageForOCR(file, 'full');
          const text = await runOCR(preprocessed, (p) =>
            setOcrProgress(Math.round((i / pendingROImages.length) * 80 + (p / pendingROImages.length) * 80))
          );
          combinedText += `\n\n=== PAGE ${i + 1} ===\n` + text;
        }
        setOcrProgress(95);
        extracted = parseStructuredROText(combinedText);
      }

      const newRO = buildROFromExtraction({
        vehicle: extracted.vehicle,
        complaints: extracted.complaints,
        customerName: extracted.customerName,
        roNumber: extracted.roNumber,
      });

      roRef.current = newRO;
      setCurrentRO(newRO);
      setAllROs((prev) => [newRO, ...prev.filter((r) => r.id !== newRO.id)]);
      await saveROToDB(newRO);
      setPendingROImages([]);
      setView('ro');
      toast.success('Repair order created from scan');
    } catch (error) {
      console.error('RO scan error', error);
      toast.error(error instanceof Error ? error.message : 'Processing images failed. Try fewer images or add your Grok key.');
    } finally {
      setIsProcessingOCR(false);
      setOcrProgress(0);
      setLoadingMessage('');
    }
  }, [apiKey, pendingROImages]);

  const createManualRO = useCallback(async () => {
    const newRO = createManualRepairOrder();
    roRef.current = newRO;
    setCurrentRO(newRO);
    setAllROs((prev) => [newRO, ...prev]);
    await saveROToDB(newRO);
    setView('ro');
    toast.success('Manual repair order created');
  }, []);

  const updateLine = useCallback(
    (lineId: string, updates: Partial<RepairLine>) => {
      applyROUpdate((ro) => ({
        ...ro,
        repairLines: ro.repairLines.map((line) => (line.id === lineId ? { ...line, ...updates } : line)),
      }));
    },
    [applyROUpdate]
  );

  const updateVehicle = useCallback(
    (updates: Partial<RepairOrder['vehicle']>) => {
      const normalized = { ...updates };
      if (normalized.vin !== undefined) normalized.vin = formatVinInput(normalized.vin);
      applyROUpdate((ro) => ({ ...ro, vehicle: { ...ro.vehicle, ...normalized } }));
    },
    [applyROUpdate]
  );

  const updateCustomer = useCallback(
    (name: string) => {
      applyROUpdate((ro) => ({ ...ro, customer: { ...ro.customer, name } }));
    },
    [applyROUpdate]
  );

  const updateComplaints = useCallback(
    (newComplaints: string[], newLabels?: string[], newIds?: string[]) => {
      applyROUpdate((ro) => {
        const labels =
          newLabels && newLabels.length === newComplaints.length
            ? newLabels
            : ro.complaintLabels ?? newComplaints.map((_, i) => String.fromCharCode(65 + i));
        const ids =
          newIds && newIds.length === newComplaints.length
            ? newIds
            : ro.complaintIds ?? labels.map((l) => `cmp-${ro.id}-${l}`);
        const oldFirst = ro.complaints[0] || '';
        const updatedLines = syncRepairLinesWithComplaints(ro.repairLines, newComplaints, oldFirst);
        return { ...ro, complaints: newComplaints, complaintLabels: labels, complaintIds: ids, repairLines: updatedLines };
      });
    },
    [applyROUpdate]
  );

  const addComplaint = useCallback(() => {
    const ro = roRef.current;
    if (!ro) return;
    const labels = [...(ro.complaintLabels || ro.complaints.map((_, i) => String.fromCharCode(65 + i)))];
    const ids = [...(ro.complaintIds || labels.map((l) => `cmp-${ro.id}-${l}`))];
    const lastCode = labels[labels.length - 1]?.toUpperCase().charCodeAt(0) ?? 64;
    const nextLabel = lastCode >= 65 && lastCode < 90 ? String.fromCharCode(lastCode + 1) : 'A';
    labels.push(nextLabel);
    ids.push(`cmp-${ro.id}-${nextLabel}-${Date.now()}`);
    updateComplaints([...(ro.complaints || []), 'New concern - describe symptom'], labels, ids);
  }, [updateComplaints]);

  const removeComplaint = useCallback(
    (index: number) => {
      const ro = roRef.current;
      if (!ro) return;
      updateComplaints(
        (ro.complaints || []).filter((_, i) => i !== index),
        ro.complaintLabels?.filter((_, i) => i !== index),
        ro.complaintIds?.filter((_, i) => i !== index)
      );
    },
    [updateComplaints]
  );

  const editComplaint = useCallback(
    (index: number, value: string) => {
      const ro = roRef.current;
      if (!ro) return;
      const updated = [...(ro.complaints || [])];
      updated[index] = value;
      updateComplaints(updated, ro.complaintLabels, ro.complaintIds);
    },
    [updateComplaints]
  );

  const updateRONumber = useCallback(
    (roNumber: string) => {
      applyROUpdate((ro) => ({ ...ro, roNumber: roNumber.trim() }));
    },
    [applyROUpdate]
  );

  const addRepairLine = useCallback(() => {
    const ro = roRef.current;
    if (!ro) return;
    const newLine = createNewRepairLine(ro.repairLines.length + 1);
    const updated = applyROUpdate(
      (r) => ({ ...r, repairLines: [...r.repairLines, newLine] }),
      { immediate: true }
    );
    if (updated) {
      setCurrentLineId(newLine.id);
      setView('line');
    }
  }, [applyROUpdate]);

  const processXentryFiles = useCallback(
    async (
      files: File[],
      existingImages: ImageAttachment[],
      existingOcr: string[],
      existingExtracted: ExtractedData
    ) => {
      let updatedExtracted = existingExtracted;
      let updatedOcrTexts = existingOcr;
      const newImgs: ImageAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setOcrProgress(Math.round((i / files.length) * 30));
        const compressed = await compressImageForStorage(file);
        newImgs.push({
          id: 'ximg-' + Date.now() + i,
          dataUrl: compressed.dataUrl,
          name: file.name,
        });
        try {
          const pre = await preprocessImageForOCR(file, 'fast');
          const text = await runOCR(pre, (p) =>
            setOcrProgress(Math.round(30 + ((i + p / 100) / files.length) * 70))
          );
          const diag = parseDiagnosticText(text);
          updatedExtracted = mergeExtracted(updatedExtracted, diag);
          updatedOcrTexts = [...updatedOcrTexts, text];
        } catch (err) {
          console.warn('Xentry OCR failed for one image', err);
        }
      }

      return { newImgs, updatedExtracted, updatedOcrTexts, allImages: [...existingImages, ...newImgs] };
    },
    []
  );

  const addXentryPhotos = useCallback(
    (lineId: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.setAttribute('capture', 'environment');
      input.onchange = async (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        if (files.length === 0 || !roRef.current) return;
        setIsProcessingOCR(true);
        setOcrProgress(0);
        setLoadingMessage('Analyzing diagnostic photos…');
        const ro = roRef.current;
        const line = ro.repairLines.find((l) => l.id === lineId);
        if (!line) {
          setIsProcessingOCR(false);
          setLoadingMessage('');
          return;
        }
        try {
          const result = await processXentryFiles(
            files,
            line.xentryImages || [],
            line.xentryOcrTexts || [],
            line.extractedData || emptyExtractedData()
          );
          applyROUpdate(
            (r) => ({
              ...r,
              repairLines: r.repairLines.map((l) =>
                l.id === lineId
                  ? {
                      ...l,
                      xentryImages: result.allImages,
                      xentryOcrTexts: result.updatedOcrTexts,
                      extractedData: result.updatedExtracted,
                    }
                  : l
              ),
            }),
            { immediate: true }
          );
          toast.success(`${files.length} diagnostic photo(s) analyzed`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to analyze photos');
        } finally {
          setIsProcessingOCR(false);
          setOcrProgress(0);
          setLoadingMessage('');
        }
      };
      input.click();
    },
    [applyROUpdate, processXentryFiles]
  );

  const addROXentryPhotos = useCallback(() => {
    if (!roRef.current) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.setAttribute('capture', 'environment');
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0 || !roRef.current) return;
      setIsProcessingOCR(true);
      setOcrProgress(0);
      setLoadingMessage('Analyzing Xentry photos…');
      const ro = roRef.current;
      const firstLine = ro.repairLines[0];
      try {
        const result = await processXentryFiles(
          files,
          ro.xentryImages || [],
          ro.xentryOcrTexts || [],
          firstLine?.extractedData || emptyExtractedData()
        );
        applyROUpdate(
          (r) => {
            let updatedLines = r.repairLines;
            if (firstLine) {
              updatedLines = r.repairLines.map((l, idx) =>
                idx === 0
                  ? {
                      ...l,
                      xentryImages: [...(l.xentryImages || []), ...result.newImgs],
                      xentryOcrTexts: result.updatedOcrTexts,
                      extractedData: result.updatedExtracted,
                    }
                  : l
              );
            }
            return {
              ...r,
              xentryImages: result.allImages,
              xentryOcrTexts: result.updatedOcrTexts,
              repairLines: updatedLines,
            };
          },
          { immediate: true }
        );
        toast.success(`${files.length} Xentry photo(s) analyzed`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to analyze photos');
      } finally {
        setIsProcessingOCR(false);
        setOcrProgress(0);
        setLoadingMessage('');
      }
    };
    input.click();
  }, [applyROUpdate, processXentryFiles]);

  const applySmartDefaultsToLine = useCallback(
    (lineId: string) => {
      const ro = roRef.current;
      if (!ro) return;
      const line = ro.repairLines.find((l) => l.id === lineId);
      if (!line) return;
      const sugg = getSuggestions(ro);
      let notes = (line.technicianNotes || '').trim();
      const addBlock = `\n\n[Smart defaults for ${sugg.bandNote}]\nCommon issues at this mileage: ${sugg.issues.join(' • ')}\nStandard values: ${sugg.tests.map((t) => `${t.label}: ${t.spec}${t.note ? ' (' + t.note + ')' : ''}`).join('; ')}`;
      if (!notes.includes('Smart defaults')) notes = (notes + addBlock).trim();
      let newExtract = line.extractedData || emptyExtractedData();
      if (newExtract.measurements.length === 0 && sugg.tests.length) {
        newExtract = {
          ...newExtract,
          measurements: sugg.tests.slice(0, 4).map((t) => ({ label: t.label, value: t.spec })),
        };
      }
      updateLine(lineId, { technicianNotes: notes, extractedData: newExtract });
      toast.success('Reference notes added');
    },
    [updateLine]
  );

  const generateStory = useCallback(
    async (lineId: string, key: string) => {
      const ro = roRef.current;
      if (!ro) return;
      const line = ro.repairLines.find((l) => l.id === lineId);
      if (!line) return;
      flushPendingSave();
      setIsGenerating(true);
      setLoadingMessage('Generating warranty story with Grok…');
      try {
        let historyContext = '';
        const similar = allROsRef.current
          .filter(
            (r) =>
              r.id !== ro.id &&
              r.vehicle.model &&
              ro.vehicle.model &&
              (r.vehicle.model.toLowerCase().includes(ro.vehicle.model.toLowerCase().split(' ')[0]) ||
                (r.vehicle.make &&
                  ro.vehicle.make &&
                  r.vehicle.make.toLowerCase() === ro.vehicle.make.toLowerCase()))
          )
          .slice(0, 2);
        if (similar.length > 0) {
          historyContext =
            '\n\nFor style consistency, examples from my previous similar repairs:\n' +
            similar
              .map((r) =>
                r.repairLines
                  .filter((l) => l.warrantyStory)
                  .map((l) => `For ${l.description}: ${l.warrantyStory!.substring(0, 250)}...`)
                  .join('\n')
              )
              .join('\n---\n');
        }
        const story = await generateWarrantyStoryWithGrok(ro, line, key, historyContext);
        applyROUpdate(
          (r) => ({
            ...r,
            repairLines: r.repairLines.map((l) => (l.id === lineId ? { ...l, warrantyStory: story } : l)),
          }),
          { immediate: true }
        );
        try {
          const quality = await scoreWarrantyStoryWithGrok(ro, line, story, key);
          setStoryQualityByLine((prev) => ({ ...prev, [lineId]: quality }));
          setStoryReviewByLine((prev) => {
            const next = { ...prev };
            delete next[lineId];
            return next;
          });
        } catch {
          // Story saved — BenzBot score is best-effort
        }
        toast.success('Warranty story generated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Story generation failed');
      } finally {
        setIsGenerating(false);
        setLoadingMessage('');
      }
    },
    [applyROUpdate, flushPendingSave]
  );

  const reviewStory = useCallback(
    async (lineId: string, key: string) => {
      const ro = roRef.current;
      if (!ro) return;
      const line = ro.repairLines.find((l) => l.id === lineId);
      if (!line?.warrantyStory?.trim()) return;
      flushPendingSave();
      setIsReviewing(true);
      setLoadingMessage('BenzBot 2.0 reviewing story…');
      try {
        const review = await reviewWarrantyStoryWithGrok(ro, line, line.warrantyStory, key);
        setStoryQualityByLine((prev) => ({ ...prev, [lineId]: review }));
        setStoryReviewByLine((prev) => ({ ...prev, [lineId]: review }));
        toast.success('BenzBot 2.0 review complete');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'BenzBot review failed');
      } finally {
        setIsReviewing(false);
        setLoadingMessage('');
      }
    },
    [flushPendingSave]
  );

  const storyQualityForLine = (() => {
    if (!currentLineId) return null;
    const quality = storyQualityByLine[currentLineId];
    const line = currentRO?.repairLines.find((l) => l.id === currentLineId);
    if (!quality || !line?.warrantyStory) return null;
    if (quality.scoredAgainstStory && quality.scoredAgainstStory !== line.warrantyStory) return null;
    return quality;
  })();

  const storyReviewForLine = (() => {
    if (!currentLineId || !storyQualityForLine) return null;
    return storyReviewByLine[currentLineId] ?? null;
  })();

  const storyQualityStaleForLine = (() => {
    if (!currentLineId) return false;
    const quality = storyQualityByLine[currentLineId];
    const line = currentRO?.repairLines.find((l) => l.id === currentLineId);
    if (!quality || !line?.warrantyStory) return false;
    return quality.scoredAgainstStory !== line.warrantyStory;
  })();

  const currentLine = currentRO?.repairLines.find((l) => l.id === currentLineId);

  const filteredROs = allROs
    .filter(
      (ro) =>
        ro.roNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ro.vehicle.make && ro.vehicle.make.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ro.vehicle.model && ro.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ro.vehicle.year && ro.vehicle.year.includes(searchTerm)) ||
        (ro.vehicle.vin && ro.vehicle.vin.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => ((b.createdAt || '0') > (a.createdAt || '0') ? 1 : -1));

  return {
    view,
    setView: navigateTo,
    currentRO,
    currentLineId,
    currentLine,
    allROs,
    loading,
    searchTerm,
    setSearchTerm,
    pendingROImages,
    isGenerating,
    isReviewing,
    isProcessingOCR,
    ocrProgress,
    loadingMessage,
    filteredROs,
    flushPendingSave,
    deleteRO,
    openRO,
    addROPhoto,
    clearPendingROImages,
    processPendingROImages,
    createManualRO,
    updateLine,
    updateVehicle,
    updateCustomer,
    addComplaint,
    removeComplaint,
    editComplaint,
    updateRONumber,
    addRepairLine,
    applySmartDefaultsToLine,
    addXentryPhotos,
    addROXentryPhotos,
    generateStory,
    reviewStory,
    storyQualityForLine,
    storyReviewForLine,
    storyQualityStaleForLine,
    setPendingROImages,
  };
}