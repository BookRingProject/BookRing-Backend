const Book = require('../models/Book');

/**
 * Extract potential book title from user message
 * @param {string} message - User's chat message
 * @returns {string} - Extracted title or empty string
 */
const extractBookTitle = (message) => {
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
      return match[1].trim();
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
      return match[1].trim();
    }
  }

  // If no patterns match, return empty string
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
    // Extract potential title from message
    let searchTitle = extractBookTitle(message);
    
    // If no title extracted, try using the whole message
    if (!searchTitle) {
      // Remove common chat words to get a cleaner search query
      const cleaned = message
        .replace(/\b(my|the|this|that|a|an|about|on|for|of|with|from|to)\b/gi, '')
        .replace(/book/gi, '')
        .trim();
      
      if (cleaned.length > 2) {
        searchTitle = cleaned;
      } else {
        // Default to empty if nothing meaningful
        return null;
      }
    }

    // Build search query - find books accessible to this user
    const query = {
      lecturerId: userId,  
      title: { $regex: searchTitle, $options: 'i' }
    };

    // Find all matching books
    const books = await Book.find(query).sort({ createdAt: -1 });

    if (books.length === 0) {
      return null;
    }

    // If multiple matches, find the best one
    if (books.length === 1) {
      return { book: books[0], matchedBy: 'title' };
    }

    // Multiple matches - score them by relevance
    const scored = books.map(book => {
      let score = 0;
      const titleLower = book.title.toLowerCase();
      const searchLower = searchTitle.toLowerCase();

      // Exact match (highest score)
      if (titleLower === searchLower) {
        score += 100;
      }

      // Title starts with search term
      if (titleLower.startsWith(searchLower)) {
        score += 50;
      }

      // Title contains search term
      if (titleLower.includes(searchLower)) {
        score += 30;
      }

      // Word-by-word matching
      const searchWords = searchLower.split(' ');
      const titleWords = titleLower.split(' ');
      
      for (const word of searchWords) {
        if (word.length > 2 && titleWords.some(tw => tw.includes(word))) {
          score += 10;
        }
      }

      return { book, score };
    });

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Return the best match if score > 0
    if (scored[0].score > 0) {
      return { book: scored[0].book, matchedBy: 'fuzzy' };
    }

    // If no good match, return the first one
    return { book: books[0], matchedBy: 'fallback' };

  } catch (error) {
    console.error('Book search error:', error);
    return null;
  }
};

module.exports = {
  searchBookByTitle,
  extractBookTitle,
};
