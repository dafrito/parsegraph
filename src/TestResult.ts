export default class TestResult {
  constructor(testStatus, testResult, test) {
    this._status = testStatus;
    this._result = testResult;
    this._test = test;
  }

  testStatus() {
    return this._status;
  };

  testResult() {
    return this._result;
  };

  test() {
    return this._test;
  };
}
