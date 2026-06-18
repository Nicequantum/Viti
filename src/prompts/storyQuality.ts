import type { RepairLine, RepairOrder } from '../types';
import { BENZBOT_AUDIT_GUIDELINES } from './benzBotGuidelines';
import { WARRANTY_WORKFLOW_STEPS } from './warrantyStory';

export type StoryQualityGrade = 'excellent' | 'strong' | 'needs-work' | 'at-risk';

export interface TechnicianDetailPrompt {
  missing: string;
  prompt: string;
  field: 'technicianNotes' | 'customerConcern' | 'diagnostic' | 'workflow';
}

export interface StoryQualityResult {
  score: number;
  grade: StoryQualityGrade;
  strengths: string[];
  improvements: string[];
  auditRisks: string[];
  technicianDetails: TechnicianDetailPrompt[];
  summary: string;
  scoredAgainstStory?: string;
}

export interface StoryReviewFeedback {
  structure: string;
  technicalDetail: string;
  clarity: string;
  workflow: string;
  fabricationRisk: string;
}

export interface StoryReviewResult extends StoryQualityResult {
  feedback: StoryReviewFeedback;
  priorityActions: string[];
}

const SCORE_JSON_SCHEMA = `{
  "score": <integer 0-100>,
  "grade": "<excellent|strong|needs-work|at-risk>",
  "summary": "<one sentence overall assessment>",
  "strengths": ["<specific strength>", ...],
  "improvements": ["<specific improvement>", ...],
  "auditRisks": ["<BenzBot 2.0 rejection risk>", ...],
  "technicianDetails": [
    {
      "missing": "<what specific technical detail is absent>",
      "prompt": "<exact instruction telling the tech what to add and where>",
      "field": "<technicianNotes|customerConcern|diagnostic|workflow>"
    }
  ]
}`;

const REVIEW_JSON_SCHEMA = `{
  "score": <integer 0-100>,
  "grade": "<excellent|strong|needs-work|at-risk>",
  "summary": "<one sentence overall assessment>",
  "strengths": ["..."],
  "improvements": ["..."],
  "auditRisks": ["..."],
  "technicianDetails": [
    {
      "missing": "<what is missing>",
      "prompt": "<what to add>",
      "field": "<technicianNotes|customerConcern|diagnostic|workflow>"
    }
  ],
  "feedback": {
    "structure": "<3 C's flow and paragraph clarity>",
    "technicalDetail": "<codes, measurements, evidence linkage>",
    "clarity": "<readability and technician voice>",
    "workflow": "<10-step workflow completeness>",
    "fabricationRisk": "<fabrication or contradiction risks>"
  },
  "priorityActions": ["<top actionable fix>", ...]
}`;

export const STORY_SCORE_SYSTEM_PROMPT = `You are a Mercedes-Benz warranty audit specialist simulating BenzBot 2.0 (Mercedes Intelligence 2.0) story review.

${BENZBOT_AUDIT_GUIDELINES}

## YOUR TASK
Score the warranty story against BenzBot 2.0 criteria. Compare ONLY against the repair line context — do not assume undocumented data exists.

For technicianDetails: identify 2-5 specific technical details that are MISSING from the story but needed for audit survival. Each entry must tell the technician exactly what to add (e.g. "Add the source voltage reading from your battery test" or "Document the initial Quick Test fault codes from XENTRY"). Use field to indicate where they should add it.

Grade mapping:
- excellent: 90-100
- strong: 75-89
- needs-work: 60-74
- at-risk: below 60

Penalize visible section headers, fabrication, missing workflow steps, and weak cause-evidence chains.

Respond with ONLY valid JSON:
${SCORE_JSON_SCHEMA}`;

export const STORY_REVIEW_SYSTEM_PROMPT = `You are a senior Mercedes-Benz warranty coach helping technicians pass BenzBot 2.0 audits.

${BENZBOT_AUDIT_GUIDELINES}

## YOUR TASK
Review the warranty story and provide a quality score plus actionable coaching.

technicianDetails must list 3-6 specific missing technical details with clear prompts on what to add. Be precise — name the exact data type (voltage reading, DTC codes, guided test result, mileage, part number, etc.).

Do NOT suggest inventing data. Suggest documenting real findings or using [NOT DOCUMENTED] placeholders.

Respond with ONLY valid JSON:
${REVIEW_JSON_SCHEMA}`;

function buildLineContext(ro: RepairOrder, line: RepairLine): string {
  const data = line.extractedData || { codes: [], guidedTests: [], measurements: [], components: [], circuits: [] };
  const xentryText = [
    data.codes.length ? `Codes: ${data.codes.join(', ')}` : '',
    data.guidedTests.length ? `Guided Tests: ${data.guidedTests.join(' | ')}` : '',
    data.measurements.length ? `Measurements: ${data.measurements.map((m) => `${m.label} = ${m.value}`).join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const workflowList = WARRANTY_WORKFLOW_STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n');

  return `VEHICLE: ${ro.vehicle.year} ${ro.vehicle.make} ${ro.vehicle.model} | VIN: ${ro.vehicle.vin} | Miles in: ${ro.vehicle.mileageIn || '[NOT PROVIDED]'} | Miles out: ${ro.vehicle.mileageOut || '[NOT PROVIDED]'}

RO COMPLAINTS:
${(ro.complaints || []).join('\n') || '[NOT PROVIDED]'}

LINE ${line.lineNumber}: ${line.description}
Customer concern: ${line.customerConcern || line.description}
Technician notes: ${line.technicianNotes || '[NOT PROVIDED]'}

DOCUMENTED DIAGNOSTIC DATA:
${xentryText || 'No structured diagnostic data extracted.'}

REQUIRED WORKFLOW STEPS:
${workflowList}`;
}

export function buildStoryScoreUserMessage(ro: RepairOrder, line: RepairLine, warrantyStory: string): string {
  return `${buildLineContext(ro, line)}

WARRANTY STORY TO SCORE:
---
${warrantyStory}
---

Score for BenzBot 2.0 audit survival. List specific missing technical details in technicianDetails.`;
}

export function buildStoryReviewUserMessage(ro: RepairOrder, line: RepairLine, warrantyStory: string): string {
  return `${buildLineContext(ro, line)}

WARRANTY STORY TO REVIEW:
---
${warrantyStory}
---

Provide BenzBot 2.0 coaching with specific technicianDetails prompts.`;
}

export function gradeFromScore(score: number): StoryQualityGrade {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'strong';
  if (score >= 60) return 'needs-work';
  return 'at-risk';
}

function clampScore(score: unknown): number {
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asStringArray(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((s) => s.trim().length > 0).slice(0, max);
}

function asGrade(value: unknown, score: number): StoryQualityGrade {
  const grades: StoryQualityGrade[] = ['excellent', 'strong', 'needs-work', 'at-risk'];
  if (typeof value === 'string' && grades.includes(value as StoryQualityGrade)) {
    return value as StoryQualityGrade;
  }
  return gradeFromScore(score);
}

const VALID_FIELDS = new Set(['technicianNotes', 'customerConcern', 'diagnostic', 'workflow']);

function parseTechnicianDetails(value: unknown): TechnicianDetailPrompt[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const missing = String(row.missing ?? '').trim();
      const prompt = String(row.prompt ?? '').trim();
      const fieldRaw = String(row.field ?? 'technicianNotes');
      const field = VALID_FIELDS.has(fieldRaw) ? (fieldRaw as TechnicianDetailPrompt['field']) : 'technicianNotes';
      if (!missing && !prompt) return null;
      return { missing: missing || 'Missing detail', prompt: prompt || missing, field };
    })
    .filter((x): x is TechnicianDetailPrompt => x !== null)
    .slice(0, 6);
}

export function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function parseStoryQualityResponse(raw: string): StoryQualityResult {
  const payload = extractJsonPayload(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {
      score: 0,
      grade: 'at-risk',
      strengths: [],
      improvements: ['Unable to parse quality score — try reviewing again.'],
      auditRisks: ['Score analysis unavailable'],
      technicianDetails: [],
      summary: 'Quality analysis could not be completed.',
    };
  }

  const score = clampScore(parsed.score);
  return {
    score,
    grade: asGrade(parsed.grade, score),
    strengths: asStringArray(parsed.strengths),
    improvements: asStringArray(parsed.improvements),
    auditRisks: asStringArray(parsed.auditRisks),
    technicianDetails: parseTechnicianDetails(parsed.technicianDetails),
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : 'Quality assessment complete.',
  };
}

export function parseStoryReviewResponse(raw: string): StoryReviewResult {
  const payload = extractJsonPayload(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    const fallback = parseStoryQualityResponse(raw);
    return {
      ...fallback,
      feedback: {
        structure: 'Review could not be parsed — try again.',
        technicalDetail: '',
        clarity: '',
        workflow: '',
        fabricationRisk: '',
      },
      priorityActions: ['Re-run BenzBot 2.0 Review'],
    };
  }

  const quality = parseStoryQualityResponse(payload);
  const feedbackRaw = (parsed.feedback ?? {}) as Record<string, unknown>;

  return {
    ...quality,
    feedback: {
      structure: String(feedbackRaw.structure ?? '').trim() || 'No structure feedback.',
      technicalDetail: String(feedbackRaw.technicalDetail ?? '').trim() || 'No technical detail feedback.',
      clarity: String(feedbackRaw.clarity ?? '').trim() || 'No clarity feedback.',
      workflow: String(feedbackRaw.workflow ?? '').trim() || 'No workflow feedback.',
      fabricationRisk: String(feedbackRaw.fabricationRisk ?? '').trim() || 'No fabrication risk noted.',
    },
    priorityActions: asStringArray(parsed.priorityActions, 5),
  };
}