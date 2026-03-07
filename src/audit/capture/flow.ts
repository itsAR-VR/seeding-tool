import path from 'path';
import type { Page } from 'playwright';
import { writeJson, ensureDir, writeText } from '../utils/fs.js';
import { captureBaseline } from './baseline.js';
import { sleep } from '../utils/time.js';
import { ensureNameHelper } from '../utils/page.js';

export interface FlowStep {
  index: number;
  url: string;
  title: string;
  stepLabel: string;
  fields: FormField[];
  action?: string;
  screenshot: string;
  domSnapshot: string;
}

export interface FormField {
  label: string;
  name: string;
  selector: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface FlowRecordOptions {
  flowName: string;
  outDir: string;
  maxSteps: number;
  allowWrites: boolean;
}

export interface UnauthFlowBaselineOptions {
  flowName: string;
  outDir: string;
  reason: string;
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

function parseTimeoutMs(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function getPageSignature(page: Page): Promise<string> {
  return page.evaluate(() => {
    const heading = document.querySelector('h1,h2')?.textContent?.trim() || '';
    const text = (document.body?.innerText || '').slice(0, 2000);
    let checksum = 0;
    for (let i = 0; i < text.length; i += 1) {
      checksum = (checksum + text.charCodeAt(i)) % 100000;
    }
    return `${heading}|${text.length}|${checksum}`;
  });
}

async function waitForStepAdvance(page: Page, prevUrl: string, prevLabel: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  const prevSignature = await getPageSignature(page);
  while (Date.now() - start < timeoutMs) {
    await sleep(500);
    if (page.url() !== prevUrl) return true;
    const currentLabel = await stepLabel(page);
    if (currentLabel && currentLabel !== prevLabel) return true;
    const currentSignature = await getPageSignature(page);
    if (currentSignature !== prevSignature) return true;
  }
  return false;
}

async function extractFormFields(page: Page): Promise<FormField[]> {
  return page.evaluate(() => {
    const fields: FormField[] = [];
    const elements = Array.from(document.querySelectorAll('input, textarea, select')) as HTMLElement[];

    for (const element of elements) {
      const tag = element.tagName.toLowerCase();
      const input = element as HTMLInputElement;
      const name = input.name || input.id || '';
      let selector = '';
      if (input.id) selector = `#${input.id}`;
      else if (input.name) selector = `[name="${input.name}"]`;
      else if (input.placeholder) selector = `${tag}[placeholder="${input.placeholder}"]`;

      const labelEl = document.querySelector(`label[for="${input.id}"]`) as HTMLLabelElement | null;
      const label = labelEl?.innerText?.trim() || (element.closest('label') as HTMLLabelElement | null)?.innerText?.trim() || '';

      const required = input.required || element.getAttribute('aria-required') === 'true';
      const type = tag === 'select' ? 'select' : input.type || tag;

      const field: FormField = {
        label,
        name,
        selector,
        type,
        required,
      };

      if (tag === 'select') {
        const select = element as HTMLSelectElement;
        field.options = Array.from(select.options).map((option) => option.textContent?.trim() || '').filter(Boolean);
      }

      fields.push(field);
    }

    return fields.filter((field) => field.selector);
  });
}

function guessValue(field: FormField): string {
  const label = `${field.label} ${field.name}`.toLowerCase();
  if (label.includes('email')) return 'pw_test@example.com';
  if (label.includes('name')) return 'PW_TEST_NAME';
  if (label.includes('company')) return 'PW_TEST_COMPANY';
  if (label.includes('website')) return 'https://example.com';
  if (label.includes('budget')) return '1000';
  if (label.includes('phone')) return '555-555-5555';
  if (label.includes('title')) return 'PW_TEST_TITLE';
  return 'PW_TEST_VALUE';
}

async function autofillFields(page: Page, fields: FormField[], allowWrites: boolean): Promise<void> {
  if (!allowWrites) return;
  for (const field of fields) {
    try {
      if (field.type === 'checkbox' || field.type === 'radio') {
        await page.locator(field.selector).first().check({ timeout: 2000 });
        continue;
      }
      if (field.type === 'select') {
        const options = field.options || [];
        const option = options.find((opt) => opt) || '';
        if (option) {
          await page.selectOption(field.selector, { label: option });
        }
        continue;
      }
      await page.fill(field.selector, guessValue(field));
    } catch {
      // ignore autofill failures
    }
  }
}

async function clickPrimaryCta(page: Page): Promise<string | undefined> {
  const ctaLabels = /next|continue|start|finish|submit|save|done|confirm/i;
  const locator = page.getByRole('button', { name: ctaLabels }).first();
  if (await locator.count()) {
    const label = await locator.innerText();
    await locator.click();
    return label;
  }
  const submit = page.locator('input[type="submit"]').first();
  if (await submit.count()) {
    await submit.click();
    return 'submit';
  }
  return undefined;
}

async function selectSampleData(page: Page): Promise<boolean> {
  const sample = page.getByText(/sample data|use sample|sample/i).first();
  if (await sample.count()) {
    await sample.click();
    return true;
  }
  return false;
}

async function stepLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const current = document.querySelector('[aria-current="step"]');
    if (current?.textContent) return current.textContent.trim();
    const heading = document.querySelector('h1,h2');
    return heading?.textContent?.trim() || '';
  });
}

export async function captureUnauthFlowBaseline(page: Page, options: UnauthFlowBaselineOptions): Promise<FlowStep[]> {
  await ensureNameHelper(page);
  await ensureDir(options.outDir);

  const stepDir = path.join(options.outDir, 'step-1');
  await ensureDir(stepDir);

  const baseline = await captureBaseline(page, { outDir: stepDir, viewportName: 'desktop' });
  const label = await stepLabel(page);
  const step: FlowStep = {
    index: 1,
    url: page.url(),
    title: await page.title(),
    stepLabel: label || 'Unauthenticated baseline',
    fields: [],
    action: 'unauthenticated baseline capture',
    screenshot: baseline.screenshotAboveFold,
    domSnapshot: baseline.domSnapshot,
  };

  const steps = [step];
  await writeJson(path.join(options.outDir, 'steps.json'), steps);
  const note = `# ${options.flowName} unauthenticated baseline\n\n${options.reason}\n\n- URL: ${step.url}\n- Screenshot: ${step.screenshot}\n- DOM snapshot: ${step.domSnapshot}\n`;
  await writeText(path.join(options.outDir, 'unauth-baseline.md'), note);

  return steps;
}

export async function recordFlow(page: Page, options: FlowRecordOptions): Promise<FlowStep[]> {
  await ensureNameHelper(page);
  const steps: FlowStep[] = [];
  await ensureDir(options.outDir);
  const manualMode = parseBooleanFlag(process.env.ONBOARDING_MANUAL);
  const stepTimeoutMs = parseTimeoutMs(process.env.FLOW_STEP_TIMEOUT_MS, 60_000);

  let sampleSelected = false;

  for (let i = 0; i < options.maxSteps; i += 1) {
    const url = page.url();
    const title = await page.title();
    const label = await stepLabel(page);
    const stepDir = path.join(options.outDir, `step-${i + 1}`);
    await ensureDir(stepDir);

    const baseline = await captureBaseline(page, { outDir: stepDir, viewportName: 'desktop' });
    const fields = await extractFormFields(page);
    await writeJson(path.join(stepDir, 'fields.json'), fields);

    let action: string | undefined;
    if (!manualMode) {
      if (!sampleSelected) {
        sampleSelected = await selectSampleData(page);
        if (sampleSelected) {
          action = 'select sample data';
        }
      }

      await autofillFields(page, fields, options.allowWrites);

      if (!action) {
        action = await clickPrimaryCta(page);
      }
    } else {
      action = 'manual';
    }

    const step: FlowStep = {
      index: i + 1,
      url,
      title,
      stepLabel: label,
      fields,
      screenshot: baseline.screenshotAboveFold,
      domSnapshot: baseline.domSnapshot,
    };
    if (action) step.action = action;
    steps.push(step);

    if (manualMode) {
      const advanced = await waitForStepAdvance(page, url, label, stepTimeoutMs);
      if (!advanced) break;
    } else {
      await sleep(500);
      if (page.url() !== url) {
        continue;
      }
      if (!action) {
        break;
      }
    }
  }

  await writeText(path.join(options.outDir, 'steps.json'), JSON.stringify(steps, null, 2));
  return steps;
}
