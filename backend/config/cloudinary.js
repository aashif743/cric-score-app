// Cloudinary client — configured once from the three env vars. These live in
// Render's environment (and backend/.env locally). If they're missing, uploads
// fail loudly at request time rather than silently mis-storing images.
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const isConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME &&
     process.env.CLOUDINARY_API_KEY &&
     process.env.CLOUDINARY_API_SECRET);

module.exports = { cloudinary, isConfigured };
