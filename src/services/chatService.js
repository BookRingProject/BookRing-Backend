/**
 * Chat Service - BRbot AI Conversation Logic
 * MIT License
 * 
 * Handles communication with Google's Gemini API for file-based chat.
 * Sends user messages and file content directly to Gemini for analysis.
 */

const { model } = require('../config/gemini');
const axios = require('axios');

/**
 * Convert a file URL to base64 for Gemini processing
 * @param {string} fileUrl - URL of the file to fetch
 * @returns {Promise<string>} - Base64 encoded file
 */
const fetchFileAsBase64 = async (fileUrl) => {
  try {
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 seconds timeout
    });
    
    const buffer = Buffer.from(response.data, 'binary');
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error fetching file:', error.message);
    throw new Error(`Failed to fetch file: ${error.message}`);
  }
};

/**
 * Chat with Gemini using a file and user message
 * @param {string} fileUrl - URL of the file (PDF or image)
 * @param {string} mimeType - MIME type of the file
 * @param {string} userMessage - User's question or prompt
 * @param {string} bookTitle - Title of the book (for context)
 * @returns {Promise<string>} - Gemini's response
 */
const chatWithFile = async (fileUrl, mimeType, userMessage, bookTitle) => {
  try {
    // Fetch file and convert to base64
    const base64File = await fetchFileAsBase64(fileUrl);

    // Build the prompt with context
    const prompt = `You are BRbot, an AI study assistant for the book "${bookTitle}".
    
The user is asking: "${userMessage}"

Please analyze the provided file and answer the user's question based on its content.
- Be thorough and accurate
- Reference specific parts of the book when relevant
- If the information isn't in the book, say so clearly
- Keep responses clear and educational
- If relevant, suggest related topics the user might want to explore`;

    // Send to Gemini with the file
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64File,
        },
      },
    ]);

    const response = result.response;
    return response.text();

  } catch (error) {
    console.error('Gemini chat error:', error);
    
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
    const maxLength = 50000; // Rough limit for Gemini
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

    const result = await model.generateContent(prompt);
    return result.response.text();

  } catch (error) {
    console.error('Gemini text chat error:', error);
    throw new Error('Failed to get AI response from text. Please try again.');
  }
};

module.exports = {
  chatWithFile,
  chatWithText,
  fetchFileAsBase64,
};
