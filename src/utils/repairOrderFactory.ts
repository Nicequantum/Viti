import type { RepairLine, RepairOrder, VehicleInfo } from '../types';
import { EMPTY_EXTRACTED } from '../types';
import { normalizeVin } from '../lib/vin';

export function createNewRepairLine(lineNumber: number): RepairLine {
  return {
    id: 'line-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    lineNumber,
    description: 'New repair item',
    customerConcern: '',
    technicianNotes: '',
    xentryImages: [],
    xentryOcrTexts: [],
    extractedData: { ...EMPTY_EXTRACTED },
  };
}

export function createManualRepairOrder(): RepairOrder {
  const complaintId = 'cmp-' + Date.now();
  return {
    id: 'ro-' + Date.now(),
    roNumber: `R-${Date.now().toString().slice(-6)}`,
    vehicle: { vin: '', year: '', make: '', model: '', mileageIn: '', mileageOut: '' },
    customer: { name: '' },
    complaints: ['Enter customer concern / symptom here (will label as A.)'],
    complaintLabels: ['A'],
    complaintIds: [complaintId],
    xentryImages: [],
    xentryOcrTexts: [],
    createdAt: new Date().toISOString(),
    repairLines: [
      {
        id: 'line-1-' + Date.now(),
        lineNumber: 1,
        description: 'Enter repair description',
        customerConcern: '',
        technicianNotes: '',
        xentryImages: [],
        xentryOcrTexts: [],
        extractedData: { ...EMPTY_EXTRACTED },
      },
    ],
  };
}

export function ensureComplaintMeta(ro: RepairOrder): RepairOrder {
  const labels = ro.complaintLabels ?? ro.complaints.map((_, i) => String.fromCharCode(65 + i));
  const ids =
    ro.complaintIds ??
    ro.complaints.map((_, i) => `cmp-${ro.id}-${labels[i] ?? i}`);
  return { ...ro, complaintLabels: labels, complaintIds: ids };
}

export function syncRepairLinesWithComplaints(
  lines: RepairLine[],
  complaints: string[],
  previousFirstComplaint?: string
): RepairLine[] {
  if (complaints.length === 0) return lines;
  const oldFirst = previousFirstComplaint ?? '';
  const newFirst = complaints[0] || '';
  return lines.map((line, idx) => {
    if (idx !== 0) return line;
    if (!newFirst) return line;
    if (!line.customerConcern || line.customerConcern === oldFirst) {
      return { ...line, customerConcern: newFirst };
    }
    return line;
  });
}

export function sanitizeVehicle(vehicle: Partial<VehicleInfo>): VehicleInfo {
  return {
    vin: normalizeVin(vehicle.vin || ''),
    year: (vehicle.year || '').trim(),
    make: (vehicle.make || 'Mercedes-Benz').trim(),
    model: (vehicle.model || '').trim(),
    mileageIn: (vehicle.mileageIn || '').replace(/[^0-9]/g, ''),
    mileageOut: (vehicle.mileageOut || '').replace(/[^0-9]/g, ''),
  };
}

export function sanitizeComplaints(complaints: string[]): string[] {
  return complaints.filter((c) => c && c.trim().length > 5 && /[a-zA-Z]/.test(c));
}

export function buildROFromExtraction(extracted: {
  vehicle: Partial<VehicleInfo>;
  complaints: string[];
  customerName: string;
  roNumber?: string;
}): RepairOrder {
  const cleanComplaints = sanitizeComplaints(extracted.complaints || []);
  const labels = cleanComplaints.map((_, i) => String.fromCharCode(65 + i));
  const ids = cleanComplaints.map((_, i) => 'cmp-' + Date.now() + '-' + i);
  const vehicle = sanitizeVehicle(extracted.vehicle);

  return {
    id: 'ro-' + Date.now(),
    roNumber: extracted.roNumber || `R-${Date.now().toString().slice(-6)}`,
    vehicle,
    customer: { name: extracted.customerName || '' },
    complaints: cleanComplaints,
    complaintLabels: labels,
    complaintIds: ids,
    xentryImages: [],
    xentryOcrTexts: [],
    createdAt: new Date().toISOString(),
    repairLines: [
      {
        id: 'line-1-' + Date.now(),
        lineNumber: 1,
        description: cleanComplaints[0] ? cleanComplaints[0].slice(0, 60) : 'Enter repair description',
        customerConcern: cleanComplaints[0] || '',
        technicianNotes: '',
        xentryImages: [],
        xentryOcrTexts: [],
        extractedData: { ...EMPTY_EXTRACTED },
      },
    ],
  };
}