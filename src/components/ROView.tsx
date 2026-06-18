import { Camera, Plus, Trash2 } from 'lucide-react';
import type { RepairOrder } from '../types';
import { StableInput, StableTextarea } from './StableTextField';

interface ROViewProps {
  ro: RepairOrder;
  isProcessingOCR: boolean;
  ocrProgress: number;
  onDone: () => void;
  onUpdateRONumber: (value: string) => void;
  onUpdateVehicle: (field: keyof RepairOrder['vehicle'], value: string) => void;
  onUpdateCustomer: (value: string) => void;
  onAddComplaint: () => void;
  onEditComplaint: (index: number, value: string) => void;
  onRemoveComplaint: (index: number) => void;
  onAddROXentryPhotos: () => void;
  onAddRepairLine: () => void;
  onOpenLine: (lineId: string) => void;
  onDeleteRO: () => void;
}

function complaintLabel(labels: string[] | undefined, index: number): string {
  return labels?.[index] || String.fromCharCode(65 + index);
}

export function ROView({
  ro,
  isProcessingOCR,
  ocrProgress,
  onDone,
  onUpdateRONumber,
  onUpdateVehicle,
  onUpdateCustomer,
  onAddComplaint,
  onEditComplaint,
  onRemoveComplaint,
  onAddROXentryPhotos,
  onAddRepairLine,
  onOpenLine,
  onDeleteRO,
}: ROViewProps) {
  return (
    <div className="px-5 pt-4 pb-8">
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="text-xl font-semibold">{ro.roNumber}</div>
          <div className="text-sm text-[#8e8e93]">Repair Order • Pre-populated from scan or manual entry</div>
        </div>
        <button onClick={onDone} className="text-[#0a84ff] text-sm">
          Done
        </button>
      </div>

      <div className="ios-card p-5 mb-6">
        <div className="text-xs uppercase tracking-widest text-[#8e8e93] mb-3">
          RO DETAILS (from first block of scan — RO#, vehicle fields, all complaints from any page)
        </div>

        <div className="mb-3">
          <label className="text-[10px] text-[#8e8e93] block mb-0.5">RO NUMBER</label>
          <StableInput
            fieldKey={`${ro.id}-roNumber`}
            value={ro.roNumber}
            onChange={onUpdateRONumber}
            placeholder="RO-123456"
            className="w-full bg-[#2c2c2e] border border-[#38383a] rounded-xl px-3 py-2 text-sm font-mono tracking-[1px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          {(['year', 'make', 'model', 'mileageIn'] as const).map((field) => (
            <div key={field}>
              <label className="text-[10px] text-[#8e8e93] block mb-0.5">{field === 'mileageIn' ? 'MILEAGE IN' : field.toUpperCase()}</label>
              <StableInput
                fieldKey={`${ro.id}-${field}`}
                value={ro.vehicle[field]}
                onChange={(v) => onUpdateVehicle(field, v)}
                placeholder={field === 'year' ? '2023' : field === 'make' ? 'Mercedes-Benz' : field === 'model' ? 'GLE 450 4MATIC' : '48250'}
                className="w-full bg-[#2c2c2e] border border-[#38383a] rounded-xl px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="mb-3">
          <label className="text-[10px] text-[#8e8e93] block mb-0.5">VIN</label>
          <StableInput
            fieldKey={`${ro.id}-vin`}
            value={ro.vehicle.vin}
            onChange={(v) => onUpdateVehicle('vin', v.toUpperCase())}
            placeholder="W1Nxxxx..."
            maxLength={17}
            className="w-full bg-[#2c2c2e] border border-[#38383a] rounded-xl px-3 py-2 text-sm font-mono tracking-[1px]"
          />
        </div>

        <div className="mb-4">
          <label className="text-[10px] text-[#8e8e93] block mb-0.5">CUSTOMER NAME</label>
          <StableInput
            fieldKey={`${ro.id}-customer`}
            value={ro.customer?.name || ''}
            onChange={onUpdateCustomer}
            placeholder="John Smith"
            className="w-full bg-[#2c2c2e] border border-[#38383a] rounded-xl px-3 py-2 text-sm"
          />
        </div>

        <div className="border-t border-[#38383a] pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-[#8e8e93]">CUSTOMER COMPLAINTS (A, B, C, D... from any page)</div>
            <button onClick={onAddComplaint} className="text-[#0a84ff] text-xs flex items-center gap-1">
              <Plus size={14} /> ADD
            </button>
          </div>
          <p className="text-[9px] text-[#8e8e93] mb-2">Pre-populated from scan (first block + multi-page). Edit as needed.</p>

          {ro.complaints && ro.complaints.length > 0 ? (
            ro.complaints.map((c, idx) => {
              const label = complaintLabel(ro.complaintLabels, idx);
              const stableId = ro.complaintIds?.[idx] ?? `${ro.id}-cmp-${label}`;
              return (
                <div key={stableId} className="flex gap-2 mb-2 items-start">
                  <div className="mt-2 w-6 text-[#0a84ff] font-semibold text-sm shrink-0">{label}.</div>
                  <StableTextarea
                    fieldKey={stableId}
                    value={c}
                    onChange={(v) => onEditComplaint(idx, v)}
                    className="bg-[#2c2c2e] border border-[#38383a] rounded-2xl px-3 py-2 text-sm min-h-[48px] resize-y"
                  />
                  <button onClick={() => onRemoveComplaint(idx)} className="mt-1 p-1.5 text-[#ff9f0a]" title="Remove complaint">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-[#8e8e93] mb-2">No complaints extracted. Add or rescan.</div>
          )}
          <button onClick={onAddComplaint} className="text-xs text-[#0a84ff] mt-1">
            + Add another complaint
          </button>
        </div>
      </div>

      <div className="ios-card p-4 mb-6">
        <div className="text-xs uppercase tracking-widest text-[#8e8e93] mb-1">XENTRY / DIAGNOSTIC IMAGE SCANS (RO level)</div>
        <p className="text-[10px] text-[#8e8e93] mb-2 leading-snug">
          Upload or capture XENTRY Quick Test, fault codes, Guided Tests, wiring diagrams, continuity checks, measurements.
        </p>
        <button
          onClick={onAddROXentryPhotos}
          disabled={isProcessingOCR}
          className="secondary-btn w-full h-12 flex items-center justify-center gap-2 text-sm mb-2"
        >
          <Camera size={18} />
          {isProcessingOCR ? `ANALYZING... ${ocrProgress}%` : 'SCAN / ADD XENTRY PHOTOS (QT, CODES, GUIDED, WIRING...)'}
        </button>
        {ro.xentryImages && ro.xentryImages.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            {ro.xentryImages.map((img) => (
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
        {ro.repairLines[0]?.extractedData &&
          (ro.repairLines[0].extractedData.codes.length > 0 ||
            ro.repairLines[0].extractedData.guidedTests.length > 0 ||
            ro.repairLines[0].extractedData.measurements.length > 0) && (
            <div className="text-[10px] bg-[#1c1c1e] p-2 rounded">
              <div className="font-semibold mb-0.5">Extracted:</div>
              {ro.repairLines[0].extractedData.codes.length > 0 && (
                <div>Codes: {ro.repairLines[0].extractedData.codes.join(', ')}</div>
              )}
              {ro.repairLines[0].extractedData.guidedTests.length > 0 && (
                <div>Guided: {ro.repairLines[0].extractedData.guidedTests.slice(0, 2).join(' | ')}</div>
              )}
              {ro.repairLines[0].extractedData.measurements.length > 0 && (
                <div>
                  Meas:{' '}
                  {ro.repairLines[0].extractedData.measurements
                    .slice(0, 1)
                    .map((m) => `${m.label}=${m.value}`)
                    .join('; ')}
                </div>
              )}
            </div>
          )}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-sm font-semibold text-[#8e8e93]">REPAIR LINES (A/B/C map to lines)</div>
        <button onClick={onAddRepairLine} className="flex items-center gap-1 text-[#0a84ff] text-sm font-medium">
          <Plus size={16} /> ADD LINE
        </button>
      </div>

      <div className="space-y-2">
        {ro.repairLines.map((line) => (
          <div
            key={line.id}
            onClick={() => onOpenLine(line.id)}
            className="ios-card px-4 py-4 flex justify-between items-center active:bg-[#252528] cursor-pointer"
          >
            <div>
              <div className="font-medium">
                Line {line.lineNumber}: {line.description}
              </div>
              {line.customerConcern && (
                <div className="text-[10px] text-[#8e8e93] mt-0.5 truncate max-w-[240px]">{line.customerConcern}</div>
              )}
              {line.warrantyStory && <div className="text-xs text-[#30d158] mt-0.5">Story ready</div>}
            </div>
            <div className="text-[#8e8e93]">›</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-6">
        <button onClick={onDone} className="flex-1 text-sm text-[#8e8e93] py-2 border border-[#38383a] rounded">
          Back to List
        </button>
        <button onClick={onDeleteRO} className="flex-1 text-sm text-[#ff9f0a] py-2 border border-[#38383a] rounded">
          Delete RO
        </button>
      </div>
    </div>
  );
}