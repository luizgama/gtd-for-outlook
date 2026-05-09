import { gtdFetchEmails } from "./tools/graph-fetch.js";
import { gtdClassifyEmail } from "./tools/classify-email.js";
import { gtdOrganizeEmail } from "./tools/graph-organize.js";
import { createMsalApp, acquireGraphAccessToken } from "../graph/auth.js";
import { GraphClient } from "../graph/client.js";
import { createProcessingStateStore } from "../pipeline/state.js";

export type PluginToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type PluginApi = {
  registerTool: (definition: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (_toolCallId: string, params: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
  }) => void;
};

type PluginEntryOptions = {
  id: string;
  name: string;
  description: string;
  configSchema?: Record<string, unknown>;
  register: (api: PluginApi) => void;
};

function definePluginEntry({ configSchema, ...entry }: PluginEntryOptions) {
  const resolvedConfigSchema = configSchema ?? {
    type: "object",
    additionalProperties: false,
    properties: {},
  };

  return {
    ...entry,
    get configSchema() {
      return resolvedConfigSchema;
    },
  };
}

export const GTD_TOOL_DEFINITIONS: PluginToolDefinition[] = [
  {
    name: "gtd_fetch_emails",
    description: "Fetch unread inbox emails for processing.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        top: { type: "number", minimum: 1, maximum: 100 },
        unreadOnly: { type: "boolean" },
        since: { type: "string" },
      },
    },
  },
  {
    name: "gtd_classify_email",
    description: "Sanitize and classify one email into a GTD category.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["messageId"],
      properties: {
        messageId: { type: "string", minLength: 1 },
        subject: { type: "string" },
        bodyPreview: { type: "string" },
      },
    },
  },
  {
    name: "gtd_organize_email",
    description: "Ensure destination folder exists, then move and categorize email.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["messageId", "category", "outlookCategory"],
      properties: {
        messageId: { type: "string", minLength: 1 },
        category: { type: "string", minLength: 1 },
        outlookCategory: { type: "string", minLength: 1 },
      },
    },
  },
];

export const pluginHandlers = {
  gtdFetchEmails,
  gtdClassifyEmail,
  gtdOrganizeEmail,
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function createGraphClient(): Promise<GraphClient> {
  const clientId = requireEnv("GRAPH_CLIENT_ID");
  const tenantId = requireEnv("GRAPH_TENANT_ID");
  const app = createMsalApp({ clientId, tenantId });
  return new GraphClient({
    tokenProvider: async () => {
      const token = await acquireGraphAccessToken(app);
      return token.accessToken;
    },
  });
}

const pluginEntry = definePluginEntry({
  id: "gtd-outlook",
  name: "GTD for Outlook",
  description: "GTD Outlook plugin tools",
  register(api) {
    api.registerTool({
      name: "gtd_fetch_emails",
      description: "Fetch unread inbox emails for GTD processing.",
      parameters: GTD_TOOL_DEFINITIONS[0].parameters,
      async execute(_toolCallId, params) {
        const client = await createGraphClient();
        const result = await gtdFetchEmails(client, params as { top?: number; unreadOnly?: boolean; since?: string });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    });

    api.registerTool({
      name: "gtd_classify_email",
      description: "Sanitize and classify one email into a GTD category.",
      parameters: GTD_TOOL_DEFINITIONS[1].parameters,
      async execute(_toolCallId, params) {
        const result = await gtdClassifyEmail(params as { messageId: string; subject?: string; bodyPreview?: string });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    });

    api.registerTool({
      name: "gtd_organize_email",
      description: "Ensure GTD folder exists, move message, and apply category.",
      parameters: GTD_TOOL_DEFINITIONS[2].parameters,
      async execute(_toolCallId, params) {
        const client = await createGraphClient();
        const stateStore = createProcessingStateStore();
        const result = await gtdOrganizeEmail(
          client,
          params as { messageId: string; category: string; outlookCategory: string },
          stateStore,
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    });
  },
});

export default pluginEntry;
