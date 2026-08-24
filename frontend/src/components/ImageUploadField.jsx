import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import client, { cloudinaryUrl } from "../api/client";
import { getCroppedBlob } from "../lib/imageCrop.js";

/**
 * props: value (publicId|null), onChange(publicId), folder?
 * aspect?: pass a number (e.g. 1 for square) to require a crop step before
 * upload -- matches AdminProducts' gallery crop flow. Omit it for a plain,
 * upload-immediately field (e.g. the delivery-proof photo, where any shape
 * is fine and the fast path matters more).
 */
export default function ImageUploadField({ value, onChange, folder, aspect }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [cropFile, setCropFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
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
      setError(err.response?.data?.error || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (aspect) {
      setCropFile(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } else {
      uploadFile(file, file.name);
      e.target.value = "";
    }
  };

  const cancelCrop = () => {
    setCropFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmCrop = async () => {
    if (!croppedAreaPixels || !cropImageSrc) return;
    const blob = await getCroppedBlob(cropImageSrc, croppedAreaPixels);
    await uploadFile(blob, "image.jpg");
    setCropFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const previewUrl = value ? cloudinaryUrl(value, { width: 200 }) : null;

  if (cropFile) {
    return (
      <div className="border border-mist rounded-sm p-3 max-w-xs">
        <div className="relative w-full h-56 bg-ink/5">
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
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full mt-2"
        />
        <div className="flex gap-2 mt-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={confirmCrop}
            disabled={uploading}
            className="px-3 py-1.5 rounded-sm bg-amber text-bone-light text-xs font-semibold disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Confirm crop & upload"}
          </motion.button>
          <button
            type="button"
            onClick={cancelCrop}
            className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-clay mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <AnimatePresence mode="wait">
        {previewUrl && (
          <motion.img
            key={value}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            src={previewUrl}
            alt=""
            className="w-16 h-16 object-cover rounded-sm border border-mist"
          />
        )}
      </AnimatePresence>
      <div className="flex flex-col gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
          className="text-xs text-ink/70"
        />
        {uploading && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-2 border-amber border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-ink/60">Uploading…</p>
          </div>
        )}
        {error && <p className="text-xs text-clay">{error}</p>}
      </div>
    </div>
  );
}
