"use client";

import { useState } from "react";
import Link from "next/link";
import { DriverSelfDto } from "@/lib/dto/driver.dto";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";
import { FileInput } from "@/components/ui/FileInput";
import { VEHICLE_SUBTYPES, VEHICLE_SUBTYPE_LABELS, VEHICLE_TYPE_FOR_SUBTYPE, type VehicleSubtype } from "@/lib/driver-operations/vehicle-subtypes";

interface DocumentRow {
  id: string;
  documentType: string;
  status: string;
  fileName: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  privateMediaObject?: {
    publicReference: string;
    originalFileName: string;
  } | null;
}

interface VehicleRow {
  id: string;
  publicReference: string;
  make: string;
  model: string;
  year: number | null;
  colour: string | null;
  registrationNumber: string;
  vehicleType: string;
  vehicleSubtype?: string | null;
  capacityKg?: string | number | null;
  status: string;
  documents: Array<{ documentType: string; status: string; expiresAt: string | null }>;
  media?: Array<{ purpose: string }>;
}

interface RegionOption {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  province?: string | null;
}

interface AssignedRegion {
  regionId: string;
  name: string;
  slug: string;
  isPrimary: boolean;
}

interface DriverReadinessData {
  isDispatchReady: boolean;
  canBeAvailable: boolean;
  reasons: string[];
  blockers: Array<{
    key: string;
    category: string;
    message: string;
    actionLabel: string;
    actionHref: string;
  }>;
  checklist: Array<{
    key: string;
    label: string;
    description: string;
    status: string;
    detail?: string;
    actionLabel?: string;
    actionHref?: string;
  }>;
}

export function DriverOnboardingExperience({
  initialDriver,
  initialDocuments = [],
  initialVehicles = [],
  initialRegions,
  initialReadiness,
  initialTab = "identity",
}: {
  initialDriver: DriverSelfDto;
  initialDocuments?: DocumentRow[];
  initialVehicles?: VehicleRow[];
  initialRegions?: {
    allRegions: RegionOption[];
    assignedRegions: AssignedRegion[];
    primaryRegionId: string | null;
  };
  initialReadiness?: DriverReadinessData | null;
  initialTab?: "identity" | "documents" | "vehicles" | "regions";
}) {
  const [driver, setDriver] = useState(initialDriver);
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialVehicles);

  // Identity form state
  const [displayName, setDisplayName] = useState(driver.displayName ?? "");
  const [phone, setPhone] = useState(driver.phone ?? "");
  const [idNumber, setIdNumber] = useState(driver.idNumber ?? "");
  const [idType, setIdType] = useState(driver.idType ?? "RSA_ID");
  const [dateOfBirth, setDateOfBirth] = useState(
    driver.dateOfBirth ? new Date(driver.dateOfBirth).toISOString().split("T")[0] : ""
  );
  const [residentialAddress, setResidentialAddress] = useState(driver.residentialAddress ?? "");
  const [licenseNumber, setLicenseNumber] = useState(driver.licenseNumber ?? "");
  const [licenseExpiryDate, setLicenseExpiryDate] = useState(
    driver.licenseExpiryDate ? new Date(driver.licenseExpiryDate).toISOString().split("T")[0] : ""
  );
  const [emergencyContactName, setEmergencyContactName] = useState(driver.emergencyContactName ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(driver.emergencyContactPhone ?? "");

  // Profile photo state
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [profilePhotoRef, setProfilePhotoRef] = useState<string | null>(
    driver.profilePhotoMediaReference ?? null
  );

  // Vehicle form state
  const [vMake, setVMake] = useState("");
  const [vModel, setVModel] = useState("");
  const [vYear, setVYear] = useState<string>("");
  const [vColour, setVColour] = useState("");
  const [vReg, setVReg] = useState("");
  const [vType, setVType] = useState<VehicleSubtype>("MOTORCYCLE");
  const [vCapacityKg, setVCapacityKg] = useState("");
  const [vehicleFieldErrors, setVehicleFieldErrors] = useState<Record<string, string>>({});

  // Regions state
  const [regions] = useState<RegionOption[]>(initialRegions?.allRegions ?? []);
  const [assignedRegionIds, setAssignedRegionIds] = useState<string[]>(
    initialRegions?.assignedRegions.map((r) => r.regionId) ?? driver.serviceRegions.map((r) => r.regionId)
  );
  const [primaryRegionId, setPrimaryRegionId] = useState<string>(
    initialRegions?.primaryRegionId ?? driver.serviceRegions.find((r) => r.isPrimary)?.regionId ?? ""
  );
  const [savingRegions, setSavingRegions] = useState(false);
  const [regionsMessage, setRegionsMessage] = useState("");
  const [regionsError, setRegionsError] = useState("");

  // Readiness state
  const [readiness, setReadiness] = useState<DriverReadinessData | null>(initialReadiness ?? null);

  // Status feedback
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"identity" | "documents" | "vehicles" | "regions">(initialTab);

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("ID_DOCUMENT");
  const [docExpiresAt, setDocExpiresAt] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  // Vehicle document upload state
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [vehDocType, setVehDocType] = useState("REGISTRATION");
  const [vehDocFile, setVehDocFile] = useState<File | null>(null);
  const [vehDocExpiresAt, setVehDocExpiresAt] = useState("");
  const [uploadingVehDoc, setUploadingVehDoc] = useState(false);

  // Vehicle media photo upload state
  const [selectedVehicleMediaId, setSelectedVehicleMediaId] = useState("");
  const [vehMediaPurpose, setVehMediaPurpose] = useState<"FRONT" | "REAR" | "SIDE" | "INTERIOR">("FRONT");
  const [vehMediaFile, setVehMediaFile] = useState<File | null>(null);
  const [uploadingVehMedia, setUploadingVehMedia] = useState(false);

  // Refresh readiness
  async function refreshReadiness() {
    try {
      const res = await fetch("/api/driver/readiness");
      if (res.ok) {
        const data = await res.json();
        setReadiness(data);
      }
    } catch {
      // non-blocking
    }
  }

  // Refresh documents
  async function refreshDocuments() {
    try {
      const res = await fetch("/api/driver/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        await refreshReadiness();
      }
    } catch {
      // non-blocking
    }
  }

  // Refresh vehicles
  async function refreshVehicles() {
    try {
      const res = await fetch("/api/driver/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
        await refreshReadiness();
      }
    } catch {
      // non-blocking
    }
  }

  // Handle saving operating regions
  async function handleSaveRegions(e: React.FormEvent) {
    e.preventDefault();
    if (assignedRegionIds.length === 0) {
      setRegionsError("Please select at least one delivery region.");
      return;
    }
    setSavingRegions(true);
    setRegionsError("");
    setRegionsMessage("");
    try {
      const res = await fetch("/api/driver/regions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionIds: assignedRegionIds,
          primaryRegionId: primaryRegionId || assignedRegionIds[0] || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update operating regions.");
      }
      setRegionsMessage("Operating regions updated successfully.");
      await refreshReadiness();
    } catch (err) {
      setRegionsError(err instanceof Error ? err.message : "Failed to update operating regions.");
    } finally {
      setSavingRegions(false);
    }
  }

  // Handle identity & profile submit
  async function handleIdentitySubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/driver/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          phone: phone.trim(),
          idNumber: idNumber.trim(),
          idType: idType.trim() || undefined,
          dateOfBirth,
          residentialAddress: residentialAddress.trim(),
          licenseNumber: licenseNumber.trim(),
          licenseExpiryDate,
          emergencyContactName: emergencyContactName.trim(),
          emergencyContactPhone: emergencyContactPhone.trim(),
          profilePhotoMediaReference: profilePhotoRef || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Identity details could not be saved.");
        return;
      }

      setDriver(data);
      setMessage("Identity and contact details submitted successfully.");
      setActiveTab("documents");
    } catch {
      setError("Network failure while submitting identity profile.");
    } finally {
      setLoading(false);
    }
  }

  // Upload driver profile photo
  async function handleProfilePhotoUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!profilePhotoFile) {
      setError("Please select a profile photo image.");
      return;
    }
    setUploadingProfilePhoto(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", profilePhotoFile);
      formData.append("purpose", "DRIVER_PROFILE_PHOTO");

      const mediaRes = await fetch("/api/driver/private-media", {
        method: "POST",
        body: formData,
      });
      const mediaData = await mediaRes.json();
      if (!mediaRes.ok) {
        setError(mediaData.error || "Profile photo upload failed.");
        return;
      }

      const attachRes = await fetch("/api/driver/profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateMediaReference: mediaData.publicReference }),
      });
      const attachData = await attachRes.json();
      if (!attachRes.ok) {
        setError(attachData.error || "Failed to link profile photo.");
        return;
      }

      setDriver(attachData);
      setProfilePhotoRef(mediaData.publicReference);
      setProfilePhotoFile(null);
      setMessage("Driver profile photo uploaded and linked successfully.");
    } catch {
      setError("Network error while uploading profile photo.");
    } finally {
      setUploadingProfilePhoto(false);
    }
  }

  // Handle vehicle registration
  async function handleVehicleCreate(e: React.FormEvent) {
    e.preventDefault();
    setVehicleFieldErrors({});
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/driver/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: vMake.trim(),
          model: vModel.trim(),
          year: vYear ? parseInt(vYear, 10) : null,
          colour: vColour.trim() || null,
          registrationNumber: vReg.trim().toUpperCase().replace(/\s+/g, ""),
          vehicleType: VEHICLE_TYPE_FOR_SUBTYPE[vType],
          vehicleSubtype: vType,
          capacityKg: vCapacityKg.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const fieldErrors: Record<string, string> = data.fields && typeof data.fields === "object" ? data.fields : {};
        setVehicleFieldErrors(fieldErrors);
        const firstFieldError = Object.entries(fieldErrors).find(([, detail]) => typeof detail === "string");
        setError(firstFieldError ? `${firstFieldError[0]}: ${firstFieldError[1]}` : data.error || "Vehicle registration was rejected. Review the details and try again.");
        return;
      }

      if (typeof data.id === "string") {
        setSelectedVehicleId(data.id);
        setSelectedVehicleMediaId(data.id);
      }
      setMessage("Vehicle registered for review. Upload its compliance documents and vehicle photographs below.");
      setVType("MOTORCYCLE");
      setVMake("");
      setVModel("");
      setVYear("");
      setVColour("");
      setVReg("");
      setVCapacityKg("");
      await refreshVehicles();
    } catch {
      setError("Network error registering vehicle.");
    } finally {
      setLoading(false);
    }
  }

  // Handle vehicle photo media upload (Front, Side)
  async function handleVehicleMediaUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicleMediaId || !vehMediaFile) {
      setError("Please select a vehicle and photo file.");
      return;
    }

    setUploadingVehMedia(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", vehMediaFile);
      formData.append("purpose", "VEHICLE_COMPLIANCE_IMAGE");
      formData.append("vehicleId", selectedVehicleMediaId);

      const mediaRes = await fetch("/api/driver/private-media", {
        method: "POST",
        body: formData,
      });
      const mediaData = await mediaRes.json();
      if (!mediaRes.ok) {
        setError(mediaData.error || "Vehicle photo upload failed.");
        return;
      }

      const attachRes = await fetch(`/api/driver/vehicles/${selectedVehicleMediaId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: vehMediaPurpose,
          privateMediaReference: mediaData.publicReference,
        }),
      });
      const attachData = await attachRes.json();
      if (!attachRes.ok) {
        setError(attachData.error || "Vehicle photo attachment failed.");
        return;
      }

      setMessage(`Vehicle ${vehMediaPurpose.toLowerCase()} photo attached successfully.`);
      setVehMediaFile(null);
      await refreshVehicles();
    } catch {
      setError("Failed to upload vehicle photo.");
    } finally {
      setUploadingVehMedia(false);
    }
  }

  // Upload driver document
  async function handleDriverDocUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) {
      setError("Please select a file to upload.");
      return;
    }

    setUploadingDoc(true);
    setMessage("");
    setError("");

    try {
      const purpose = selectedDocType === "LICENSE" ? "DRIVER_LICENCE" : "DRIVER_IDENTITY_DOCUMENT";
      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("purpose", purpose);

      const mediaRes = await fetch("/api/driver/private-media", {
        method: "POST",
        body: formData,
      });
      const mediaData = await mediaRes.json();
      if (!mediaRes.ok) {
        setError(mediaData.error || "Private media upload failed.");
        return;
      }

      const attachRes = await fetch("/api/driver/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: selectedDocType,
          privateMediaReference: mediaData.publicReference,
          expiresAt: docExpiresAt || null,
        }),
      });
      const attachData = await attachRes.json();
      if (!attachRes.ok) {
        setError(attachData.error || "Document attachment failed.");
        return;
      }

      setMessage(attachData.status === "SUBMITTED"
        ? `Successfully uploaded and submitted ${selectedDocType.replace(/_/g, " ")}.`
        : `This evidence is already attached. Current document status: ${attachData.status}.`);
      setDocFile(null);
      setDocExpiresAt("");
      await refreshDocuments();
    } catch {
      setError("Failed to complete document upload.");
    } finally {
      setUploadingDoc(false);
    }
  }


  // Handle vehicle document upload
  async function handleVehicleDocUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicleId || !vehDocFile) {
      setError("Please select a vehicle and file.");
      return;
    }

    setUploadingVehDoc(true);
    setMessage("");
    setError("");

    try {
      const purpose =
        vehDocType === "REGISTRATION"
          ? "VEHICLE_REGISTRATION"
          : vehDocType === "LICENCE_DISC"
          ? "VEHICLE_LICENCE_DISC"
          : "VEHICLE_INSURANCE";

      const formData = new FormData();
      formData.append("file", vehDocFile);
      formData.append("purpose", purpose);
      formData.append("vehicleId", selectedVehicleId);

      const mediaRes = await fetch("/api/driver/private-media", {
        method: "POST",
        body: formData,
      });
      const mediaData = await mediaRes.json();
      if (!mediaRes.ok) {
        setError(mediaData.error || "Vehicle document upload failed.");
        return;
      }

      const attachRes = await fetch(`/api/driver/vehicles/${selectedVehicleId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: vehDocType,
          privateMediaReference: mediaData.publicReference,
          expiresAt: vehDocExpiresAt || null,
        }),
      });
      const attachData = await attachRes.json();
      if (!attachRes.ok) {
        setError(attachData.error || "Vehicle document attachment failed.");
        return;
      }

      setMessage(`Vehicle ${vehDocType.replace(/_/g, " ")} attached successfully.`);
      setVehDocFile(null);
      setVehDocExpiresAt("");
      await refreshVehicles();
    } catch {
      setError("Failed to upload vehicle document.");
    } finally {
      setUploadingVehDoc(false);
    }
  }

  const approvedVehicles = vehicles.filter((v) => v.status === "APPROVED");
  const hasApprovedVehicle = approvedVehicles.length > 0;
  const hasPendingVehicle = vehicles.some((v) => v.status === "PENDING_REVIEW");

  const profileStatusTone =
    driver.onboardingStatus === "APPROVED"
      ? "success"
      : driver.onboardingStatus === "PENDING_REVIEW"
      ? "warning"
      : driver.onboardingStatus === "REJECTED"
      ? "danger"
      : "neutral";

  const vehicleStatusTone = hasApprovedVehicle
    ? "success"
    : hasPendingVehicle
    ? "warning"
    : vehicles.length > 0
    ? "danger"
    : "neutral";

  const isProfilePending = driver.onboardingStatus === "PENDING_REVIEW" || driver.status === "PENDING_REVIEW";

  return (
    <div className={styles.scope}>
      <div className="space-y-6">
        {/* Status banner */}
        <OperationalPanel title="Compliance and Onboarding Status">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-[var(--kt-ink-navy)]">
                    {driver.displayName || "Courier Driver"} ({driver.driverCode})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-[var(--kt-text-muted)]">Profile:</span>
                    <ProtectedStatus
                      label={driver.onboardingStatus.replace(/_/g, " ")}
                      tone={profileStatusTone}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-[var(--kt-text-muted)]">Vehicle:</span>
                    <ProtectedStatus
                      label={
                        hasApprovedVehicle
                          ? "APPROVED"
                          : hasPendingVehicle
                          ? "PENDING REVIEW"
                          : vehicles.length > 0
                          ? "ACTION REQUIRED"
                          : "NO VEHICLE"
                      }
                      tone={vehicleStatusTone}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-[var(--kt-text-muted)]">Operating Regions:</span>
                    <ProtectedStatus
                      label={assignedRegionIds.length > 0 ? `${assignedRegionIds.length} ASSIGNED` : "NONE"}
                      tone={assignedRegionIds.length > 0 ? "success" : "danger"}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-[var(--kt-text-muted)]">Dispatch:</span>
                    <ProtectedStatus
                      label={readiness?.isDispatchReady ? "DISPATCH READY" : readiness?.canBeAvailable ? "ONLINE ACTION REQUIRED" : "NOT READY"}
                      tone={readiness?.isDispatchReady ? "success" : readiness?.canBeAvailable ? "information" : "warning"}
                    />
                  </div>
                </div>
                {isProfilePending && (
                  <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-medium mt-2">
                    Your profile is awaiting administrator review. Check the document and vehicle sections below for any outstanding requirements.
                  </div>
                )}
                <p className="text-xs text-[var(--kt-text-muted)] mt-1">
                  {readiness?.isDispatchReady
                    ? "Your driver profile, identity, licence, vehicle compliance, and delivery regions are verified. You are active and eligible for dispatch offers."
                    : readiness && readiness.blockers.length > 0
                    ? `Dispatch readiness incomplete: ${readiness.blockers.length} requirement(s) must be satisfied before orders can be offered.`
                    : "Complete all required steps to activate your courier delivery profile."}
                </p>
              </div>
              {readiness?.isDispatchReady && (
                <Link className="eo-driver-button eo-driver-button--primary" href="/driver">
                  Go to Driver Dashboard →
                </Link>
              )}
            </div>

            {/* Authoritative Readiness Checklist */}
            {readiness?.checklist && (
              <div className="pt-3 border-t border-[var(--kt-soft-border)]">
                <span className="block text-xs font-bold uppercase tracking-wider text-[var(--kt-ink-navy)] mb-2.5">
                  Readiness & Compliance Checklist ({readiness.checklist.filter((c) => c.status === "COMPLETED").length}/{readiness.checklist.length} verified)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {readiness.checklist.map((item) => {
                    const isDone = item.status === "COMPLETED";
                    const isPending = item.status === "PENDING_REVIEW";
                    const isExpired = item.status === "EXPIRED";
                    const isRejected = item.status === "REJECTED";
                    const tone: "success" | "warning" | "danger" | "neutral" = isDone
                      ? "success"
                      : isPending
                      ? "warning"
                      : isExpired || isRejected
                      ? "danger"
                      : "neutral";

                    const targetTab =
                      item.key === "IDENTITY_DOCUMENT" || item.key === "DRIVING_LICENCE"
                        ? "documents"
                        : item.key === "COMPLIANT_VEHICLE"
                        ? "vehicles"
                        : item.key === "SERVICE_REGIONS"
                        ? "regions"
                        : item.key === "DRIVER_PROFILE" || item.key === "USER_ACCOUNT"
                        ? "identity"
                        : null;

                    return (
                      <div
                        key={item.key}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 ${
                          isDone
                            ? "bg-[var(--kt-mint-wash)]/30 border-[var(--kt-teal-emerald)]/30"
                            : isPending
                            ? "bg-amber-50/50 border-amber-200"
                            : "bg-[var(--kt-cool-gray)]/50 border-[var(--kt-soft-border)]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-[var(--kt-ink-navy)] truncate">
                              {item.label}
                            </span>
                            <ProtectedStatus label={item.status} tone={tone} />
                          </div>
                          {item.detail && (
                            <p className="text-[11px] text-[var(--kt-text-muted)] mt-1 truncate" title={item.detail}>
                              {item.detail}
                            </p>
                          )}
                        </div>
                        {!isDone && targetTab && (
                          <button
                            type="button"
                            onClick={() => setActiveTab(targetTab)}
                            className="text-[11px] font-semibold text-[var(--kt-signal-cobalt)]  text-left mt-1"
                          >
                            Resolve in {targetTab} →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </OperationalPanel>

        {/* Navigation tabs */}
        <div className="eo-driver-onboarding-nav flex flex-wrap border-b border-[var(--kt-soft-border)] gap-2" role="group" aria-label="Onboarding steps">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "identity"
                ? "border-[var(--kt-signal-cobalt)] text-[var(--kt-signal-cobalt)]"
                : "border-transparent text-[var(--kt-text-muted)] "
            }`}
            onClick={() => setActiveTab("identity")}
            aria-pressed={activeTab === "identity"}
          >
            1. Identity & Contact
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "documents"
                ? "border-[var(--kt-signal-cobalt)] text-[var(--kt-signal-cobalt)]"
                : "border-transparent text-[var(--kt-text-muted)] "
            }`}
            onClick={() => setActiveTab("documents")}
            aria-pressed={activeTab === "documents"}
          >
            2. Driver Licence & Identity Documents ({documents.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "vehicles"
                ? "border-[var(--kt-signal-cobalt)] text-[var(--kt-signal-cobalt)]"
                : "border-transparent text-[var(--kt-text-muted)] "
            }`}
            onClick={() => setActiveTab("vehicles")}
            aria-pressed={activeTab === "vehicles"}
          >
            3. Fleet Vehicles ({vehicles.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "regions"
                ? "border-[var(--kt-signal-cobalt)] text-[var(--kt-signal-cobalt)]"
                : "border-transparent text-[var(--kt-text-muted)] "
            }`}
            onClick={() => setActiveTab("regions")}
            aria-pressed={activeTab === "regions"}
          >
            4. Operating Regions ({assignedRegionIds.length})
          </button>
        </div>

        {message && (
          <div role="status" aria-live="polite" className="p-3 text-xs bg-[var(--kt-mint-wash)] text-[var(--kt-teal-emerald)] rounded-xl border border-[var(--kt-teal-emerald)] font-semibold">
            {message}
          </div>
        )}
        {error && (
          <div id="driver-onboarding-error" role="alert" className="p-3 text-xs bg-[var(--kt-red-soft)] text-[var(--kt-red)] rounded-xl border border-[var(--kt-red)] font-semibold">
            {error}
          </div>
        )}

        {/* Tab 1: Identity */}
        {activeTab === "identity" && (
          <OperationalPanel
            title="Step 1: Driver Legal Identity & Residence"
            description="Submit your South African National ID / passport, date of birth, residential address, and emergency contact details for verification."
          >
            <form aria-label="Driver identity and contact" aria-describedby={error ? "driver-onboarding-error" : undefined} onSubmit={handleIdentitySubmit} className="eo-driver-identity-form space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="onboarding-display-name" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Display / Legal Full Name *
                  </label>
                  <input
                    id="onboarding-display-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="First and Last Name"
                  />
                </div>

                <div>
                  <label htmlFor="onboarding-phone" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Phone Number *
                  </label>
                  <input
                    id="onboarding-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="e.g. +27 82 123 4567"
                  />
                </div>

                <div>
                  <label htmlFor="onboarding-id-type" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Identity Document Type *
                  </label>
                  <select
                    id="onboarding-id-type"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                  >
                    <option value="RSA_ID">South African National ID</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="FOREIGN_ID">Foreign ID / Asylum Permit</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="onboarding-id-number" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    ID or Passport Number *
                  </label>
                  <input
                    id="onboarding-id-number"
                    type="text"
                    required
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="13-digit SA ID or Passport"
                  />
                </div>

                <div>
                  <label htmlFor="onboarding-date-of-birth" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Date of Birth *
                  </label>
                  <input
                    id="onboarding-date-of-birth"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="onboarding-address" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Residential Address *
                  </label>
                  <input
                    id="onboarding-address"
                    type="text"
                    required
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="Street address, suburb, city, postal code"
                  />
                </div>

                <div>
                  <label htmlFor="onboarding-licence-number" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Driver Licence Number *
                  </label>
                  <input
                    id="onboarding-licence-number"
                    type="text"
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="e.g. 8501015099081"
                  />
                </div>

                <div>
                  <label htmlFor="onboarding-licence-expiry" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Licence Expiry Date *
                  </label>
                  <input
                    id="onboarding-licence-expiry"
                    type="date"
                    required
                    value={licenseExpiryDate}
                    onChange={(e) => setLicenseExpiryDate(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                  />
                </div>

                <div>
                  <label htmlFor="onboarding-emergency-name" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Emergency Contact Name *
                  </label>
                  <input
                    id="onboarding-emergency-name"
                    type="text"
                    required
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="Contact person"
                  />
                </div>

                <div>
                  <label htmlFor="onboarding-emergency-phone" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Emergency Contact Phone *
                  </label>
                  <input
                    id="onboarding-emergency-phone"
                    type="tel"
                    required
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="Contact phone"
                  />
                </div>

                <div className="md:col-span-2 pt-3 border-t border-[var(--kt-soft-border)]">
                  <label htmlFor="driver-profile-photo" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Driver Profile Photo (Headshot for Customer & Fleet Verification)
                  </label>
                  <p className="text-[11px] text-[var(--kt-text-muted)] mb-2">
                    Clear portrait photo of your face, matching your official identity document.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <FileInput
                      id="driver-profile-photo"
                      disabled={uploadingProfilePhoto}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setProfilePhotoFile(e.target.files?.[0] ?? null)}
                      className="text-xs rounded-xl border border-[var(--kt-soft-border)] px-3 py-1.5 bg-white text-[var(--kt-text)]"
                    />
                    <button
                      type="button"
                      disabled={uploadingProfilePhoto || !profilePhotoFile}
                      onClick={handleProfilePhotoUpload}
                      className="eo-driver-button eo-driver-button--secondary text-xs"
                    >
                      {uploadingProfilePhoto ? "Uploading photo..." : profilePhotoRef ? "✓ Photo Attached (Update)" : "Upload Photo"}
                    </button>
                    {profilePhotoRef && (
                      <span className="text-xs text-emerald-600 font-bold">
                        ✓ Profile photo attached
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-[var(--kt-soft-border)]">
                <button
                  type="submit"
                  disabled={loading}
                  className="eo-driver-button eo-driver-button--primary"
                >
                  {loading ? "Saving identity..." : "Save and Proceed to Documents →"}
                </button>
              </div>
            </form>
          </OperationalPanel>
        )}

        {/* Tab 2: Documents */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <OperationalPanel
              title="Step 2: Upload Driver Identity & Licence Documents"
              description="Attach official copies of your ID / Passport and valid Driver's Licence. Documents remain private and require authorized access."
            >
              <form onSubmit={handleDriverDocUpload} className="space-y-4" aria-label="Driver document upload">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="driver-document-type" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Document Type *
                    </label>
                    <select
                      id="driver-document-type"
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    >
                      <option value="ID_DOCUMENT">National ID / Passport</option>
                      <option value="LICENSE">Driver Licence</option>
                      <option value="PROOF_OF_ADDRESS">Proof of Address</option>
                      <option value="OTHER">Other Compliance Certificate</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="driver-document-expiry" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Expiry Date (if applicable)
                    </label>
                    <input
                      id="driver-document-expiry"
                      type="date"
                      value={docExpiresAt}
                      onChange={(e) => setDocExpiresAt(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    />
                  </div>

                  <div>
                    <label htmlFor="driver-document-file" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      File (PDF, JPEG, PNG, WEBP, max 10MB) *
                    </label>
                    <FileInput
                      id="driver-document-file"
                      disabled={uploadingDoc}
                      required
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                      className="w-full text-xs rounded-xl border border-[var(--kt-soft-border)] px-2 py-1.5 bg-white text-[var(--kt-text)]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={uploadingDoc || !docFile}
                    className="eo-driver-button eo-driver-button--primary"
                  >
                    {uploadingDoc ? "Uploading Document..." : "Upload Document"}
                  </button>
                </div>
              </form>
            </OperationalPanel>

            <OperationalPanel title="Uploaded Driver Documents">
              {documents.length === 0 ? (
                <p className="text-xs text-[var(--kt-text-muted)] italic">
                  No documents uploaded yet. Please upload both your ID document and Driver Licence.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-white rounded-xl border border-[var(--kt-soft-border)] flex flex-wrap gap-2 justify-between items-center text-xs"
                    >
                      <div className="min-w-0 break-words">
                        <span className="font-bold text-[var(--kt-ink-navy)] block">
                          {doc.documentType.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-[var(--kt-text-muted)] block">
                          {doc.fileName || "Uploaded file"}
                        </span>
                        {doc.expiresAt && (
                          <span className="text-[10px] text-[var(--kt-text-muted)]">
                            Expires: {new Date(doc.expiresAt).toLocaleDateString("en-ZA")}
                          </span>
                        )}
                        {doc.rejectionReason && (
                          <span className="text-[10px] text-red-600 font-semibold block mt-0.5">
                            Reason: {doc.rejectionReason}
                          </span>
                        )}
                      </div>
                      <ProtectedStatus
                        label={doc.status}
                        className="shrink-0 whitespace-nowrap"
                        tone={
                          doc.status === "APPROVED"
                            ? "success"
                            : doc.status === "REJECTED"
                            ? "danger"
                            : "warning"
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-[var(--kt-soft-border)] mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("identity")}
                  className="eo-driver-button eo-driver-button--secondary"
                >
                  ← Back to Identity
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("vehicles")}
                  className="eo-driver-button eo-driver-button--primary"
                >
                  Proceed to Vehicles →
                </button>
              </div>
            </OperationalPanel>
          </div>
        )}

        {/* Tab 3: Vehicles */}
        {activeTab === "vehicles" && (
          <div className="space-y-6">
            <OperationalPanel
              title="Step 3: Fleet Vehicle Registration"
              description="Register the vehicle(s) you will operate for deliveries. Each vehicle must have approved registration, licence disc, and insurance documentation."
            >
              <form onSubmit={handleVehicleCreate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Vehicle Type *
                    </label>
                    <select
                      value={vType}
                      onChange={(e) => setVType(e.target.value as VehicleSubtype)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      aria-invalid={Boolean(vehicleFieldErrors.vehicleType || vehicleFieldErrors.vehicleSubtype)}
                    >
                      {VEHICLE_SUBTYPES.map(type => <option key={type} value={type}>{VEHICLE_SUBTYPE_LABELS[type]}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Make *
                    </label>
                    <input
                      type="text"
                      required
                      value={vMake}
                      onChange={(e) => setVMake(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      placeholder="e.g. Honda"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Model *
                    </label>
                    <input
                      type="text"
                      required
                      value={vModel}
                      onChange={(e) => setVModel(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      placeholder="e.g. NC750X"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Year
                    </label>
                    <input
                      type="number"
                      value={vYear}
                      onChange={(e) => setVYear(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      placeholder="e.g. 2022"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Colour
                    </label>
                    <input
                      type="text"
                      value={vColour}
                      onChange={(e) => setVColour(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      placeholder="e.g. Black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Registration / Plate *
                    </label>
                    <input
                      type="text"
                      required
                      value={vReg}
                      minLength={2}
                      maxLength={20}
                      aria-invalid={Boolean(vehicleFieldErrors.registrationNumber)}
                      onChange={(e) => setVReg(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      placeholder="e.g. CA 123-456"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Cargo Capacity (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.001"
                      max="99999999"
                      value={vCapacityKg}
                      onChange={(e) => setVCapacityKg(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      placeholder="e.g. 30.0 for bike, 800.0 for bakkie"
                    />
                  </div>
                </div>

                <p className="text-xs text-[var(--kt-text-muted)]">Choose the vehicle category stated in your registration records. The plate, licence disc, registration certificate, insurance evidence and vehicle photographs are reviewed separately before dispatch.</p>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="eo-driver-button eo-driver-button--secondary"
                  >
                    {loading ? "Registering..." : "+ Register Vehicle"}
                  </button>
                </div>
              </form>
            </OperationalPanel>

            {vehicles.length > 0 && (
              <>
                <OperationalPanel
                title="Upload Vehicle Compliance Documents"
                description="Upload registration, licence disc, and insurance certificates for your registered vehicles."
              >
                <form onSubmit={handleVehicleDocUpload} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        Select Vehicle *
                      </label>
                      <select
                        required
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      >
                        <option value="">-- Choose Vehicle --</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.make} {v.model} ({v.registrationNumber})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        Document Type *
                      </label>
                      <select
                        value={vehDocType}
                        onChange={(e) => setVehDocType(e.target.value)}
                        className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      >
                        <option value="REGISTRATION">Registration Certificate</option>
                        <option value="LICENCE_DISC">Vehicle Licence Disc</option>
                        <option value="INSURANCE">Insurance Certificate</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={vehDocExpiresAt}
                        onChange={(e) => setVehDocExpiresAt(e.target.value)}
                        className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      />
                    </div>

                    <div>
                      <label htmlFor="vehicle-document-file" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        File (PDF or Image) *
                      </label>
                      <FileInput
                        id="vehicle-document-file"
                        disabled={uploadingVehDoc}
                        required
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => setVehDocFile(e.target.files?.[0] ?? null)}
                        className="w-full text-xs rounded-xl border border-[var(--kt-soft-border)] px-2 py-1.5 bg-white text-[var(--kt-text)]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={uploadingVehDoc || !vehDocFile || !selectedVehicleId}
                      className="eo-driver-button eo-driver-button--primary"
                    >
                      {uploadingVehDoc ? "Uploading..." : "Upload Vehicle Document"}
                    </button>
                  </div>
                </form>
              </OperationalPanel>
              <OperationalPanel
                title="Upload Vehicle Photos (Front & Side Views)"
                description="Upload clear photographs showing the front (including number plate) and side of your vehicle."
              >
                <form onSubmit={handleVehicleMediaUpload} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        Select Vehicle *
                      </label>
                      <select
                        required
                        value={selectedVehicleMediaId}
                        onChange={(e) => setSelectedVehicleMediaId(e.target.value)}
                        className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      >
                        <option value="">-- Choose Vehicle --</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.make} {v.model} ({v.registrationNumber})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        Photo Angle *
                      </label>
                      <select
                        value={vehMediaPurpose}
                        onChange={(e) => setVehMediaPurpose(e.target.value as "FRONT" | "REAR" | "SIDE" | "INTERIOR")}
                        className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      >
                        <option value="FRONT">Front View (With Number Plate)</option>
                        <option value="REAR">Rear View</option>
                        <option value="SIDE">Side View</option>
                        <option value="INTERIOR">Interior (where applicable)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="vehicle-photo-file" className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        Photo File (JPEG, PNG, WEBP) *
                      </label>
                      <FileInput
                        id="vehicle-photo-file"
                        disabled={uploadingVehMedia}
                        required
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setVehMediaFile(e.target.files?.[0] ?? null)}
                        className="w-full text-xs rounded-xl border border-[var(--kt-soft-border)] px-2 py-1.5 bg-white text-[var(--kt-text)]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={uploadingVehMedia || !vehMediaFile || !selectedVehicleMediaId}
                      className="eo-driver-button eo-driver-button--primary"
                    >
                      {uploadingVehMedia ? "Uploading photo..." : "Upload Vehicle Photo"}
                    </button>
                  </div>
                </form>
              </OperationalPanel>
              </>
            )}

            <OperationalPanel title="Registered Fleet Vehicles">
              {vehicles.length === 0 ? (
                <p className="text-xs text-[var(--kt-text-muted)] italic">
                  No vehicles registered yet. Register your vehicle above to complete compliance.
                </p>
              ) : (
                <div className="space-y-3">
                  {vehicles.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 bg-white rounded-xl border border-[var(--kt-soft-border)] space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-[var(--kt-ink-navy)]">
                            {v.make} {v.model} ({v.registrationNumber})
                          </span>
                          <span className="text-[11px] text-[var(--kt-text-muted)] block">
                            Type: {v.vehicleSubtype ? v.vehicleSubtype.replaceAll("_", " ") : v.vehicleType} · {v.colour || "Color unspecified"} · Year: {v.year || "N/A"} · Capacity: {v.capacityKg ? `${v.capacityKg} kg` : "Not specified"}
                          </span>
                        </div>
                        <ProtectedStatus
                          label={v.status}
                          tone={
                            v.status === "APPROVED"
                              ? "success"
                              : v.status === "REJECTED"
                              ? "danger"
                              : "warning"
                          }
                        />
                      </div>

                      <div className="pt-2 border-t border-[var(--kt-soft-border)]">
                        <span className="text-[10px] font-bold text-[var(--kt-text-muted)] uppercase tracking-wider block mb-1">
                          Vehicle Documents & Compliance Media:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {["REGISTRATION", "LICENCE_DISC", "INSURANCE"].map((type) => {
                            const d = v.documents?.find((doc) => doc.documentType === type);
                            return (
                              <div
                                key={type}
                                className="px-2 py-1 rounded bg-[var(--kt-cool-gray)] text-[10px] flex items-center gap-1.5"
                              >
                                <span className="font-medium text-[var(--kt-ink-navy)]">
                                  {type.replace(/_/g, " ")}:
                                </span>
                                <span
                                  className={`font-bold ${
                                    d?.status === "APPROVED"
                                      ? "text-emerald-600"
                                      : d?.status === "REJECTED"
                                      ? "text-red-600"
                                      : d
                                      ? "text-amber-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {d ? d.status : "MISSING"}
                                </span>
                              </div>
                            );
                          })}
                          {["FRONT", "REAR", "SIDE", "INTERIOR"].map((purpose) => {
                            const m = v.media?.find((med) => med.purpose === purpose);
                            return (
                              <div
                                key={purpose}
                                className="px-2 py-1 rounded bg-[var(--kt-cool-gray)] text-[10px] flex items-center gap-1.5"
                              >
                                <span className="font-medium text-[var(--kt-ink-navy)]">
                                  Photo {purpose.toLowerCase()}:
                                </span>
                                <span
                                  className={`font-bold ${
                                    m ? "text-emerald-600" : "text-gray-400"
                                  }`}
                                >
                                  {m ? "ATTACHED" : "MISSING"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-[var(--kt-soft-border)] mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("documents")}
                  className="eo-driver-button eo-driver-button--secondary"
                >
                  ← Back to Documents
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("regions")}
                    className="eo-driver-button eo-driver-button--primary"
                  >
                    Next: Operating Regions →
                  </button>
                </div>
              </div>
            </OperationalPanel>
          </div>
        )}

        {/* Tab 4: Operating Regions */}
        {activeTab === "regions" && (
          <div className="space-y-6">
            <OperationalPanel
              title="Step 4: Operating Delivery Regions"
              description="Select the coverage areas where you are available to collect and deliver orders. Choose your primary region where you spend most of your operational hours."
            >
              <form onSubmit={handleSaveRegions} className="space-y-5">
                {regionsMessage && (
                  <div role="status" className="p-3 text-xs bg-[var(--kt-mint-wash)] text-[var(--kt-teal-emerald)] rounded-xl border border-[var(--kt-teal-emerald)] font-semibold">
                    {regionsMessage}
                  </div>
                )}
                {regionsError && (
                  <div role="alert" className="p-3 text-xs bg-[var(--kt-red-soft)] text-[var(--kt-red)] rounded-xl border border-[var(--kt-red)] font-semibold">
                    {regionsError}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--kt-ink-navy)]">
                      Available Delivery Regions ({assignedRegionIds.length} selected)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = regions.map((r) => r.id);
                          setAssignedRegionIds(allIds);
                          if (!primaryRegionId && allIds.length > 0) setPrimaryRegionId(allIds[0]);
                        }}
                        className="text-xs font-semibold text-[var(--kt-signal-cobalt)] "
                      >
                        Select all
                      </button>
                      <span className="text-xs text-[var(--kt-soft-border)]">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignedRegionIds([]);
                          setPrimaryRegionId("");
                        }}
                        className="text-xs font-semibold text-[var(--kt-text-muted)] "
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {regions.length === 0 ? (
                    <p className="text-sm text-[var(--kt-text-muted)] py-4 text-center">
                      No active delivery regions configured in the system.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {regions.map((reg) => {
                        const isChecked = assignedRegionIds.includes(reg.id);
                        const isPrimary = primaryRegionId === reg.id;
                        return (
                          <div
                            key={reg.id}
                            className={`p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                              isChecked
                                ? "bg-[var(--kt-mint-wash)]/20 border-[var(--kt-signal-cobalt)]"
                                : "bg-white border-[var(--kt-soft-border)]"
                            }`}
                          >
                            <label className="flex items-start gap-3 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const next = [...assignedRegionIds, reg.id];
                                    setAssignedRegionIds(next);
                                    if (!primaryRegionId) setPrimaryRegionId(reg.id);
                                  } else {
                                    const next = assignedRegionIds.filter((id) => id !== reg.id);
                                    setAssignedRegionIds(next);
                                    if (primaryRegionId === reg.id) {
                                      setPrimaryRegionId(next[0] ?? "");
                                    }
                                  }
                                }}
                                className="mt-1 h-4 w-4 rounded border-[var(--kt-soft-border)] text-[var(--kt-signal-cobalt)]"
                              />
                              <div>
                                <span className="text-sm font-bold text-[var(--kt-ink-navy)] block">
                                  {reg.name}
                                </span>
                                {(reg.city || reg.province) && (
                                  <span className="text-xs text-[var(--kt-text-muted)] block">
                                    {[reg.city, reg.province].filter(Boolean).join(", ")}
                                  </span>
                                )}
                              </div>
                            </label>

                            {isChecked && (
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[var(--kt-ink-navy)] whitespace-nowrap pt-1">
                                <input
                                  type="radio"
                                  name="primaryRegion"
                                  checked={isPrimary}
                                  onChange={() => setPrimaryRegionId(reg.id)}
                                  className="h-3.5 w-3.5 text-[var(--kt-signal-cobalt)]"
                                />
                                <span>Primary</span>
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[var(--kt-soft-border)]">
                  <button
                    type="button"
                    onClick={() => setActiveTab("vehicles")}
                    className="eo-driver-button eo-driver-button--secondary"
                  >
                    ← Back to Vehicles
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingRegions || assignedRegionIds.length === 0}
                      className="eo-driver-button eo-driver-button--primary"
                    >
                      {savingRegions ? "Saving..." : "Save Operating Regions"}
                    </button>
                    <Link className="eo-driver-button eo-driver-button--secondary" href="/driver">
                      Driver Home →
                    </Link>
                  </div>
                </div>
              </form>
            </OperationalPanel>
          </div>
        )}
      </div>
    </div>
  );
}
