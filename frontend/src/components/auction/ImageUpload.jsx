import React, { useRef, useState } from "react";

// Where the Hostinger uploader lives. In production it sits at the site root
// (cric-zone.com/upload.php); override with VITE_UPLOAD_URL if hosted elsewhere.
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || "/upload.php";

// Small avatar-style picker: shows the current image, lets you upload a new one
// (→ Hostinger) and returns the public URL via onChange. `round` for logos/faces.
export default function ImageUpload({ value, onChange, size = 56, round = true, label = "Photo" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(UPLOAD_URL, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) onChange(data.url);
      else alert(data.error || "Upload failed. Is upload.php on your hosting?");
    } catch (_) {
      alert("Upload failed — check your connection / upload.php.");
    } finally {
      setBusy(false);
    }
  };

  const box = { width: size, height: size, borderRadius: round ? "9999px" : "0.75rem" };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={box}
        className="grid place-items-center overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 text-[10px] font-bold text-slate-400 hover:border-indigo-400"
      >
        {busy ? "…" : value ? <img src={value} alt="" style={box} className="object-cover" /> : "＋"}
      </button>
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-slate-500">{label}</span>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="text-[11px] font-bold text-red-400 hover:text-red-600">Remove</button>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="text-[11px] font-bold text-indigo-500">Upload</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" />
    </div>
  );
}
