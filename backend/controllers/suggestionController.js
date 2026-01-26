const Suggestion = require('../models/Suggestion');

// @desc    Get name suggestions based on query and type
// @route   GET /api/suggestions
// @access  Public
const getSuggestions = async (req, res) => {
  try {
    const { query, type } = req.query;

    if (!type || !['player', 'team'].includes(type)) {
      return res.status(400).json({ message: 'Valid type (player/team) is required' });
    }

    // Build search criteria
    const searchCriteria = { type };

    if (query && query.trim()) {
      // Search by prefix (case-insensitive)
      // Escape special regex characters to prevent injection
      const escapedQuery = query.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchCriteria.normalizedName = { $regex: `^${escapedQuery}` };
    }

    // Find suggestions sorted by usage count (most popular first)
    // Use lean() for faster reads (returns plain JS objects instead of Mongoose docs)
    const suggestions = await Suggestion.find(searchCriteria)
      .sort({ usageCount: -1 })
      .limit(8)
      .select('name usageCount')
      .lean()
      .maxTimeMS(3000); // 3 second max query time

    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    // Check if it's a timeout error
    if (error.name === 'MongooseError' || error.code === 50) {
      console.warn('Suggestion query timeout');
      return res.status(200).json({ success: true, data: [] });
    }
    console.error('Error getting suggestions:', error);
    res.status(500).json({ message: 'Failed to get suggestions' });
  }
};

// @desc    Add a new suggestion or increment usage count if exists
// @route   POST /api/suggestions
// @access  Public
const addSuggestion = async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!type || !['player', 'team'].includes(type)) {
      return res.status(400).json({ message: 'Valid type (player/team) is required' });
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();

    // Use findOneAndUpdate with upsert for atomic operation (faster than find + save)
    const suggestion = await Suggestion.findOneAndUpdate(
      { normalizedName, type },
      {
        $inc: { usageCount: 1 },
        $setOnInsert: {
          name: trimmedName,
          normalizedName,
          type,
          isSeeded: false,
        },
      },
      {
        upsert: true,
        new: true,
        lean: true,
        maxTimeMS: 3000,
      }
    );

    res.status(200).json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    console.error('Error adding suggestion:', error);
    res.status(500).json({ message: 'Failed to add suggestion' });
  }
};

module.exports = { getSuggestions, addSuggestion };
