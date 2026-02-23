#!/usr/bin/env bash
# Quick sanity check for the Google Cloud Text-to-Speech API.
# Usage: GOOGLE_API_KEY=<key> ./scripts/sanity-google-tts.sh
#
# Synthesises a short phrase and saves the result to /tmp/tts-sanity.mp3.
# Uses the REST v1 endpoint with an API key (no gcloud auth required).

set -euo pipefail

: "${GOOGLE_API_KEY:?Set GOOGLE_API_KEY before running this script}"

OUTPUT_FILE="/tmp/tts-sanity.mp3"

RESPONSE=$(curl -s "https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "input": { "text": "Hello, this is a sanity check for Google Text to Speech." },
    "voice": { "languageCode": "en-US", "name": "en-US-Journey-D" },
    "audioConfig": { "audioEncoding": "MP3" }
  }')

echo "$RESPONSE" | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
if 'audioContent' not in data:
    print('Error response:'); print(json.dumps(data, indent=2)); sys.exit(1)
with open('${OUTPUT_FILE}', 'wb') as f:
    f.write(base64.b64decode(data['audioContent']))
"

echo "Google TTS sanity check passed."
echo "Audio saved to ${OUTPUT_FILE}"
