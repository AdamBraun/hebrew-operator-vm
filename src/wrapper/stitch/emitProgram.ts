import fs from "node:fs/promises";
import path from "node:path";
import {
  stitchProgramIRFromFiles,
  type ProgramIROutputFormat,
  type StitchProgramIRFromFilesArgs,
  type StitchProgramIRResult
} from "../program_schema";

export type EmitProgramArgs = StitchProgramIRFromFilesArgs & {
  outDir: string;
  programFileName?: string;
  manifestFileName?: string;
};

export type EmitProgramResult = StitchProgramIRResult & {
  programPath: string;
  manifestPath: string;
};

function defaultProgramFileName(outputFormat: ProgramIROutputFormat): string {
  return outputFormat === "json" ? "ProgramIR.json" : "ProgramIR.jsonl";
}

export async function emitProgram(args: EmitProgramArgs): Promise<EmitProgramResult> {
  const outputFormat = args.outputFormat ?? "jsonl";
  const programFileName = args.programFileName ?? defaultProgramFileName(outputFormat);
  const manifestFileName = args.manifestFileName ?? "program.manifest.json";

  const stitched = await stitchProgramIRFromFiles({
    spinePath: args.spinePath,
    lettersIrPath: args.lettersIrPath,
    niqqudIrPath: args.niqqudIrPath,
    cantillationIrPath: args.cantillationIrPath,
    layoutIrPath: args.layoutIrPath,
    metadataPlanPath: args.metadataPlanPath,
    outputFormat,
    ...(args.createdAt ? { createdAt: args.createdAt } : {})
  });

  await fs.mkdir(args.outDir, { recursive: true });
  const programPath = path.join(args.outDir, programFileName);
  const manifestPath = path.join(args.outDir, manifestFileName);

  await Promise.all([
    fs.writeFile(programPath, stitched.programIrText, "utf8"),
    fs.writeFile(manifestPath, stitched.manifestText, "utf8")
  ]);

  return {
    ...stitched,
    programPath,
    manifestPath
  };
}
