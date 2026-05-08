import { definePluginEntry } from "/home/luizgama/.npm-global/lib/node_modules/openclaw/dist/plugin-sdk/plugin-entry.js";
import * as Type from "/home/luizgama/.npm-global/lib/node_modules/openclaw/node_modules/typebox/build/typebox.mjs";

export default definePluginEntry({
  id: "gtd-outlook-spike-a",
  name: "GTD Outlook Spike A",
  description: "Throwaway OpenClaw validation plugin for Spike A.",
  register(api) {
    api.registerTool({
      name: "echo_tool",
      description: "Return the supplied input unchanged.",
      parameters: Type.Object({
        input: Type.String(),
      }),
      async execute(_toolCallId, params) {
        return {
          content: [{ type: "text", text: params.input }],
        };
      },
    });

    api.registerTool({
      name: "typed_echo_tool",
      description: "Validate representative TypeBox parameter shapes.",
      parameters: Type.Object({
        message: Type.String(),
        count: Type.Number(),
        mode: Type.Union([Type.Literal("brief"), Type.Literal("full")]),
        tag: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        const tag = typeof params.tag === "string" ? params.tag : "none";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: params.message,
                count: params.count,
                mode: params.mode,
                tag,
              }),
            },
          ],
        };
      },
    });
  },
});
