// Base template contract. Subclasses (templates/quiz.js) implement static methods.
export class BaseTemplate {
  static name = 'base';
  static label = 'Base';
  // Returns the per-item payload sent to clients. Strip server-only fields here (e.g. correct answer).
  static getItemPayload(item /*, rules */) { return { ...item }; }
  // Returns { correct, points } given a submitted value.
  static scoreAnswer(/* value, item, msTaken, liveRules */) { return { correct: false, points: 0 }; }
}
