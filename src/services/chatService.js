'use strict';

const axios = require('axios');
const {
  withKeyRotation,
  isQuotaError,
} = require('../config/gemini');

/**
 * Maximum file size allowed for inline Gemini processing.
 * Adjust this to match your application's requirements.
 */
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * HTTP timeout for downloading source files.
 */
const FILE_FETCH_TIMEOUT_MS = 30_000;

/**
 * Maximum amount of extracted text sent in the text fallback.
 */
const MAX_TEXT_LENGTH = 50_000;

/**
 * Safely convert an unknown error into a useful string.
 *
 * @param {unknown} error
 * @returns {string}
 */
const getErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

/**
 * Extract an HTTP status code from an error when available.
 *
 * @param {unknown} error
 * @returns {number|null}
 */
const getErrorStatus = (error) => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const possibleStatuses = [
    error.status,
    error.statusCode,
    error.response?.status,
    error.originalError?.response?.status,
  ];

  for (const status of possibleStatuses) {
    const numericStatus = Number(status);

    if (Number.isInteger(numericStatus) && numericStatus >= 100) {
      return numericStatus;
    }
  }

  return null;
};

/**
 * Determine whether an error is a file-fetch error created by this service.
 *
 * This intentionally checks structured error properties rather than
 * searching the error message for the word "fetch". That prevents a
 * Gemini quota/API error from being incorrectly reported as a file error.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
const isFileFetchError = (error) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (
    error.name === 'FileFetchError' ||
    error.code === 'FILE_FETCH_ERROR'
  );
};

/**
 * Determine whether an error means all available Gemini keys are exhausted.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
const isAllKeysExhaustedError = (error) => {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('all gemini api keys have reached their daily quota') ||
    message.includes('all gemini api keys are exhausted') ||
    message.includes('all gemini keys are exhausted') ||
    message.includes('all api keys have been exhausted') ||
    message.includes('all available gemini keys are exhausted') ||
    message.includes('no gemini api keys available') ||
    message.includes('all keys exhausted')
  );
};

/**
 * Determine whether an error is a Gemini quota/rate-limit failure.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
const isGeminiQuotaOrRateLimitError = (error) => {
  if (!error) {
    return false;
  }

  try {
    if (typeof isQuotaError === 'function' && isQuotaError(error)) {
      return true;
    }
  } catch (detectorError) {
    console.warn(
      '⚠️ [Gemini] isQuotaError() threw an error:',
      getErrorMessage(detectorError)
    );
  }

  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('ratelimit') ||
    message.includes('too many requests') ||
    message.includes('resource exhausted') ||
    message.includes('resource_exhausted') ||
    message.includes('limit exceeded') ||
    message.includes('daily quota') ||
    message.includes('free_tier') ||
    message.includes('generate_content_free_tier_requests') ||
    message.includes('429') ||
    message.includes('http 429')
  );
};

/**
 * Determine whether an error is related to Gemini authentication.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
const isGeminiAuthenticationError = (error) => {
  const message = getErrorMessage(error).toLowerCase();

  const status = getErrorStatus(error);

  if (status === 401) {
    return true;
  }

  return (
    message.includes('invalid api key') ||
    message.includes('invalid_api_key') ||
    message.includes('api key not valid') ||
    message.includes('api_key not valid') ||
    message.includes('authentication failed') ||
    message.includes('unauthenticated') ||
    message.includes('unauthorized') ||
    message.includes('permission denied') ||
    message.includes('api key')
  );
};

/**
 * Determine whether the file URL itself likely failed with an HTTP
 * authorization error.
 *
 * This is only used inside fetchFileAsBase64(), where the HTTP request
 * definitely came from Axios fetching the file.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
const isFileAuthorizationError = (error) => {
  const status = getErrorStatus(error);

  return status === 401 || status === 403;
};

/**
 * Convert a remote file URL to base64.
 *
 * @param {string} fileUrl
 * @returns {Promise<string>}
 */
const fetchFileAsBase64 = async (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== 'string') {
    const error = new Error('A valid file URL is required.');
    error.name = 'FileFetchError';
    error.code = 'FILE_FETCH_ERROR';
    error.status = null;
    throw error;
  }

  try {
    console.log('📥 [fetchFileAsBase64] Fetching file:', fileUrl);

    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: FILE_FETCH_TIMEOUT_MS,
      maxContentLength: MAX_FILE_SIZE_BYTES,
      maxBodyLength: MAX_FILE_SIZE_BYTES,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        Accept: '*/*',
      },
    });

    const contentLengthHeader = response.headers?.['content-length'];

    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);

      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_FILE_SIZE_BYTES
      ) {
        const error = new Error(
          `File exceeds the maximum supported size of ${Math.round(
            MAX_FILE_SIZE_BYTES / 1024 / 1024
          )} MB.`
        );

        error.name = 'FileFetchError';
        error.code = 'FILE_FETCH_ERROR';
        error.status = 413;

        throw error;
      }
    }

    const buffer = Buffer.from(response.data);

    if (!buffer.length) {
      const error = new Error('The downloaded file is empty.');

      error.name = 'FileFetchError';
      error.code = 'FILE_FETCH_ERROR';
      error.status = 422;

      throw error;
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      const error = new Error(
        `File exceeds the maximum supported size of ${Math.round(
          MAX_FILE_SIZE_BYTES / 1024 / 1024
        )} MB.`
      );

      error.name = 'FileFetchError';
      error.code = 'FILE_FETCH_ERROR';
      error.status = 413;

      throw error;
    }

    const base64 = buffer.toString('base64');

    console.log(
      `✅ [fetchFileAsBase64] File fetched successfully. Size: ${(
        buffer.length /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    console.log(
      `📄 [fetchFileAsBase64] Content-Type: ${
        response.headers?.['content-type'] || 'unknown'
      }`
    );

    return base64;
  } catch (originalError) {
    if (isFileFetchError(originalError)) {
      console.error(
        '❌ [fetchFileAsBase64]',
        getErrorMessage(originalError)
      );

      throw originalError;
    }

    const status = getErrorStatus(originalError);

    console.error(
      '❌ [fetchFileAsBase64] Failed to fetch file:',
      getErrorMessage(originalError)
    );

    if (status) {
      console.error(`   HTTP Status: ${status}`);
    }

    if (originalError?.code) {
      console.error(`   Error Code: ${originalError.code}`);
    }

    let message = `Failed to fetch file: ${getErrorMessage(originalError)}`;

    if (isFileAuthorizationError(originalError)) {
      message =
        'The file server denied access to the requested book file.';
    } else if (
      originalError?.code === 'ECONNABORTED' ||
      originalError?.code === 'ETIMEDOUT'
    ) {
      message = 'The file server took too long to respond.';
    } else if (
      originalError?.code === 'ENOTFOUND' ||
      originalError?.code === 'EAI_AGAIN'
    ) {
      message = 'The file server could not be reached.';
    }

    const fetchError = new Error(message);

    fetchError.name = 'FileFetchError';
    fetchError.code = 'FILE_FETCH_ERROR';
    fetchError.status = status;
    fetchError.originalError = originalError;

    throw fetchError;
  }
};

/**
 * Build the prompt used for file-based book chat.
 *
 * @param {string} bookTitle
 * @param {string} userMessage
 * @returns {string}
 */
const buildFilePrompt = (bookTitle, userMessage) => {
  return `You are BRbot, an AI study assistant for the book "${bookTitle}".

The user is asking:
"${userMessage}"

Analyze the provided book file and answer the user's question based on its content.

Response requirements:
- Be accurate and educational.
- Use the book as the primary source.
- Reference specific sections, chapters, concepts, or passages when relevant.
- Do not invent information that is not supported by the book.
- If the answer cannot be found in the book, clearly say so.
- Keep the explanation easy to understand.
- Use Markdown formatting.
- Use **bold** for important terms and section headings.
- Use bullet points for lists.
- Use numbered lists for sequential steps.
- Use blockquotes for short relevant quotations or callouts.
- Keep paragraphs well spaced.

Respond directly to the user's question.`;
};

/**
 * Build the prompt used for text-based book chat.
 *
 * @param {string} bookTitle
 * @param {string} userMessage
 * @param {string} textContent
 * @returns {string}
 */
const buildTextPrompt = (bookTitle, userMessage, textContent) => {
  return `You are BRbot, an AI study assistant for the book "${bookTitle}".

Book content:
${textContent}

The user is asking:
"${userMessage}"

Answer the user's question using the provided book content as the primary source.

Guidelines:
- Be accurate and educational.
- Reference relevant parts of the book when possible.
- Do not invent information that is not supported by the provided content.
- If the answer is not contained in the provided content, clearly say so.
- Explain difficult ideas in simple language.
- Use Markdown formatting.
- Use **bold** for important terms and headings.
- Use bullet points and numbered lists when useful.
- Keep paragraphs clear and well spaced.

Respond directly to the user's question.`;
};

/**
 * Chat with Gemini using a remote file.
 *
 * @param {string} fileUrl
 * @param {string} mimeType
 * @param {string} userMessage
 * @param {string} bookTitle
 * @returns {Promise<string>}
 */
const chatWithFile = async (
  fileUrl,
  mimeType,
  userMessage,
  bookTitle
) => {
  try {
    if (!mimeType || typeof mimeType !== 'string') {
      throw new Error('A valid MIME type is required.');
    }

    if (!userMessage || typeof userMessage !== 'string') {
      throw new Error('A valid user message is required.');
    }

    if (!bookTitle || typeof bookTitle !== 'string') {
      throw new Error('A valid book title is required.');
    }

    console.log('🤖 [chatWithFile] Starting Gemini file chat...');
    console.log(`📚 [chatWithFile] Book: "${bookTitle}"`);
    console.log(`📝 [chatWithFile] User message: "${userMessage}"`);
    console.log(`📄 [chatWithFile] MIME type: ${mimeType}`);

    // ---------------------------------------------------------
    // STEP 1: Download the file.
    // Any error from this stage is explicitly marked as a
    // FileFetchError.
    // ---------------------------------------------------------
    const base64File = await fetchFileAsBase64(fileUrl);

    console.log(
      `✅ [chatWithFile] File converted to base64. Encoded size: ${(
        base64File.length /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    // ---------------------------------------------------------
    // STEP 2: Build prompt.
    // ---------------------------------------------------------
    const prompt = buildFilePrompt(bookTitle, userMessage);

    console.log(
      `📏 [chatWithFile] Prompt length: ${prompt.length} characters`
    );

    // ---------------------------------------------------------
    // STEP 3: Send exactly one Gemini generation request from
    // this function. Key rotation is handled centrally.
    // ---------------------------------------------------------
    console.log(
      '📤 [chatWithFile] Sending request through Gemini key rotation...'
    );

    const startTime = Date.now();

    const result = await withKeyRotation(async (model) => {
      return model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64File,
          },
        },
      ]);
    });

    const elapsedSeconds = (
      (Date.now() - startTime) /
      1000
    ).toFixed(2);

    // ---------------------------------------------------------
    // STEP 4: Validate Gemini response.
    // ---------------------------------------------------------
    const response = result?.response;

    if (!response) {
      const error = new Error(
        'Gemini returned no response object.'
      );

      error.code = 'EMPTY_GEMINI_RESPONSE';
      throw error;
    }

    let text;

    try {
      text = response.text();
    } catch (responseError) {
      console.error(
        '❌ [chatWithFile] Failed to extract Gemini response:',
        getErrorMessage(responseError)
      );

      const error = new Error(
        'Gemini returned an invalid response.'
      );

      error.code = 'INVALID_GEMINI_RESPONSE';
      error.originalError = responseError;

      throw error;
    }

    if (!text || !text.trim()) {
      const error = new Error(
        'Gemini returned an empty response.'
      );

      error.code = 'EMPTY_GEMINI_RESPONSE';
      throw error;
    }

    console.log(
      `✅ [chatWithFile] Gemini response received in ${elapsedSeconds}s`
    );

    console.log(
      `📏 [chatWithFile] Response length: ${text.length} characters`
    );

    console.log(
      `📝 [chatWithFile] Response preview: ${text
        .replace(/\s+/g, ' ')
        .substring(0, 150)}...`
    );

    return text;
  } catch (error) {
    const message = getErrorMessage(error);
    const status = getErrorStatus(error);

    console.error(
      '❌ [chatWithFile] Error:',
      message
    );

    if (status) {
      console.error(
        `   Status: ${status}`
      );
    }

    // ---------------------------------------------------------
    // 1. ACTUAL FILE FETCH ERROR
    // ---------------------------------------------------------
    if (isFileFetchError(error)) {
      console.error(
        '🔴 [chatWithFile] Confirmed file-fetch failure.'
      );

      throw new Error(
        'Could not access the book file. Please make sure the file is available and try again.'
      );
    }

    // ---------------------------------------------------------
    // 2. ALL KEYS EXHAUSTED
    // ---------------------------------------------------------
    if (isAllKeysExhaustedError(error)) {
      console.error(
        '🔴 [chatWithFile] All configured Gemini API keys are exhausted.'
      );

      const serviceError = new Error(
        'The AI service has temporarily reached its request limit. Please try again later.'
      );

      serviceError.code = 'GEMINI_ALL_KEYS_EXHAUSTED';
      serviceError.status = 429;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 3. GEMINI QUOTA / RATE LIMIT
    // ---------------------------------------------------------
    if (isGeminiQuotaOrRateLimitError(error)) {
      console.error(
        '🔴 [chatWithFile] Gemini quota/rate limit exceeded.'
      );

      const serviceError = new Error(
        'The AI service has temporarily reached its request limit. Please try again later.'
      );

      serviceError.code = 'GEMINI_QUOTA_EXCEEDED';
      serviceError.status = 429;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 4. GEMINI AUTHENTICATION
    // ---------------------------------------------------------
    if (isGeminiAuthenticationError(error)) {
      console.error(
        '🔴 [chatWithFile] Gemini authentication/API-key error.'
      );

      const serviceError = new Error(
        'The AI service could not authenticate this request. Please try again later.'
      );

      serviceError.code = 'GEMINI_AUTHENTICATION_ERROR';
      serviceError.status = status || 401;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 5. EXPLICIT HTTP RATE LIMIT
    // ---------------------------------------------------------
    if (status === 429) {
      console.error(
        '🔴 [chatWithFile] HTTP 429 received from Gemini.'
      );

      const serviceError = new Error(
        'The AI service has temporarily reached its request limit. Please try again later.'
      );

      serviceError.code = 'GEMINI_RATE_LIMITED';
      serviceError.status = 429;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 6. OTHER AUTHORIZATION ERRORS
    // ---------------------------------------------------------
    if (status === 401 || status === 403) {
      console.error(
        `🔴 [chatWithFile] Gemini returned HTTP ${status}.`
      );

      const serviceError = new Error(
        'The AI service could not authorize this request. Please try again later.'
      );

      serviceError.code = 'GEMINI_AUTHORIZATION_ERROR';
      serviceError.status = status;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 7. GENERIC ERROR
    // ---------------------------------------------------------
    console.error(
      '🔴 [chatWithFile] Unhandled Gemini error:',
      error
    );

    const serviceError = new Error(
      'Failed to get an AI response. Please try again.'
    );

    serviceError.code = 'GEMINI_REQUEST_FAILED';
    serviceError.originalError = error;

    throw serviceError;
  }
};

/**
 * Chat with Gemini using pre-extracted text.
 *
 * @param {string} textContent
 * @param {string} userMessage
 * @param {string} bookTitle
 * @returns {Promise<string>}
 */
const chatWithText = async (
  textContent,
  userMessage,
  bookTitle
) => {
  try {
    if (!textContent || typeof textContent !== 'string') {
      throw new Error('No text content was provided.');
    }

    if (!userMessage || typeof userMessage !== 'string') {
      throw new Error('A valid user message is required.');
    }

    if (!bookTitle || typeof bookTitle !== 'string') {
      throw new Error('A valid book title is required.');
    }

    console.log('📝 [chatWithText] Starting text fallback...');
    console.log(`📚 [chatWithText] Book: "${bookTitle}"`);
    console.log(
      `📏 [chatWithText] Original text length: ${textContent.length} characters`
    );

    const truncatedText =
      textContent.length > MAX_TEXT_LENGTH
        ? `${textContent.substring(
            0,
            MAX_TEXT_LENGTH
          )}\n\n... [content truncated]`
        : textContent;

    console.log(
      `📏 [chatWithText] Text sent to Gemini: ${truncatedText.length} characters`
    );

    const prompt = buildTextPrompt(
      bookTitle,
      userMessage,
      truncatedText
    );

    console.log(
      `📏 [chatWithText] Prompt length: ${prompt.length} characters`
    );

    console.log(
      '📤 [chatWithText] Sending request through Gemini key rotation...'
    );

    const startTime = Date.now();

    const result = await withKeyRotation(async (model) => {
      return model.generateContent(prompt);
    });

    const elapsedSeconds = (
      (Date.now() - startTime) /
      1000
    ).toFixed(2);

    const response = result?.response;

    if (!response) {
      const error = new Error(
        'Gemini returned no response object.'
      );

      error.code = 'EMPTY_GEMINI_RESPONSE';
      throw error;
    }

    let text;

    try {
      text = response.text();
    } catch (responseError) {
      console.error(
        '❌ [chatWithText] Failed to extract Gemini response:',
        getErrorMessage(responseError)
      );

      const error = new Error(
        'Gemini returned an invalid response.'
      );

      error.code = 'INVALID_GEMINI_RESPONSE';
      error.originalError = responseError;

      throw error;
    }

    if (!text || !text.trim()) {
      const error = new Error(
        'Gemini returned an empty response.'
      );

      error.code = 'EMPTY_GEMINI_RESPONSE';
      throw error;
    }

    console.log(
      `✅ [chatWithText] Gemini response received in ${elapsedSeconds}s`
    );

    console.log(
      `📏 [chatWithText] Response length: ${text.length} characters`
    );

    return text;
  } catch (error) {
    const message = getErrorMessage(error);
    const status = getErrorStatus(error);

    console.error(
      '❌ [chatWithText] Error:',
      message
    );

    if (status) {
      console.error(
        `   Status: ${status}`
      );
    }

    // ---------------------------------------------------------
    // 1. ALL KEYS EXHAUSTED
    // ---------------------------------------------------------
    if (isAllKeysExhaustedError(error)) {
      console.error(
        '🔴 [chatWithText] All Gemini API keys are exhausted.'
      );

      const serviceError = new Error(
        'The AI service has temporarily reached its request limit. Please try again later.'
      );

      serviceError.code = 'GEMINI_ALL_KEYS_EXHAUSTED';
      serviceError.status = 429;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 2. QUOTA/RATE LIMIT
    // ---------------------------------------------------------
    if (isGeminiQuotaOrRateLimitError(error)) {
      console.error(
        '🔴 [chatWithText] Gemini quota/rate limit exceeded.'
      );

      const serviceError = new Error(
        'The AI service has temporarily reached its request limit. Please try again later.'
      );

      serviceError.code = 'GEMINI_QUOTA_EXCEEDED';
      serviceError.status = 429;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 3. AUTHENTICATION
    // ---------------------------------------------------------
    if (isGeminiAuthenticationError(error)) {
      console.error(
        '🔴 [chatWithText] Gemini authentication/API-key error.'
      );

      const serviceError = new Error(
        'The AI service could not authenticate this request. Please try again later.'
      );

      serviceError.code = 'GEMINI_AUTHENTICATION_ERROR';
      serviceError.status = status || 401;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 4. HTTP RATE LIMIT
    // ---------------------------------------------------------
    if (status === 429) {
      console.error(
        '🔴 [chatWithText] HTTP 429 received from Gemini.'
      );

      const serviceError = new Error(
        'The AI service has temporarily reached its request limit. Please try again later.'
      );

      serviceError.code = 'GEMINI_RATE_LIMITED';
      serviceError.status = 429;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 5. OTHER AUTHORIZATION ERRORS
    // ---------------------------------------------------------
    if (status === 401 || status === 403) {
      console.error(
        `🔴 [chatWithText] Gemini returned HTTP ${status}.`
      );

      const serviceError = new Error(
        'The AI service could not authorize this request. Please try again later.'
      );

      serviceError.code = 'GEMINI_AUTHORIZATION_ERROR';
      serviceError.status = status;

      throw serviceError;
    }

    // ---------------------------------------------------------
    // 6. GENERIC ERROR
    // ---------------------------------------------------------
    console.error(
      '🔴 [chatWithText] Unhandled error:',
      error
    );

    const serviceError = new Error(
      'Failed to get an AI response from the text content. Please try again.'
    );

    serviceError.code = 'GEMINI_TEXT_REQUEST_FAILED';
    serviceError.originalError = error;

    throw serviceError;
  }
};

module.exports = {
  chatWithFile,
  chatWithText,
  fetchFileAsBase64,
};
