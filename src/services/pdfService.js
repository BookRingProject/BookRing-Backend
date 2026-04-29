const fs = require('fs');
const pdf = require('pdf-parse');
const { fromPath } = require('pdf2img');

const extractCoverImage = async (pdfPath) => {
  try {
    const outputPath = pdfPath.replace('.pdf', '_cover.png');
    
    // Convert first page to image
    await fromPath(pdfPath, {
      output: outputPath,
      page: 1,
      type: 'png',
      density: 150,
    });

    return outputPath;
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