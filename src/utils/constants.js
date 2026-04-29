const CATEGORIES = [
  'Mathematics',
  'Computer Science',
  'Physics',
  'Chemistry',
  'Biology',
  'Engineering',
  'Medicine & Health',
  'Business & Economics',
  'Law',
  'Humanities & Arts',
];

const USER_ROLES = {
  STUDENT: 'student',
  LECTURER: 'lecturer',
};

const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB

module.exports = {
  CATEGORIES,
  USER_ROLES,
  FILE_SIZE_LIMIT,
};