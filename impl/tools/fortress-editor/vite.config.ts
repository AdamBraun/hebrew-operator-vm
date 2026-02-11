import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

function fixEnvelopeExport() {
  const target = path.resolve(__dirname, "../../reference/src/letters/types.ts");
  return {
    name: "fix-envelope-export",
    enforce: "pre",
    transform(code: string, id: string) {
      const cleanId = id.split("?")[0];
      if (path.normalize(cleanId) !== path.normalize(target)) {
        return null;
      }
      let updated = code;
      updated = updated.replace(
        'import { Envelope, defaultEnvelope } from "../state/policies";',
        'import { defaultEnvelope } from "../state/policies";\nimport type { Envelope } from "../state/policies";'
      );
      updated = updated.replace(
        "export { Envelope, defaultEnvelope };",
        "export { defaultEnvelope };\nexport type { Envelope };"
      );
      return updated === code ? null : updated;
    }
  };
}

export default defineConfig({
  plugins: [fixEnvelopeExport(), react()],
  resolve: {
    alias: {
      "@ref": path.resolve(__dirname, "../../reference/src")
    }
  },
  server: {
    fs: {
      allow: [__dirname, path.resolve(__dirname, "../../reference/src")]
    }
  }
});
