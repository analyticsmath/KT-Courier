import { z } from "zod";

const reportExportFormatSchema = z.enum(["CSV", "JSON", "XLSX"]);

export const reportArtifactSummarySchema = z.object({
  id: z.string(),
  publicReference: z.string(),
  format: reportExportFormatSchema,
  byteSize: z.number().int().nonnegative(),
  checksum: z.string(),
  downloadCount: z.number().int().nonnegative(),
  expiresAt: z.string(),
});

export const reportJobSummarySchema = z.object({
  id: z.string(),
  publicReference: z.string(),
  definitionKey: z.string(),
  requesterRole: z.string(),
  status: z.string(),
  outputFormat: reportExportFormatSchema,
  rowCount: z.number().int().nullable(),
  createdAt: z.string(),
});

export const reportJobDetailSchema = reportJobSummarySchema.extend({
  errorMessage: z.string().nullable(),
  artifact: reportArtifactSummarySchema.nullable(),
});

export const reportDefinitionSummarySchema = z.object({
  key: z.string(),
  version: z.number().int().positive(),
  name: z.string(),
  audience: z.string(),
  requiredPermission: z.string(),
  maximumRowCount: z.number().int().positive(),
});

export const reportReconciliationCaseSummarySchema = z.object({
  id: z.string(),
  publicReference: z.string(),
  reason: z.string(),
  status: z.string(),
  safeSummary: z.string(),
  openedAt: z.string(),
});

export const reconciliationScanResultSchema = z.object({
  casesOpened: z.number().int().nonnegative(),
  casesResolved: z.number().int().nonnegative(),
});

export type ReportArtifactSummary = z.infer<typeof reportArtifactSummarySchema>;
export type ReportJobSummary = z.infer<typeof reportJobSummarySchema>;
export type ReportJobDetail = z.infer<typeof reportJobDetailSchema>;
export type ReportDefinitionSummary = z.infer<typeof reportDefinitionSummarySchema>;
export type ReportReconciliationCaseSummary = z.infer<typeof reportReconciliationCaseSummarySchema>;
