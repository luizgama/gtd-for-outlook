const DIST_ENTRY_SPECIFIER = "../../dist/plugin/index.js";
const BUILD_HELP = "Run `npm run build` from the repository root, then retry.";

async function importDistEntry() {
  try {
    return await import(DIST_ENTRY_SPECIFIER);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `OpenClaw plugin runtime entry not found at ${DIST_ENTRY_SPECIFIER}. ${BUILD_HELP} Original error: ${message}`,
    );
  }
}

const distEntry = await importDistEntry();

export const GTD_TOOL_DEFINITIONS = distEntry.GTD_TOOL_DEFINITIONS;
export const pluginHandlers = distEntry.pluginHandlers;
export default distEntry.default;
