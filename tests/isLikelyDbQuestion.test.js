const { isLikelyDbQuestion } = require('../src/utils/dbClassifier');

test('positive cases', () => {
  expect(isLikelyDbQuestion('How do I create a primary key in Postgres?')).toBe(true);
  expect(isLikelyDbQuestion('SELECT * FROM users WHERE id = 1;')).toBe(true);
  expect(isLikelyDbQuestion('How to design a many-to-many relationship?')).toBe(true);
});

test('negative cases', () => {
  expect(isLikelyDbQuestion('How to cook pasta?')).toBe(false);
  expect(isLikelyDbQuestion('What is the weather today?')).toBe(false);
  expect(isLikelyDbQuestion('Tell me a joke about cats')).toBe(false);
});
