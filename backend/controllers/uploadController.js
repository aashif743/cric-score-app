// Image upload endpoint — streams an incoming file to Cloudinary and returns
// its hosted URL. Used for tournament logos and team crests. Kept generic so
// any future feature (auction crests, profile photos) can reuse it.
//
// Storage note: the backend disk on Render is ephemeral, so files are NEVER
// written locally — multer keeps the file in memory and we pipe the buffer
// straight to Cloudinary.
const { cloudinary, isConfigured } = require("../config/cloudinary");

// Square-fit, capped at 512x512, auto format/quality — logos stay crisp and
// small regardless of what the user picked from their phone.
const uploadImage = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(500).json({
        success: false,
        error: "Image uploads are not configured on the server.",
      });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: "No image file received." });
    }

    const folder = req.body.folder === "team" ? "criczone/team-logos" : "criczone/tournament-logos";

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          transformation: [
            { width: 512, height: 512, crop: "limit" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
      );
      stream.end(req.file.buffer);
    });

    return res.json({
      success: true,
      data: { url: result.secure_url, publicId: result.public_id },
    });
  } catch (err) {
    console.error("Image upload failed:", err.message || err);
    return res.status(500).json({ success: false, error: "Image upload failed. Please try again." });
  }
};

module.exports = { uploadImage };
