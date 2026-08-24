import { z } from 'zod';
import type { JsonSchema } from './tools.generated';

function unionFromSchemas(schemas: JsonSchema[]): z.ZodTypeAny {
  const parts = schemas.map((item) => jsonPropertyToZod(item));
  if (parts.length === 0) {
    return z.unknown();
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return z.union(parts as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

function jsonPropertyToZod(schema: JsonSchema): z.ZodTypeAny {
  if (schema.enum && schema.enum.length > 0) {
    const values = schema.enum.filter((value): value is string | number => {
      return typeof value === 'string' || typeof value === 'number';
    });
    if (values.length > 0) {
      return z.union(values.map((value) => z.literal(value)) as [z.ZodLiteral<string | number>, ...z.ZodLiteral<string | number>[]]);
    }
  }

  const alternatives = schema.oneOf ?? (schema.anyOf as JsonSchema[] | undefined);
  if (alternatives && alternatives.length > 0) {
    return unionFromSchemas(alternatives);
  }

  if (Array.isArray(schema.type) && schema.type.length > 1) {
    return unionFromSchemas(schema.type.map((type) => ({ type, items: schema.items })));
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case 'integer':
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(schema.items ? jsonPropertyToZod(schema.items) : z.unknown());
    case 'object':
      if (schema.properties) {
        return jsonSchemaToZodObject(schema);
      }
      return z.record(z.string(), z.unknown());
    default:
      return z.string();
  }
}

function jsonSchemaToZodObject(schema: JsonSchema): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const properties = schema.properties ?? {};

  for (const [key, propertySchema] of Object.entries(properties)) {
    let field = jsonPropertyToZod(propertySchema);
    if (!schema.required?.includes(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }

  return z.object(shape as z.ZodRawShape).strict();
}

/** Convert generated OpenAPI JSON Schema to Zod for MCP tool registration. */
export function jsonSchemaToZod(schema: JsonSchema): z.ZodTypeAny {
  if (schema.type === 'object' || schema.properties) {
    return jsonSchemaToZodObject(schema);
  }
  return jsonPropertyToZod(schema);
}
