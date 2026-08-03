/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentReviewAssignmentType, RecruitmentReviewAssignmentStatus } from "@/types/db";
import { RecruitmentError } from "./errors";

export class ReviewAssignmentService {
  constructor(private readonly db: any) {}

  async assignReviewer(input: {
    applicationId: string;
    reviewerUserId: string;
    assignmentType: RecruitmentReviewAssignmentType;
    dueAt?: Date;
  }) {
    const publicReference = `RAS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentReviewAssignment.create({
      data: {
        publicReference,
        applicationId: input.applicationId,
        reviewerUserId: input.reviewerUserId,
        assignmentType: input.assignmentType,
        status: RecruitmentReviewAssignmentStatus.PENDING,
        dueAt: input.dueAt || null,
      },
    });
  }

  async declareConflictOfInterest(assignmentReference: string, details: string) {
    return this.db.recruitmentReviewAssignment.update({
      where: { publicReference: assignmentReference },
      data: {
        status: RecruitmentReviewAssignmentStatus.CONFLICT_DECLARED,
        conflictDeclared: true,
        conflictDetails: details,
      },
    });
  }

  async completeAssignment(assignmentReference: string) {
    const assignment = await this.db.recruitmentReviewAssignment.findUnique({
      where: { publicReference: assignmentReference },
    });

    if (!assignment) throw new RecruitmentError("Assignment not found.");
    if (assignment.conflictDeclared) {
      throw new RecruitmentError("Cannot complete review assignment: Conflict of interest declared.");
    }

    return this.db.recruitmentReviewAssignment.update({
      where: { publicReference: assignmentReference },
      data: {
        status: RecruitmentReviewAssignmentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }
}
