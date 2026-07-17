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

/**
 * Check if a PDF is image-based (scanned) or text-based
 * Uses multiple heuristics for accuracy
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<boolean>} - True if image-based, false if text-based
 */
const isImageBasedPDF = async (pdfPath) => {
  try {
    // Heuristic 1: Check file size
    // Image-based PDFs are usually larger than 5MB
    const stats = fs.statSync(pdfPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // If file is larger than 5MB, likely image-based
    if (fileSizeMB > 5) {
      console.log(`📄 PDF size: ${fileSizeMB.toFixed(2)}MB - likely image-based`);
      return true;
    }

    // Heuristic 2: Try to extract text
    // If extracted text is very short, likely image-based
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const data = await pdf(pdfBuffer);
      const textLength = data.text.trim().length;
      
      // If less than 100 characters of text, it's image-based
      if (textLength < 100) {
        console.log(`📄 Extracted text length: ${textLength} chars - likely image-based`);
        return true;
      }
      
      console.log(`📄 Extracted text length: ${textLength} chars - text-based PDF`);
      return false;
      
    } catch (extractError) {
      // If text extraction fails, treat as image-based
      console.log('📄 Text extraction failed - treating as image-based');
      return true;
    }

  } catch (error) {
    console.error('Error detecting PDF type:', error);
    // Default to false (treat as text-based) if detection fails
    return false;
  }
};

module.exports = {
  extractCoverImage,
  extractTextFromPDF,
  isImageBasedPDF,
};
