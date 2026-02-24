#!/usr/bin/env node
import { ENGINE_INPUT_PATHS, REPAIR_COMMAND_HINT, REQUIRED_ARTIFACT_PATHS } from "./config.mjs";
import { ensureKnownFlags, listWorkingTreeChanges } from "./lib.mjs";
import { verifyPasukCorpus } from "./verify-pasuk-corpus.mjs";
import { verifyArtifacts } from "./verify.mjs";

function assertPushIncludesArtifacts() {
  const relevantPaths = [...ENGINE_INPUT_PATHS, ...REQUIRED_ARTIFACT_PATHS];
  const workingTreeChanges = listWorkingTreeChanges(relevantPaths);
  if (workingTreeChanges.length === 0) {
    return;
  }

  console.error(
    "artifacts:verify:deep requires committed state. Uncommitted changes detected in engine/artifact paths:"
  );
  for (const filePath of workingTreeChanges) {
    console.error(`- ${filePath}`);
  }
  console.error(
    "Commit these changes before push so verification reflects exactly what will be pushed."
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--verbose"]);
  ensureKnownFlags(args, knownFlags);
  const verbose = args.includes("--verbose");

  assertPushIncludesArtifacts();

  const contract = verifyArtifacts({ verbose });
  if (!contract.ok) {
    console.error("artifacts:verify:deep failed during manifest contract verification");
    for (const failure of contract.failures) {
      console.error(`- ${failure}`);
    }
    for (const line of contract.ramifications) {
      console.error(`- ${line}`);
    }
    console.error(`Fix: ${REPAIR_COMMAND_HINT}`);
    process.exit(1);
  }

  const pasuk = await verifyPasukCorpus({ verbose });
  if (!pasuk.ok) {
    console.error("artifacts:verify:deep failed during per-verse provenance verification");
    const limit = 30;
    for (const failure of pasuk.failures.slice(0, limit)) {
      console.error(`- ${failure}`);
    }
    if (pasuk.failures.length > limit) {
      console.error(`- ... ${pasuk.failures.length - limit} additional failure(s)`);
    }
    console.error(`Fix: ${REPAIR_COMMAND_HINT}`);
    process.exit(1);
  }

  console.log(
    [
      "artifacts:verify:deep ok",
      `interpreter_inputs_hash=${contract.interpreterHash}`,
      `dot_renderer_inputs_hash=${contract.dotRendererHash}`,
      `pasuk_rows=${pasuk.rowsChecked}`
    ].join(" ")
  );
}

main().catch((error) => {
  console.error(`artifacts:verify:deep error: ${String(error?.message ?? error)}`);
  process.exit(2);
});
