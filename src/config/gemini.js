const { GoogleGenerativeAI } = require('@google/generative-ai');

// ============================================================
// CONFIGURATION
// ============================================================

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

// Number of retries AFTER the first attempt.
// Example: MAX_RETRIES = 2 means up to 3 attempts per key.
const MAX_RETRIES = 2;

// Initial delay for temporary errors.
// Retries use exponential backoff:
// 2s → 4s
const INITIAL_RETRY_DELAY = 2000;

// Maximum delay between retries.
const MAX_RETRY_DELAY = 10000;

// ============================================================
// LOAD API KEYS
// ============================================================

const loadApiKeys = () => {
  const keys = [];

  // Primary key
  const primaryKey = process.env.GEMINI_API_KEY;

  if (primaryKey) {
    keys.push({
      key: primaryKey,
      isExhausted: false,
      lastUsed: null,
    });
  } else {
    console.warn(
      '⚠️ [Gemini] GEMINI_API_KEY is not set'
    );
  }

  // Additional keys
  let index = 2;

  while (index <= 5) {
    const envName = `GEMINI_API_KEY_${index}`;
    const key = process.env[envName];

    if (key) {
      keys.push({
        key,
        isExhausted: false,
        lastUsed: null,
      });

      console.log(
        `✅ [Gemini] Loaded additional key: ${envName}`
      );
    }

    index++;
  }

  if (keys.length === 0) {
    console.error(
      '❌ [Gemini] No Gemini API keys found!'
    );
  } else {
    console.log(
      `✅ [Gemini] Loaded ${keys.length} Gemini API key(s)`
    );
  }

  return keys;
};

// ============================================================
// STATE
// ============================================================

let apiKeys = loadApiKeys();
let currentKeyIndex = 0;

// ============================================================
// HELPERS
// ============================================================

/**
 * Get a readable label for a key.
 *
 * @param {number} index
 * @returns {string}
 */
const getKeyLabel = (index) => {
  return index === 0
    ? 'GEMINI_API_KEY'
    : `GEMINI_API_KEY_${index + 1}`;
};

/**
 * Extract HTTP status from Gemini errors.
 *
 * @param {Error} error
 * @returns {number|null}
 */
const getErrorStatus = (error) => {
  if (!error) {
    return null;
  }

  const possibleStatuses = [
    error.status,
    error.statusCode,
    error.response?.status,
    error.response?.statusCode,
  ];

  for (const status of possibleStatuses) {
    if (typeof status === 'number') {
      return status;
    }

    if (typeof status === 'string' && /^\d+$/.test(status)) {
      return Number(status);
    }
  }

  // Some Gemini errors only expose the status inside message text.
  const message = error.message || '';

  const match = message.match(
    /\[(\d{3})\]/
  );

  if (match) {
    return Number(match[1]);
  }

  return null;
};

/**
 * Wait before retrying.
 *
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
const sleep = (milliseconds) => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

/**
 * Calculate exponential backoff delay.
 *
 * @param {number} retryNumber
 * @returns {number}
 */
const getRetryDelay = (retryNumber) => {
  const exponentialDelay =
    INITIAL_RETRY_DELAY * Math.pow(2, retryNumber);

  return Math.min(
    exponentialDelay,
    MAX_RETRY_DELAY
  );
};

// ============================================================
// KEY MANAGEMENT
// ============================================================

/**
 * Get next available API key using round-robin.
 *
 * Exhausted keys are skipped.
 *
 * @returns {{key: string, index: number}|null}
 */
const getNextAvailableKey = () => {
  if (apiKeys.length === 0) {
    return null;
  }

  const startIndex = currentKeyIndex;

  for (let attempts = 0; attempts < apiKeys.length; attempts++) {
    const index =
      (startIndex + attempts) % apiKeys.length;

    const keyObj = apiKeys[index];

    if (!keyObj.isExhausted) {
      currentKeyIndex =
        (index + 1) % apiKeys.length;

      keyObj.lastUsed = new Date();

      return {
        key: keyObj.key,
        index,
      };
    }
  }

  return null;
};

/**
 * Get Gemini model using next available API key.
 *
 * @returns {Object}
 */
const getModel = () => {
  const result = getNextAvailableKey();

  if (!result) {
    throw new Error(
      'All Gemini API keys are currently exhausted. ' +
      'Please check your Gemini API quotas or reset the keys.'
    );
  }

  const {
    key,
    index,
  } = result;

  const keyLabel = getKeyLabel(index);

  console.log(
    `🔑 [Gemini] Using key: ${keyLabel}`
  );

  try {
    const genAI =
      new GoogleGenerativeAI(key);

    const model =
      genAI.getGenerativeModel({
        model: MODEL_NAME,
      });

    // Store information on the model so that
    // withKeyRotation knows which key actually failed.
    model._keyInfo = {
      key,
      index,
      label: keyLabel,
    };

    return model;

  } catch (error) {
    console.error(
      `❌ [Gemini] Failed to initialize ${keyLabel}:`,
      error.message
    );

    // Initialization problems are treated as unusable keys.
    markKeyAsExhausted(index);

    // Try another key.
    return getModel();
  }
};

/**
 * Mark a key as exhausted.
 *
 * This should mainly be used for quota/rate-limit errors.
 *
 * @param {number} index
 */
const markKeyAsExhausted = (index) => {
  if (
    index < 0 ||
    index >= apiKeys.length
  ) {
    return;
  }

  const keyObj = apiKeys[index];

  if (keyObj.isExhausted) {
    return;
  }

  keyObj.isExhausted = true;

  const label = getKeyLabel(index);

  console.warn(
    `⚠️ [Gemini] ${label} marked as exhausted`
  );

  const activeCount =
    apiKeys.filter(
      (key) => !key.isExhausted
    ).length;

  console.log(
    `📊 [Gemini] ${activeCount} of ${apiKeys.length} key(s) still active`
  );
};

/**
 * Reset all keys.
 */
const resetAllKeys = () => {
  console.log(
    '🔄 [Gemini] Resetting all API keys...'
  );

  apiKeys.forEach((keyObj) => {
    keyObj.isExhausted = false;
    keyObj.lastUsed = null;
  });

  currentKeyIndex = 0;

  console.log(
    `✅ [Gemini] All ${apiKeys.length} key(s) reset`
  );
};

// ============================================================
// ERROR DETECTION
// ============================================================

/**
 * Determine whether an error is caused by quota/rate limiting.
 *
 * Usually HTTP 429.
 *
 * @param {Error} error
 * @returns {boolean}
 */
const isQuotaError = (error) => {
  const message =
    error?.message || '';

  const status =
    getErrorStatus(error);

  const normalizedMessage =
    message.toLowerCase();

  return (
    status === 429 ||

    normalizedMessage.includes('429') ||

    normalizedMessage.includes('quota') ||

    normalizedMessage.includes(
      'rate limit'
    ) ||

    normalizedMessage.includes(
      'resource_exhausted'
    ) ||

    normalizedMessage.includes(
      'too many requests'
    )
  );
};

/**
 * Determine whether an error is temporary.
 *
 * Includes:
 * 500
 * 502
 * 503
 * 504
 *
 * Also detects Gemini's "high demand" message.
 *
 * @param {Error} error
 * @returns {boolean}
 */
const isTemporaryError = (error) => {
  const message =
    error?.message || '';

  const status =
    getErrorStatus(error);

  const normalizedMessage =
    message.toLowerCase();

  return (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||

    normalizedMessage.includes('500') ||

    normalizedMessage.includes('502') ||

    normalizedMessage.includes('503') ||

    normalizedMessage.includes('504') ||

    normalizedMessage.includes(
      'service unavailable'
    ) ||

    normalizedMessage.includes(
      'high demand'
    ) ||

    normalizedMessage.includes(
      'temporarily unavailable'
    ) ||

    normalizedMessage.includes(
      'internal server error'
    )
  );
};

// ============================================================
// GEMINI API CALL WITH KEY ROTATION
// ============================================================

/**
 * Execute a Gemini API call with:
 *
 * 1. Multiple API keys
 * 2. Round-robin key selection
 * 3. Quota detection
 * 4. Temporary error retries
 * 5. Exponential backoff
 * 6. Automatic key rotation
 *
 * @param {Function} apiCall
 * @returns {Promise<any>}
 */
const withKeyRotation = async (apiCall) => {
  if (
    typeof apiCall !== 'function'
  ) {
    throw new TypeError(
      '[Gemini] apiCall must be a function'
    );
  }

  if (apiKeys.length === 0) {
    throw new Error(
      'No Gemini API keys are configured. ' +
      'Please set GEMINI_API_KEY in your environment.'
    );
  }

  let lastError = null;

  /*
   * We allow each available key to be tried.
   *
   * A key can have:
   * - one initial attempt
   * - MAX_RETRIES additional attempts for temporary errors
   */

  const keysAvailableAtStart =
    apiKeys.filter(
      (key) => !key.isExhausted
    ).length;

  for (
    let keyAttempt = 0;
    keyAttempt < keysAvailableAtStart;
    keyAttempt++
  ) {
    let model;

    try {
      model = getModel();
    } catch (error) {
      lastError = error;

      console.error(
        '❌ [Gemini] Unable to get an available key:',
        error.message
      );

      break;
    }

    const keyIndex =
      model?._keyInfo?.index ?? -1;

    const keyLabel =
      model?._keyInfo?.label ||
      getKeyLabel(keyIndex);

    /*
     * ========================================================
     * RETRY THIS KEY FOR TEMPORARY ERRORS
     * ========================================================
     */

    for (
      let retry = 0;
      retry <= MAX_RETRIES;
      retry++
    ) {
      try {
        const result =
          await apiCall(model);

        return result;

      } catch (error) {
        lastError = error;

        const status =
          getErrorStatus(error);

        console.error(
          `❌ [Gemini] Request failed using ${keyLabel} ` +
          `(status: ${status || 'unknown'}):`,
          error.message
        );

        /*
         * ====================================================
         * QUOTA / RATE LIMIT
         * ====================================================
         *
         * Do NOT retry the same key.
         * Mark it exhausted and move to the next key.
         */

        if (isQuotaError(error)) {
          console.warn(
            `⚠️ [Gemini] ${keyLabel} reached quota/rate limit.`
          );

          markKeyAsExhausted(keyIndex);

          break;
        }

        /*
         * ====================================================
         * TEMPORARY ERROR - 500/502/503/504
         * ====================================================
         *
         * Retry the SAME key first.
         *
         * This is important for your current 503 error:
         *
         * "This model is currently experiencing high demand."
         */

        if (isTemporaryError(error)) {
          if (retry < MAX_RETRIES) {
            const delay =
              getRetryDelay(retry);

            console.warn(
              `⏳ [Gemini] Temporary error on ${keyLabel}. ` +
              `Retrying in ${delay}ms... ` +
              `(${retry + 1}/${MAX_RETRIES})`
            );

            await sleep(delay);

            continue;
          }

          /*
           * Temporary error persisted after retries.
           *
           * Do NOT mark the key as exhausted because
           * 503 does not necessarily mean the key is bad.
           *
           * Move to another key if one exists.
           */

          console.warn(
            `⚠️ [Gemini] ${keyLabel} is still unavailable ` +
            `after ${MAX_RETRIES} retry(s). ` +
            `Trying another key...`
          );

          break;
        }

        /*
         * ====================================================
         * OTHER ERRORS
         * ====================================================
         *
         * Examples:
         * - 400 bad request
         * - invalid prompt
         * - invalid file
         * - unsupported request
         *
         * These should NOT rotate keys because another key
         * probably won't fix the problem.
         */

        console.error(
          `❌ [Gemini] Non-retryable error from ${keyLabel}.`
        );

        throw error;
      }
    }
  }

  /*
   * ==========================================================
   * ALL AVAILABLE KEYS WERE TRIED
   * ==========================================================
   */

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    'Gemini request failed and no available API key remains.'
  );
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Core
  getModel,
  withKeyRotation,

  // Key management
  markKeyAsExhausted,
  resetAllKeys,

  getAvailableKeyCount: () =>
    apiKeys.filter(
      (key) => !key.isExhausted
    ).length,

  // Error helpers
  isQuotaError,
  isTemporaryError,

  // Legacy compatibility
  get genAI() {
    const model = getModel();

    return model
      ? {
          getGenerativeModel: () => model,
        }
      : null;
  },

  get model() {
    return getModel();
  },
};
