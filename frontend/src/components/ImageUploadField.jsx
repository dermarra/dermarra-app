import { useState } from "react";
import client, { cloudinaryUrl } from "../api/client";

/** props: value (publicId|null), onChange(publicId), folder? */
export default function ImageUploadField({ value, onChange, folder }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (folder) formData.append("folder", folder);

      const { data } = await client.post("/admin/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(data.public_id);
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const previewUrl = value ? cloudinaryUrl(value, { width: 200 }) : null;

  return (
    <div className="flex items-center gap-3">
      {previewUrl && (
        <img src={previewUrl} alt="" className="w-16 h-16 object-cover rounded-sm border border-mist" />
      )}
      <div className="flex flex-col gap-1">
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
          className="text-xs text-ink/70"
        />
        {uploading && <p className="text-xs text-ink/60">Uploading…</p>}
        {error && <p className="text-xs text-clay">{error}</p>}
      </div>
    </div>
  );
}
