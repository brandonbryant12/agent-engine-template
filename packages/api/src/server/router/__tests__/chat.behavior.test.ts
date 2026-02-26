import { describe, expect, it, vi } from 'vitest';
import { decodeChatContractMessages } from '../chat';

describe('chat router message decoding', () => {
  it('maps valid text-only contract messages to UI messages', () => {
    const result = decodeChatContractMessages(
      [
        {
          id: 'msg_1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello world' }],
        },
      ],
      {},
    );

    expect(result).toEqual([
      {
        id: 'msg_1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello world' }],
      },
    ]);
  });

  it('throws INPUT_VALIDATION_FAILED for unsupported part types', () => {
    const inputValidationError = vi.fn(() => new Error('unsupported-part'));

    expect(() =>
      decodeChatContractMessages(
        [
          {
            id: 'msg_1',
            role: 'user',
            parts: [{ type: 'image', text: 'ignored' }],
          },
        ],
        { INPUT_VALIDATION_FAILED: inputValidationError },
      ),
    ).toThrow('unsupported-part');

    expect(inputValidationError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unsupported chat message part type',
        data: expect.objectContaining({
          messageIndex: 0,
          partIndex: 0,
          partType: 'image',
        }),
      }),
    );
  });

  it('throws INPUT_VALIDATION_FAILED when text part omits text payload', () => {
    const inputValidationError = vi.fn(() => new Error('missing-text'));

    expect(() =>
      decodeChatContractMessages(
        [
          {
            id: 'msg_1',
            role: 'user',
            parts: [{ type: 'text' }],
          },
        ],
        { INPUT_VALIDATION_FAILED: inputValidationError },
      ),
    ).toThrow('missing-text');

    expect(inputValidationError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Chat text message parts must include non-empty text',
      }),
    );
  });
});
