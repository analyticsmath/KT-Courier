"use client";

import { useState } from "react";
import Link from "next/link";
import { DriverSelfDto } from "@/lib/dto/driver.dto";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

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
  capacityKg?: string | number | null;
  status: string;
  documents: Array<{ documentType: string; status: string; expiresAt: string | null }>;
  media?: Array<{ id: string; purpose: string; publicReference: string }>;
}

export function DriverOnboardingExperience({
  initialDriver,
  initialDocuments = [],
  initialVehicles = [],
}: {
  initialDriver: DriverSelfDto;
  initialDocuments?: DocumentRow[];
  initialVehicles?: VehicleRow[];
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
    driver.profilePhotoMediaId ? `PMO-${driver.profilePhotoMediaId}` : null
  );

  // Vehicle form state
  const [vMake, setVMake] = useState("");
  const [vModel, setVModel] = useState("");
  const [vYear, setVYear] = useState<string>("");
  const [vColour, setVColour] = useState("");
  const [vReg, setVReg] = useState("");
  const [vType, setVType] = useState("MOTORBIKE");
  const [vCapacityKg, setVCapacityKg] = useState("");

  // Status feedback
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"identity" | "documents" | "vehicles">("identity");

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
  const [vehMediaPurpose, setVehMediaPurpose] = useState<"FRONT" | "SIDE">("FRONT");
  const [vehMediaFile, setVehMediaFile] = useState<File | null>(null);
  const [uploadingVehMedia, setUploadingVehMedia] = useState(false);

  // Refresh documents
  async function refreshDocuments() {
    try {
      const res = await fetch("/api/driver/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
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
      }
    } catch {
      // non-blocking
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
          registrationNumber: vReg.trim(),
          vehicleType: vType,
          capacityKg: vCapacityKg.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to register vehicle.");
        return;
      }

      setMessage("Vehicle successfully registered in compliance roster.");
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

      setMessage(`Successfully uploaded and submitted ${selectedDocType.replace(/_/g, " ")}.`);
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

  const isProfileApproved = driver.onboardingStatus === "APPROVED";
  const approvedVehicles = vehicles.filter((v) => v.status === "APPROVED");
  const hasApprovedVehicle = approvedVehicles.length > 0;
  const hasPendingVehicle = vehicles.some((v) => v.status === "PENDING_REVIEW");
  const isDispatchEligible = isProfileApproved && hasApprovedVehicle;

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

  const dispatchStatusTone = isDispatchEligible ? "success" : "neutral";

  return (
    <div className={styles.scope}>
      <div className="space-y-6">
        {/* Status banner */}
        <OperationalPanel title="Compliance and Onboarding Status">
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
                  <span className="text-xs font-medium text-[var(--kt-text-muted)]">Dispatch:</span>
                  <ProtectedStatus
                    label={isDispatchEligible ? "ELIGIBLE" : "NOT ELIGIBLE"}
                    tone={dispatchStatusTone}
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--kt-text-muted)] mt-1">
                {isDispatchEligible
                  ? "Your driver profile and vehicle compliance have both been verified and approved. You are eligible for dispatch assignments."
                  : isProfileApproved && !hasApprovedVehicle
                  ? "Your personal profile and identity credentials are approved. However, you do not have an approved, compliant vehicle. Vehicle registration and document approval (registration, licence disc, insurance) are mandatory before dispatch activation."
                  : driver.onboardingStatus === "PENDING_REVIEW"
                  ? "Your profile and documents have been submitted. An administrator will verify your credentials shortly."
                  : driver.onboardingStatus === "REJECTED"
                  ? "Your onboarding profile requires corrections. Please review the details below and resubmit."
                  : "Complete all required steps to activate your courier delivery profile."}
              </p>
            </div>
            {isDispatchEligible && (
              <Link className="eo-driver-button eo-driver-button--primary" href="/driver">
                Go to Driver Dashboard →
              </Link>
            )}
          </div>
        </OperationalPanel>

        {/* Navigation tabs */}
        <div className="flex border-b border-[var(--kt-soft-border)] gap-2">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "identity"
                ? "border-[var(--kt-signal-cobalt)] text-[var(--kt-signal-cobalt)]"
                : "border-transparent text-[var(--kt-text-muted)] hover:text-[var(--kt-text)]"
            }`}
            onClick={() => setActiveTab("identity")}
          >
            1. Identity & Contact
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "documents"
                ? "border-[var(--kt-signal-cobalt)] text-[var(--kt-signal-cobalt)]"
                : "border-transparent text-[var(--kt-text-muted)] hover:text-[var(--kt-text)]"
            }`}
            onClick={() => setActiveTab("documents")}
          >
            2. Driver Licence & Identity Documents ({documents.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "vehicles"
                ? "border-[var(--kt-signal-cobalt)] text-[var(--kt-signal-cobalt)]"
                : "border-transparent text-[var(--kt-text-muted)] hover:text-[var(--kt-text)]"
            }`}
            onClick={() => setActiveTab("vehicles")}
          >
            3. Fleet Vehicles ({vehicles.length})
          </button>
        </div>

        {message && (
          <div className="p-3 text-xs bg-[var(--kt-mint-wash)] text-[var(--kt-teal-emerald)] rounded-xl border border-[var(--kt-teal-emerald)] font-semibold">
            {message}
          </div>
        )}
        {error && (
          <div className="p-3 text-xs bg-[var(--kt-red-soft)] text-[var(--kt-red)] rounded-xl border border-[var(--kt-red)] font-semibold">
            {error}
          </div>
        )}

        {/* Tab 1: Identity */}
        {activeTab === "identity" && (
          <OperationalPanel
            title="Step 1: Driver Legal Identity & Residence"
            description="Submit your South African National ID / passport, date of birth, residential address, and emergency contact details for verification."
          >
            <form onSubmit={handleIdentitySubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Display / Legal Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="First and Last Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="e.g. +27 82 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Identity Document Type *
                  </label>
                  <select
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
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    ID or Passport Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="13-digit SA ID or Passport"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Residential Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="Street address, suburb, city, postal code"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Driver Licence Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="e.g. 8501015099081"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Licence Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={licenseExpiryDate}
                    onChange={(e) => setLicenseExpiryDate(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Emergency Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="Contact person"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Emergency Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    placeholder="Contact phone"
                  />
                </div>

                <div className="md:col-span-2 pt-3 border-t border-[var(--kt-soft-border)]">
                  <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                    Driver Profile Photo (Headshot for Customer & Fleet Verification)
                  </label>
                  <p className="text-[11px] text-[var(--kt-text-muted)] mb-2">
                    Clear portrait photo of your face, matching your official identity document.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <input
                      type="file"
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
              description="Attach official copies of your ID / Passport and valid Driver's Licence. Documents are stored in encrypted private evidence storage."
            >
              <form onSubmit={handleDriverDocUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Document Type *
                    </label>
                    <select
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
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      Expiry Date (if applicable)
                    </label>
                    <input
                      type="date"
                      value={docExpiresAt}
                      onChange={(e) => setDocExpiresAt(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                      File (PDF, JPEG, PNG, WEBP, max 10MB) *
                    </label>
                    <input
                      type="file"
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
                      className="p-3 bg-white rounded-xl border border-[var(--kt-soft-border)] flex justify-between items-center text-xs"
                    >
                      <div>
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
                      onChange={(e) => setVType(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                    >
                      <option value="MOTORBIKE">Motorbike</option>
                      <option value="CAR">Car</option>
                      <option value="VAN">Van</option>
                      <option value="TRUCK">Truck</option>
                      <option value="BICYCLE">Bicycle</option>
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
                      min="0"
                      value={vCapacityKg}
                      onChange={(e) => setVCapacityKg(e.target.value)}
                      className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      placeholder="e.g. 30.0 for bike, 800.0 for bakkie"
                    />
                  </div>
                </div>

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
                      <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        File (PDF or Image) *
                      </label>
                      <input
                        type="file"
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
                        onChange={(e) => setVehMediaPurpose(e.target.value as "FRONT" | "SIDE")}
                        className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)]"
                      >
                        <option value="FRONT">Front View (With Number Plate)</option>
                        <option value="SIDE">Side View</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--kt-ink-navy)] mb-1">
                        Photo File (JPEG, PNG, WEBP) *
                      </label>
                      <input
                        type="file"
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
                            Type: {v.vehicleType} · {v.colour || "Color unspecified"} · Year: {v.year || "N/A"} · Capacity: {v.capacityKg ? `${v.capacityKg} kg` : "Not specified"}
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
                          {["FRONT", "SIDE"].map((purpose) => {
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

              <div className="flex justify-between pt-4 border-t border-[var(--kt-soft-border)] mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("documents")}
                  className="eo-driver-button eo-driver-button--secondary"
                >
                  ← Back to Documents
                </button>
                <Link className="eo-driver-button eo-driver-button--primary" href="/driver">
                  View Driver Home →
                </Link>
              </div>
            </OperationalPanel>
          </div>
        )}
      </div>
    </div>
  );
}
