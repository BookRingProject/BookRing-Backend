const { model } = require('../config/gemini');
const axios = require('axios');

/**
 * Convert a file URL to base64 for Gemini processing
 * @param {string} fileUrl - URL of the file to fetch
 * @returns {Promise<string>} - Base64 encoded file
 */
const fetchFileAsBase64 = async (fileUrl) => {
  try {
    console.log('📥 [fetchFileAsBase64] Fetching file from:', fileUrl);
    
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 seconds timeout
    });
    
    const buffer = Buffer.from(response.data, 'binary');
    const base64 = buffer.toString('base64');
    
    console.log(`✅ [fetchFileAsBase64] File fetched successfully. Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📄 [fetchFileAsBase64] Content-Type: ${response.headers['content-type']}`);
    
    return base64;
  } catch (error) {
    console.error('❌ [fetchFileAsBase64] Error fetching file:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Status Text:', error.response.statusText);
    }
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
    console.log('🤖 [chatWithFile] Starting chat with Gemini...');
    console.log(`📚 [chatWithFile] Book: "${bookTitle}"`);
    console.log(`📝 [chatWithFile] User message: "${userMessage}"`);
    console.log(`📄 [chatWithFile] File URL: ${fileUrl}`);
    console.log(`📋 [chatWithFile] MIME Type: ${mimeType}`);

    // Fetch file and convert to base64
    const base64File = await fetchFileAsBase64(fileUrl);
    console.log(`✅ [chatWithFile] File converted to base64 (${(base64File.length / 1024 / 1024).toFixed(2)} MB)`);

    // Build the prompt with context
    const prompt = `You are BRbot, an AI study assistant for the book "${bookTitle}".
    
The user is asking: "${userMessage}"

Please analyze the provided file and answer the user's question based on its content.
- Be thorough and accurate
- Reference specific parts of the book when relevant
- If the information isn't in the book, say so clearly
- Keep responses clear and educational
- If relevant, suggest related topics the user might want to explore`;

    console.log('📤 [chatWithFile] Sending to Gemini...');
    console.log(`📏 [chatWithFile] Prompt length: ${prompt.length} characters`);

    // Send to Gemini with the file
    const startTime = Date.now();
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64File,
        },
      },
    ]);
    const endTime = Date.now();

    const response = result.response;
    const text = response.text();
    
    console.log(`✅ [chatWithFile] Gemini response received in ${(endTime - startTime) / 1000} seconds`);
    console.log(`📏 [chatWithFile] Response length: ${text.length} characters`);
    console.log(`📝 [chatWithFile] Response preview: ${text.substring(0, 150)}...`);

    return text;

  } catch (error) {
    console.error('❌ [chatWithFile] Gemini chat error:', error.message);
    
    // Check for specific error types
    if (error.message?.includes('fetch')) {
      console.error('   🔴 File fetch failed - check if URL is accessible');
      throw new Error('Could not access the book file. Please make sure the file is available.');
    }
    
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      console.error('   🔴 Rate limit or quota exceeded');
      throw new Error('The AI service is currently busy. Please try again in a moment.');
    }
    
    if (error.message?.includes('403') || error.message?.includes('401')) {
      console.error('   🔴 Authentication failed - check file permissions');
      throw new Error('Cannot access the book file. It may be private or restricted.');
    }
    
    console.error('   🔴 Unknown error:', error);
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
    console.log('📝 [chatWithText] Using text fallback...');
    console.log(`📚 [chatWithText] Book: "${bookTitle}"`);
    console.log(`📏 [chatWithText] Text content length: ${textContent.length} characters`);

    // Truncate text if too long (Gemini has token limits)
    const maxLength = 50000; // Rough limit for Gemini
    const truncatedText = textContent.length > maxLength 
      ? textContent.substring(0, maxLength) + '... (truncated)' 
      : textContent;

    console.log(`📏 [chatWithText] Truncated text length: ${truncatedText.length} characters`);

    const prompt = `You are BRbot, an AI study assistant for the book "${bookTitle}".
    
Book content: ${truncatedText}

The user is asking: "${userMessage}"

Please analyze the provided book content and answer the user's question based on it.
- Be thorough and accurate
- Reference specific parts of the book when relevant
- If the information isn't in the book, say so clearly
- Keep responses clear and educational`;

    console.log('📤 [chatWithText] Sending to Gemini...');
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    console.log(`✅ [chatWithText] Gemini response received. Length: ${text.length} characters`);
    return text;

  } catch (error) {
    console.error('❌ [chatWithText] Error:', error.message);
    throw new Error('Failed to get AI response from text. Please try again.');
  }
};

module.exports = {
  chatWithFile,
  chatWithText,
  fetchFileAsBase64,
};
