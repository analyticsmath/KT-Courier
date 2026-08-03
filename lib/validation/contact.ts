import { z } from "zod";

export const ENQUIRY_TYPES = [
  "delivery_question",
  "business_account",
  "existing_order",
  "pricing",
  "general_support",
] as const;

export const ContactFormSchema = z.object({
  name: z.string().min(2, "Name is required").max(150).trim(),
  email: z.string().email("A valid email address is required").max(200).trim(),
  phone: z.string().trim().max(30).optional(),
  enquiryType: z.enum(ENQUIRY_TYPES, {
    error: "Please select an enquiry type",
  }),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message must be under 5000 characters")
    .trim(),
});

export type ContactFormInput = z.infer<typeof ContactFormSchema>;
