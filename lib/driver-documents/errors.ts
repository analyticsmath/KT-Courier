const failures = {
  PROFILE_NOT_FOUND: { status: 404, message: "Driver profile not found." },
  MEDIA_INVALID: { status: 422, message: "The uploaded private media cannot be used for this driver document." },
  MEDIA_ALREADY_ATTACHED: { status: 409, message: "This private media is already attached with different document details. Upload new evidence to replace a document." },
} as const;

export class DriverDocumentError extends Error {
  readonly status: number;
  constructor(readonly code: keyof typeof failures) {
    super(failures[code].message);
    this.name = "DriverDocumentError";
    this.status = failures[code].status;
  }
}
