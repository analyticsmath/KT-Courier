import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Phase 26 — Source Code Integrity & Prohibited AI / Automation Audits", () => {
  const libRecruitmentDir = path.resolve(__dirname, "../../lib/recruitment");

  function readAllFiles(dir: string): string[] {
    const results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results.push(...readAllFiles(filePath));
      } else if (filePath.endsWith(".ts")) {
        results.push(filePath);
      }
    }
    return results;
  }

  it("verifies all 32 prohibited patterns and implementations are absent in lib/recruitment", () => {
    const files = readAllFiles(libRecruitmentDir);
    const combinedContent = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

    const prohibitedPatterns = [
      "APPLICANT_FEE",
      "STAFFING_MARKETPLACE",
      "AUTOMATED_REJECTION",
      "AUTOMATED_HIRE",
      "AI_RANK",
      "CV_EMBEDDING_RANK",
      "CULTURE_FIT_SCORE",
      "PERSONALITY_SCORE",
      "FACIAL_SCORE",
      "EMOTION_SCORE",
      "VOICE_STRESS_SCORE",
      "SOCIAL_MEDIA_SCRAPING",
      "BLANKET_CRIMINAL_CHECK",
      "BLANKET_CREDIT_CHECK",
      "HIV_STATUS",
      "DIRECT_RECRUITMENT_EMAIL_SENDER",
      "DIRECT_RECRUITMENT_SMS_SENDER",
      "DIRECT_RECRUITMENT_PUSH_SENDER",
      "MOCK_PRODUCTION_REPOSITORY",
      "IN_MEMORY_USER_IDENTITY",
      "NO_OP_DOCUMENT_ADAPTER",
      "FAKE_EMPLOYEE_ADAPTER",
      "FAKE_DRIVER_ADAPTER",
      "IN_MEMORY_OUTBOX",
      "DIRECT_EMPLOYEE_ACTIVATION",
      "DIRECT_DRIVER_ACTIVATION",
      "UNRESTRICTED_SPECIAL_INFO_DTO",
      "EE_LEAKAGE",
      "STATIC_PRODUCTION_APPLICANT_DATA",
      "PLACEHOLDER_API_RESPONSE",
      "LOCK_BYPASS",
      "GENERIC_RECONCILIATION_RESOLVE",
    ];

    for (const pattern of prohibitedPatterns) {
      expect(combinedContent).not.toContain(pattern);
    }
  });

  it("verifies NO external background check network calls or external LLM calls exist in lib/recruitment", () => {
    const files = readAllFiles(libRecruitmentDir);
    const combinedContent = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

    expect(combinedContent).not.toMatch(/openai/i);
    expect(combinedContent).not.toMatch(/anthropic/i);
    expect(combinedContent).not.toMatch(/langchain/i);
    expect(combinedContent).not.toMatch(/externalBackgroundCheckCall/i);
  });
});
