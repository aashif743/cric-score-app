const express = require("express");
const multer = require("multer");
const router = express.Router();
const { uploadImage } = require("../controllers/uploadController");
const { protect } = require("../middleware/authMiddleware");

// Keep the file in memory (never touch Render's ephemeral disk); cap at 5MB and
// accept only images. Rejected files surface as a clean 400 via the handler.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only PNG, JPG or WEBP images are allowed."));
  },
});

// POST /api/uploads/image  — multipart field name: "image"
router.post("/image", protect, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller." : err.message;
      return res.status(400).json({ success: false, error: msg });
    }
    uploadImage(req, res);
  });
});

module.exports = router;
