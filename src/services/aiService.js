const { model } = require('../config/gemini');
const fs = require('fs');
const { CATEGORIES } = require('../utils/constants');

// Extract text from PDF and summarize using Gemini
const summarizePDF = async (pdfPath) => {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    const prompt = `Please provide a concise, well-structured summary of this academic PDF document. 
    The summary should be 300-500 words, highlighting the key concepts, main arguments, and conclusions.
    Format the summary in clear paragraphs.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
    ]);

    const summary = result.response.text();
    return summary;
  } catch (error) {
    console.error('Gemini summarization error:', error);
    throw new Error('Failed to summarize PDF: ' + error.message);
  }
};

// Detect book category using Gemini
const detectCategory = async (pdfPath) => {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    const categoriesList = CATEGORIES.join(', ');
    
    const prompt = `Analyze this academic PDF and classify it into EXACTLY ONE of these categories: ${categoriesList}.
    
    Return ONLY the category name, nothing else. Just one word or two words from the list above.
    
    Example response: "Computer Science" or "Mathematics" or "Biology"`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
    ]);

    let category = result.response.text().trim();
    
    // Validate category is in our list
    if (!CATEGORIES.includes(category)) {
      // Default to first category if detection fails
      category = CATEGORIES[0];
    }

    return category;
  } catch (error) {
    console.error('Gemini category detection error:', error);
    // Default to first category
    return CATEGORIES[0];
  }
};

module.exports = {
  summarizePDF,
  detectCategory,
};