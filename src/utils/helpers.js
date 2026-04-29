const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

const extractFileExtension = (filename) => {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
};

const getRandomString = (length = 8) => {
  return Math.random().toString(36).substring(2, 2 + length);
};

module.exports = {
  slugify,
  extractFileExtension,
  getRandomString,
};