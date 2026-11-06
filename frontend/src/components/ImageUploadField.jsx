import { useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import client, { cloudinaryUrl } from "../api/client";
import { getCroppedBlob } from "../lib/imageCrop.js";
import { Button } from "./admin/Kit.jsx";

/**
 * Admin photo picker: a drop zone ("Drop a photo here, or browse") when
 * empty; a large preview with Replace (and optional Remove) once set.
 *
 * props: value (publicId|null), onChange(publicId|null), folder?
 * aspect?: a number (e.g. 1 for square) requires a crop step before upload;
 *   omit it to upload immediately (e.g. delivery-proof photos).
 * removable?: show "Remove" (calls onChange(null)) -- only where the photo
 *   is optional.
 * hint?: one short line under the drop zone, e.g. "Square, at least 800px".
 */
export default function ImageUploadField({ value, onChange, folder, aspect, removable = false, hint }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [cropFile, setCropFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const cropImageSrc = useMemo(() => (cropFile ? URL.createObjectURL(cropFile) : null), [cropFile]);

  const uploadFile = async (fileOrBlob, filename) => {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", fileOrBlob, filename);
      if (folder) formData.append("folder", folder);
      const { data } = await client.post("/admin/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(data.public_id);
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed -- please try again.");
    } finally {
      setUploading(false);
    }
  };

  const takeFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image -- choose a JPG, PNG or WebP.");
      return;
    }
    setError(null);
    if (aspect) {
      setCropFile(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } else {
      uploadFile(file, file.name);
    }
  };

  const resetInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const browse = () => fileInputRef.current?.click();

  const confirmCrop = async () => {
    if (!croppedAreaPixels || !cropImageSrc) return;
    const blob = await getCroppedBlob(cropImageSrc, croppedAreaPixels);
    await uploadFile(blob, "image.jpg");
    setCropFile(null);
    resetInput();
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        takeFile(e.target.files[0]);
        if (!aspect) resetInput();
      }}
    />
  );

  if (cropFile) {
    return (
      <div className="flex flex-col gap-3 max-w-md">
        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-ink/5">
          <Cropper
            image={cropImageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-ink/70">
          Zoom
          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-blue" />
        </label>
        <div className="flex gap-2">
          <Button variant="primary" onClick={confirmCrop} disabled={uploading}>
            {uploading ? "Uploading…" : "Use this crop"}
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setCropFile(null);
              resetInput();
            }}
          >
            Cancel
          </Button>
        </div>
        {error && <p className="text-sm text-orange-700">{error}</p>}
      </div>
    );
  }

  const previewUrl = value ? cloudinaryUrl(value, { width: 400 }) : null;

  if (previewUrl) {
    return (
      <div className="flex flex-wrap items-center gap-5">
        {fileInput}
        <img src={previewUrl} alt="" className="w-32 h-32 object-cover rounded-lg border border-mist bg-mist" />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button variant="quiet" onClick={browse} disabled={uploading}>
              {uploading ? "Uploading…" : "Replace photo"}
            </Button>
            {removable && (
              <Button variant="danger" onClick={() => onChange(null)} disabled={uploading}>
                Remove
              </Button>
            )}
          </div>
          {hint && <p className="text-sm text-ink/70">{hint}</p>}
          {error && <p className="text-sm text-orange-700">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {fileInput}
      <button
        type="button"
        onClick={browse}
        disabled={uploading}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFile(e.dataTransfer.files[0]);
        }}
        className={`flex flex-col items-center justify-center gap-2 w-full min-h-[10rem] px-6 py-8 rounded-lg border-2 border-dashed text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
          dragging ? "border-blue bg-blue-50" : "border-ink/25 bg-bone-light hover:border-blue hover:bg-blue-50"
        }`}
      >
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-ink/70">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 16l5-5 4 4 3-3 6 6" />
          <circle cx="15.5" cy="8.5" r="1.5" />
        </svg>
        {uploading ? (
          <span className="font-semibold">Uploading…</span>
        ) : (
          <span>
            <span className="font-semibold">Drop a photo here</span>, or <span className="font-semibold text-blue-700 underline underline-offset-2">browse</span>
          </span>
        )}
        <span className="text-sm text-ink/70">{hint || "JPG, PNG or WebP"}</span>
      </button>
      {error && <p className="text-sm text-orange-700">{error}</p>}
    </div>
  );
}
