import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyWord } from "../engine/shape/applyWord";
import { renderConstructionHtml } from "../engine/render/renderConstructionHtml";


describe("renderConstructionHtml", () => {
  it("renders HTML markup", () => {
    const construction = applyWord("בָּ");
    const html = renderConstructionHtml(construction);
    const markup = renderToStaticMarkup(html);

    expect(markup).toContain("canvas");
    expect(markup).toContain("stroke");
  });
});
