/**
 * Sitenin bütün metni. Tek kaynak.
 *
 * Karşılığı tasarım kanvasındaki `renderVals()` bloğuydu; kanvas silindi
 * 04-09-2026, içerik kaynağı `docs/site-icerik.md` olarak duruyor.
 * Sayfalar bu diziler üzerinde dönüyor.
 *
 * Dil kuralı (CLAUDE.md, "Dil"): ziyaretçinin gördüğü her metin İngilizce.
 * Bu dosyadaki YORUMLAR Türkçe, DEĞERLER İngilizce.
 */

export const SITE_URL = "https://codecraft-ashy-seven.vercel.app";

export const ENDPOINT = "https://codecraft-ashy-seven.vercel.app/mcp";

export const REPO = "https://github.com/TanerTalas/codecraft";
export const REPO_LICENSE = `${REPO}/blob/main/LICENSE`;
export const REPO_NOTICES = `${REPO}/blob/main/THIRD-PARTY-NOTICES.md`;
export const USAGE_GUIDELINES = "https://www.minecraft.net/en-us/usage-guidelines";

/** Ana sayfadaki dört sessiz başarısızlık. Dördü de ölçüldü, uydurma değil. */
export const failures = [
  {
    what: '"format_version": "1.26.40"',
    result: "The schema rejected it: a spawn rule accepts only 1.8.0, 1.10.0 or 1.12.0.",
  },
  {
    what: "feature rule filename ≠ identifier",
    result:
      "The game rejected it: “Feature rule identifier ‘ruby_ore_feature’ does not match filename ‘ruby_ore’”.",
  },
  {
    what: "recipe with no unlock field",
    result: "The game never loaded the recipe: “1.20+ Recipes require unlock data”.",
  },
  {
    what: "query.is_babyy",
    result: "The entire block definition was dropped. The block never registered in the game.",
  },
];

export const steps = [
  { n: "1", text: "You add the MCP endpoint to your own Claude client." },
  {
    n: "2",
    text: "While working on a Bedrock task, the model calls the tools by itself: which field is required, which identifier exists, is this line valid.",
  },
  {
    n: "3",
    text: "The generated files are validated against the official schema, the command grammar, and real tsc.",
  },
];

/**
 * Dokuz araç. Ana sayfadaki özet listesi de, Araçlar sayfasındaki kartlar da
 * BU diziden türüyor — tasarımda da öyleydi (`tools: cards.map(...)`).
 */
export const toolCards = [
  {
    name: "check_feasibility",
    line: "Can Bedrock do this at all; if not, why, and what the alternative is",
    when: "First. Before any file is written.",
    note: "Input is language-independent, output is always English. Blocked classes: input simulation, filesystem access, network access. A blocked answer carries the reason, the evidence, and an alternative.",
  },
  {
    name: "get_version_info",
    line: "Which version number goes where",
    when: "Second, together with get_schema, before writing files.",
    note: "The returned format_version list may have been narrowed by measurement; get_schema gives the raw schema enum. That is why the two can look different.",
  },
  {
    name: "get_schema",
    line: "Which fields this document type requires, and which format_version is valid",
    when: "Second, together with get_version_info.",
    note: "It does not return the raw schema, it returns a summary. On crowded nodes it narrows and says what it cut; use path to descend into a subnode.",
  },
  {
    name: "lookup_id",
    line: "Does this minecraft: identifier exist in this version, what type is it, what block states does it have",
    when: "Whenever an identifier is referenced.",
    note: "For a block it also returns the valid block states and the values they accept. A name without a namespace is treated as minecraft:.",
  },
  {
    name: "validate_json",
    line: "Does this file match the official schema",
    when: "After each JSON file is written.",
    note: "The error message carries a JSON pointer, the rule that was violated, and readable text. Unexpected field names and the valid enum values make it into the message.",
  },
  {
    name: "validate_command",
    line: "Is this command line valid, does it require cheats",
    when: "On any command string, including ones embedded in files.",
    note: "An execute ... run <command> chain is unwrapped and the inner command is validated too. It tells you whether cheats are required.",
  },
  {
    name: "validate_script",
    line: "Does the script compile with real tsc and real @minecraft/server types",
    when: "After script files are written.",
    note: "Real TypeScript compiler, real @minecraft/server types. The answer states which module version it compiled against.",
  },
  {
    name: "validate_python",
    line: "Is this out-of-game automation script and the commands inside it valid",
    when: "On automation that runs outside the game.",
    note: "Three axes: Python syntax, embedded commands, the /connect envelope. There is no Python interpreter on the hosted endpoint, so the syntax axis is skipped and reported as syntaxChecked: false — ok:true alone does not mean the syntax is valid.",
  },
  {
    name: "review_pack",
    line: "The whole pack: the right validator per file, plus the checks a schema structurally cannot see",
    when: "Last, once the pack is complete.",
    note: "Also runs the checks a schema structurally cannot see: identifier consistency, filename rules, manifest module type, texture keys, component names, Molang queries, loot and trade table paths.",
  },
];

export const setupSteps = [
  {
    n: "1",
    text: "In Claude, open Customize > Connectors. Not Settings — that distinction got confused in real use.",
  },
  { n: "2", text: "Add a custom connector and enter the address." },
  { n: "3", text: "Save. The tools are listed on the tool permissions screen." },
];

export const scenarios = [
  { ask: "Make a guardian creature spawn on the surface at night", note: "" },
  { ask: "When I break a block, break its neighbours of the same kind too", note: "" },
  { ask: "Build a ten-by-ten glass box around me", note: "" },
  {
    ask: "Make it fish automatically without me touching the keyboard",
    note: "This one is blocked, with a reason and an alternative. It is a good first try because it shows the tool can say no.",
  },
];

export const nonBugs = [
  {
    seen: "GET /mcp returns 405",
    why: "The spec allows a server that does not offer SSE to return 405.",
  },
  { seen: "No OAuth discovery endpoints", why: "The endpoint is unauthenticated, deliberately." },
  {
    seen: "Server version never appears in the client UI",
    why: "A remote connector is proxied and the client does not surface the initialize response. Measured.",
  },
];

/** Beş sürüm numarası. Sekmeler bunun üzerinde dönüyor. */
export const versions = [
  {
    label: "Marketing number",
    example: "26.40",
    where: "Announcements only. It is never written into any file.",
  },
  { label: "Game / data version", example: "1.26.40.5", where: "Data indexes." },
  {
    label: "min_engine_version",
    example: "[1, 26, 40]",
    where: "manifest.json, as a three-part array.",
  },
  {
    label: "@minecraft/server module version",
    example: "2.9.0",
    where: "manifest.json → dependencies.",
  },
  {
    label: "format_version",
    example: "1.21.100 · 1.13.0 · 2",
    where: "Content files. Each document type has its own.",
  },
];

export const misses = [
  {
    title: "Valid but not intended",
    measured: false,
    text: "The file is correct, the behaviour is wrong. Example: sending a player a message on the worldLoad event — the event fires, but there is no player there to receive it. No schema can catch this.",
  },
  {
    title: "Context",
    measured: false,
    text: "An existing Molang query used in the wrong context is rejected by the game. The check only looks at whether the query exists.",
  },
  {
    title: "Silent failure",
    measured: true,
    text: "An entity pointing at a loot table that does not exist loads, spawns and dies. The game writes nothing; nothing drops.",
  },
  {
    title: "Untried document types",
    measured: true,
    text: "The pack that was verified in-game carried 13 files and touched 11 document types. The number of recognised types is 60.",
  },
];

export const measurements = [
  "The validator’s error findings and the game’s ContentLog errors converged on the same set for one test pack: both empty.",
  "An unknown Molang query drops the entire block definition in-game. After the measurement, the check was raised to error.",
  "An unknown component name is rejected the same way, but the check stayed a warning, because the source list had a measured gap of 126 names. The gap has been closed; the severity decision is being handled separately.",
];

export const sources = [
  {
    name: "Mojang/bedrock-samples",
    use: "Block, entity and item identifiers; command grammar; Molang queries; component names; schemas",
    license: "Minecraft EULA — derived index only",
  },
  {
    name: "Blockception/Minecraft-bedrock-json-schemas",
    use: "The schemas JSON validation uses",
    license: "BSD-3-Clause, attribution required",
  },
  {
    name: "@minecraft/* npm packages",
    use: "Script type definitions",
    license: "MIT, Microsoft",
  },
  {
    name: "MicrosoftDocs/minecraft-creator",
    use: "Release notes",
    license: "CC-BY-4.0",
  },
];
