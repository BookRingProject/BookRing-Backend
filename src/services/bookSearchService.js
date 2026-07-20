const Book = require('../models/Book');
const { model } = require('../config/gemini');

/**
 * Use Gemini to intelligently extract the book title from user message
 * @param {string} message - User's chat message
 * @returns {Promise<string>} - Extracted title or empty string
 */
const extractBookTitleWithAI = async (message) => {
  try {
    console.log('🤖 [extractBookTitleWithAI] Using Gemini to extract title from:', message);

    const prompt = `You are a book title extractor. Your ONLY job is to extract the book title from the user's message.

Here are some examples:
- "What is the book 'Thinking in Systems' about?" → Thinking in Systems
- "Can you summarize my Machine Learning book?" → Machine Learning
- "Tell me about 'The Art of War'" → The Art of War
- "What does the image 'Barber Flyer' talk about?" → Barber Flyer
- "Explain the PDF 'Data Science Handbook'" → Data Science Handbook
- "I need help with my Physics textbook" → Physics
- "What's in the file 'Annual Report 2024'?" → Annual Report 2024

Now extract the book title from this message. Return ONLY the title, nothing else. No explanations, no quotes, just the title.

User message: "${message}"

Title:`;

    const result = await model.generateContent(prompt);
    let extractedTitle = result.response.text().trim();
    
    // Clean up the response (remove quotes, extra spaces)
    extractedTitle = extractedTitle.replace(/^["']|["']$/g, '').trim();
    
    console.log(`✅ [extractBookTitleWithAI] Gemini extracted: "${extractedTitle}"`);
    return extractedTitle;

  } catch (error) {
    console.error('❌ [extractBookTitleWithAI] Error:', error.message);
    // Fallback to regex extraction if Gemini fails
    console.log('🔄 Falling back to regex extraction...');
    return extractBookTitleRegex(message);
  }
};

/**
 * Fallback: Extract potential book title from user message using regex
 * @param {string} message - User's chat message
 * @returns {string} - Extracted title or empty string
 */
const extractBookTitleRegex = (message) => {
  console.log('🔍 [extractBookTitleRegex] Raw message:', message);

  // Common patterns users might use
  const patterns = [
    /(?:my|the|this)\s+book\s+["']([^"']+)["']/i,
    /(?:my|the|this)\s+book\s+['"]([^"']+)['"]/i,
    /(?:about|on|for)\s+["']([^"']+)["']/i,
    /(?:about|on|for)\s+['"]([^"']+)['"]/i,
    /book\s+["']([^"']+)["']/i,
    /book\s+['"]([^"']+)['"]/i,
    /["']([^"']+)["']\s+book/i,
    /['"]([^"']+)['"]\s+book/i,
    /(?:tell me about|summarize|explain|analyze)\s+["']([^"']+)["']/i,
    /(?:tell me about|summarize|explain|analyze)\s+['"]([^"']+)['"]/i,
    /(?:image|file|document|pdf)\s+['"]?([^'"]+)['"]?/i,
    /['"]?([^'"]+)['"]?\s+(?:image|file|document|pdf)/i,
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      console.log('✅ [extractBookTitleRegex] Pattern matched! Extracted:', extracted);
      return extracted;
    }
  }

  // Fallback: Look for words after common phrases
  const fallbackPhrases = [
    /(?:about|on|for|of)\s+([a-zA-Z0-9\s\-_]{3,30})/i,
    /(?:my|the)\s+([a-zA-Z0-9\s\-_]{3,30})\s+book/i,
    /['"]?([a-zA-Z0-9\s\-_]{3,30})['"]?/i,
  ];

  for (const phrase of fallbackPhrases) {
    const match = message.match(phrase);
    if (match && match[1]) {
      const extracted = match[1].trim();
      console.log('✅ [extractBookTitleRegex] Fallback matched! Extracted:', extracted);
      return extracted;
    }
  }

  console.log('❌ [extractBookTitleRegex] No pattern matched. Returning empty string.');
  return '';
};

/**
 * Search for a book by title across ALL books in the platform
 * @param {string} message - User's chat message
 * @param {string} userId - User ID (used for logging only)
 * @returns {Promise<Object|null>} - Matching book or null
 */
const searchBookByTitle = async (message, userId) => {
  try {
    console.log('📚 [searchBookByTitle] Starting search across ALL books...');
    console.log('📝 [searchBookByTitle] User message:', message);
    console.log('👤 [searchBookByTitle] User ID:', userId);

    // Extract potential title from message using Gemini
    let searchTitle = await extractBookTitleWithAI(message);
    console.log('🔍 [searchBookByTitle] Extracted title:', searchTitle || '(empty)');
    
    // If Gemini returned nothing or too short, try cleaning the message
    if (!searchTitle || searchTitle.length < 2) {
      console.log('🔄 [searchBookByTitle] Title too short, trying cleaned message...');
      // Remove common chat words to get a cleaner search query
      const cleaned = message
        .replace(/\b(my|the|this|that|a|an|about|on|for|of|with|from|to|what|does|image|file|document|pdf|book|tell|me|explain|summarize|analyze)\b/gi, '')
        .replace(/['"]/g, '')
        .trim();
      
      console.log('🧹 [searchBookByTitle] Cleaned message:', cleaned);
      
      if (cleaned.length > 2) {
        searchTitle = cleaned;
        console.log('✅ [searchBookByTitle] Using cleaned message as title:', searchTitle);
      } else {
        console.log('❌ [searchBookByTitle] Cleaned message too short. Returning null.');
        return null;
      }
    }

    // Build search query - search ALL books in the platform
    const query = {
      title: { $regex: searchTitle, $options: 'i' }
    };
    console.log('🔎 [searchBookByTitle] Database query (ALL books):', JSON.stringify(query, null, 2));

    // Find all matching books
    const books = await Book.find(query).sort({ createdAt: -1 });
    console.log(`📊 [searchBookByTitle] Found ${books.length} books matching query across the entire platform`);

    if (books.length === 0) {
      console.log('❌ [searchBookByTitle] No books found anywhere. Returning null.');
      return null;
    }

    // Log all found books
    console.log('📚 [searchBookByTitle] All matching books:');
    books.forEach((book, index) => {
      console.log(`  ${index + 1}. "${book.title}" (ID: ${book._id}) uploaded by: ${book.lecturerId}`);
    });

    // If multiple matches, find the best one
    if (books.length === 1) {
      console.log(`✅ [searchBookByTitle] Single match found: "${books[0].title}"`);
      return { book: books[0], matchedBy: 'title' };
    }

    // Multiple matches - score them by relevance
    console.log('📊 [searchBookByTitle] Scoring multiple matches...');
    const scored = books.map(book => {
      let score = 0;
      const titleLower = book.title.toLowerCase();
      const searchLower = searchTitle.toLowerCase();

      // Exact match (highest score)
      if (titleLower === searchLower) {
        score += 100;
        console.log(`  🎯 "${book.title}" - Exact match! +100`);
      }

      // Title starts with search term
      if (titleLower.startsWith(searchLower)) {
        score += 50;
        console.log(`  📌 "${book.title}" - Starts with term +50`);
      }

      // Title contains search term
      if (titleLower.includes(searchLower)) {
        score += 30;
        console.log(`  🔍 "${book.title}" - Contains term +30`);
      }

      // Word-by-word matching
      const searchWords = searchLower.split(' ');
      const titleWords = titleLower.split(' ');
      
      for (const word of searchWords) {
        if (word.length > 2 && titleWords.some(tw => tw.includes(word))) {
          score += 10;
          console.log(`  📝 "${book.title}" - Word match "${word}" +10`);
        }
      }

      return { book, score };
    });

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);
    console.log(`🏆 [searchBookByTitle] Best match: "${scored[0].book.title}" (Score: ${scored[0].score})`);

    // Return the best match if score > 0
    if (scored[0].score > 0) {
      console.log(`✅ [searchBookByTitle] Returning best match: "${scored[0].book.title}"`);
      return { book: scored[0].book, matchedBy: 'fuzzy' };
    }

    // If no good match, return the first one
    console.log(`⚠️ [searchBookByTitle] No good match, returning first book: "${books[0].title}"`);
    return { book: books[0], matchedBy: 'fallback' };

  } catch (error) {
    console.error('❌ [searchBookByTitle] Error:', error);
    return null;
  }
};

module.exports = {
  searchBookByTitle,
  extractBookTitleWithAI,
  extractBookTitleRegex,
};
