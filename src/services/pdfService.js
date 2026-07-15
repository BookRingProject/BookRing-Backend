const fs = require('fs');
const pdf = require('pdf-parse');
const { fromPath } = require('pdf2pic');

const extractCoverImage = async (pdfPath) => {
  console.log('Cover extraction disabled - using Cloudinary thumbnails');
  return null; // Always return null, let frontend use Cloudinary
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
