/**
 * Content validator — the server-side counterpart of the CMS form validation.
 *
 * Sveltia CMS validates in the browser, which a determined user (or a hand-edited commit) could
 * bypass. This script re-validates every file under /content against the *same* field rules
 * defined in src/admin/config.ts (required, min/max length, regex patterns, select options, list
 * sizes, number ranges) plus a few structural checks (front matter, file names, dates).
 *
 * It runs in GitHub Actions on every pull request and before every production build, so a
 * change that fails validation can neither be merged (with the branch rule enabled) nor deployed.
 *
 *   node --experimental-strip-types scripts/validate-content.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { config } from '../src/admin/config.ts';

type Field = Record<string, any>;

const root = resolve(import.meta.dirname, '..');
const errors: string[] = [];
const fail = (file: string, msg: string) => errors.push(`${file}: ${msg}`);

/** Sveltia accepts "pattern" values as a RegExp, a /regex/flags string or a bare regex string. */
const toRegExp = (pattern: string | RegExp): RegExp => {
  if (pattern instanceof RegExp) return pattern;
  const m = pattern.match(/^\/(.+)\/([dimsuy]*)$/);
  return m ? new RegExp(m[1], m[2]) : new RegExp(pattern);
};

/** Anything that looks like an HTML tag, a script URL or an inline event handler. */
const DANGEROUS = [
  [/<\s*\/?\s*[a-z!?]/i, 'contains an HTML tag'],
  [/javascript\s*:/i, 'contains a javascript: URL'],
  [/\bon[a-z]+\s*=/i, 'contains an inline event handler (on…=)'],
  [/data\s*:\s*text\/html/i, 'contains a data:text/html URL'],
] as const;

function checkDangerous(file: string, path: string, value: unknown) {
  if (typeof value !== 'string') return;
  for (const [re, why] of DANGEROUS) {
    if (re.test(value)) fail(file, `${path} ${why}`);
  }
}

function validateField(file: string, path: string, field: Field, value: unknown) {
  const required = field.required !== false;
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

  if (empty) {
    if (required && field.widget !== 'boolean') fail(file, `${path} is required`);
    return;
  }

  checkDangerous(file, path, value);

  switch (field.widget) {
    case 'string':
    case 'text':
    case 'markdown': {
      if (typeof value !== 'string') return fail(file, `${path} must be a string`);
      if (field.minlength && value.length < field.minlength) fail(file, `${path} is shorter than ${field.minlength} characters`);
      if (field.maxlength && value.length > field.maxlength) fail(file, `${path} is longer than ${field.maxlength} characters`);
      if (Array.isArray(field.pattern) && !toRegExp(field.pattern[0]).test(value)) fail(file, `${path}: ${field.pattern[1]}`);
      break;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) return fail(file, `${path} must be a number`);
      if (field.min !== undefined && value < field.min) fail(file, `${path} is below ${field.min}`);
      if (field.max !== undefined && value > field.max) fail(file, `${path} is above ${field.max}`);
      break;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') fail(file, `${path} must be true or false`);
      break;
    }
    case 'datetime': {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
        fail(file, `${path} must be a date in YYYY-MM-DD format`);
      }
      break;
    }
    case 'relation': {
      if (typeof value !== 'string') return fail(file, `${path} must be a string`);
      // Cross-file check: the referenced entry must exist in the target collection (by value_field)
      const targets = relationValues(field.collection, field.value_field);
      if (targets && !targets.has(value)) fail(file, `${path} refers to “${value}”, which is not an existing ${field.collection} entry`);
      break;
    }
    case 'select': {
      const allowed = (field.options as any[]).map((o) => (typeof o === 'object' ? o.value : o));
      const values = Array.isArray(value) ? value : [value];
      if (field.multiple && !Array.isArray(value)) fail(file, `${path} must be a list`);
      for (const v of values) if (!allowed.includes(v)) fail(file, `${path} has an unknown option “${v}”`);
      break;
    }
    case 'list': {
      if (!Array.isArray(value)) return fail(file, `${path} must be a list`);
      if (field.min !== undefined && value.length < field.min) fail(file, `${path} needs at least ${field.min} item(s)`);
      if (field.max !== undefined && value.length > field.max) fail(file, `${path} allows at most ${field.max} item(s)`);
      value.forEach((item, i) => {
        const itemPath = `${path}[${i}]`;
        if (field.fields) validateObject(file, itemPath, field.fields, item);
        else if (field.field) validateField(file, itemPath, field.field, item);
        else checkDangerous(file, itemPath, item);
      });
      break;
    }
    case 'object': {
      validateObject(file, path, field.fields, value);
      break;
    }
    default:
      break;
  }
}

function validateObject(file: string, path: string, fields: Field[], value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(file, `${path} must be an object`);
  const obj = value as Record<string, unknown>;
  const known = new Set(fields.map((f) => f.name));
  for (const key of Object.keys(obj)) {
    if (!known.has(key)) fail(file, `${path ? `${path}.` : ''}${key} is not a known field`);
  }
  for (const field of fields) {
    validateField(file, path ? `${path}.${field.name}` : field.name, field, obj[field.name]);
  }
}

// ---------------------------------------------------------------------------
// Walk the CMS configuration and validate the files it points to
// ---------------------------------------------------------------------------
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
let checked = 0;

/** Parse one entry file of a folder collection into { data, body } or record a failure. */
function readEntry(rel: string, format: string): { data: unknown; body?: string } | undefined {
  const raw = readFileSync(abs(rel), 'utf8');
  if (format === 'json') {
    try {
      return { data: JSON.parse(raw) };
    } catch (e) {
      fail(rel, `is not valid JSON (${(e as Error).message})`);
      return undefined;
    }
  }
  const m = raw.match(FRONT_MATTER);
  if (!m) { fail(rel, 'missing YAML front matter (--- … ---)'); return undefined; }
  try {
    return { data: parseYaml(m[1], { schema: 'core' }) ?? {}, body: m[2].trim() };
  } catch (e) {
    fail(rel, `front matter is not valid YAML (${(e as Error).message})`);
    return undefined;
  }
}

/** Values a relation field may take: the `value_field` of every entry in the target collection. */
const relationCache = new Map<string, Set<string> | undefined>();
function relationValues(collectionName: string, valueField = '{{slug}}'): Set<string> | undefined {
  const key = `${collectionName}:${valueField}`;
  if (relationCache.has(key)) return relationCache.get(key);
  const target = (config.collections ?? []).find((c) => !('divider' in c) && c.name === collectionName);
  if (!target || !('folder' in target)) { relationCache.set(key, undefined); return undefined; }
  const ext = `.${target.extension ?? 'md'}`;
  const values = new Set<string>();
  for (const name of readdirSync(join(root, target.folder))) {
    if (!name.endsWith(ext)) continue;
    const slug = basename(name, ext);
    if (valueField === '{{slug}}') { values.add(slug); continue; }
    const entry = readEntry(join(target.folder, name), target.format ?? 'yaml-frontmatter');
    const v = (entry?.data as Record<string, unknown> | undefined)?.[valueField.replace(/^\{\{|\}\}$/g, '')];
    if (typeof v === 'string') values.add(v);
  }
  relationCache.set(key, values);
  return values;
}

for (const collection of config.collections ?? []) {
  if ('divider' in collection) continue;

  // File collection: fixed JSON files
  if ('files' in collection) {
    for (const cf of collection.files) {
      const rel = cf.file;
      const abs = join(root, rel);
      if (!existsSync(abs)) { fail(rel, 'file is missing'); continue; }
      checked++;
      let data: unknown;
      try {
        data = JSON.parse(readFileSync(abs, 'utf8'));
      } catch (e) {
        fail(rel, `is not valid JSON (${(e as Error).message})`);
        continue;
      }
      validateObject(rel, '', cf.fields as Field[], data);
    }
    continue;
  }

  // Entry collection: one Markdown file per entry
  if ('folder' in collection) {
    const dir = join(root, collection.folder);
    const ext = `.${collection.extension ?? 'md'}`;
    const slugPattern = typeof collection.slug === 'object' && Array.isArray(collection.slug.pattern) ? toRegExp(collection.slug.pattern[0]) : null;

    for (const name of readdirSync(dir)) {
      if (!name.endsWith(ext)) { fail(join(collection.folder, name), `unexpected file (only ${ext} files belong here)`); continue; }
      const rel = join(collection.folder, name);
      checked++;
      const slug = basename(name, ext);
      if (slugPattern && !slugPattern.test(slug)) fail(rel, `file name “${slug}” is not a valid slug (lowercase letters, numbers, dashes)`);

      const entry = readEntry(rel, collection.format ?? 'yaml-frontmatter');
      if (!entry) continue;

      const fields = collection.fields as Field[];
      const bodyField = entry.body !== undefined ? fields.find((f) => f.name === 'body') : undefined;
      const dataFields = bodyField ? fields.filter((f) => f.name !== 'body') : fields;
      validateObject(rel, '', dataFields, entry.data);
      if (bodyField) validateField(rel, 'body', bodyField, entry.body);
    }
  }
}

function abs(rel: string) {
  return join(root, rel);
}

if (errors.length) {
  console.error(`✖ Content validation failed with ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error('');
  process.exit(1);
}

console.log(`✔ Content validation passed (${checked} file(s) checked against src/admin/config.ts rules).`);
