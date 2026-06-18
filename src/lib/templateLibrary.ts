export type TemplateCategory = 'customer' | 'warranty';

export interface StoryTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  content: string;
  tags: string[];
}

interface TemplateSeed {
  title: string;
  category: TemplateCategory;
  tags: string[];
  content: string;
}

function paragraph(complaint: string, cause: string, correction: string): string {
  return `${complaint.trim()} ${cause.trim()} ${correction.trim()}`.replace(/\s+/g, ' ').trim();
}

const SEEDS: TemplateSeed[] = [
  {
    title: 'B Service',
    category: 'customer',
    tags: ['maintenance', 'service-b', 'customer-pay'],
    content: paragraph(
      'Customer requests scheduled Mercedes-Benz Service B maintenance per maintenance booklet and vehicle mileage interval.',
      'Vehicle is due for Service B interval. Maintenance inspection identified normal wear items per Mercedes-Benz maintenance standards with no additional customer-pay faults requiring diagnosis.',
      'Performed Service B per Mercedes-Benz maintenance booklet: replaced engine oil and filter, reset service indicator, completed maintenance inspection per workshop manual, checked and topped fluids as required, inspected brakes, tires, belts, hoses, lights, and wipers, verified tire pressures, and road tested vehicle. Returned vehicle to customer with service documentation and next service due recommendation.'
    ),
  },
  {
    title: 'A Service',
    category: 'customer',
    tags: ['maintenance', 'service-a', 'customer-pay'],
    content: paragraph(
      'Customer requests scheduled Mercedes-Benz Service A maintenance per maintenance booklet.',
      'Vehicle is due for Service A interval. Routine maintenance inspection completed with no additional customer-pay faults identified.',
      'Performed Service A per Mercedes-Benz maintenance booklet: replaced engine oil and filter, reset service indicator, completed maintenance inspection, checked fluids and tire pressures, inspected brakes and tires, and verified proper operation on road test. Vehicle returned to customer.'
    ),
  },
  {
    title: 'Lube, Oil & Filter Service',
    category: 'customer',
    tags: ['maintenance', 'lof', 'customer-pay'],
    content: paragraph(
      'Customer requests lube, oil, and filter service.',
      'Routine oil change interval reached with no drivability or warning concerns reported.',
      'Performed lube, oil, and filter service: drained engine oil, replaced oil filter, installed approved engine oil to specification, checked and topped fluids as needed, reset service reminder if applicable, and verified no leaks. Road tested with no issues noted.'
    ),
  },
  {
    title: 'Blind Spot Assist Warning',
    category: 'warranty',
    tags: ['blind-spot', 'assist', 'radar'],
    content: paragraph(
      'Customer states blind spot assist warning displays intermittently while driving.',
      'Initial test drive confirmed blind spot assist warning during lane change simulation. Source voltage verified at battery and battery charger installed. Connected XENTRY and Quick Test stored faults related to blind spot assist communication. Guided testing confirmed fault in blind spot monitor circuit.',
      'Replaced faulty blind spot assist radar sensor per guided test direction. Cleared faults and performed blind spot system calibration per WIS. Final Quick Test showed no faults. Disconnected charger and XENTRY. Final verification test drive confirmed blind spot assist operated normally.'
    ),
  },
  {
    title: 'MBUX System Failure',
    category: 'warranty',
    tags: ['mbux', 'head-unit', 'infotainment'],
    content: paragraph(
      'Customer reports MBUX system failure with screen black, rebooting, or functions unavailable.',
      'Confirmed MBUX inoperative at key-on. Voltage maintained with battery charger. XENTRY Quick Test showed communication faults for head unit nodes. Guided testing indicated MBUX head unit internal failure not recoverable by reset.',
      'Replaced MBUX head unit and programmed to vehicle. Cleared faults and final Quick Test verified communication. Verification drive confirmed stable MBUX operation including audio, navigation, Bluetooth, and backup camera.'
    ),
  },
  {
    title: 'Check Engine Light — Fuel Trim',
    category: 'warranty',
    tags: ['cel', 'fuel-trim', 'injector', 'lean'],
    content: paragraph(
      'Customer reports check engine light illuminated with rough idle and hesitation during acceleration.',
      'Initial test drive confirmed concern. Battery charger connected. XENTRY Quick Test confirmed lean codes. Guided fuel system testing and adaptation data review indicated injector delivery faults on affected cylinders.',
      'Replaced faulty injectors per diagnosis. Cleared adaptations and performed drive cycle. Final Quick Test verified no codes returned. Verification drive confirmed smooth idle and no hesitation.'
    ),
  },
];

const USER_TEMPLATES_KEY = 'benztech_user_templates_v1';
const RECENT_TEMPLATES_KEY = 'benztech_recent_templates_v1';

export function getBuiltInTemplates(): StoryTemplate[] {
  return SEEDS.map((seed, index) => ({
    id: `seed-${index}-${seed.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: seed.title,
    category: seed.category,
    content: seed.content,
    tags: seed.tags,
  }));
}

function loadUserTemplates(): StoryTemplate[] {
  try {
    const raw = localStorage.getItem(USER_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === 'string' && typeof t.content === 'string');
  } catch {
    return [];
  }
}

export function saveUserTemplate(template: Omit<StoryTemplate, 'id'> & { id?: string }): StoryTemplate {
  const existing = loadUserTemplates();
  const entry: StoryTemplate = {
    id: template.id || `user-${Date.now()}`,
    title: template.title,
    category: template.category,
    content: template.content,
    tags: template.tags || ['user-saved'],
  };
  const next = [entry, ...existing.filter((t) => t.id !== entry.id)].slice(0, 50);
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(next));
  return entry;
}

export function listAllTemplates(): StoryTemplate[] {
  return [...loadUserTemplates(), ...getBuiltInTemplates()];
}

export interface RecentTemplateRef {
  id: string;
  title: string;
  category: TemplateCategory;
  usedAt: string;
}

export function recordRecentTemplate(ref: Pick<RecentTemplateRef, 'id' | 'title' | 'category'>): void {
  const existing = getRecentTemplateRefs();
  const next: RecentTemplateRef[] = [
    { ...ref, usedAt: new Date().toISOString() },
    ...existing.filter((r) => r.id !== ref.id),
  ].slice(0, 12);
  localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(next));
}

export function getRecentTemplateRefs(): RecentTemplateRef[] {
  try {
    const raw = localStorage.getItem(RECENT_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Customer Pay templates insert exact saved text — never through AI. */
export function getTemplateInsertText(template: StoryTemplate): string {
  return template.content;
}