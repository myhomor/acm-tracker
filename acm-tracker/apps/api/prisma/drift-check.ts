import { readFileSync } from "node:fs";
import { join } from "node:path";

type Field = { name: string; type: string; attributes: string };
type Model = Map<string, Field>;
type Schema = Map<string, Model>;

const PRISMA_DIR = __dirname;
const POSTGRES_SCHEMA = join(PRISMA_DIR, "schema.prisma");
const SQLITE_SCHEMA = join(PRISMA_DIR, "sqlite", "schema.prisma");

const ALLOWED_TYPE_DELTAS: Record<string, Record<string, [string, string]>> = {
  WorkspaceSettings: { authConfig: ["Json", "String"] },
};

const MODEL_NAMES = new Set([
  "Member", "Project", "Task", "TimeEntry", "AiRun",
  "WorkspaceSettings", "ModelPrice", "Document", "NotificationRule",
]);

function parseSchema(path: string): Schema {
  const source = readFileSync(path, "utf8");
  const schema: Schema = new Map();
  for (const block of source.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
    schema.set(block[1], parseModel(block[2]));
  }
  return schema;
}

function parseModel(body: string): Model {
  const model: Model = new Map();
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("@@")) continue;
    const match = /^(\w+)\s+([\w[\]?]+)\s*(.*)$/.exec(line);
    if (!match) continue;
    model.set(match[1], { name: match[1], type: match[2], attributes: match[3].replace(/\s+/g, " ").trim() });
  }
  return model;
}

function isRelationField(field: Field): boolean {
  const base = field.type.replace(/[[\]?]/g, "");
  return MODEL_NAMES.has(base) && field.attributes.includes("@relation");
}

function isCollectionField(field: Field): boolean {
  return field.type.endsWith("[]") && MODEL_NAMES.has(field.type.slice(0, -2));
}

function diffSchemas(pg: Schema, sqlite: Schema): string[] {
  const errors: string[] = [];
  diffModelSets(pg, sqlite, errors);
  for (const [model, pgModel] of pg) {
    const sqliteModel = sqlite.get(model);
    if (sqliteModel) diffFields(model, pgModel, sqliteModel, errors);
  }
  return errors;
}

function diffModelSets(pg: Schema, sqlite: Schema, errors: string[]): void {
  for (const model of pg.keys()) {
    if (!sqlite.has(model)) errors.push(`Model "${model}" missing in SQLite mirror`);
  }
  for (const model of sqlite.keys()) {
    if (!pg.has(model)) errors.push(`Model "${model}" exists in SQLite mirror but not in Postgres source`);
  }
}

function diffFields(model: string, pg: Model, sqlite: Model, errors: string[]): void {
  for (const [name, pgField] of pg) {
    const sqliteField = sqlite.get(name);
    if (!sqliteField) {
      errors.push(`${model}.${name} missing in SQLite mirror`);
      continue;
    }
    diffFieldType(model, name, pgField, sqliteField, errors);
  }
  for (const name of sqlite.keys()) {
    if (!pg.has(name)) errors.push(`${model}.${name} exists in SQLite mirror but not in Postgres source`);
  }
}

function splitType(type: string): { base: string; optional: boolean } {
  const optional = type.endsWith("?");
  return { base: optional ? type.slice(0, -1) : type, optional };
}

function diffFieldType(model: string, name: string, pg: Field, sqlite: Field, errors: string[]): void {
  if (isRelationField(pg) || isCollectionField(pg)) return;
  const pgType = splitType(pg.type);
  const sqliteType = splitType(sqlite.type);
  if (pgType.optional !== sqliteType.optional) {
    errors.push(`${model}.${name} nullability differs: Postgres "${pg.type}" vs SQLite "${sqlite.type}"`);
    return;
  }
  const allowed = ALLOWED_TYPE_DELTAS[model]?.[name];
  if (allowed && pgType.base === allowed[0] && sqliteType.base === allowed[1]) return;
  if (pgType.base !== sqliteType.base) {
    errors.push(`${model}.${name} type differs: Postgres "${pg.type}" vs SQLite "${sqlite.type}"`);
  }
}

function run(): void {
  const errors = diffSchemas(parseSchema(POSTGRES_SCHEMA), parseSchema(SQLITE_SCHEMA));
  if (errors.length > 0) {
    console.error("Schema drift detected between Postgres source and SQLite mirror:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("OK: Postgres source and SQLite mirror are in lockstep.");
}

run();
