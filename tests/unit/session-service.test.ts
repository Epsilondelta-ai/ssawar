import { describe, expect, it } from "vitest";
import { generateTitleFromContent, normalizeCreateSessionInput } from "@/lib/session-service";

describe("generateTitleFromContent", () => {
  it("returns Untitled for blank input", () => {
    expect(generateTitleFromContent("   ")).toBe("Untitled");
  });

  it("normalizes spaces and casing", () => {
    expect(generateTitleFromContent("   창업을   하려면   무엇부터? ")).toBe("창업을 하려면 무엇부터?");
  });

  it("truncates long content", () => {
    const title = generateTitleFromContent("a".repeat(80));
    expect(title.endsWith("...")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(47);
  });
});

describe("normalizeCreateSessionInput", () => {
  it("accepts a valid session config", () => {
    const normalized = normalizeCreateSessionInput({
      orchestratorModel: "claude-sonnet-4-5",
      participantModels: ["gpt-5.4", "claude-opus-4-5"],
    });

    expect(normalized.visibility).toBe("private");
    expect(normalized.participantModels).toEqual(["gpt-5.4", "claude-opus-4-5"]);
  });

  it("rejects too few participants", () => {
    expect(() =>
      normalizeCreateSessionInput({
        orchestratorModel: "claude-sonnet-4-5",
        participantModels: ["gpt-5.4"],
      }),
    ).toThrowError("INVALID_PARTICIPANT_COUNT");
  });

  it("rejects invalid participant model ids", () => {
    expect(() =>
      normalizeCreateSessionInput({
        orchestratorModel: "claude-sonnet-4-5",
        participantModels: ["gpt-5.4", "not-real"],
      }),
    ).toThrowError("INVALID_PARTICIPANT_MODEL");
  });
});
