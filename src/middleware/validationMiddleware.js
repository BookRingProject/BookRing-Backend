const { errorResponse } = require('../utils/apiResponse');

const validate = (schema) => {
  return (req, res, next) => {
    const { isValid, errors } = schema(req.body, req.user?.role);
    
    if (!isValid) {
      return errorResponse(res, 'Validation failed', 400, errors);
    }
    
    next();
  };
};

module.exports = { validate };