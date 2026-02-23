import { describe, it, expect } from 'vitest';
import { wrapPcmAsWav } from '../audio-utils';

describe('wrapPcmAsWav', () => {
  const pcmData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
  const wav = wrapPcmAsWav(pcmData);

  it('writes RIFF header', () => {
    expect(wav.slice(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(36 + pcmData.length);
    expect(wav.slice(8, 12).toString('ascii')).toBe('WAVE');
  });

  it('writes fmt chunk with correct audio parameters', () => {
    expect(wav.slice(12, 16).toString('ascii')).toBe('fmt ');
    expect(wav.readUInt32LE(16)).toBe(16); // fmt chunk size
    expect(wav.readUInt16LE(20)).toBe(1); // PCM format
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(24000); // 24kHz sample rate
    expect(wav.readUInt32LE(28)).toBe(48000); // byte rate (24000 * 1 * 16/8)
    expect(wav.readUInt16LE(32)).toBe(2); // block align (1 * 16/8)
    expect(wav.readUInt16LE(34)).toBe(16); // 16 bits per sample
  });

  it('writes data chunk with PCM data appended', () => {
    expect(wav.slice(36, 40).toString('ascii')).toBe('data');
    expect(wav.readUInt32LE(40)).toBe(pcmData.length);
    expect(wav.slice(44)).toEqual(pcmData);
  });

  it('produces correct total size (44-byte header + data)', () => {
    expect(wav.length).toBe(44 + pcmData.length);
  });

  it('handles empty PCM data', () => {
    const empty = wrapPcmAsWav(Buffer.alloc(0));
    expect(empty.length).toBe(44);
    expect(empty.readUInt32LE(40)).toBe(0);
  });
});
