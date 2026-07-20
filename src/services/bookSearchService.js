const Book = require('../models/Book');

/**
 * Extract potential book title from user message
 * @param {string} message - User's chat message
 * @returns {string} - Extracted title or empty string
 */
const extractBookTitle = (message) => {
  console.log('🔍 [extractBookTitle] Raw message:', message);

  // Common patterns users might use
  const patterns = [
    /(?:my|the|this) book\s+["']([^"']+)["']/i,
    /(?:my|the|this) book\s+['"]([^"']+)['"]/i,
    /(?:about|on|for)\s+["']([^"']+)["']/i,
    /(?:about|on|for)\s+['"]([^"']+)['"]/i,
    /book\s+["']([^"']+)["']/i,
    /book\s+['"]([^"']+)['"]/i,
    /["']([^"']+)["']\s+book/i,
    /['"]([^"']+)['"]\s+book/i,
    /(?:tell me about|summarize|explain|analyze)\s+["']([^"']+)["']/i,
    /(?:tell me about|summarize|explain|analyze)\s+['"]([^"']+)['"]/i,
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      console.log('✅ [extractBookTitle] Pattern matched! Extracted:', extracted);
      return extracted;
    }
  }

  // Fallback: Look for words after common phrases
  const fallbackPhrases = [
    /(?:about|on|for|of)\s+([a-zA-Z0-9\s\-_]{3,30})/i,
    /(?:my|the)\s+([a-zA-Z0-9\s\-_]{3,30})\s+book/i,
  ];

  for (const phrase of fallbackPhrases) {
    const match = message.match(phrase);
    if (match && match[1]) {
      const extracted = match[1].trim();
      console.log('✅ [extractBookTitle] Fallback matched! Extracted:', extracted);
      return extracted;
    }
  }

  console.log('❌ [extractBookTitle] No pattern matched. Returning empty string.');
  return '';
};

/**
 * Search for a book by title with fuzzy matching
 * @param {string} message - User's chat message
 * @param {string} userId - User ID for permission filtering
 * @returns {Promise<Object|null>} - Matching book or null
 */
const searchBookByTitle = async (message, userId) => {
  try {
    console.log('📚 [searchBookByTitle] Starting search...');
    console.log('📝 [searchBookByTitle] User message:', message);
    console.log('👤 [searchBookByTitle] User ID:', userId);

    // Extract potential title from message
    let searchTitle = extractBookTitle(message);
    console.log('🔍 [searchBookByTitle] Extracted title:', searchTitle || '(empty)');
    
    // If no title extracted, try using the whole message
    if (!searchTitle) {
      console.log('🔄 [searchBookByTitle] No title extracted, cleaning full message...');
      // Remove common chat words to get a cleaner search query
      const cleaned = message
        .replace(/\b(my|the|this|that|a|an|about|on|for|of|with|from|to)\b/gi, '')
        .replace(/book/gi, '')
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

    // Build search query - find books accessible to this user
    const query = {
      lecturerId: userId,  
      title: { $regex: searchTitle, $options: 'i' }
    };
    console.log('🔎 [searchBookByTitle] Database query:', JSON.stringify(query, null, 2));

    // Find all matching books
    const books = await Book.find(query).sort({ createdAt: -1 });
    console.log(`📊 [searchBookByTitle] Found ${books.length} books matching query`);

    if (books.length === 0) {
      console.log('❌ [searchBookByTitle] No books found. Returning null.');
      return null;
    }

    // Log all found books
    console.log('📚 [searchBookByTitle] All matching books:');
    books.forEach((book, index) => {
      console.log(`  ${index + 1}. "${book.title}" (ID: ${book._id})`);
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
  extractBookTitle,
};
