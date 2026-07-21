const { getModel, withKeyRotation, isQuotaError } = require('../config/gemini');
const fs = require('fs');
const path = require('path');
const { CATEGORIES } = require('../utils/constants');
const axios = require('axios');

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
 * Execute Gemini API call with automatic key rotation
 * @param {Function} apiCall - Function that takes a model and returns a result
 * @returns {Promise<any>} - Result of the API call
 */
const callWithRotation = async (apiCall) => {
  return withKeyRotation(apiCall);
};

/**
 * Fetch a file from URL and convert to base64 for Gemini
 * @param {string} fileUrl - URL of the file to fetch
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<Object>} - Object with base64 data and mimeType
 */
const fetchFileAsBase64 = async (fileUrl, mimeType) => {
  try {
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const buffer = Buffer.from(response.data, 'binary');
    const base64Data = buffer.toString('base64');
    
    return {
      base64Data,
      mimeType: mimeType || response.headers['content-type'] || 'application/pdf'
    };
  } catch (error) {
    console.error('Error fetching file:', error.message);
    throw new Error(`Failed to fetch file: ${error.message}`);
  }
};

/**
 * Chat with Gemini using a file URL (for BRbot)
 * @param {string} fileUrl - URL of the file (PDF or image)
 * @param {string} mimeType - MIME type of the file
 * @param {string} userMessage - User's question or prompt
 * @param {string} bookTitle - Title of the book (for context)
 * @returns {Promise<string>} - Gemini's response
 */
const chatWithFile = async (fileUrl, mimeType, userMessage, bookTitle) => {
  try {
    // Fetch file from URL and convert to base64
    const { base64Data } = await fetchFileAsBase64(fileUrl, mimeType);

    // Build the prompt with context
    const prompt = `You are BRbot, an AI study assistant for the book "${bookTitle}".
    
The user is asking: "${userMessage}"

Please analyze the provided file and answer the user's question based on its content.
- Be thorough and accurate
- Reference specific parts of the book when relevant
- If the information isn't in the book, say so clearly
- Keep responses clear and educational
- If relevant, suggest related topics the user might want to explore`;

    // Send to Gemini with the file using key rotation
    const result = await withKeyRotation(async (model) => {
      return await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: mimeType || 'application/pdf',
            data: base64Data,
          },
        },
      ]);
    });

    return result.response.text();

  } catch (error) {
    console.error('Gemini chat error:', error);
    
    // Check if all keys are exhausted
    if (error.message?.includes('All Gemini API keys have reached their daily quota')) {
      throw new Error('All AI service keys are currently exhausted. Please try again after midnight.');
    }
    
    // Check for specific error types
    if (error.message?.includes('fetch')) {
      throw new Error('Could not access the book file. Please make sure the file is available.');
    }
    
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      throw new Error('The AI service is currently busy. Please try again in a moment.');
    }
    
    throw new Error('Failed to get AI response. Please try again.');
  }
};

/**
 * Chat with Gemini using pre-extracted text (fallback for large files)
 * @param {string} textContent - Extracted text from the file
 * @param {string} userMessage - User's question or prompt
 * @param {string} bookTitle - Title of the book
 * @returns {Promise<string>} - Gemini's response
 */
const chatWithText = async (textContent, userMessage, bookTitle) => {
  try {
    // Truncate text if too long (Gemini has token limits)
    const maxLength = 50000;
    const truncatedText = textContent.length > maxLength 
      ? textContent.substring(0, maxLength) + '... (truncated)' 
      : textContent;

    const prompt = `You are BRbot, an AI study assistant for the book "${bookTitle}".
    
Book content: ${truncatedText}

The user is asking: "${userMessage}"

Please analyze the provided book content and answer the user's question based on it.
- Be thorough and accurate
- Reference specific parts of the book when relevant
- If the information isn't in the book, say so clearly
- Keep responses clear and educational`;

    const result = await withKeyRotation(async (model) => {
      return await model.generateContent(prompt);
    });

    return result.response.text();

  } catch (error) {
    console.error('Gemini text chat error:', error);
    
    if (error.message?.includes('All Gemini API keys have reached their daily quota')) {
      throw new Error('All AI service keys are currently exhausted. Please try again after midnight.');
    }
    
    throw new Error('Failed to get AI response from text. Please try again.');
  }
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
    
    const result = await withKeyRotation(async (model) => {
      return await model.generateContent(content);
    });
    
    const summary = result.response.text();
    return summary;
  } catch (error) {
    console.error('Gemini summarization error:', error);
    
    if (error.message?.includes('All Gemini API keys have reached their daily quota')) {
      throw new Error('All AI service keys are currently exhausted. Please try again after midnight.');
    }
    
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
    
    const result = await withKeyRotation(async (model) => {
      return await model.generateContent(content);
    });
    
    let category = result.response.text().trim();
    
    // Validate category is in our list
    if (!CATEGORIES.includes(category)) {
      console.warn(`Invalid category detected: "${category}", defaulting to ${CATEGORIES[0]}`);
      category = CATEGORIES[0];
    }

    return category;
  } catch (error) {
    console.error('Gemini category detection error:', error);
    
    if (error.message?.includes('All Gemini API keys have reached their daily quota')) {
      console.warn('All keys exhausted - using default category');
    }
    
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
  chatWithFile,
  chatWithText,
  fetchFileAsBase64,
  callWithRotation,
};
