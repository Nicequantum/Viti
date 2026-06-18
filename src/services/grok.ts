import type { RepairLine, RepairOrder, ROExtraction } from '../types';
import { parseStructuredROText } from '../utils/roExtractor';
import {
  buildStoryReviewUserMessage,
  buildStoryScoreUserMessage,
  parseStoryQualityResponse,
  parseStoryReviewResponse,
  STORY_REVIEW_SYSTEM_PROMPT,
  STORY_SCORE_SYSTEM_PROMPT,
  type StoryQualityResult,
  type StoryReviewResult,
} from '../prompts/storyQuality';
import { buildWarrantyStoryUserMessage, SYSTEM_PROMPT } from '../prompts/warrantyStory';

const RO_EXTRACTION_PROMPT = `Use OCR to carefully analyze the provided repair order image(s). Extract ACCURATELY and ONLY from the FIRST BLOCK (top header / primary vehicle info section — ignore labor, parts, totals, signatures, lower notes).

STRICT FIELD LOCATIONS FOR THIS MERCEDES-BENZ RO FORMAT:
- RO Number: top center of page (near "RO #", "Repair Order", "Work Order")
- Customer Name: top left customer section
- Year / Make / Model: specific vehicle information table row
- VIN: the VIN field (must be exactly 17 characters)
- Mileage IN: the "MILEAGE IN / OUT" or mileage column (numbers only)

Customer Complaints (MOST IMPORTANT - SUPER AGGRESSIVE):
Search the ENTIRE document (all pages/images) for ANY text after or under these EXACT trigger phrases (case insensitive):
"Customer states", "Customer complaint", "Customer concern", "customer states that",
"Technician notes", "Tech notes", "Technician found", "Technician observed", "Technician seen", "tech found", "tech observed", "technician notes",
"Concern", "Complaint", "Issue", "Problem", "Needs", "Requires", "state inspection", "found", "observed", "reported", "requires repair", "inspection result", "c/s", "c s".
Extract the full following text as complaints. Label them A, B, C, D etc (use form labels if present, or assign sequentially). Pull EVERY complaint from any page. If none, output exactly "None listed."

Output ONLY this exact format, nothing else:

RO Number: [precise value from top center]
Customer Name: [value]
Year: [value]
Make: [value]
Model: [value]
VIN: [exact 17 char]
Mileage IN: [numbers only]
Customer Complaints:
A. [exact text]
B. [exact text]
...

Be extremely precise on VIN (17 alphanum, fix O/0 I/1), mileage numbers, RO number. Use the trigger phrases above aggressively for complaints.`;

interface GrokChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function grokChat(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-3',
      messages,
      temperature: options?.temperature ?? 0.25,
      max_tokens: options?.max_tokens ?? 900,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Grok API error: ${response.status} ${err}`);
  }
  const apiResponse = (await response.json()) as GrokChatResponse;
  return apiResponse.choices?.[0]?.message?.content?.trim() || '';
}

export async function extractROWithGrok(imageDataUrls: string[], apiKey: string): Promise<ROExtraction> {
  const imageContents = imageDataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } }));
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [{ role: 'user', content: [{ type: 'text', text: RO_EXTRACTION_PROMPT }, ...imageContents] }],
      temperature: 0.05,
      max_tokens: 700,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Grok vision extraction error: ${response.status} ${err}`);
  }
  const apiResponse = (await response.json()) as GrokChatResponse;
  const extractedText = apiResponse.choices?.[0]?.message?.content?.trim() || '';
  return parseStructuredROText(extractedText);
}

export async function generateWarrantyStoryWithGrok(
  ro: RepairOrder,
  line: RepairLine,
  apiKey: string,
  historyContext = ''
): Promise<string> {
  const userMessage = buildWarrantyStoryUserMessage(ro, line, historyContext);
  const story = await grokChat(
    apiKey,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.25, max_tokens: 1100 }
  );
  return story || 'No story generated.';
}

export async function scoreWarrantyStoryWithGrok(
  ro: RepairOrder,
  line: RepairLine,
  warrantyStory: string,
  apiKey: string
): Promise<StoryQualityResult> {
  const raw = await grokChat(
    apiKey,
    [
      { role: 'system', content: STORY_SCORE_SYSTEM_PROMPT },
      { role: 'user', content: buildStoryScoreUserMessage(ro, line, warrantyStory) },
    ],
    { temperature: 0.1, max_tokens: 800 }
  );
  return { ...parseStoryQualityResponse(raw), scoredAgainstStory: warrantyStory };
}

export async function reviewWarrantyStoryWithGrok(
  ro: RepairOrder,
  line: RepairLine,
  warrantyStory: string,
  apiKey: string
): Promise<StoryReviewResult> {
  const raw = await grokChat(
    apiKey,
    [
      { role: 'system', content: STORY_REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: buildStoryReviewUserMessage(ro, line, warrantyStory) },
    ],
    { temperature: 0.15, max_tokens: 1000 }
  );
  return { ...parseStoryReviewResponse(raw), scoredAgainstStory: warrantyStory };
}