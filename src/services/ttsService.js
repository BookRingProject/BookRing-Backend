const ttsConfig = require('../config/tts');
const { uploadAudio } = require('./uploadService');

const convertToAudio = async (text, title) => {
  try {
    const response = await fetch(`${ttsConfig.ttsApiUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ttsConfig.ttsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        voice: 'alloy',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'TTS conversion failed');
    }

    // Get audio as buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Upload to Cloudinary and get URL
    const audioUrl = await uploadAudio(audioBuffer, title);
    
    return audioUrl;  // Return the URL, not the buffer
  } catch (error) {
    console.error('TTS conversion error:', error);
    throw new Error('Failed to convert text to audio: ' + error.message);
  }
};

module.exports = {
  convertToAudio,
};
