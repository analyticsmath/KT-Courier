"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/constants/assignments";
import {
  PICKUP_FAILURE_REASON_LABELS,
  PARCEL_CONDITION_LABELS,
  OPERATIONAL_EVENT_LABELS,
} from "@/lib/constants/pickup";
import { DELIVERY_EXCEPTION_REASON_LABELS } from "@/lib/constants/delivery";
import { formatDateTime } from "@/lib/utils/formatters";
import type { DriverAssignmentDto } from "@/lib/dto/assignment.dto";
import type { WorkbenchAssignmentDto } from "@/lib/dto/pickup.dto";
import { createDriverOperationIdStore } from "@/lib/driver-operations/client-operation";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

interface OtpStatus {
  hasActiveOtp: boolean;
  sentToEmail: string | null;
  expiresAt: string | null;
  attemptsUsed: number;
  maxAttempts: number;
  canResend: boolean;
}

// ─── Pickup eligibility ───────────────────────────────────────────────────────

const PICKUP_ELIGIBLE_STATUSES = ["CONFIRMED", "PICKUP_SCHEDULED"];

function isPickupEligible(orderStatus: string, assignmentStatus: string): boolean {
  return assignmentStatus === "ACCEPTED" && PICKUP_ELIGIBLE_STATUSES.includes(orderStatus);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assignmentBadgeVariant(status: string): "green" | "blue" | "amber" | "red" | "gray" {
  if (status === "ACCEPTED") return "green";
  if (status === "ASSIGNED") return "blue";
  if (status === "REJECTED") return "red";
  if (status === "CANCELLED") return "gray";
  return "gray";
}

function orderStatusBadgeVariant(status: string): "green" | "blue" | "amber" | "gray" {
  if (status === "PICKUP_SCHEDULED") return "blue";
  if (status === "CONFIRMED") return "amber";
  if (status === "PICKED_UP") return "green";
  return "gray";
}

function formatDistance(m: number | null): string {
  if (!m) return "—";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(s: number | null): string {
  if (!s) return "—";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

// ─── Pickup action enum ────────────────────────────────────────────────────────

type PickupAction = "idle" | "start" | "complete" | "fail";

// ─── Delivery action enum ──────────────────────────────────────────────────────

type DeliveryAction = "idle" | "start" | "send_otp" | "complete" | "attempted";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DriverAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [assignment, setAssignment] = useState<DriverAssignmentDto | null>(null);
  const [workbench, setWorkbench] = useState<WorkbenchAssignmentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const operationIds = useRef(createDriverOperationIdStore());

  // Keep the UUID for a network retry until the server returns a final result.
  const operationCommand = useCallback((name: string, material: unknown = {}) => ({
    operationId: operationIds.current.get(name, { assignmentVersion: assignment?.version ?? workbench?.version, material }),
    assignmentVersion: assignment?.version ?? workbench?.version,
  }), [assignment?.version, workbench?.version]);

  const clearOperation = useCallback((name: string) => operationIds.current.clear(name), []);

  // Accept/reject
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Pickup state
  const [pickupAction, setPickupAction] = useState<PickupAction>("idle");
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState<string | null>(null);

  // Delivery state
  const [deliveryAction, setDeliveryAction] = useState<DeliveryAction>("idle");
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [otpStatus, setOtpStatus] = useState<OtpStatus | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [locationRecording, setLocationRecording] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Start delivery form
  const [deliveryStartNote, setDeliveryStartNote] = useState("");

  // Complete delivery form
  const [otpCode, setOtpCode] = useState("");
  const [deliveryRecipientName, setDeliveryRecipientName] = useState("");
  const [deliveryRecipientPhone, setDeliveryRecipientPhone] = useState("");
  const [deliveryPublicNote, setDeliveryPublicNote] = useState("");
  const [deliveryDriverNote, setDeliveryDriverNote] = useState("");
  const [deliveryConfirm, setDeliveryConfirm] = useState(false);

  // Attempted form
  const [attemptReason, setAttemptReason] = useState("");
  const [attemptDriverNote, setAttemptDriverNote] = useState("");

  // Start pickup form
  const [startNote, setStartNote] = useState("");

  // Complete pickup form
  const [completeParcels, setCompleteParcels] = useState("1");
  const [completeCondition, setCompleteCondition] = useState("NOT_RECORDED");
  const [completePublicNote, setCompletePublicNote] = useState("");
  const [completeDriverNote, setCompleteDriverNote] = useState("");
  const [completeConfirm, setCompleteConfirm] = useState(false);

  // Fail pickup form
  const [failReason, setFailReason] = useState("");
  const [failNote, setFailNote] = useState("");

  const loadAssignment = useCallback(() => {
    fetch(`/api/driver/assignments/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setAssignment(data);
        }
      })
      .catch(() => setError("Failed to load assignment."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  // When assignment is accepted and pickup eligible, also load workbench data
  useEffect(() => {
    if (
      assignment?.status === "ACCEPTED" &&
      PICKUP_ELIGIBLE_STATUSES.includes(assignment.orderStatus)
    ) {
      fetch(`/api/driver/workbench`)
        .then((r) => r.json())
        .then((data) => {
          const found = data.assignments?.find(
            (a: WorkbenchAssignmentDto) => a.id === id
          );
          if (found) setWorkbench(found);
        })
        .catch(() => {});
    }
  }, [assignment, id]);


  // Load OTP status when delivery is in transit
  useEffect(() => {
    if (
      assignment?.status === "ACCEPTED" &&
      (assignment.orderStatus === "IN_TRANSIT" || assignment.orderStatus === "DELIVERY_ATTEMPTED")
    ) {
      fetch(`/api/driver/assignments/${id}/delivery/otp`)
        .then((r) => r.json())
        .then((data) => { if (!data.error) setOtpStatus(data); })
        .catch(() => {});
    }
  }, [assignment, id]);

  async function handleAccept() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/driver/assignments/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: assignment?.version }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Could not accept assignment.");
        return;
      }
      await loadAssignment();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setActionError("A rejection reason is required.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/driver/assignments/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: assignment?.version, reasonCode: "OTHER", note: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Could not reject assignment.");
        return;
      }
      router.push("/driver/assignments");
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartPickup(e: React.FormEvent) {
    e.preventDefault();
    setPickupLoading(true);
    setPickupError(null);
    try {
      const res = await fetch(`/api/driver/assignments/${id}/pickup/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...operationCommand("pickup-start", { driverNote: startNote }), driverNote: startNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) loadAssignment();
        setPickupError(data.error || "Could not start pickup.");
        return;
      }
      setWorkbench(data);
      clearOperation("pickup-start");
      setPickupAction("idle");
      // Reload base assignment
      loadAssignment();
    } catch {
      setPickupError("Network error. Please try again.");
    } finally {
      setPickupLoading(false);
    }
  }

  async function handleCompletePickup(e: React.FormEvent) {
    e.preventDefault();
    if (!completeConfirm) {
      setPickupError("You must confirm the parcel has been collected.");
      return;
    }
    setPickupLoading(true);
    setPickupError(null);
    try {
      const res = await fetch(`/api/driver/assignments/${id}/pickup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...operationCommand("pickup-complete", { parcelCount: completeParcels, parcelCondition: completeCondition, publicNote: completePublicNote, driverNote: completeDriverNote }),
          parcelCount: parseInt(completeParcels, 10) || 1,
          parcelCondition: completeCondition,
          publicNote: completePublicNote || undefined,
          driverNote: completeDriverNote || undefined,
          confirmPickup: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) loadAssignment();
        setPickupError(data.error || "Could not complete pickup.");
        return;
      }
      setWorkbench(data);
      clearOperation("pickup-complete");
      setPickupAction("idle");
      loadAssignment();
    } catch {
      setPickupError("Network error. Please try again.");
    } finally {
      setPickupLoading(false);
    }
  }

  async function handleFailPickup(e: React.FormEvent) {
    e.preventDefault();
    if (!failReason) {
      setPickupError("A failure reason is required.");
      return;
    }
    if (!failNote.trim()) {
      setPickupError("A note is required for pickup failure.");
      return;
    }
    setPickupLoading(true);
    setPickupError(null);
    try {
      const res = await fetch(`/api/driver/assignments/${id}/pickup/fail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failureReason: failReason,
          note: failNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPickupError(data.error || "Could not record pickup failure.");
        return;
      }
      setWorkbench(data);
      setPickupAction("idle");
      loadAssignment();
    } catch {
      setPickupError("Network error. Please try again.");
    } finally {
      setPickupLoading(false);
    }
  }

  // ── Delivery handlers ──

  async function handleSendOtp() {
    setOtpSending(true);
    setDeliveryError(null);
    try {
      const res = await fetch(`/api/driver/assignments/${id}/delivery/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operationCommand("delivery-otp")),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) loadAssignment();
        setDeliveryError(data.error || "Could not send OTP.");
        return;
      }
      setOtpStatus(data);
      clearOperation("delivery-otp");
      setDeliveryAction("complete");
    } catch {
      setDeliveryError("Network error. Please try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleRecordLocation() {
    if (!assignment || !navigator.geolocation) {
      setDeliveryError("Location is unavailable on this device.");
      return;
    }
    setLocationRecording(true);
    setLocationStatus(null);
    setDeliveryError(null);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const capturedAt = new Date(position.timestamp).toISOString();
      const payload = {
        ...operationCommand("location-sample", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          capturedAt,
        }),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        clientCapturedAt: capturedAt,
        accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined,
        headingDegrees: position.coords.heading ?? undefined,
        speedMetersPerSecond: position.coords.speed ?? undefined,
        source: "DEVICE_GPS",
      };
      try {
        const response = await fetch(`/api/driver/assignments/${id}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          setDeliveryError(data.error || "Location evidence could not be recorded.");
          return;
        }
        clearOperation("location-sample");
        setLocationStatus(data.validationStatus === "ACCEPTED" ? "Verified location recorded." : "Location recorded with a verification warning.");
      } catch {
        setDeliveryError("Location evidence could not be recorded.");
      } finally {
        setLocationRecording(false);
      }
    }, () => {
      setLocationRecording(false);
      setDeliveryError("Location permission is required to record a location sample.");
    }, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 });
  }

  async function handleStartDelivery(e: React.FormEvent) {
    e.preventDefault();
    setDeliveryLoading(true);
    setDeliveryError(null);
    try {
      const isResume = assignment?.orderStatus === "DELIVERY_ATTEMPTED";
      const res = await fetch(`/api/driver/assignments/${id}/delivery/${isResume ? "resume" : "start"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...operationCommand(isResume ? "delivery-resume" : "delivery-start", { driverNote: deliveryStartNote }), driverNote: deliveryStartNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) loadAssignment();
        setDeliveryError(data.error || "Could not start delivery.");
        return;
      }
      setDeliveryAction("idle");
      clearOperation(isResume ? "delivery-resume" : "delivery-start");
      loadAssignment();
    } catch {
      setDeliveryError("Network error. Please try again.");
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function handleCompleteDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!deliveryConfirm) {
      setDeliveryError("You must confirm the delivery has been completed.");
      return;
    }
    if (otpCode.length !== 6) {
      setDeliveryError("OTP code must be 6 digits.");
      return;
    }
    if (!deliveryDriverNote.trim()) {
      setDeliveryError("A delivery note is required.");
      return;
    }
    setDeliveryLoading(true);
    setDeliveryError(null);
    try {
      const res = await fetch(`/api/driver/assignments/${id}/delivery/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...operationCommand("delivery-complete", { recipientName: deliveryRecipientName, recipientPhone: deliveryRecipientPhone, publicNote: deliveryPublicNote, driverNote: deliveryDriverNote }),
          otpCode,
          recipientName: deliveryRecipientName,
          recipientPhone: deliveryRecipientPhone || undefined,
          publicNote: deliveryPublicNote || undefined,
          driverNote: deliveryDriverNote,
          confirmDelivery: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) loadAssignment();
        setDeliveryError(data.error || "Could not complete delivery.");
        return;
      }
      setDeliveryAction("idle");
      clearOperation("delivery-complete");
      loadAssignment();
    } catch {
      setDeliveryError("Network error. Please try again.");
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function handleDeliveryAttempted(e: React.FormEvent) {
    e.preventDefault();
    if (!attemptReason) {
      setDeliveryError("A reason is required.");
      return;
    }
    if (!attemptDriverNote.trim()) {
      setDeliveryError("A driver note is required.");
      return;
    }
    setDeliveryLoading(true);
    setDeliveryError(null);
    try {
      const res = await fetch(`/api/driver/assignments/${id}/delivery/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...operationCommand("delivery-attempt", { reason: attemptReason, driverNote: attemptDriverNote }), reason: attemptReason, driverNote: attemptDriverNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) loadAssignment();
        setDeliveryError(data.error || "Could not record delivery attempt.");
        return;
      }
      setDeliveryAction("idle");
      clearOperation("delivery-attempt");
      loadAssignment();
    } catch {
      setDeliveryError("Network error. Please try again.");
    } finally {
      setDeliveryLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <ProtectedPageHeader eyebrow="Driver assignment" title="Loading assignment" description="Loading the source-backed assignment record." />
        <Card>
          <div className="h-40 flex items-center justify-center text-[var(--kt-text-muted)] text-sm">
            Loading assignment details…
          </div>
        </Card>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="space-y-6">
        <ProtectedPageHeader eyebrow="Driver assignment" title="Assignment unavailable" description="The record could not be loaded for this driver account." />
        <Card>
          <p className="text-sm text-[var(--kt-signal-red)]">{error || "Assignment not found."}</p>
          <Button href="/driver/assignments" variant="ghost" size="sm" className="mt-4">
            ← Back to Assignments
          </Button>
        </Card>
      </div>
    );
  }

  const isAssigned = assignment.status === "ASSIGNED";
  const isAccepted = assignment.status === "ACCEPTED";
  const pickupEligible = isPickupEligible(assignment.orderStatus, assignment.status);

  const parcelConditionOptions = Object.entries(PARCEL_CONDITION_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const failureReasonOptions = Object.entries(PICKUP_FAILURE_REASON_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const deliveryExceptionOptions = Object.entries(DELIVERY_EXCEPTION_REASON_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const isDeliveryStatus = ["PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(assignment.orderStatus);
  const isDelivered = assignment.orderStatus === "DELIVERED";

  return (
    <div className={`${styles.scope} space-y-6 max-w-2xl`}>
      <ProtectedPageHeader
        eyebrow="Driver assignment"
        title={assignment.orderNumber}
        description={`Assigned ${formatDateTime(assignment.assignedAt)}`}
        actions={
          <Button href="/driver/assignments" variant="ghost" size="sm">← Back</Button>
        }
      />

      {/* Status badges */}
      <div className="flex gap-3 flex-wrap">
        <Badge variant={assignmentBadgeVariant(assignment.status)}>
          {ASSIGNMENT_STATUS_LABELS[assignment.status]}
        </Badge>
        <Badge variant={orderStatusBadgeVariant(assignment.orderStatus)}>
          Order: {assignment.orderStatus.replace(/_/g, " ")}
        </Badge>
      </div>
      {assignment.status === "ASSIGNED" && assignment.expiresAt && (
        <p className="text-sm text-[var(--kt-text-muted)]" role="status">Offer expires {formatDateTime(assignment.expiresAt)}. Assignment version {assignment.version}.</p>
      )}

      {/* ── Actions for ASSIGNED ── */}
      {isAssigned && (
        <Card>
          <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-3">Action Required</h2>
          {actionError && (
            <div className="mb-3 p-3 rounded-xl bg-[var(--kt-signal-red)]/10 border border-[var(--kt-signal-red)]/30 text-sm text-[var(--kt-signal-red)]">
              {actionError}
            </div>
          )}
          {!showRejectForm ? (
            <div className="flex gap-3 flex-wrap">
              <Button variant="primary" onClick={handleAccept} disabled={actionLoading}>
                {actionLoading ? "Accepting…" : "Accept Assignment"}
              </Button>
              <Button variant="secondary" onClick={() => setShowRejectForm(true)} disabled={actionLoading}>
                Reject
              </Button>
            </div>
          ) : (
            <form onSubmit={handleReject} className="space-y-3">
              <div>
                <Label htmlFor="reject-reason">Rejection Reason *</Label>
                <Textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please explain why you cannot accept this delivery…"
                  rows={3}
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" variant="secondary" disabled={actionLoading}>
                  {actionLoading ? "Submitting…" : "Confirm Rejection"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setShowRejectForm(false); setActionError(null); }}
                  disabled={actionLoading}
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* ── Pickup actions for ACCEPTED + eligible order ── */}
      {isAccepted && pickupEligible && (
        <Card>
          <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-3">Pickup Actions</h2>

          {pickupError && (
            <div className="mb-3 p-3 rounded-xl bg-[var(--kt-signal-red)]/10 border border-[var(--kt-signal-red)]/30 text-sm text-[var(--kt-signal-red)]">
              {pickupError}
            </div>
          )}

          {/* Idle state — show action buttons */}
          {pickupAction === "idle" && (
            <div className="space-y-3">
              {workbench && (
                <div className="text-xs text-[var(--kt-text-muted)] bg-[var(--kt-cool-gray)] rounded-xl px-3 py-2">
                  {workbench.pickupStarted ? (
                    <span className="text-[var(--kt-signal-cobalt)] font-semibold">Pickup in progress.</span>
                  ) : (
                    <span>Ready to start pickup.</span>
                  )}
                </div>
              )}
              <div className="flex gap-3 flex-wrap">
                {(!workbench?.pickupStarted) && (
                  <Button variant="primary" onClick={() => { setPickupAction("start"); setPickupError(null); }}>
                    Start Pickup
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => { setPickupAction("complete"); setPickupError(null); }}
                >
                  Confirm Pickup
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setPickupAction("fail"); setPickupError(null); }}
                  className="text-[var(--kt-signal-red)] border-[var(--kt-signal-red)]/30 hover:bg-[var(--kt-signal-red)]/5"
                >
                  Pickup Failed
                </Button>
              </div>
            </div>
          )}

          {/* Start pickup form */}
          {pickupAction === "start" && (
            <form onSubmit={handleStartPickup} className="space-y-4">
              <div>
                <Label htmlFor="start-note">Driver Note (optional)</Label>
                <Textarea
                  id="start-note"
                  value={startNote}
                  onChange={(e) => setStartNote(e.target.value)}
                  placeholder="Any relevant notes before you head to pickup…"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" variant="primary" disabled={pickupLoading}>
                  {pickupLoading ? "Starting…" : "Confirm Start Pickup"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPickupAction("idle")} disabled={pickupLoading}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Complete pickup form */}
          {pickupAction === "complete" && (
            <form onSubmit={handleCompletePickup} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="parcel-count">Parcel Count *</Label>
                  <input
                    id="parcel-count"
                    type="number"
                    min="1"
                    max="50"
                    value={completeParcels}
                    onChange={(e) => setCompleteParcels(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--kt-soft-border)] rounded-xl bg-white text-[var(--kt-ink-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--kt-signal-cobalt)]/30"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="parcel-condition">Parcel Condition</Label>
                  <Select
                    id="parcel-condition"
                    value={completeCondition}
                    onChange={(e) => setCompleteCondition(e.target.value)}
                    options={parcelConditionOptions}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="public-note">Note for Customer (optional)</Label>
                <Textarea
                  id="public-note"
                  value={completePublicNote}
                  onChange={(e) => setCompletePublicNote(e.target.value)}
                  placeholder="e.g. Parcel collected in good condition."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="driver-note">Driver Note (internal, optional)</Label>
                <Textarea
                  id="driver-note"
                  value={completeDriverNote}
                  onChange={(e) => setCompleteDriverNote(e.target.value)}
                  placeholder="Any internal notes about the pickup…"
                  rows={2}
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={completeConfirm}
                  onChange={(e) => setCompleteConfirm(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[var(--kt-signal-cobalt)]"
                />
                <span className="text-sm font-semibold text-[var(--kt-ink-navy)] group-hover:text-[var(--kt-signal-cobalt)]">
                  I confirm the parcel has been collected.
                </span>
              </label>
              <div className="flex gap-3">
                <Button type="submit" variant="primary" disabled={pickupLoading || !completeConfirm}>
                  {pickupLoading ? "Confirming…" : "Confirm Pickup Collected"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPickupAction("idle")} disabled={pickupLoading}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Fail pickup form */}
          {pickupAction === "fail" && (
            <form onSubmit={handleFailPickup} className="space-y-4">
              <div>
                <Label htmlFor="fail-reason">Failure Reason *</Label>
                <Select
                  id="fail-reason"
                  value={failReason}
                  onChange={(e) => setFailReason(e.target.value)}
                  options={[{ value: "", label: "Select a reason…" }, ...failureReasonOptions]}
                  required
                />
              </div>
              <div>
                <Label htmlFor="fail-note">Note *</Label>
                <Textarea
                  id="fail-note"
                  value={failNote}
                  onChange={(e) => setFailNote(e.target.value)}
                  placeholder="Describe what happened and what you observed…"
                  rows={3}
                  required
                />
              </div>
              <div className="p-3 rounded-xl bg-[var(--kt-amber-wash)] border border-[var(--kt-solar-amber)]/30 text-xs text-[var(--kt-ink-navy)]">
                Pickup failure will be reviewed by KT Couriers operations. The order remains available for reassignment or reattempt.
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={pickupLoading}
                  className="border-[var(--kt-signal-red)]/40 text-[var(--kt-signal-red)] hover:bg-[var(--kt-signal-red)]/5"
                >
                  {pickupLoading ? "Submitting…" : "Record Pickup Failure"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPickupAction("idle")} disabled={pickupLoading}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* ── Delivery section ── */}
      {isAccepted && isDeliveryStatus && (
        <Card>
          <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-3">Delivery Actions</h2>

          {deliveryError && (
            <div className="mb-3 p-3 rounded-xl bg-[var(--kt-signal-red)]/10 border border-[var(--kt-signal-red)]/30 text-sm text-[var(--kt-signal-red)]">
              {deliveryError}
            </div>
          )}

          {/* Idle — choose an action */}
          {deliveryAction === "idle" && (
            <div className="space-y-3">
              {/* OTP status */}
              {otpStatus?.hasActiveOtp && (
              <div className="p-3 rounded-xl bg-[var(--kt-signal-cobalt)]/8 border border-[var(--kt-signal-cobalt)]/20 text-xs" role="status" aria-live="polite">
                  <p className="font-semibold text-[var(--kt-signal-cobalt)]">OTP sent to {otpStatus.sentToEmail}</p>
                  <p className="text-[var(--kt-text-muted)] mt-0.5">
                    {otpStatus.attemptsUsed} / {otpStatus.maxAttempts} attempts used
                  </p>
                </div>
              )}
              {locationStatus && <p className="text-xs text-[var(--kt-text-muted)]" role="status">{locationStatus}</p>}
              <div className="flex gap-3 flex-wrap">
                {assignment.orderStatus === "PICKED_UP" && (
                  <Button variant="primary" onClick={() => { setDeliveryAction("start"); setDeliveryError(null); }}>
                    Start Delivery
                  </Button>
                )}
                {(assignment.orderStatus === "IN_TRANSIT" || assignment.orderStatus === "DELIVERY_ATTEMPTED") && (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => { setDeliveryAction("send_otp"); setDeliveryError(null); }}
                    >
                      {otpStatus?.hasActiveOtp ? "Resend OTP" : "Send OTP to Recipient"}
                    </Button>
                    {otpStatus?.hasActiveOtp && (
                      <Button
                        variant="secondary"
                        onClick={() => { setDeliveryAction("complete"); setDeliveryError(null); }}
                      >
                        Enter OTP Code
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  onClick={() => { setDeliveryAction("attempted"); setDeliveryError(null); }}
                >
                  Delivery Attempted
                </Button>
                {["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(assignment.orderStatus) && (
                  <Button variant="ghost" onClick={handleRecordLocation} disabled={locationRecording}>
                    {locationRecording ? "Recording location…" : "Record Location"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Start delivery */}
          {deliveryAction === "start" && (
            <form onSubmit={handleStartDelivery} className="space-y-4">
              <p className="text-sm text-[var(--kt-text-muted)]">
                Confirm you are heading to the delivery address. The order will move to IN TRANSIT. Record a fresh verified location at the destination before completing delivery.
              </p>
              <div>
                <Label htmlFor="del-start-note">Driver Note (optional)</Label>
                <Textarea
                  id="del-start-note"
                  value={deliveryStartNote}
                  onChange={(e) => setDeliveryStartNote(e.target.value)}
                  placeholder="Any notes before starting delivery…"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" variant="primary" disabled={deliveryLoading}>
                  {deliveryLoading ? "Starting…" : "Confirm Start Delivery"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDeliveryAction("idle")} disabled={deliveryLoading}>Cancel</Button>
              </div>
            </form>
          )}

          {/* Send OTP */}
          {deliveryAction === "send_otp" && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--kt-text-muted)]">
                An OTP code will be emailed to the recipient. Give the recipient a moment to check their email, then ask them for the code.
              </p>
              {otpStatus?.hasActiveOtp && (
                <div className="p-3 rounded-xl bg-[var(--kt-amber-wash)] border border-[var(--kt-solar-amber)]/30 text-xs text-[var(--kt-ink-navy)]">
                  An OTP was already sent to{" "}
                  <span className="font-semibold">{otpStatus.sentToEmail}</span>. Resending will invalidate the old code.
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="primary" onClick={handleSendOtp} disabled={otpSending}>
                  {otpSending ? "Sending…" : otpStatus?.hasActiveOtp ? "Resend OTP" : "Send OTP Now"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDeliveryAction("idle")} disabled={otpSending}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Enter OTP and complete */}
          {deliveryAction === "complete" && (
            <form onSubmit={handleCompleteDelivery} className="space-y-4">
              <div>
                <Label htmlFor="otp-code">OTP Code from Recipient *</Label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  aria-describedby="otp-code-help"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  className="w-full px-3 py-2 text-2xl tracking-[0.5em] font-mono border border-[var(--kt-soft-border)] rounded-xl bg-white text-[var(--kt-ink-navy)] text-center focus:outline-none focus:ring-2 focus:ring-[var(--kt-signal-cobalt)]/30"
                  required
                />
                <p id="otp-code-help" className="mt-2 text-xs text-[var(--kt-text-muted)]">Paste the six-digit code supplied by the recipient. The code is sent only with this completion request and is not stored in the page.</p>
              </div>
              <div>
                <Label htmlFor="del-recipient-name">Recipient Name *</Label>
                <input
                  id="del-recipient-name"
                  type="text"
                  value={deliveryRecipientName}
                  onChange={(e) => setDeliveryRecipientName(e.target.value)}
                  placeholder="Name of person who accepted the delivery"
                  className="w-full px-3 py-2 text-sm border border-[var(--kt-soft-border)] rounded-xl bg-white text-[var(--kt-ink-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--kt-signal-cobalt)]/30"
                  required
                />
              </div>
              <div>
                <Label htmlFor="del-recipient-phone">Recipient Phone (optional)</Label>
                <input
                  id="del-recipient-phone"
                  type="tel"
                  value={deliveryRecipientPhone}
                  onChange={(e) => setDeliveryRecipientPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-sm border border-[var(--kt-soft-border)] rounded-xl bg-white text-[var(--kt-ink-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--kt-signal-cobalt)]/30"
                />
              </div>
              <div>
                <Label htmlFor="del-public-note">Note for Customer (optional)</Label>
                <Textarea
                  id="del-public-note"
                  value={deliveryPublicNote}
                  onChange={(e) => setDeliveryPublicNote(e.target.value)}
                  placeholder="e.g. Left with security desk."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="del-driver-note">Delivery Note *</Label>
                <Textarea
                  id="del-driver-note"
                  value={deliveryDriverNote}
                  onChange={(e) => setDeliveryDriverNote(e.target.value)}
                  placeholder="Record the handoff or delivery conditions."
                  rows={2}
                  required
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={deliveryConfirm}
                  onChange={(e) => setDeliveryConfirm(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[var(--kt-signal-cobalt)]"
                />
                <span className="text-sm font-semibold text-[var(--kt-ink-navy)] group-hover:text-[var(--kt-signal-cobalt)]">
                  I confirm the parcel has been delivered and the OTP code is correct.
                </span>
              </label>
              <div className="flex gap-3">
                <Button type="submit" variant="primary" disabled={deliveryLoading || !deliveryConfirm || otpCode.length !== 6 || !deliveryDriverNote.trim()}>
                  {deliveryLoading ? "Confirming…" : "Confirm Delivery"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDeliveryAction("idle")} disabled={deliveryLoading}>Cancel</Button>
              </div>
              <p className="text-xs text-[var(--kt-text-muted)]">Completion also requires a recent verified device-location sample near the delivery address. Use “Record Location” after arrival.</p>
            </form>
          )}

          {/* Record delivery attempted */}
          {deliveryAction === "attempted" && (
            <form onSubmit={handleDeliveryAttempted} className="space-y-4">
              <div>
                <Label htmlFor="attempt-reason">Reason *</Label>
                <Select
                  id="attempt-reason"
                  value={attemptReason}
                  onChange={(e) => setAttemptReason(e.target.value)}
                  options={[{ value: "", label: "Select a reason…" }, ...deliveryExceptionOptions]}
                  required
                />
              </div>
              <div>
                <Label htmlFor="attempt-note">Driver Note *</Label>
                <Textarea
                  id="attempt-note"
                  value={attemptDriverNote}
                  onChange={(e) => setAttemptDriverNote(e.target.value)}
                  placeholder="What happened and what you observed…"
                  rows={3}
                  required
                />
              </div>
              <div className="p-3 rounded-xl bg-[var(--kt-amber-wash)] border border-[var(--kt-solar-amber)]/30 text-xs text-[var(--kt-ink-navy)]">
                The order will be marked as DELIVERY ATTEMPTED. KT Couriers will review and may reschedule.
              </div>
              <div className="flex gap-3">
                <Button type="submit" variant="secondary" disabled={deliveryLoading}>
                  {deliveryLoading ? "Recording…" : "Record Delivery Attempted"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDeliveryAction("idle")} disabled={deliveryLoading}>Cancel</Button>
              </div>
            </form>
          )}

        </Card>
      )}

      {/* Delivered state */}
      {isAccepted && isDelivered && (
        <div className="p-4 rounded-2xl bg-[var(--kt-mint-wash)] border border-[var(--kt-teal-emerald)]/20">
          <p className="text-sm font-semibold text-[var(--kt-teal-emerald)]">Delivery Completed</p>
          <p className="text-xs text-[var(--kt-text-muted)] mt-1">
            This parcel has been successfully delivered and the delivery is confirmed.
          </p>
        </div>
      )}

      {isAccepted && isDeliveryStatus && (
        <Card>
          <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-2">Proof of delivery</h2>
          <p className="text-sm text-[var(--kt-text-muted)] leading-relaxed">This workflow uses the canonical delivery OTP and server confirmation. This route has no source-backed camera, signature, or proof-file upload control, so none is simulated here.</p>
        </Card>
      )}

      {/* Route details */}
      <Card>
        <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-4">Delivery Route</h2>
        <dl className="space-y-0">
          <DetailRow
            label="Pickup"
            value={
              workbench?.pickupFormattedAddress ||
              assignment.pickupFormattedAddress ||
              `${assignment.pickupLine1 || "—"}, ${assignment.pickupCity || ""}`
            }
          />
          {workbench?.pickupContactName && (
            <DetailRow
              label="Contact"
              value={`${workbench.pickupContactName}${workbench.pickupContactPhone ? ` · ${workbench.pickupContactPhone}` : ""}`}
            />
          )}
          {workbench?.pickupAccessNotes && (
            <DetailRow label="Access notes" value={workbench.pickupAccessNotes} />
          )}
          <DetailRow
            label="Dropoff"
            value={
              workbench?.dropoffFormattedAddress ||
              assignment.dropoffFormattedAddress ||
              `${assignment.dropoffLine1 || "—"}, ${assignment.dropoffCity || ""}`
            }
          />
          <DetailRow label="Distance" value={formatDistance(assignment.distanceMeters)} />
          <DetailRow label="Est. Duration" value={formatDuration(assignment.durationSeconds)} />
          {assignment.deliveryRegionName && (
            <DetailRow label="Region" value={assignment.deliveryRegionName} />
          )}
          {workbench?.parcelCount !== undefined && (
            <DetailRow label="Parcels" value={String(workbench.parcelCount)} />
          )}
          {workbench?.parcelDescription && (
            <DetailRow label="Description" value={workbench.parcelDescription} />
          )}
          {workbench?.recipientName && (
            <DetailRow label="Recipient" value={workbench.recipientName} />
          )}
        </dl>
      </Card>

      {/* Operational events (pickup history) */}
      {workbench && workbench.operationalEvents.length > 0 && (
        <Card>
          <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-4">Pickup Activity</h2>
          <ol className="space-y-3">
            {workbench.operationalEvents.map((ev, idx) => {
              const isLast = idx === workbench.operationalEvents.length - 1;
              const isFail = ev.eventType === "PICKUP_FAILED";
              const isComplete = ev.eventType === "PICKUP_COMPLETED";
              const dotColor = isFail
                ? "bg-[var(--kt-signal-red)]"
                : isComplete
                ? "bg-[var(--kt-teal-emerald)]"
                : "bg-[var(--kt-signal-cobalt)]";
              return (
                <li key={ev.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
                    {!isLast && <span className="w-px flex-1 bg-[var(--kt-soft-border)] mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-semibold text-[var(--kt-ink-navy)]">
                      {OPERATIONAL_EVENT_LABELS[ev.eventType]}
                    </p>
                    <p className="text-xs text-[var(--kt-text-muted)]">{formatDateTime(ev.occurredAt)}</p>
                    {ev.failureReasonLabel && (
                      <p className="text-xs text-[var(--kt-signal-red)] mt-0.5">
                        Reason: {ev.failureReasonLabel}
                      </p>
                    )}
                    {ev.parcelConditionLabel && ev.parcelCondition !== "NOT_RECORDED" && (
                      <p className="text-xs text-[var(--kt-text-muted)] mt-0.5">
                        Condition: {ev.parcelConditionLabel}
                      </p>
                    )}
                    {ev.publicNote && (
                      <p className="text-xs text-[var(--kt-text-muted)] mt-0.5 italic">{ev.publicNote}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {/* Assignment events */}
      {assignment.events.length > 0 && (
        <Card>
          <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-4">Assignment Activity</h2>
          <ol className="space-y-3">
            {assignment.events.map((ev, idx) => {
              const isLast = idx === assignment.events.length - 1;
              return (
                <li key={ev.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 bg-[var(--kt-signal-cobalt)]" />
                    {!isLast && <span className="w-px flex-1 bg-[var(--kt-soft-border)] mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-semibold text-[var(--kt-ink-navy)]">{ev.eventLabel}</p>
                    <p className="text-xs text-[var(--kt-text-muted)]">{formatDateTime(ev.createdAt)}</p>
                    {ev.note && <p className="text-xs text-[var(--kt-text-muted)] mt-0.5 italic">{ev.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-[var(--kt-soft-border)] last:border-0">
      <dt className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-[var(--kt-ink-navy)]">{value}</dd>
    </div>
  );
}
