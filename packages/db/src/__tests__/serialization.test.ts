import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  SerializationError,
  createEffectSerializer,
  createBatchEffectSerializer,
  createSyncSerializer,
} from '../schemas/serialization';

interface TestEntity {
  id: string;
  name: string;
  createdAt: Date;
}

interface TestOutput {
  id: string;
  name: string;
  createdAt: string;
}

const testTransform = (entity: TestEntity): TestOutput => ({
  id: entity.id,
  name: entity.name,
  createdAt: entity.createdAt.toISOString(),
});

const testEntity: TestEntity = {
  id: 'test_1',
  name: 'Test Entity',
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

describe('createEffectSerializer', () => {
  const serialize = createEffectSerializer('test', testTransform);

  it('serializes an entity successfully', async () => {
    const result = await Effect.runPromise(serialize(testEntity));
    expect(result).toEqual({
      id: 'test_1',
      name: 'Test Entity',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('wraps transform errors in SerializationError', async () => {
    const badSerializer = createEffectSerializer(
      'broken',
      (_entity: { value: unknown }) => {
        throw new Error('transform failed');
      },
    );

    const exit = await Effect.runPromiseExit(badSerializer({ value: null }));
    expect(exit._tag).toBe('Failure');
  });
});

describe('createBatchEffectSerializer', () => {
  const serializeBatch = createBatchEffectSerializer('test', testTransform);

  it('serializes multiple entities', async () => {
    const entities: TestEntity[] = [
      { id: 'a', name: 'A', createdAt: new Date('2024-01-01') },
      { id: 'b', name: 'B', createdAt: new Date('2024-02-01') },
      { id: 'c', name: 'C', createdAt: new Date('2024-03-01') },
    ];
    const results = await Effect.runPromise(serializeBatch(entities));
    expect(results).toHaveLength(3);
    expect(results[0]!.id).toBe('a');
    expect(results[2]!.id).toBe('c');
  });

  it('handles empty array', async () => {
    const results = await Effect.runPromise(serializeBatch([]));
    expect(results).toEqual([]);
  });

  it('serializes full output correctly for batches larger than concurrency cap', async () => {
    const entities: TestEntity[] = Array.from({ length: 64 }, (_, index) => ({
      id: `entity_${index}`,
      name: `Entity ${index}`,
      createdAt: new Date(`2024-01-${String((index % 28) + 1).padStart(2, '0')}`),
    }));

    const results = await Effect.runPromise(serializeBatch(entities));

    expect(results).toHaveLength(64);
    expect(results[0]!.id).toBe('entity_0');
    expect(results[63]!.id).toBe('entity_63');
  });
});

describe('createSyncSerializer', () => {
  const serialize = createSyncSerializer(testTransform);

  it('returns the transform function directly', () => {
    const result = serialize(testEntity);
    expect(result).toEqual({
      id: 'test_1',
      name: 'Test Entity',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('works with Array.map', () => {
    const entities: TestEntity[] = [
      { id: 'x', name: 'X', createdAt: new Date('2024-06-01') },
      { id: 'y', name: 'Y', createdAt: new Date('2024-07-01') },
    ];
    const results = entities.map(serialize);
    expect(results).toHaveLength(2);
    expect(results[0]!.id).toBe('x');
    expect(results[1]!.id).toBe('y');
  });
});

describe('SerializationError', () => {
  it('has the correct tag', () => {
    const error = new SerializationError({
      entity: 'job',
      message: 'Failed to serialize',
    });
    expect(error._tag).toBe('SerializationError');
    expect(error.entity).toBe('job');
    expect(error.message).toBe('Failed to serialize');
  });
});
