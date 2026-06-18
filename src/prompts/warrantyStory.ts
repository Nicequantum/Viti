import type { RepairLine, RepairOrder } from '../types';
import { BENZBOT_AUDIT_GUIDELINES, NATURAL_STORY_STYLE_RULES } from './benzBotGuidelines';

export const WARRANTY_WORKFLOW_STEPS = [
  'Initial test drive to confirm/reproduce the customer complaint (mileage in/out)',
  'Source voltage check at the battery',
  'Install battery charger to maintain vehicle voltage',
  'Connect XENTRY and perform initial Quick Test',
  'Guided testing on relevant fault codes from the Quick Test',
  'Technician findings and diagnostic conclusions',
  'Repairs performed',
  'Clear fault codes and perform final Quick Test to verify no codes return',
  'Disconnect battery charger and XENTRY',
  'Final verification test drive (typically 3–5 miles) to confirm the repair (mileage in/out)',
] as const;

export const SYSTEM_PROMPT = `You are a senior Mercedes-Benz master technician writing warranty stories engineered to survive BenzBot 2.0 (Mercedes Intelligence 2.0) automated warranty audits.

${BENZBOT_AUDIT_GUIDELINES}

${NATURAL_STORY_STYLE_RULES}

## ABSOLUTE RULES — AUDIT SAFETY (NEVER VIOLATE)

1. **Facts only**: Use ONLY information explicitly provided in the user message.
2. **No fabrication**: Do NOT invent test results, codes, measurements, procedures, or part numbers.
3. **Missing data placeholders**: Use [NOT DOCUMENTED] or [NOT PROVIDED] when data is absent.
4. **Required workflow sequence**: Walk through ALL 10 workflow steps in order within natural paragraphs.
5. **No visible headers**: Never output "Customer Complaint:", "Cause:", "Correction:", or any section labels.
6. **Tone**: Professional first-person technician language. Chronological flow.

Write ONLY the warranty story for the specific repair line. Natural paragraphs only — no headings.`;

export const STORY_TEMPLATES = [
  'Chronological narrative: customer presentation → diagnostic workflow → cause conclusion → repair → verification drive.',
  'Evidence-first flow: test drive and voltage, then XENTRY data, guided tests, findings, repair, final verification.',
  'Concise audit record: tight sentences, every workflow step present, placeholders for undocumented elements.',
  'Road-test bookends: initial and final drives anchor the story with diagnostics and repair between.',
  'XENTRY-centered: foreground Quick Test and guided testing within natural paragraph flow.',
];

export function buildWarrantyStoryUserMessage(
  ro: RepairOrder,
  line: RepairLine,
  historyContext = '',
  templateIndex?: number
): string {
  const vehicleInfo = `${ro.vehicle.year} ${ro.vehicle.make} ${ro.vehicle.model} | VIN: ${ro.vehicle.vin} | Miles: ${ro.vehicle.mileageIn}${ro.vehicle.mileageOut ? ` → ${ro.vehicle.mileageOut}` : ''}`
    .replace(/\s+/g, ' ')
    .trim();

  const data = line.extractedData || { codes: [], guidedTests: [], measurements: [], components: [], circuits: [] };
  const xentryText = [
    data.codes.length ? `Codes: ${data.codes.join(', ')}` : '',
    data.guidedTests.length ? `Guided Tests: ${data.guidedTests.join(' | ')}` : '',
    data.measurements.length ? `Measurements: ${data.measurements.map((m) => `${m.label} = ${m.value}`).join('; ')}` : '',
    data.components.length ? `Components: ${data.components.join(' | ')}` : '',
    data.circuits.length ? `Circuits/Pins: ${data.circuits.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n') || 'No structured Xentry data extracted.';

  const rawXentryOcr =
    line.xentryOcrTexts && line.xentryOcrTexts.length > 0
      ? '\nRaw OCR from line diagnostic photos:\n' + line.xentryOcrTexts.join('\n---\n')
      : '';

  const roRawXentryOcr =
    ro.xentryOcrTexts && ro.xentryOcrTexts.length > 0
      ? '\nRO-level Xentry / Quick Test OCR:\n' + ro.xentryOcrTexts.join('\n---\n')
      : '';

  const idx = templateIndex ?? Math.floor(Math.random() * STORY_TEMPLATES.length);
  const workflowChecklist = WARRANTY_WORKFLOW_STEPS.map((step, i) => `${i + 1}. ${step}`).join('\n');

  return `Vehicle information: ${vehicleInfo}

RO Complaints (A, B, C etc from scan):
${(ro.complaints || []).join('\n') || '[NOT PROVIDED]'}

All repairs on this RO:
${ro.repairLines.map((l) => `Line ${l.lineNumber}: ${l.description}`).join('\n')}

Current repair line: Line ${line.lineNumber} - ${line.description}

Customer concern for this line: ${line.customerConcern || line.description || '[NOT PROVIDED]'}

Technician notes: ${line.technicianNotes || '[NOT PROVIDED]'}

Xentry test data:
${xentryText}
${rawXentryOcr}
${roRawXentryOcr}
${historyContext}

REQUIRED WORKFLOW (include ALL steps in order — weave into natural paragraphs):
${workflowChecklist}

REQUIREMENTS:
- Use ONLY the data above. Never invent numbers, codes, or test results.
- Write in natural paragraph form. NO visible headings or section labels.
- Cover the 3 C's (complaint, cause, correction) within flowing prose.
- Reference labeled complaints (A, B, C…) when relevant.
- Use [NOT DOCUMENTED] / [NOT PROVIDED] for missing data.
- Narrative style: ${STORY_TEMPLATES[idx]}

Write only the warranty story for this specific line.`;
}