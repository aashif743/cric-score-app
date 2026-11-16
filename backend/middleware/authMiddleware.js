const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header (e.g., "Bearer eyJhbGci...")
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token's ID and attach it to the request object
      // We don't want to include the password hash
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Activity ping for DAU/WAU/MAU — throttled to at most once per 5 minutes
      // per user, fire-and-forget so it never slows or breaks the request.
      const FIVE_MIN = 5 * 60 * 1000;
      const last = req.user.lastActive ? req.user.lastActive.getTime() : 0;
      if (Date.now() - last > FIVE_MIN) {
        User.updateOne({ _id: req.user._id }, { $set: { lastActive: new Date() } }).catch(() => {});
      }

      next(); // Move on to the next middleware or the controller
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Gate for the admin panel. Must run AFTER `protect` (needs req.user). Rejects
// anyone who isn't an active admin.
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authorized.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  if (req.user.status === 'disabled') {
    return res.status(403).json({ success: false, error: 'Account disabled.' });
  }
  next();
};

module.exports = { protect, requireAdmin };