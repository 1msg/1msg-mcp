import { jsonSchemaToZod } from '../json-schema-to-zod';
import { GENERATED_MCP_TOOLS } from '../tools.generated';

describe('jsonSchemaToZod', () => {
  it('accepts create_settings webhookUrl as a string or an array', () => {
    const createSettings = GENERATED_MCP_TOOLS.find((tool) => tool.name === 'create_settings');
    expect(createSettings).toBeDefined();
    const schema = jsonSchemaToZod(createSettings!.inputSchema);
    expect(
      (schema.parse({ webhookUrl: 'https://hooks.example/a' }) as { webhookUrl: string }).webhookUrl,
    ).toBe('https://hooks.example/a');
    expect(
      (
        schema.parse({
          webhookUrl: ['https://hooks.example/a', 'https://hooks.example/b'],
        }) as { webhookUrl: string[] }
      ).webhookUrl,
    ).toEqual(['https://hooks.example/a', 'https://hooks.example/b']);
  });
});
