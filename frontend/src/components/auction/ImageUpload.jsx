import React, { useRef, useState } from "react";
import { FiUploadCloud, FiTrash2, FiRefreshCw, FiImage } from "react-icons/fi";
import { Spinner, toast, cx } from "./ui.jsx";

// Where the Hostinger uploader lives. In production it sits at the site root
// (cric-zone.com/upload.php); override with VITE_UPLOAD_URL if hosted elsewhere.
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || "/upload.php";
const MAX_MB = 5;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Professional image picker: drag-and-drop or click, client-side validation
// (type + size), live preview with change/remove, and an upload spinner.
// Uploads to Hostinger and returns the public URL via onChange.
export default function ImageUpload({ value, onChange, round = true, label = "Photo", hint }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      toast.error("Please choose a JPG, PNG, WEBP or GIF image.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image is too large (max ${MAX_MB} MB).`);
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(UPLOAD_URL, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        onChange(data.url);
        toast.success("Image uploaded.");
      } else {
        toast.error(data.error || "Upload failed. Is upload.php on your hosting?");
      }
    } catch (_) {
      toast.error("Upload failed — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const onPick = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    upload(file);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    upload(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const shape = round ? "rounded-full" : "rounded-2xl";

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cx(
          "group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden border-2 border-dashed transition",
          shape,
          drag ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-300 bg-slate-50 hover:border-indigo-400 dark:border-white/15 dark:bg-white/5"
        )}
      >
        {busy ? (
          <Spinner size={22} className="text-indigo-500" />
        ) : value ? (
          <>
            <img src={value} alt="" className={cx("h-full w-full object-cover", shape)} />
            <span className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
              <FiRefreshCw size={18} />
            </span>
          </>
        ) : (
          <FiImage size={24} className="text-slate-400 transition group-hover:text-indigo-500" />
        )}
      </button>

      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</div>
        <div className="mt-0.5 text-xs font-medium text-slate-400">{hint || `Drag & drop or click · JPG/PNG · max ${MAX_MB}MB`}</div>
        <div className="mt-1.5 flex items-center gap-3">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 dark:text-indigo-400">
            <FiUploadCloud size={13} /> {value ? "Change" : "Upload"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600">
              <FiTrash2 size={12} /> Remove
            </button>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}
