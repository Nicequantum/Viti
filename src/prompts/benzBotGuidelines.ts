/**
 * BenzBot 2.0 (Mercedes Intelligence 2.0) warranty audit survival guidelines.
 */
export const BENZBOT_AUDIT_GUIDELINES = `## BENZBOT 2.0 — MERCEDES INTELLIGENCE AUDIT STANDARD

BenzBot 2.0 evaluates warranty stories for factual consistency, diagnostic logic, workflow completeness, and billing defensibility.

### What BenzBot 2.0 Rewards
1. **Natural 3 C's flow** — Customer complaint, cause, and correction woven into connected paragraphs without visible section headers. Each part is distinct but reads as one professional narrative.
2. **Complaint-to-evidence chain** — Cause built step-by-step from documented evidence (test drive → voltage → XENTRY → guided tests → findings).
3. **Complete 10-step workflow** — All standard warranty workflow steps appear in chronological order. Missing steps use [NOT DOCUMENTED] or [NOT PROVIDED].
4. **Correction matches cause** — Repair actions address the stated root cause with post-repair verification.
5. **Technician voice** — First-person, professional, concise. Active verbs. No marketing language.
6. **Technical specificity without fabrication** — Exact codes, measurements, and component names from provided OCR/notes only.
7. **Audit-safe honesty** — Placeholders signal missing documentation. Invented data is the #1 rejection trigger.

### What BenzBot 2.0 Flags
- Fabricated data not in the repair line context
- Visible headers like "Customer Complaint:", "Cause:", or "Correction:"
- Cause without evidence chain
- Correction without verification closure
- Complaint mismatch with the labeled RO line
- Copy-paste boilerplate lacking line-specific detail
- Contradictions with provided notes or OCR findings`;

export const NATURAL_STORY_STYLE_RULES = `### NATURAL PARAGRAPH FORMAT (STRICT)
When writing warranty stories:
- Write in flowing natural paragraphs — NO visible section headers (never write "Customer Complaint:", "Cause:", "Correction:", or similar labels)
- Weave the 3 C's into connected prose: open with how the customer presented, build cause through the diagnostic workflow, close with correction and verification
- Include all 10 workflow steps in chronological order within the narrative
- Use [NOT DOCUMENTED] / [NOT PROVIDED] for missing data — never invent filler
- First-person technician voice throughout
- Prefer short, precise sentences. Reference fault codes and measurements exactly as provided
- End with confidence the repair was verified`;