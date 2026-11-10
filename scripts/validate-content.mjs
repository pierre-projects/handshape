// Validates every lesson unit in content/units against the JSON Schema,
// then checks the rules a schema cannot express: unique ids across units,
// valid cross-references, and media files that actually exist. Word lists in
// content/words are checked against their own schema and word length.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');

export function validateContent(contentDir = root) {
  const errors = [];
  const schema = JSON.parse(readFileSync(join(contentDir, 'schema', 'unit.schema.json'), 'utf8'));
  const validate = new Ajv2020({ allErrors: true }).compile(schema);

  const unitDir = join(contentDir, 'units');
  const files = readdirSync(unitDir).filter((f) => f.endsWith('.json')).sort();
  const units = [];
  for (const file of files) {
    let unit;
    try {
      unit = JSON.parse(readFileSync(join(unitDir, file), 'utf8'));
    } catch (e) {
      errors.push(`${file}: invalid JSON: ${e.message}`);
      continue;
    }
    if (!validate(unit)) {
      for (const err of validate.errors) errors.push(`${file}${err.instancePath}: ${err.message}`);
      continue;
    }
    units.push({ file, unit });
  }

  const unitIds = new Map();
  const unitOrders = new Map();
  const itemIds = new Map();
  for (const { file, unit } of units) {
    if (unitIds.has(unit.id)) errors.push(`${file}: unit id "${unit.id}" also used in ${unitIds.get(unit.id)}`);
    unitIds.set(unit.id, file);
    if (unitOrders.has(unit.order)) errors.push(`${file}: order ${unit.order} also used in ${unitOrders.get(unit.order)}`);
    unitOrders.set(unit.order, file);
    for (const item of unit.items) {
      if (itemIds.has(item.id)) errors.push(`${file}: item id "${item.id}" also used in ${itemIds.get(item.id)}`);
      itemIds.set(item.id, file);
    }
  }

  for (const { file, unit } of units) {
    for (const item of unit.items) {
      for (const other of item.confusable_with ?? []) {
        if (!itemIds.has(other)) errors.push(`${file}: item "${item.id}" is confusable_with unknown item "${other}"`);
        if (other === item.id) errors.push(`${file}: item "${item.id}" lists itself in confusable_with`);
      }
      for (const m of item.media ?? []) {
        if (m.src && !existsSync(join(contentDir, m.src))) {
          errors.push(`${file}: item "${item.id}" references missing file content/${m.src}`);
        }
      }
    }
  }

  const wordLists = validateWordLists(contentDir, errors);
  return { errors, unitCount: units.length, itemCount: itemIds.size, wordLists };
}

/** Word lists in content/words: the schema, plus the exact word length a list asks for. */
function validateWordLists(contentDir, errors) {
  const dir = join(contentDir, 'words');
  if (!existsSync(dir)) return 0;
  const schema = JSON.parse(readFileSync(join(contentDir, 'schema', 'wordlist.schema.json'), 'utf8'));
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const where = `words/${file}`;
    let list;
    try {
      list = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      errors.push(`${where}: invalid JSON: ${e.message}`);
      continue;
    }
    if (!validate(list)) {
      for (const err of validate.errors) errors.push(`${where}${err.instancePath}: ${err.message}`);
      continue;
    }
    if (list.length) {
      const wrong = list.words.filter((w) => w.length !== list.length);
      if (wrong.length) errors.push(`${where}: not ${list.length} letters: ${wrong.join(', ')}`);
    }
  }
  return files.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errors, unitCount, itemCount, wordLists } = validateContent();
  if (errors.length) {
    console.error(`Content validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`Content OK: ${unitCount} units, ${itemCount} items, ${wordLists} word lists.`);
}
