const { errorResponse } = require('../utils/apiResponse');

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(res, `Access denied. ${roles.join(' or ')} role required`, 403);
    }

    next();
  };
};

const isStudent = requireRole('student');
const isLecturer = requireRole('lecturer');

module.exports = {
  requireRole,
  isStudent,
  isLecturer,
};