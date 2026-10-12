#!/usr/bin/env node
/**
 * Generate MCP tool definitions and SDK handler map from bundled public OpenAPI.
 *
 * ARCHITECTURE: handlers MUST delegate to @1msg/sdk (Client) only.
 * Do not emit fetch/axios or raw HTTP — see packages/mcp/ARCHITECTURE.md
 *
 * Input:  public/openapi.bundled.yaml
 * Output: packages/mcp/src/tools.generated.ts
 *         packages/mcp/src/handlers.generated.ts
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const INPUT_SPEC = path.join(ROOT, 'public/openapi.bundled.yaml');
const OUTPUT_DIR = path.join(ROOT, 'packages/mcp/src');
const TOOLS_FILE = path.join(OUTPUT_DIR, 'tools.generated.ts');
const HANDLERS_FILE = path.join(OUTPUT_DIR, 'handlers.generated.ts');

const TAG_TO_API = {
  Profile: 'profile',
  Messaging: 'messaging',
  Users: 'users',
  Groups: 'groups',
  Flows: 'flows',
  Templates: 'templates',
  Channel: 'channel',
  Catalog: 'catalog',
  Webhooks: 'webhooks',
  Calling: 'calling',
};

const BODY_OBJECT_METHODS = new Set([
  'sendButton',
  'sendContact',
  'sendList',
  'sendLocationRequest',
  'sendReaction',
  'sendProduct',
  'sendTemplate',
  'sendCtaUrl',
  'sendSticker',
  'sendAddressMessage',
  'sendOrderDetails',
  'sendPaymentRequest',
  'createUploadMedia',
  'setWhatsappBusinessEncryption',
  'deleteMediaLegacy',
  'blockUser',
  'unblockUser',
  'addTemplate',
  'removeTemplate',
  'updateCallingSettings',
  'initiateCall',
  'setConversationalAutomation',
  'setWebhook',
  'updateMe',
  'createCommerce',
  'createSettings',
  'createGroups',
  'createGroupsGroupId',
  'createFlows',
  'patchFlowsFlowIdAssets',
  'patchFlowsFlowIdMetadata',
]);

/** OpenAPI boolean query/body fields that SDK types as boolean (optionalArg returns string). */
const BOOLEAN_PARAMS = new Set(['typingIndicator', 'voice', 'last', 'publish']);

/** OpenAPI enum fields that need a cast through `as never` for SDK enums. */
const ENUM_PARAMS = new Set(['mediaType', 'sort']);

function camelToSnake(value) {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function loadSpec() {
  if (!fs.existsSync(INPUT_SPEC)) {
    console.error(`❌ Bundled OpenAPI spec not found: ${INPUT_SPEC}`);
    console.error(
      '   Run `npm run bundle:public` from the repo root, then retry.',
    );
    process.exit(1);
  }
  return yaml.parse(fs.readFileSync(INPUT_SPEC, 'utf8'));
}

function resolveRef(spec, ref) {
  if (!ref || !ref.startsWith('#/')) {
    return ref;
  }
  const parts = ref.slice(2).split('/');
  let node = spec;
  for (const part of parts) {
    node = node?.[part];
  }
  return node;
}

function resolveSchema(spec, schema) {
  if (!schema) {
    return { type: 'object', properties: {}, additionalProperties: true };
  }
  if (schema.$ref) {
    return resolveSchema(spec, resolveRef(spec, schema.$ref));
  }
  if (schema.allOf) {
    const merged = { type: 'object', properties: {}, required: [] };
    for (const part of schema.allOf) {
      const resolved = resolveSchema(spec, part);
      merged.properties = {
        ...merged.properties,
        ...(resolved.properties || {}),
      };
      merged.required = [
        ...new Set([...(merged.required || []), ...(resolved.required || [])]),
      ];
      if (resolved.description) {
        merged.description = resolved.description;
      }
    }
    return merged;
  }
  return schema;
}

function mergeParameters(spec, pathItemParams, operationParams) {
  const byKey = new Map();
  for (const param of [...(pathItemParams || []), ...(operationParams || [])]) {
    const resolved = param.$ref ? resolveRef(spec, param.$ref) : param;
    if (!resolved || resolved.name === 'token') {
      continue;
    }
    byKey.set(`${resolved.in}:${resolved.name}`, resolved);
  }
  return [...byKey.values()];
}

function pickRequestBodySchema(spec, requestBody) {
  if (!requestBody) {
    return null;
  }
  const content = requestBody.content || {};
  const preferredOrder = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    ...Object.keys(content),
  ];
  const seen = new Set();
  const schemas = [];
  for (const key of preferredOrder) {
    if (seen.has(key) || !content[key]?.schema) {
      continue;
    }
    seen.add(key);
    schemas.push(resolveSchema(spec, content[key].schema));
  }
  if (schemas.length === 0) {
    return null;
  }
  return schemas.reduce((acc, schema) => mergeResolvedSchemas(acc, schema));
}

function isEmptySchemaNode(node) {
  return !node || (typeof node === 'object' && Object.keys(node).length === 0);
}

function mergePropSchema(preferred, fallback) {
  if (!preferred) {
    return fallback;
  }
  if (!fallback) {
    return preferred;
  }
  const merged = { ...fallback, ...preferred };
  if (!preferred.description && fallback.description) {
    merged.description = fallback.description;
  }
  if (isEmptySchemaNode(preferred.items) && fallback.items) {
    merged.items = fallback.items;
  }
  if (!preferred.example && fallback.example) {
    merged.example = fallback.example;
  }
  if (
    (!preferred.properties || Object.keys(preferred.properties).length === 0) &&
    fallback.properties
  ) {
    merged.properties = fallback.properties;
  }
  return merged;
}

function mergeResolvedSchemas(preferred, fallback) {
  if (!preferred) {
    return fallback;
  }
  if (!fallback) {
    return preferred;
  }
  const names = new Set([
    ...Object.keys(preferred.properties || {}),
    ...Object.keys(fallback.properties || {}),
  ]);
  const properties = {};
  for (const name of names) {
    properties[name] = mergePropSchema(
      preferred.properties?.[name],
      fallback.properties?.[name],
    );
  }
  return {
    ...fallback,
    ...preferred,
    properties,
    required: [
      ...new Set([...(preferred.required || []), ...(fallback.required || [])]),
    ],
    description: preferred.description || fallback.description,
  };
}

function buildInputSchema(spec, parameters, bodySchema) {
  const properties = {};
  const required = [];

  for (const param of parameters) {
    const schema = resolveSchema(spec, param.schema || { type: 'string' });
    properties[param.name] = {
      ...schema,
      description: param.description || schema.description,
    };
    if (param.required) {
      required.push(param.name);
    }
  }

  if (bodySchema) {
    const resolvedBody = resolveSchema(spec, bodySchema);
    const bodyProps = resolvedBody.properties || {};
    for (const [name, propSchema] of Object.entries(bodyProps)) {
      if (properties[name]) {
        continue;
      }
      properties[name] = resolveSchema(spec, propSchema);
    }
    for (const name of resolvedBody.required || []) {
      if (!required.includes(name)) {
        required.push(name);
      }
    }
    if (
      resolvedBody.additionalProperties === true &&
      Object.keys(bodyProps).length === 0
    ) {
      properties.payload = {
        type: 'object',
        additionalProperties: true,
        description: 'Request body payload',
      };
    }
  }

  const schema = {
    type: 'object',
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

function collectOperations(spec) {
  const operations = [];
  for (const [routePath, pathItem] of Object.entries(spec.paths || {})) {
    const pathLevelParams = pathItem.parameters || [];
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const operation = pathItem[method];
      if (!operation?.operationId) {
        continue;
      }
      const tag = operation.tags?.[0] || 'Messaging';
      const parameters = mergeParameters(
        spec,
        pathLevelParams,
        operation.parameters,
      );
      const bodySchema = pickRequestBodySchema(spec, operation.requestBody);
      const inputSchema = buildInputSchema(spec, parameters, bodySchema);
      // Preserve the existing MCP numeric-ID convenience; the handler serializes it
      // through requireArg before the SDK sees the wire-level string identifier.
      if (
        operation.operationId === 'deleteMedia' &&
        inputSchema.properties.mediaId
      ) {
        inputSchema.properties.mediaId.type = ['string', 'number'];
      }
      operations.push({
        operationId: operation.operationId,
        toolName: camelToSnake(operation.operationId),
        summary: operation.summary || operation.operationId,
        description:
          operation.description || operation.summary || operation.operationId,
        tag,
        apiClass: TAG_TO_API[tag] || 'messaging',
        parameters,
        bodySchema,
        inputSchema,
      });
    }
  }
  operations.sort((a, b) => a.operationId.localeCompare(b.operationId));
  return operations;
}

function resolveSdkApisDir() {
  const srcDir = path.join(ROOT, 'packages/sdk/src/generated/src/apis');
  if (fs.existsSync(srcDir)) {
    return srcDir;
  }
  const distDir = path.join(ROOT, 'packages/sdk/dist/generated/src/apis');
  if (fs.existsSync(distDir)) {
    return distDir;
  }
  return srcDir;
}

function parseSdkMethodSignatures() {
  const signatures = new Map();
  const sdkApisDir = resolveSdkApisDir();
  if (!fs.existsSync(sdkApisDir)) {
    console.warn(`⚠️  SDK APIs directory not found: ${sdkApisDir}`);
    return signatures;
  }
  const apiFiles = fs
    .readdirSync(sdkApisDir)
    .filter((f) => f.endsWith('Api.ts') || f.endsWith('Api.d.ts'));

  for (const file of apiFiles) {
    const apiClass = file.replace(/Api(?:\.d)?\.ts$/, '');
    const apiKey = apiClass.charAt(0).toLowerCase() + apiClass.slice(1);
    const content = fs.readFileSync(path.join(sdkApisDir, file), 'utf8');
    const ifaceMatch = content.match(
      /export interface \w+ApiInterface \{([\s\S]*?)\n\}/,
    );
    if (!ifaceMatch) {
      continue;
    }
    const ifaceBody = ifaceMatch[1];
    const methodRegex = /^\s+(\w+)\(([^)]*)\):/gm;
    let match;
    while ((match = methodRegex.exec(ifaceBody)) !== null) {
      const methodName = match[1];
      if (methodName.endsWith('Raw') || methodName.endsWith('RequestOpts')) {
        continue;
      }
      const params = match[2]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const optional = p.includes('?');
          const name = p.split(':')[0].replace('?', '').trim();
          return { name, optional };
        })
        .filter((p) => p.name !== 'initOverrides');
      signatures.set(methodName, { apiClass: apiKey, params });
    }
  }
  return signatures;
}

function camelToSnakeCandidates(name) {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** SDK camelCases query names (`minTime`); MCP schema keeps OpenAPI names (`min_time`). */
function openApiArgName(sdkParamName, operation) {
  const params = operation.parameters || [];
  if (params.some((param) => param.name === sdkParamName)) {
    return sdkParamName;
  }
  const snake = camelToSnakeCandidates(sdkParamName);
  if (params.some((param) => param.name === snake)) {
    return snake;
  }
  return sdkParamName;
}

function openApiParamType(sdkParamName, operation) {
  const openApiName = openApiArgName(sdkParamName, operation);
  const match = (operation.parameters || []).find(
    (param) => param.name === openApiName || param.name === sdkParamName,
  );
  return match?.schema?.type;
}

function argAccessor(paramName, optional, operation) {
  const argsKey = operation ? openApiArgName(paramName, operation) : paramName;
  const schemaType = operation
    ? openApiParamType(paramName, operation)
    : undefined;
  if (
    paramName === 'phone' ||
    schemaType === 'integer' ||
    schemaType === 'number'
  ) {
    return optional
      ? `optionalNumber(args, '${argsKey}')`
      : `requireNumber(args, '${argsKey}')`;
  }
  if (paramName === 'params') {
    return optional
      ? `optionalArray(args, '${argsKey}')`
      : `requireArray(args, '${argsKey}')`;
  }
  if (
    BOOLEAN_PARAMS.has(paramName) ||
    BOOLEAN_PARAMS.has(argsKey) ||
    schemaType === 'boolean'
  ) {
    return optional
      ? `optionalBoolean(args, '${argsKey}')`
      : `requireBoolean(args, '${argsKey}')`;
  }
  if (ENUM_PARAMS.has(paramName)) {
    return optional
      ? `optionalArg(args, '${argsKey}') as never`
      : `requireArg(args, '${argsKey}') as never`;
  }
  return optional
    ? `optionalArg(args, '${argsKey}')`
    : `requireArg(args, '${argsKey}')`;
}

function pathOrQueryParamNames(operation) {
  return (operation.parameters || [])
    .filter((param) => param.in === 'path' || param.in === 'query')
    .map((param) => param.name);
}

function isPathOrQuerySdkParam(sdkName, operation) {
  const names = pathOrQueryParamNames(operation);
  if (names.includes(sdkName)) {
    return true;
  }
  return names.includes(camelToSnakeCandidates(sdkName));
}

function emitBodyObjectHandler(operation, signature) {
  const { operationId, apiClass } = operation;
  const sdkParams = (signature?.params || []).filter(
    (param) => param.name !== 'initOverrides',
  );
  const bodySdkParam = sdkParams.find(
    (param) =>
      param.name !== 'token' && !isPathOrQuerySdkParam(param.name, operation),
  );
  const prelude = ['const token = client.config.token;'];
  const pathAndQueryNames = pathOrQueryParamNames(operation);

  if (operation.inputSchema.properties?.payload) {
    prelude.push(
      'const bodyArg = (args.payload ?? args) as Record<string, unknown>;',
    );
  } else {
    prelude.push('const bodyArg = pickArgs(args, inputFields);');
    for (const name of pathAndQueryNames) {
      prelude.push(`delete bodyArg['${name}'];`);
    }
  }

  if (operationId === 'sendContact') {
    prelude.push(`if (bodyArg['contact'] && !bodyArg['contacts']) {
      const c = bodyArg['contact'] as Record<string, unknown>;
      const name = typeof c.name === 'string'
        ? { formatted_name: c.name, first_name: String(c.name).split(/\\s+/)[0] }
        : c.name;
      bodyArg['contacts'] = [{
        name,
        phones: c.phone ? [{ phone: String(c.phone), type: 'CELL' }] : undefined,
        emails: c.email ? [{ email: c.email }] : undefined,
        org: c.org,
        urls: c.url ? [{ url: c.url }] : undefined,
      }];
      delete bodyArg['contact'];
    }`);
  }

  if (operationId === 'createUploadMedia') {
    prelude.push(`if (typeof bodyArg['url'] === 'string' && (bodyArg['body'] === undefined || bodyArg['body'] === '')) {
      bodyArg['body'] = bodyArg['url'];
    }`);
  }

  const callArgs = [];
  if (sdkParams.length === 0) {
    return {
      prelude,
      call: `return client.${apiClass}.${operationId}(token, bodyArg as never);`,
    };
  }
  for (const param of sdkParams) {
    if (param.name === 'token') {
      callArgs.push('token');
      continue;
    }
    if (bodySdkParam && param.name === bodySdkParam.name) {
      callArgs.push('bodyArg as never');
      continue;
    }
    prelude.push(
      `const ${param.name} = ${argAccessor(param.name, param.optional, operation)};`,
    );
    callArgs.push(param.name);
  }

  return {
    prelude,
    call: `return client.${apiClass}.${operationId}(${callArgs.join(', ')});`,
  };
}

function fixHandlerCallOrder(operation, signature) {
  const { operationId, apiClass } = operation;
  const params =
    signature?.params?.filter((p) => p.name !== 'initOverrides') || [];
  const nonToken = params.filter((p) => p.name !== 'token');

  if (BODY_OBJECT_METHODS.has(operationId)) {
    return emitBodyObjectHandler(operation, signature);
  }

  if (nonToken.length === 0) {
    return {
      prelude: ['const token = client.config.token;'],
      call: `return client.${apiClass}.${operationId}(token);`,
    };
  }

  if (operationId === 'deleteMedia') {
    return {
      prelude: [
        'const token = client.config.token;',
        "const mediaId = requireArg(args, 'mediaId');",
      ],
      call: 'return client.messaging.deleteMedia(token, mediaId);',
    };
  }

  if (operationId === 'sendCarousel') {
    const carouselPrelude = ['const token = client.config.token;'];
    carouselPrelude.push(
      "const cards = optionalArray(args, 'cards') as object[] | undefined;",
    );
    carouselPrelude.push(
      "let params = optionalArray(args, 'params') as object[] | undefined;",
    );
    carouselPrelude.push(
      "if ((!params || params.length === 0) && cards?.length) { params = [{ type: 'CAROUSEL', cards }]; }",
    );
    carouselPrelude.push(
      "if (!params?.length) throw new Error('send_carousel requires cards (2-10) or params with a CAROUSEL component');",
    );
    carouselPrelude.push("const body = optionalArg(args, 'body');");
    carouselPrelude.push(
      "const quotedMsgId = optionalArg(args, 'quotedMsgId');",
    );
    carouselPrelude.push("const chatId = optionalArg(args, 'chatId');");
    carouselPrelude.push("const phone = optionalNumber(args, 'phone');");
    return {
      prelude: carouselPrelude,
      call: 'return client.messaging.sendCarousel(token, params, body, quotedMsgId, chatId, phone);',
    };
  }

  if (operationId === 'sendFlow') {
    const flowPrelude = ['const token = client.config.token;'];
    flowPrelude.push("const body = requireArg(args, 'body');");
    flowPrelude.push("const flowId = requireArg(args, 'flowId');");
    flowPrelude.push("const flowToken = requireArg(args, 'flowToken');");
    flowPrelude.push("const flowCta = requireArg(args, 'flowCta');");
    flowPrelude.push(
      'const header = args.header as Record<string, unknown> | undefined;',
    );
    flowPrelude.push("const footer = optionalArg(args, 'footer');");
    flowPrelude.push(
      'const flowAction = args.flowAction as string | undefined;',
    );
    flowPrelude.push(
      'const flowActionPayload = args.flowActionPayload as object | undefined;',
    );
    flowPrelude.push(
      "const flowMessageVersion = optionalArg(args, 'flowMessageVersion');",
    );
    flowPrelude.push('const mode = args.mode as string | undefined;');
    flowPrelude.push(
      'const flowActionData = args.flowActionData as object | undefined;',
    );
    flowPrelude.push(
      "const flowActionScreen = optionalArg(args, 'flowActionScreen');",
    );
    flowPrelude.push("const quotedMsgId = optionalArg(args, 'quotedMsgId');");
    flowPrelude.push("const chatId = optionalArg(args, 'chatId');");
    flowPrelude.push("const phone = optionalNumber(args, 'phone');");
    return {
      prelude: flowPrelude,
      call: 'return client.messaging.sendFlow(token, body, flowId, flowToken, flowCta, header as never, footer, flowAction as never, flowActionPayload, flowMessageVersion, mode as never, flowActionData, flowActionScreen, quotedMsgId, chatId, phone);',
    };
  }

  const pathParamNames = new Set(
    operation.parameters.filter((p) => p.in === 'path').map((p) => p.name),
  );
  const pathFirst = nonToken.some((p) => pathParamNames.has(p.name));

  const prelude = ['const token = client.config.token;'];

  if (pathFirst) {
    for (const param of nonToken) {
      prelude.push(
        `const ${param.name} = ${argAccessor(param.name, param.optional, operation)};`,
      );
    }
    const ordered = [];
    for (const param of nonToken) {
      if (pathParamNames.has(param.name)) {
        ordered.push(param.name);
      }
    }
    ordered.push('token');
    for (const param of nonToken) {
      if (!pathParamNames.has(param.name)) {
        ordered.push(param.name);
      }
    }
    return {
      prelude,
      call: `return client.${apiClass}.${operationId}(${ordered.join(', ')});`,
    };
  }

  for (const param of nonToken) {
    prelude.push(
      `const ${param.name} = ${argAccessor(param.name, param.optional, operation)};`,
    );
  }

  if (operationId === 'sendMessage') {
    return {
      prelude,
      call: 'return client.sendMessage({ body, quotedMsgId, chatId, phone });',
    };
  }

  return {
    prelude,
    call: `return client.${apiClass}.${operationId}(token, ${nonToken.map((p) => p.name).join(', ')});`,
  };
}

function emitToolsFile(operations) {
  const body = `/* eslint-disable */
/* auto-generated by gen/generate-mcp-tools.js — do not edit */

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  additionalProperties?: boolean | JsonSchema;
  enum?: unknown[];
  oneOf?: JsonSchema[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  [key: string]: unknown;
}

export interface GeneratedMcpTool {
  /** MCP tool name (snake_case) */
  name: string;
  /** OpenAPI operationId */
  operationId: string;
  description: string;
  inputSchema: JsonSchema;
  inputFields: string[];
}

export const GENERATED_MCP_TOOLS: GeneratedMcpTool[] = ${JSON.stringify(
    operations.map((op) => ({
      name: op.toolName,
      operationId: op.operationId,
      description: op.description,
      inputSchema: op.inputSchema,
      inputFields: Object.keys(op.inputSchema.properties || {}),
    })),
    null,
    2,
  )};

export const GENERATED_MCP_TOOL_COUNT = GENERATED_MCP_TOOLS.length;
`;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(TOOLS_FILE, body);
}

function emitHandlersFile(operations, signatures) {
  const cases = operations.map((operation) => {
    const signature = signatures.get(operation.operationId);
    const apiClass = signature?.apiClass || operation.apiClass;
    const handler = fixHandlerCallOrder({ ...operation, apiClass }, signature);
    const body = [...handler.prelude, handler.call]
      .map((line) => `      ${line}`)
      .join('\n');
    return `    case '${operation.toolName}': {\n${body}\n    }`;
  });

  const body = `/* eslint-disable */
/* auto-generated by gen/generate-mcp-tools.js — do not edit */
// @ts-nocheck — generated against workspace SDK; published @1msg/sdk may lag (settings polyfill).

import type { Client } from '@1msg/sdk';
import { GENERATED_MCP_TOOLS } from './tools.generated';

function requireArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(\`Missing required argument: \${key}\`);
  }
  return String(value);
}

function optionalArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return typeof value === 'string' ? value : String(value);
}

function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function requireNumber(args: Record<string, unknown>, key: string): number {
  const value = optionalNumber(args, key);
  if (value === undefined) {
    throw new Error(\`Missing required argument: \${key}\`);
  }
  return value;
}

function optionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return undefined;
}

function requireBoolean(args: Record<string, unknown>, key: string): boolean {
  const value = optionalBoolean(args, key);
  if (value === undefined) {
    throw new Error(\`Missing required argument: \${key}\`);
  }
  return value;
}

function optionalArray(args: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function requireArray(args: Record<string, unknown>, key: string): unknown[] {
  const value = optionalArray(args, key);
  if (!value) {
    throw new Error(\`Missing required argument: \${key} (expected array)\`);
  }
  return value;
}

function pickArgs(args: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (args[key] !== undefined && args[key] !== null && args[key] !== '') {
      picked[key] = args[key];
    }
  }
  return picked;
}

const inputFieldsByTool = new Map(
  GENERATED_MCP_TOOLS.map((tool) => [tool.name, tool.inputFields]),
);

export async function invokeGeneratedTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const inputFields = inputFieldsByTool.get(toolName) ?? Object.keys(args);

  switch (toolName) {
${cases.join('\n\n')}
    default:
      throw new Error(\`Unknown tool: \${toolName}\`);
  }
}
`;

  fs.writeFileSync(HANDLERS_FILE, body);
}

function main() {
  console.log('🔧 Chat API MCP Tools Generator');
  console.log('─'.repeat(50));

  const spec = loadSpec();
  const operations = collectOperations(spec);
  const signatures = parseSdkMethodSignatures();

  if (operations.length === 0) {
    console.error('❌ No operations with operationId found in bundled spec.');
    process.exit(1);
  }

  const missing = operations.filter((op) => !signatures.has(op.operationId));
  if (missing.length > 0) {
    console.warn(
      `⚠️  ${missing.length} operations missing SDK signature (using tag fallback):`,
    );
    for (const op of missing) {
      console.warn(`   - ${op.operationId}`);
    }
  }

  emitToolsFile(operations);
  emitHandlersFile(operations, signatures);

  console.log(`📝 Input:  ${path.relative(ROOT, INPUT_SPEC)}`);
  console.log(`📦 Output: ${path.relative(ROOT, TOOLS_FILE)}`);
  console.log(`📦 Output: ${path.relative(ROOT, HANDLERS_FILE)}`);
  console.log(`📊 Generated ${operations.length} MCP tools`);
  console.log('');
  console.log('✅ MCP tools generated successfully');
  console.log('─'.repeat(50));
}

if (require.main === module) main();
module.exports = { collectOperations };
