// backend/utils/matchValidation.js
const { check, validationResult } = require('express-validator');

exports.validateEndMatch = [
  check('innings1').exists().withMessage('Innings1 data is required'),
  check('innings1.teamName').exists().withMessage('Team name is required'),
  check('innings1.runs').isInt().withMessage('Runs must be a number'),
  check('innings1.wickets').isInt().withMessage('Wickets must be a number'),
  check('innings1.overs').matches(/^\d+\.\d+$/).withMessage('Invalid overs format'),
  check('result')
    .exists().withMessage('Match result is required')
    .notEmpty().withMessage('Result cannot be empty')
    .isString().withMessage('Result must be a string'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array(),
        receivedData: req.body 
      });
    }
    next();
  }
];