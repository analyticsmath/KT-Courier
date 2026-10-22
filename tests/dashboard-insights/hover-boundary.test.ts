// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

describe("Protected hover boundary",()=>{
  it("excludes shared controls inside protected pages while keeping public hover and keyboard focus",async()=>{
    const source=readFileSync("app/globals.css","utf8");
    const policy=source.slice(source.indexOf("@custom-variant hover"),source.indexOf("@theme inline"));
    const compiler=await compile('@theme { --color-red-500:#f00; }\n'+policy+'\n@tailwind utilities;');
    const css=compiler.build(['hover:bg-red-500','focus-visible:outline']);
    expect(css).toContain('@media (hover: hover)');
    expect(css).toContain('&:hover:where(:not([data-kt-protected-system], [data-kt-protected-system] *))');
    expect(css).toContain('&:focus-visible');
    document.body.innerHTML='<button id="public">Public</button><div data-kt-protected-system="editorial-operations-v1"><section><button id="protected">Protected</button></section></div>';
    const exclusion=':where(:not([data-kt-protected-system], [data-kt-protected-system] *))';
    expect(document.getElementById('public')!.matches(exclusion)).toBe(true);
    expect(document.getElementById('protected')!.matches(exclusion)).toBe(false);
  });
});
