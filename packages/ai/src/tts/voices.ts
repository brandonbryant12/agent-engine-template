/**
 * Available Gemini TTS voices.
 * Based on Google Cloud TTS documentation.
 * @see https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
 */

export type VoiceGender = 'female' | 'male';

export interface VoiceInfo {
  readonly id: string;
  readonly name: string;
  readonly gender: VoiceGender;
  readonly description: string;
}

/**
 * Female voice IDs for Gemini TTS.
 */
export const FEMALE_VOICES = [
  'Achernar',
  'Aoede',
  'Autonoe',
  'Callirrhoe',
  'Despina',
  'Erinome',
  'Gacrux',
  'Kore',
  'Laomedeia',
  'Leda',
  'Pulcherrima',
  'Sulafat',
  'Vindemiatrix',
  'Zephyr',
] as const;

/**
 * Male voice IDs for Gemini TTS.
 */
export const MALE_VOICES = [
  'Achird',
  'Algenib',
  'Algieba',
  'Alnilam',
  'Charon',
  'Enceladus',
  'Fenrir',
  'Iapetus',
  'Orus',
  'Puck',
  'Rasalgethi',
  'Sadachbia',
  'Sadaltager',
  'Schedar',
  'Umbriel',
  'Zubenelgenubi',
] as const;

/**
 * All available Gemini TTS voice IDs.
 */
export const ALL_VOICE_IDS = [...FEMALE_VOICES, ...MALE_VOICES] as const;

/**
 * Type representing valid Gemini TTS voice IDs.
 */
export type GeminiVoiceId = (typeof ALL_VOICE_IDS)[number];

/**
 * Type guard to check if a string is a valid Gemini voice ID.
 */
export const isValidVoiceId = (id: string): id is GeminiVoiceId =>
  ALL_VOICE_IDS.includes(id as GeminiVoiceId);

/**
 * Get the gender of a voice by ID.
 */
export const getVoiceGender = (id: GeminiVoiceId): VoiceGender =>
  FEMALE_VOICES.includes(id as (typeof FEMALE_VOICES)[number])
    ? 'female'
    : 'male';

/**
 * Full voice information for all Gemini TTS voices.
 */
export const VOICES: readonly VoiceInfo[] = [
  // Female voices
  {
    id: 'Achernar',
    name: 'Achernar',
    gender: 'female',
    description: 'Warm and articulate female voice',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'female',
    description: 'Melodic and engaging female voice',
  },
  {
    id: 'Autonoe',
    name: 'Autonoe',
    gender: 'female',
    description: 'Clear and professional female voice',
  },
  {
    id: 'Callirrhoe',
    name: 'Callirrhoe',
    gender: 'female',
    description: 'Smooth and flowing female voice',
  },
  {
    id: 'Despina',
    name: 'Despina',
    gender: 'female',
    description: 'Bright and expressive female voice',
  },
  {
    id: 'Erinome',
    name: 'Erinome',
    gender: 'female',
    description: 'Calm and soothing female voice',
  },
  {
    id: 'Gacrux',
    name: 'Gacrux',
    gender: 'female',
    description: 'Confident and clear female voice',
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    description: 'Youthful and energetic female voice',
  },
  {
    id: 'Laomedeia',
    name: 'Laomedeia',
    gender: 'female',
    description: 'Elegant and refined female voice',
  },
  {
    id: 'Leda',
    name: 'Leda',
    gender: 'female',
    description: 'Friendly and approachable female voice',
  },
  {
    id: 'Pulcherrima',
    name: 'Pulcherrima',
    gender: 'female',
    description: 'Rich and resonant female voice',
  },
  {
    id: 'Sulafat',
    name: 'Sulafat',
    gender: 'female',
    description: 'Dynamic and versatile female voice',
  },
  {
    id: 'Vindemiatrix',
    name: 'Vindemiatrix',
    gender: 'female',
    description: 'Sophisticated and mature female voice',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'female',
    description: 'Light and airy female voice',
  },
  // Male voices
  {
    id: 'Achird',
    name: 'Achird',
    gender: 'male',
    description: 'Steady and reliable male voice',
  },
  {
    id: 'Algenib',
    name: 'Algenib',
    gender: 'male',
    description: 'Strong and authoritative male voice',
  },
  {
    id: 'Algieba',
    name: 'Algieba',
    gender: 'male',
    description: 'Deep and resonant male voice',
  },
  {
    id: 'Alnilam',
    name: 'Alnilam',
    gender: 'male',
    description: 'Warm and inviting male voice',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    description: 'Clear and professional male voice',
  },
  {
    id: 'Enceladus',
    name: 'Enceladus',
    gender: 'male',
    description: 'Calm and measured male voice',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    description: 'Bold and dynamic male voice',
  },
  {
    id: 'Iapetus',
    name: 'Iapetus',
    gender: 'male',
    description: 'Thoughtful and articulate male voice',
  },
  {
    id: 'Orus',
    name: 'Orus',
    gender: 'male',
    description: 'Friendly and conversational male voice',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'male',
    description: 'Lively and engaging male voice',
  },
  {
    id: 'Rasalgethi',
    name: 'Rasalgethi',
    gender: 'male',
    description: 'Distinguished and refined male voice',
  },
  {
    id: 'Sadachbia',
    name: 'Sadachbia',
    gender: 'male',
    description: 'Smooth and polished male voice',
  },
  {
    id: 'Sadaltager',
    name: 'Sadaltager',
    gender: 'male',
    description: 'Confident and assertive male voice',
  },
  {
    id: 'Schedar',
    name: 'Schedar',
    gender: 'male',
    description: 'Commanding and powerful male voice',
  },
  {
    id: 'Umbriel',
    name: 'Umbriel',
    gender: 'male',
    description: 'Soft and gentle male voice',
  },
  {
    id: 'Zubenelgenubi',
    name: 'Zubenelgenubi',
    gender: 'male',
    description: 'Rich and expressive male voice',
  },
] as const;

/**
 * Get voice info by ID.
 */
export const getVoiceById = (id: string): VoiceInfo | undefined =>
  VOICES.find((v) => v.id === id);

/**
 * Get all voices filtered by gender.
 */
export const getVoicesByGender = (gender: VoiceGender): readonly VoiceInfo[] =>
  VOICES.filter((v) => v.gender === gender);

/**
 * Default sample text for voice previews.
 */
export const DEFAULT_PREVIEW_TEXT =
  "Hello! I'm excited to help with your AI chat assistant today.";
