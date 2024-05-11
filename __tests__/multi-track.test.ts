import { describe, expect, jest, test } from '@jest/globals';
import { getSubs } from '../src/multi-track.js';

jest.mock('../src/config.js', () => ({
  downloadsDir: 'something',
  subsPriorities: 'first,second,third,forth'.split(','),
  audioPriorities: 'some,thing'.split(','),
}));

// subs with expeted priorities
const subs = {
  n1: '/DirName/RUS Sub/second/forth/*.ass',
  n2: '/DirName/RUS Sub/third/*.ass',
  n3: '/DirName/RUS Sub/second/*.ass',
  n4: '/DirName/RUS Sub/first/*.ass',
  rest: [
    '/DirName/RUS Sub/fifth/*.ass',
    '/DirName/RUS Sub/sixth/*.ass',
    '/DirName/RUS Sub/seventh/*.ass'
  ],
}

describe('Multi-track dub sub chooser', () => {
  test('schold choose forth if present in patterns array', () => {
    const expectedString = subs.n1;

    const result = getSubs([
      subs.n2,
      subs.n4,
      subs.n3,
      subs.n1,
      ...subs.rest,
    ]);

    expect(result).toBe(expectedString);
  });

  test('second choice is third', () => {
    const expectedString = subs.n2;

    const result = getSubs([
      subs.n4,
      subs.n2,
      subs.n3,
      ...subs.rest,
    ]);

    expect(result).toBe(expectedString);
  });

  test('third choice is second', () => {
    const expectedString = subs.n3;

    const result = getSubs([
      subs.n4,
      subs.n3,
      ...subs.rest,
    ]);

    expect(result).toBe(expectedString);
  });

  test('fourth choice is first', () => {
    const expectedString = subs.n4;

    const result = getSubs([
      ...subs.rest,
      subs.n4,
    ]);

    expect(result).toBe(expectedString);
  });
});
