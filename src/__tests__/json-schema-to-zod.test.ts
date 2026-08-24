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

  it('accepts delete_media mediaId as a number or a string', () => {
    const deleteMedia = GENERATED_MCP_TOOLS.find((tool) => tool.name === 'delete_media');
    expect(deleteMedia).toBeDefined();
    const schema = jsonSchemaToZod(deleteMedia!.inputSchema);
    expect((schema.parse({ mediaId: '1597399065095084' }) as { mediaId: string }).mediaId).toBe(
      '1597399065095084',
    );
    const fromNumber = (
      schema.parse({ mediaId: 1597399065095084 }) as { mediaId: string | number }
    ).mediaId;
    expect(String(fromNumber)).toBe('1597399065095084');
  });
});
