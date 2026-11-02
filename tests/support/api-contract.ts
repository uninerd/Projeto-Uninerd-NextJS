import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';

interface ResponseDefinition { content?: Record<string, { schema?: object }> }
interface Contract { paths: Record<string, Record<string, { responses: Record<string, ResponseDefinition> }>> }
const document = JSON.parse(readFileSync('contracts/openapi.json', 'utf8')) as Contract;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(document, 'urn:uninerd:openapi');
const validators = new Map<string, ValidateFunction>();
const pointer = (value: string) => value.replace(/~/g, '~0').replace(/\//g, '~1');

/** Check real JSON responses against the published OpenAPI, including resolved $refs. */
export function assertResponseContract(path: string, method: string, status: number, body: unknown): void {
  const verb = method.toLowerCase();
  const response = document.paths[path]?.[verb]?.responses[String(status)];
  assert.ok(response, `${method} ${path}: status ${status} não documentado no OpenAPI.`);
  assert.ok(response.content?.['application/json']?.schema, `${method} ${path}: resposta JSON sem schema.`);
  const key = `${method} ${path} ${status}`;
  let validate = validators.get(key);
  if (!validate) {
    validate = ajv.compile({ $ref: `urn:uninerd:openapi#/paths/${pointer(path)}/${verb}/responses/${status}/content/application~1json/schema` });
    validators.set(key, validate);
  }
  assert.ok(validate(body), `${key}: resposta diverge do OpenAPI: ${ajv.errorsText(validate.errors)}`);
}
