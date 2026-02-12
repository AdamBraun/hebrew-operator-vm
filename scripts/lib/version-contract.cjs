const fs = require("node:fs");
const path = require("node:path");

const VERSION_SOURCE_PATH = path.resolve(
  process.cwd(),
  "impl",
  "reference",
  "src",
  "version.ts"
);

const VERSION_LINE_PATTERN =
  /\b(TRACE_VERSION|SEMANTICS_VERSION|RENDER_VERSION)\b\s*:\s*[^=]*=\s*"([^"]+)"/g;

function parseVersionContractSource(sourceText) {
  const fields = {};
  VERSION_LINE_PATTERN.lastIndex = 0;
  let match = VERSION_LINE_PATTERN.exec(sourceText);
  while (match) {
    fields[match[1]] = match[2];
    match = VERSION_LINE_PATTERN.exec(sourceText);
  }

  const trace_version = fields.TRACE_VERSION;
  const semantics_version = fields.SEMANTICS_VERSION;
  const render_version = fields.RENDER_VERSION;

  if (!trace_version || !semantics_version || !render_version) {
    throw new Error(
      "Unable to parse TRACE_VERSION/SEMANTICS_VERSION/RENDER_VERSION from impl/reference/src/version.ts"
    );
  }

  return {
    trace_version,
    semantics_version,
    render_version
  };
}

function readVersionContractFromFileSync(filePath = VERSION_SOURCE_PATH) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  return parseVersionContractSource(sourceText);
}

async function readVersionContractFromFile(filePath = VERSION_SOURCE_PATH) {
  const sourceText = await fs.promises.readFile(filePath, "utf8");
  return parseVersionContractSource(sourceText);
}

module.exports = {
  VERSION_SOURCE_PATH,
  parseVersionContractSource,
  readVersionContractFromFileSync,
  readVersionContractFromFile
};
