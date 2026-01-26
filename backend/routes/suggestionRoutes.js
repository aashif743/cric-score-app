const express = require('express');
const router = express.Router();
const { getSuggestions, addSuggestion } = require('../controllers/suggestionController');

router.get('/', getSuggestions);
router.post('/', addSuggestion);

module.exports = router;
