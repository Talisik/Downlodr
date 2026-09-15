import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { bridgeGet } from '../client.js';

export async function handleGetAppStatus() {
  return bridgeGet<{
    ok: boolean;
    app: string;
    version: string;
    platform: string;
    afdaReady: boolean;
    skedulosaReady: boolean;
  }>('/status');
}

export async function handleGetSystemInfo() {
  return bridgeGet<Record<string, unknown>>('/system/info');
}

export function registerSystemTools(server: McpServer): void {
  server.tool(
    'downlodr_get_app_status',
    'Check whether the Downlodr app is running and get its version, platform, and service readiness.',
    {},
    async () => {
      const status = await handleGetAppStatus();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
      };
    },
  );

  server.tool(
    'downlodr_get_system_info',
    'Get system information from the machine running Downlodr: CPU, memory, OS, and app version.',
    {},
    async () => {
      const info = await handleGetSystemInfo();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
      };
    },
  );
}
