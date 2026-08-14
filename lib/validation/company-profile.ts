import { z } from "zod";

const optionalText = z.string().trim().max(500).optional().nullable();

export const CompanyProfileUpdateSchema = z.object({
  legalName: z.string().trim().min(1).max(240),
  tradingName: optionalText,
  registrationNumber: z.string().trim().max(120).optional().nullable(),
  vatNumber: z.string().trim().max(120).optional().nullable(),
  physicalAddress: z.record(z.string(), z.unknown()).optional().nullable(),
  supportEmail: z.string().trim().email().max(320).optional().nullable(),
  businessEmail: z.string().trim().email().max(320).optional().nullable(),
  telephoneNumbers: z.array(z.string().trim().min(1).max(64)).max(8).optional().nullable(),
  website: z.string().trim().url().max(500).optional().nullable(),
  publicMetadata: z.record(z.string(), z.unknown()).optional().nullable(),
  documentIdentityMetadata: z.record(z.string(), z.unknown()).optional().nullable(),
  effectiveAt: z.coerce.date().optional(),
}).strict();
