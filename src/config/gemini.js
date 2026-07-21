const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_RETRIES = 2; // Number of retries per key before marking as exhausted

// --- Load API Keys ---
const loadApiKeys = () => {
  const keys = [];
  
  // Primary key (always required)
  const primaryKey = process.env.GEMINI_API_KEY;
  if (primaryKey) {
    keys.push({ key: primaryKey, isExhausted: false, lastUsed: null });
  } else {
    console.warn('⚠️ [Gemini] GEMINI_API_KEY is not set');
  }

  // Additional keys (GEMINI_API_KEY_2, _3, _4, _5)
  let index = 2;
  while (index <= 5) {
    const key = process.env[`GEMINI_API_KEY_${index}`];
    if (key) {
      keys.push({ key, isExhausted: false, lastUsed: null });
      console.log(`✅ [Gemini] Loaded additional key: GEMINI_API_KEY_${index}`);
    }
    index++;
  }

  if (keys.length === 0) {
    console.error('❌ [Gemini] No API keys found!');
  } else {
    console.log(`✅ [Gemini] Loaded ${keys.length} API keys`);
  }

  return keys;
};

// --- State ---
let apiKeys = loadApiKeys();
let currentKeyIndex = 0;
let keyUsageCount = {};

// --- Helper Functions ---

/**
 * Get the next available API key (round-robin with exhaustion check)
 * @returns {Object|null} - { key, index } or null if all exhausted
 */
const getNextAvailableKey = () => {
  const startIndex = currentKeyIndex;
  let attempts = 0;

  while (attempts < apiKeys.length) {
    const index = (startIndex + attempts) % apiKeys.length;
    const keyObj = apiKeys[index];

    if (!keyObj.isExhausted) {
      currentKeyIndex = (index + 1) % apiKeys.length; // Move to next for next call
      return { key: keyObj.key, index };
    }
    attempts++;
  }

  // All keys are exhausted
  return null;
};

/**
 * Get the current model with the active key
 * @returns {Object} - Gemini model instance
 * @throws {Error} - If all keys are exhausted
 */
const getModel = () => {
  const result = getNextAvailableKey();
  
  if (!result) {
    const resetTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleTimeString();
    throw new Error(
      `All Gemini API keys have reached their daily quota. Please try again after midnight (approx ${resetTime}).`
    );
  }

  const { key, index } = result;
  
  // Log which key is being used (for debugging)
  const keyLabel = index === 0 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${index + 1}`;
  console.log(`🔑 [Gemini] Using key: ${keyLabel}`);

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    // Attach key info to model for error handling
    model._keyInfo = { key, index, label: keyLabel };
    
    return model;
  } catch (error) {
    console.error(`❌ [Gemini] Failed to initialize model with ${keyLabel}:`, error.message);
    // Mark this key as exhausted if initialization fails
    markKeyAsExhausted(index);
    // Retry with next key
    return getModel();
  }
};

/**
 * Mark a specific key as exhausted (rate limited or quota reached)
 * @param {number} index - The index of the key to mark
 */
const markKeyAsExhausted = (index) => {
  if (index < 0 || index >= apiKeys.length) return;
  
  const keyObj = apiKeys[index];
  if (keyObj.isExhausted) return; // Already marked

  keyObj.isExhausted = true;
  const label = index === 0 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${index + 1}`;
  console.warn(`⚠️ [Gemini] Key "${label}" marked as exhausted (rate limit/quota reached)`);
  
  // Log remaining active keys
  const activeCount = apiKeys.filter(k => !k.isExhausted).length;
  console.log(`📊 [Gemini] ${activeCount} of ${apiKeys.length} keys still active`);
};

/**
 * Reset all keys (call at midnight or on server restart)
 */
const resetAllKeys = () => {
  console.log('🔄 [Gemini] Resetting all API keys...');
  apiKeys.forEach(keyObj => {
    keyObj.isExhausted = false;
    keyObj.lastUsed = null;
  });
  currentKeyIndex = 0;
  console.log(`✅ [Gemini] All ${apiKeys.length} keys reset`);
};

/**
 * Check if a specific error indicates quota/rate limit exhaustion
 * @param {Error} error - The error from Gemini API
 * @returns {boolean} - True if the error is quota/rate limit related
 */
const isQuotaError = (error) => {
  const message = error?.message || '';
  const status = error?.status || error?.response?.status || '';
  
  return (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('Too Many Requests') ||
    status === 429
  );
};

/**
 * Execute a Gemini API call with automatic key rotation on quota errors
 * @param {Function} apiCall - Async function that takes a model and returns a result
 * @param {number} retryCount - Internal retry counter
 * @returns {Promise<any>} - The result of the API call
 */
const withKeyRotation = async (apiCall, retryCount = 0) => {
  try {
    const model = getModel();
    const result = await apiCall(model);
    return result;
  } catch (error) {
    // Check if this is a quota/rate limit error
    if (isQuotaError(error)) {
      const model = getModel(); // This gets the current model with key info
      const keyIndex = model._keyInfo?.index ?? -1;
      
      if (keyIndex >= 0) {
        // Mark the current key as exhausted
        markKeyAsExhausted(keyIndex);
        
        // Retry with next key if we haven't exceeded max retries
        if (retryCount < MAX_RETRIES * apiKeys.length) {
          console.log(`🔄 [Gemini] Retrying with next key (attempt ${retryCount + 1})...`);
          return withKeyRotation(apiCall, retryCount + 1);
        }
      }
    }
    
    // Re-throw if not a quota error or retries exhausted
    throw error;
  }
};

// --- Export ---
module.exports = {
  // Core exports
  getModel,
  withKeyRotation,
  
  // Key management
  markKeyAsExhausted,
  resetAllKeys,
  getAvailableKeyCount: () => apiKeys.filter(k => !k.isExhausted).length,
  isQuotaError,
  
  // Legacy exports for backward compatibility (deprecated, use getModel instead)
  get genAI() {
    const model = getModel();
    return model ? { getGenerativeModel: () => model } : null;
  },
  get model() {
    return getModel();
  },
};
