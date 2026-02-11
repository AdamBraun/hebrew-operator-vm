import React, { useMemo, useState } from "react";
import { InputRTL } from "./ui/InputRTL";
import { applyWord } from "./engine/shape/applyWord";
import { renderConstructionHtml } from "./engine/render/renderConstructionHtml";

export type DetailLevel = "minimal" | "audit";

export function App() {
  const [input, setInput] = useState("בָּ");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("minimal");

  const pipeline = useMemo(() => {
    try {
      const construction = applyWord(input);
      const html = renderConstructionHtml(construction, { audit: detailLevel === "audit" });
      return { construction, html, error: null };
    } catch (error) {
      return { construction: null, html: null, error };
    }
  }, [input, detailLevel]);

  const errorMessage = pipeline.error instanceof Error ? pipeline.error.message : null;

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="kicker">Cascading Construction</div>
          <h1>Fortress Shape</h1>
          <p>Type a Hebrew word. Each letter grows the same living form.</p>
        </div>
        <div className="toggle-group">
          <button
            type="button"
            className={detailLevel === "audit" ? "toggle active" : "toggle"}
            onClick={() => setDetailLevel(detailLevel === "audit" ? "minimal" : "audit")}
          >
            {detailLevel === "audit" ? "Audit On" : "Audit Off"}
          </button>
        </div>
      </header>

      <section className="input-panel">
        <label className="label" htmlFor="hebrew-input">
          Input
        </label>
        <InputRTL value={input} onChange={setInput} error={errorMessage ?? undefined} />
        <div className="hint">Try בָּ, מֶלֶךְ, or בְּרֵאשִׁית</div>
      </section>

      <section className="canvas-panel">
        {pipeline.html}
        {errorMessage ? <div className="error">{errorMessage}</div> : null}
      </section>
    </div>
  );
}
