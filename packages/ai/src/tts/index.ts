// Service interface and Context.Tag
export {
  TTS,
  type TTSService,
  type AudioEncoding,
  type SpeakerTurn,
  type SpeakerVoiceConfig,
  type SynthesizeOptions,
  type SynthesizeResult,
  type ListVoicesOptions,
  type PreviewVoiceOptions,
  type PreviewVoiceResult,
} from './service';

// Voices
export {
  VOICES,
  FEMALE_VOICES,
  MALE_VOICES,
  ALL_VOICE_IDS,
  type GeminiVoiceId,
  type VoiceGender,
  type VoiceInfo,
  isValidVoiceId,
  getVoiceById,
  getVoicesByGender,
  getVoiceGender,
  DEFAULT_PREVIEW_TEXT,
} from './voices';

// Google provider (Gemini API)
export { GoogleTTSLive, type GoogleTTSConfig } from './providers/google';

// Use Cases - Error types are inferred by Effect
export {
  // Errors
  VoiceNotFoundError,
  // Use cases
  listVoices,
  listVoicesWithPreviews,
  previewVoice,
  // Types
  type ListVoicesInput,
  type ListVoicesResult,
  type ListVoicesWithPreviewsInput,
  type VoiceWithPreview,
  type PreviewVoiceInput,
  type PreviewVoiceUseCaseResult,
} from './use-cases';
