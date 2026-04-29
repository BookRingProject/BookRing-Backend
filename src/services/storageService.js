const fs = require('fs');
const path = require('path');

const cleanupTempFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up temp file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to cleanup temp file: ${filePath}`, error);
  }
};

const cleanupTempDirectory = (dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        cleanupTempFile(path.join(dirPath, file));
      }
    }
  } catch (error) {
    console.error(`Failed to cleanup temp directory: ${dirPath}`, error);
  }
};

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

module.exports = {
  cleanupTempFile,
  cleanupTempDirectory,
  ensureDirectoryExists,
};