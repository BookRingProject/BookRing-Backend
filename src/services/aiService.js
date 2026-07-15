const { model } = require('../config/gemini');
const fs = require('fs');
const path = require('path');
const { CATEGORIES } = require('../utils/constants');

/**
 * Check if a file is an image based on extension
 * @param {string} filePath - Path to the file
 * @returns {boolean} - True if file is an image
 */
const isImageFile = (filePath) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
  const ext = path.extname(filePath).toLowerCase();
  return imageExtensions.includes(ext);
};

/**
 * Prepare content for Gemini based on file type
 * @param {string} filePath - Path to PDF or image file
 * @param {string} prompt - Prompt text to send
 * @returns {Promise<Array>} - Content array for Gemini
 */
const prepareContentForGemini = async (filePath, prompt) => {
  // Case 1: Standalone image
  if (isImageFile(filePath)) {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = `image/${path.extname(filePath).substring(1)}`;
    
    return [
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
      },
    ];
  }
  
  // Case 2: PDF (text-based OR image-based - Gemini handles both)
  if (path.extname(filePath).toLowerCase() === '.pdf') {
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfBase64 = pdfBuffer.toString('base64');
    
    // Add vision guidance for image-heavy PDFs
    let enhancedPrompt = prompt;
    enhancedPrompt += `\n\nIMPORTANT: If this PDF contains images, charts, diagrams, or scanned text, please use your vision capabilities to read and understand all visual content as well.`;

    return [
      enhancedPrompt,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
    ];
  }
  
  throw new Error(`Unsupported file type: ${filePath}`);
};

/**
 * Summarize a PDF or image using Gemini
 * @param {string} filePath - Path to PDF or image file
 * @param {Object} options - Options for summarization
 * @returns {Promise<string>} - Generated summary
 */
const summarizePDF = async (filePath, options = {}) => {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Build prompt
    let prompt = options.customPrompt || 
      `Please provide a concise, well-structured summary of this document. 
      The summary should be 300-500 words, highlighting the key concepts, 
      main arguments, and conclusions. Format the summary in clear paragraphs.`;

    // For images, add specific instructions
    if (isImageFile(filePath)) {
      prompt += `\n\nThis is an image. Please extract and summarize all visible text and information.`;
    }

    const content = await prepareContentForGemini(filePath, prompt);
    const result = await model.generateContent(content);
    const summary = result.response.text();
    
    return summary;
  } catch (error) {
    console.error('Gemini summarization error:', error);
    throw new Error('Failed to summarize document: ' + error.message);
  }
};

/**
 * Detect category using Gemini
 * @param {string} filePath - Path to PDF or image file
 * @returns {Promise<string>} - Category name
 */
const detectCategory = async (filePath) => {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const categoriesList = CATEGORIES.join(', ');
    
    let prompt = `Analyze this document and classify it into EXACTLY ONE of these categories: ${categoriesList}.
    
    Return ONLY the category name, nothing else. Just one word or two words from the list above.
    
    Example response: "Computer Science" or "Mathematics" or "Biology"`;

    // For images, add specific instructions
    if (isImageFile(filePath)) {
      prompt += `\n\nThis is an image. Analyze its content to determine the category.`;
    } else {
      prompt += `\n\nIf this PDF contains images, charts, or diagrams, use your vision capabilities to analyze them as well.`;
    }

    const content = await prepareContentForGemini(filePath, prompt);
    const result = await model.generateContent(content);
    
    let category = result.response.text().trim();
    
    // Validate category is in our list
    if (!CATEGORIES.includes(category)) {
      console.warn(`Invalid category detected: "${category}", defaulting to ${CATEGORIES[0]}`);
      category = CATEGORIES[0];
    }

    return category;
  } catch (error) {
    console.error('Gemini category detection error:', error);
    return CATEGORIES[0];
  }
};

/**
 * Process a standalone image (convenience wrapper)
 * @param {string} imagePath - Path to image file
 * @param {Object} options - Options for processing
 * @returns {Promise<string>} - Generated summary
 */
const summarizeImage = async (imagePath, options = {}) => {
  return summarizePDF(imagePath, options);
};

module.exports = {
  summarizePDF,
  summarizeImage,
  detectCategory,
  isImageFile,
  prepareContentForGemini,
};
