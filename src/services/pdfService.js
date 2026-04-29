const fs = require('fs');
const pdf = require('pdf-parse');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Alternative: Use pdf-to-image or similar
// For now, we'll skip cover extraction to unblock uploads

const extractCoverImage = async (pdfPath) => {
  try {
    // Option 1: Use ImageMagick (if installed on Render)
    // const outputPath = pdfPath.replace('.pdf', '_cover.png');
    // await execPromise(`convert "${pdfPath}[0]" "${outputPath}"`);
    // return outputPath;
    
    // Option 2: Skip cover extraction for now (use placeholder)
    console.log('Cover extraction skipped - using placeholder');
    return null;
    
  } catch (error) {
    console.error('Cover extraction error:', error);
    return null;
  }
};

const extractTextFromPDF = async (pdfPath) => {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF text extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

module.exports = {
  extractCoverImage,
  extractTextFromPDF,
};
