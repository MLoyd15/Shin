import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("service-role client import boundary", () => {
  it("fails lint when imported from outside apps/api/src/jobs", async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const filePath = path.resolve("apps/api/src/services/service-role-client-boundary.fixture.ts");
    const [result] = await eslint.lintText(
      'import { getServiceRoleClient } from "../jobs/service-role-client.js";',
      { filePath },
    );

    expect(result?.messages.some((message) => message.ruleId === "no-restricted-imports")).toBe(
      true,
    );
  });
});
