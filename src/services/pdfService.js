const fs = require('fs');
const pdf = require('pdf-parse');
const { fromPath } = require('pdf2pic');

const extractCoverImage = async (pdfPath) => {
  try {
    console.log('📸 Attempting to extract cover from:', pdfPath);
    
    // Configure pdf2pic options
    const options = {
      density: 100,
      saveFilename: 'cover',
      savePath: '/tmp', // Use Render's temp directory
      format: 'png',
      width: 300,
      height: 400,
    };
    
    const convert = fromPath(pdfPath, options);
    const result = await convert.page(1); // Extract first page
    
    console.log('✅ Cover extracted successfully:', result.path);
    return result.path;
    
  } catch (error) {
    console.error('❌ Cover extraction error:', error);
    return null; // Return null to use default cover
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
