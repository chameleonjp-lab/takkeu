// Existing Japanese assertions explicitly run under a Japanese browser locale.
// Language-selection tests pass their own navigator/storage contexts.
if (typeof window !== 'undefined') Object.defineProperties(window.navigator, {
  language: { configurable: true, value: 'ja-JP' },
  languages: { configurable: true, value: ['ja-JP'] },
});
