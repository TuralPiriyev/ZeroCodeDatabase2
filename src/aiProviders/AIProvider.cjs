/*
 Abstract AIProvider interface (CommonJS)
*/
class AIProvider {
  constructor(opts = {}) {
    this.name = opts.name || 'abstract';
  }

  // chat should accept {system, user, language, schema} and return a string
  async chat(payload) {
    throw new Error('Not implemented');
  }
}

module.exports = AIProvider;
