"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/adminApi";
import type {
  AdminBannerInfo,
  BannerPage,
  BannerClickTarget,
} from "@/types/admin";
import toast from "react-hot-toast";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/admin/ui";

// ============================================================================
// Constants
// ============================================================================

const PAGE_OPTIONS: {
  value: BannerPage;
  label: string;
  pcSize: string;
  pcWidth: number;
  mobileSize?: string;
}[] = [
  { value: "SWAP", label: "Swap", pcSize: "1360 x 215", pcWidth: 1360 },
  { value: "LIQUIDITY", label: "Liquidity", pcSize: "1360 x 215", pcWidth: 1360 },
  { value: "LOCK", label: "Lock", pcSize: "670 x 205", pcWidth: 670, mobileSize: "390 x 120" },
  { value: "PORTFOLIO", label: "Portfolio", pcSize: "1360 x 215", pcWidth: 1360 },
];

const CLICK_TARGETS: { value: BannerClickTarget; label: string }[] = [
  { value: "NEW_TAB", label: "New tab" },
  { value: "CURRENT_TAB", label: "Current tab" },
];

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type))
    return "Invalid file type. Allowed: PNG, JPEG, WebP";
  if (file.size > MAX_SIZE)
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`;
  return null;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

function guessPageFromWidth(width: number): BannerPage {
  // 1360 wide -> SWAP, LIQUIDITY, or PORTFOLIO, 670 wide -> LOCK
  if (width >= 1000) return "SWAP";
  return "LOCK";
}

// ============================================================================
// Drop Zone
// ============================================================================

function DropZone({
  label,
  hint,
  preview,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  preview: string | null;
  onFile: (file: File) => void;
  onClear?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError(null);
    onFile(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ds-gray-800">{label}</p>
        {preview && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-ds-red-400 hover:text-ds-red-700 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-xs text-ds-red-400">{error}</p>}

      {preview ? (
        <div
          className="relative group cursor-pointer"
          onClick={() => ref.current?.click()}
        >
          <div className="bg-ds-background-100 rounded-lg border border-ds-gray-400 p-3 overflow-hidden">
            <img src={preview} alt={label} className="w-full h-auto rounded" />
          </div>
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-sm text-white font-medium">Replace</span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handle(f);
          }}
          onClick={() => ref.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-ds-blue-700 bg-ds-blue-700/10"
              : "border-ds-gray-400 hover:border-ds-gray-600"
          }`}
        >
          <svg className="w-8 h-8 mx-auto text-ds-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-ds-gray-700">Drop image here or click to browse</p>
          <p className="text-xs text-ds-gray-600 mt-1">{hint}</p>
        </div>
      )}

      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

// ============================================================================
// Step Indicator
// ============================================================================

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i < current
                ? "bg-ds-gray-1000 text-ds-background-100"
                : i === current
                  ? "bg-ds-gray-200 text-ds-gray-1000 ring-2 ring-ds-gray-1000"
                  : "bg-ds-gray-200 text-ds-gray-600"
            }`}
          >
            {i < current ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < total - 1 && (
            <div className={`w-12 h-0.5 ${i < current ? "bg-ds-gray-1000" : "bg-ds-gray-300"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Create Wizard
// ============================================================================

function BannerCreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1: Images & URL
  const [pcFile, setPcFile] = useState<File | null>(null);
  const [pcPreview, setPcPreview] = useState<string | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [mobilePreview, setMobilePreview] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [clickTarget, setClickTarget] = useState<BannerClickTarget>("NEW_TAB");

  // Step 2: Page & Title
  const [page, setPage] = useState<BannerPage>("SWAP");
  const [pageAutoDetected, setPageAutoDetected] = useState(false);
  const [title, setTitle] = useState("");

  // Step 3: Schedule
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPage = PAGE_OPTIONS.find((p) => p.value === page)!;
  const needsMobile = page === "LOCK";

  // Handle PC image selection + auto-detect page
  const handlePcFile = async (file: File) => {
    setPcFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPcPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const dims = await getImageDimensions(file);
    if (dims.width > 0) {
      const guessed = guessPageFromWidth(dims.width);
      setPage(guessed);
      setPageAutoDetected(true);
    }
  };

  const handleMobileFile = (file: File) => {
    setMobileFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setMobilePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Navigate steps
  const goNext = () => {
    setError(null);

    if (step === 1) {
      if (!title.trim()) {
        setError("Title is required");
        return;
      }
    }

    if (step === 2) {
      if ((startAt && !endAt) || (!startAt && endAt)) {
        setError("Both start and end times must be set, or both left empty");
        return;
      }
      if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
        setError("End time must be after start time");
        return;
      }
    }

    setStep((s) => s + 1);
  };

  const goBack = () => {
    setError(null);
    setStep((s) => s - 1);
  };

  // Save
  const handleSave = async () => {
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if ((startAt && !endAt) || (!startAt && endAt)) {
      setError("Both start and end times must be set, or both left empty");
      return;
    }
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      setError("End time must be after start time");
      return;
    }

    setIsSaving(true);
    try {
      let banner = await adminApi.createBanner({
        title,
        page,
        linkUrl: linkUrl || undefined,
        clickTarget,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
      });

      if (pcFile) {
        banner = await adminApi.uploadBannerPcImage(banner.id, pcFile);
      }
      if (mobileFile) {
        banner = await adminApi.uploadBannerMobileImage(banner.id, mobileFile);
      }

      toast.success("Banner created");
      router.replace(`/admin/banners/${banner.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create banner");
    } finally {
      setIsSaving(false);
    }
  };

  const STEP_LABELS = ["Image & URL", "Page & Title", "Schedule"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/admin/banners")}
          className="p-2 text-ds-gray-700 hover:text-ds-gray-1000 hover:bg-ds-gray-200 rounded-lg transition-colors duration-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-ds-gray-1000">Create Banner</h1>
          <p className="text-sm text-ds-gray-700">{STEP_LABELS[step]}</p>
        </div>
        <StepIndicator current={step} total={3} />
      </div>

      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 0: Image & URL */}
      {step === 0 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-6">
              <DropZone
                label="PC Banner Image"
                hint="PNG, JPEG, WebP -- Max 5MB -- Recommended: 1360x215 or 670x205"
                preview={pcPreview}
                onFile={handlePcFile}
                onClear={() => { setPcFile(null); setPcPreview(null); setPageAutoDetected(false); }}
              />

              <DropZone
                label="Mobile Banner Image (optional)"
                hint="PNG, JPEG, WebP -- Max 5MB -- Recommended: 390x120 (Lock & Vote pages)"
                preview={mobilePreview}
                onFile={handleMobileFile}
                onClear={() => { setMobileFile(null); setMobilePreview(null); }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <Input
                label="Link URL"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                hint="Optional"
              />

              {linkUrl && (
                <div>
                  <label className="text-xs font-medium text-ds-gray-800 mb-2 block">
                    Click Behavior
                  </label>
                  <div className="flex gap-4">
                    {CLICK_TARGETS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="clickTarget"
                          checked={clickTarget === opt.value}
                          onChange={() => setClickTarget(opt.value)}
                          className="accent-ds-gray-1000"
                        />
                        <span className="text-sm text-ds-gray-900">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={goNext}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Page & Title */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              {/* Page Selection */}
              <div>
                <label className="text-xs font-medium text-ds-gray-800 mb-2 block">
                  Target Page
                  {pageAutoDetected && (
                    <span className="text-ds-blue-400 font-normal ml-2 text-xs">
                      (auto-detected from image size)
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {PAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setPage(opt.value); setPageAutoDetected(false); }}
                      className={`p-4 rounded-lg border-2 text-left transition-colors duration-100 ${
                        page === opt.value
                          ? "border-ds-gray-1000 bg-ds-gray-100"
                          : "border-ds-gray-400 hover:border-ds-gray-600"
                      }`}
                    >
                      <p className="text-sm font-medium text-ds-gray-1000">{opt.label}</p>
                      <p className="text-xs text-ds-gray-700 mt-1">
                        PC: {opt.pcSize}
                        {opt.mobileSize ? ` -- Mobile: ${opt.mobileSize}` : " -- PC only"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <Input
                label="Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Banner title (admin label)"
                maxLength={200}
              />
            </CardContent>
          </Card>

          {/* Preview */}
          {pcPreview && (
            <Card>
              <CardContent>
                <p className="text-xs font-medium text-ds-gray-800 mb-3">Preview on {selectedPage.label} page</p>
                <div className="bg-ds-background-100 rounded-lg p-4 overflow-hidden">
                  <img
                    src={pcPreview}
                    alt="Preview"
                    className="w-full h-auto rounded-lg"
                    style={{ aspectRatio: selectedPage.pcSize.replace(" x ", "/") }}
                  />
                </div>
                {needsMobile && mobilePreview && (
                  <div className="mt-4">
                    <p className="text-xs text-ds-gray-700 mb-2">Mobile</p>
                    <div className="bg-ds-background-100 rounded-lg p-4 max-w-[280px] overflow-hidden">
                      <img
                        src={mobilePreview}
                        alt="Mobile preview"
                        className="w-full h-auto rounded-lg"
                        style={{ aspectRatio: selectedPage.mobileSize!.replace(" x ", "/") }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
            <Button onClick={goNext}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Schedule & Save */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ds-gray-800 mb-1 block">
                  Exposure Period
                  <span className="text-ds-gray-600 font-normal ml-1">(optional)</span>
                </label>
                <p className="text-xs text-ds-gray-600 mb-3">
                  Leave empty for always-active display.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start"
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                  <Input
                    label="End"
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-ds-gray-700">Title</span>
                <span className="text-ds-gray-1000">{title || "-"}</span>
                <span className="text-ds-gray-700">Page</span>
                <span className="text-ds-gray-1000">{selectedPage.label}</span>
                <span className="text-ds-gray-700">PC Image</span>
                <span className={pcFile ? "text-ds-green-400" : "text-ds-gray-600"}>{pcFile ? pcFile.name : "None"}</span>
                <span className="text-ds-gray-700">Mobile Image</span>
                <span className={mobileFile ? "text-ds-green-400" : "text-ds-gray-600"}>{mobileFile ? mobileFile.name : "None"}</span>
                <span className="text-ds-gray-700">Link</span>
                <span className="text-ds-gray-1000 truncate">{linkUrl || "None"}</span>
                <span className="text-ds-gray-700">Period</span>
                <span className="text-ds-gray-1000">{startAt && endAt ? "Scheduled" : "Always active"}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
            <Button
              onClick={handleSave}
              loading={isSaving}
            >
              {isSaving ? "Creating..." : "Create Banner"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Edit Page (non-wizard, all-in-one)
// ============================================================================

function BannerEditPage({ banner }: { banner: AdminBannerInfo }) {
  const router = useRouter();

  const [savedBanner, setSavedBanner] = useState(banner);
  const [title, setTitle] = useState(banner.title);
  const [linkUrl, setLinkUrl] = useState(banner.linkUrl ?? "");
  const [clickTarget, setClickTarget] = useState(banner.clickTarget);
  const [startAt, setStartAt] = useState(
    banner.startAt ? toLocalDatetime(banner.startAt) : ""
  );
  const [endAt, setEndAt] = useState(
    banner.endAt ? toLocalDatetime(banner.endAt) : ""
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPc, setIsUploadingPc] = useState(false);
  const [isUploadingMobile, setIsUploadingMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPage = PAGE_OPTIONS.find((p) => p.value === savedBanner.page)!;
  const needsMobile = savedBanner.page === "LOCK";

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError("Title is required"); return; }
    if ((startAt && !endAt) || (!startAt && endAt)) {
      setError("Both start and end times must be set, or both left empty");
      return;
    }
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      setError("End time must be after start time");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await adminApi.updateBanner(savedBanner.id, {
        title,
        linkUrl: linkUrl || undefined,
        clickTarget,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
      });
      setSavedBanner(updated);
      toast.success("Banner saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadPc = async (file: File) => {
    setIsUploadingPc(true);
    try {
      const updated = await adminApi.uploadBannerPcImage(savedBanner.id, file);
      setSavedBanner(updated);
      toast.success("PC image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingPc(false);
    }
  };

  const uploadMobile = async (file: File) => {
    setIsUploadingMobile(true);
    try {
      const updated = await adminApi.uploadBannerMobileImage(savedBanner.id, file);
      setSavedBanner(updated);
      toast.success("Mobile image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingMobile(false);
    }
  };

  const deletePc = async () => {
    try {
      const updated = await adminApi.deleteBannerPcImage(savedBanner.id);
      setSavedBanner(updated);
      toast.success("PC image removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const deleteMobile = async () => {
    try {
      const updated = await adminApi.deleteBannerMobileImage(savedBanner.id);
      setSavedBanner(updated);
      toast.success("Mobile image removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/admin/banners")}
          className="p-2 text-ds-gray-700 hover:text-ds-gray-1000 hover:bg-ds-gray-200 rounded-lg transition-colors duration-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Edit Banner</h1>
          <p className="text-sm text-ds-gray-700">
            ID: {savedBanner.id} -- {savedBanner.page} -- {savedBanner.status}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-1 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />

              <div>
                <label className="text-xs font-medium text-ds-gray-800 mb-1.5 block">
                  Target Page
                </label>
                <p className="h-9 px-3 flex items-center bg-ds-background-100 border border-ds-gray-400 rounded-md text-ds-gray-700 text-sm">
                  {selectedPage.label} — {selectedPage.pcSize}
                  {selectedPage.mobileSize ? ` / ${selectedPage.mobileSize}` : ""}
                </p>
              </div>

              <Input
                label="Link URL"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />

              <div>
                <label className="text-xs font-medium text-ds-gray-800 mb-2 block">Click Behavior</label>
                <div className="flex gap-4">
                  {CLICK_TARGETS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="clickTarget"
                        checked={clickTarget === opt.value}
                        onChange={() => setClickTarget(opt.value)}
                        className="accent-ds-gray-1000"
                      />
                      <span className="text-sm text-ds-gray-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-ds-gray-800 mb-1.5 block">
                  Exposure Period <span className="text-ds-gray-600 font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                  <Input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSave}
                loading={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Stats */}
          {savedBanner.impressions > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Impressions</p>
                    <p className="text-lg font-semibold text-ds-gray-1000 font-geist-mono">{savedBanner.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Clicks</p>
                    <p className="text-lg font-semibold text-ds-blue-400 font-geist-mono">{savedBanner.clicks.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">CTR</p>
                    <p className="text-lg font-semibold text-ds-green-400 font-geist-mono">{savedBanner.ctr}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Images & Preview */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent>
              <DropZone
                label="PC Image"
                hint={`${selectedPage.pcSize} -- PNG, JPEG, WebP -- Max 5MB`}
                preview={savedBanner.imagePcUrl}
                onFile={uploadPc}
                onClear={savedBanner.imagePcUrl ? deletePc : undefined}
              />
            </CardContent>
          </Card>

          {needsMobile && (
            <Card>
              <CardContent>
                <DropZone
                  label="Mobile Image"
                  hint={`${selectedPage.mobileSize} -- PNG, JPEG, WebP -- Max 5MB`}
                  preview={savedBanner.imageMobileUrl}
                  onFile={uploadMobile}
                  onClear={savedBanner.imageMobileUrl ? deleteMobile : undefined}
                />
              </CardContent>
            </Card>
          )}

          {savedBanner.imagePcUrl && (
            <Card>
              <CardContent>
                <p className="text-xs font-medium text-ds-gray-800 mb-3">Preview</p>
                <div className="bg-ds-background-100 rounded-lg p-4 overflow-hidden">
                  <img
                    src={savedBanner.imagePcUrl}
                    alt="Preview"
                    className="w-full h-auto rounded-lg"
                    style={{ aspectRatio: selectedPage.pcSize.replace(" x ", "/") }}
                  />
                </div>
                {needsMobile && savedBanner.imageMobileUrl && (
                  <div className="mt-4">
                    <p className="text-xs text-ds-gray-700 mb-2">Mobile</p>
                    <div className="bg-ds-background-100 rounded-lg p-4 max-w-[280px]">
                      <img
                        src={savedBanner.imageMobileUrl}
                        alt="Mobile"
                        className="w-full h-auto rounded-lg"
                        style={{ aspectRatio: selectedPage.mobileSize!.replace(" x ", "/") }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

interface BannerEditorProps {
  banner?: AdminBannerInfo;
}

export function BannerEditor({ banner }: BannerEditorProps) {
  if (banner) return <BannerEditPage banner={banner} />;
  return <BannerCreateWizard />;
}
