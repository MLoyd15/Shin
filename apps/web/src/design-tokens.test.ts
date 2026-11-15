import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(fileURLToPath(new URL("./index.css", import.meta.url)), "utf8");
const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

function getThemeTokens(selector: string): Record<string, string> {
  const block = stylesheet.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1];
  if (!block) throw new Error(`Missing ${selector} theme block`);

  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, name, value]) => [
      name,
      value!.toUpperCase(),
    ]),
  );
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("FolioAgent design tokens", () => {
  it("defaults to the specified dark navy palette", () => {
    expect(html).toMatch(/<html[^>]*class="dark"/);
    expect(getThemeTokens("\\.dark")).toMatchObject({
      ["background"]: "#0B1220",
      ["surface"]: "#111A2E",
      "surface-elevated": "#172238",
      border: "#223049",
      text: "#E6ECF5",
      "text-muted": "#8A98B3",
      primary: "#2DD4BF",
      "primary-foreground": "#06201C",
      positive: "#34D399",
      negative: "#F87171",
      warning: "#FBBF24",
      "chart-1": "#2DD4BF",
      "chart-2": "#60A5FA",
      "chart-3": "#A78BFA",
      "chart-4": "#F59E0B",
      "chart-5": "#F472B6",
      "chart-6": "#94A3B8",
    });
  });

  it.each(["\\:root", "\\.dark"])(
    "keeps text and status colors readable on every %s surface",
    (theme) => {
      const tokens = getThemeTokens(theme);
      const surfaces = [tokens["background"], tokens["surface"], tokens["surface-elevated"]];

      for (const foreground of [
        tokens["text"],
        tokens["text-muted"],
        tokens["positive"],
        tokens["negative"],
      ]) {
        expect(foreground).toBeDefined();
        for (const background of surfaces) {
          expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(4.5);
        }
      }

      expect(contrast(tokens["primary-foreground"]!, tokens["primary"]!)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it("disables nonessential motion when reduced motion is requested", () => {
    expect(stylesheet).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
