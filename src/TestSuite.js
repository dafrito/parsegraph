function parsegraph_Test(name, runner, runnerThisArg) {
  this._name = name;
  this._runner = [runner, runnerThisArg];
}

parsegraph_Test.prototype.name = function() {
  return this._name;
};

parsegraph_Test.prototype.isTestSuite = function() {
  return typeof this._runner[0] === 'object';
};

parsegraph_Test.prototype.testSuite = function() {
  return this._runner[0];
};

parsegraph_Test.prototype.isTest = function() {
  return typeof this._runner[0] === 'function';
};

parsegraph_Test.prototype.run = function(
    listener,
    listenerThisArg,
    resultDom,
    suiteResult,
) {
  if (!suiteResult) {
    suiteResult = new parsegraph_TestSuiteResult();
  }
  if (this.isTestSuite()) {
    try {
      // The runner is another test or test suite.
      var testResult = this._runner[0].run(
          listener,
          listenerThisArg,
          resultDom,
          suiteResult,
      );

      if (testResult.isSuccessful()) {
        testStatus = 'Successful';
        testResult = testResult;
      } else {
        testStatus = 'Failed';
        testResult = testResult;
        console.log('Suite failed with result: ', testResult);
      }
    } catch (ex) {
      testStatus = 'Crashed';
      testResult = ex;
    }
  } else if (this.isTest()) {
    // The runner is a function.
    var testStatus = 'Started';
    var testResult;
    try {
      testResult = this._runner[0].call(
          this._runner[1],
          resultDom,
          suiteResult,
      );
      if (testResult !== undefined) {
        testStatus = 'Failed';
        console.log('Test failed with result: ', testResult);
      } else {
        testStatus = 'Successful';
      }
    } catch (ex) {
      testResult = ex;
      testStatus = 'Crashed';
    }
  } else {
    testResult =
      'Test must either be an object or a function, but given ' +
      typeof this._runner[0];
    testStatus = 'Crashed';
  }

  return new parsegraph_TestResult(testStatus, testResult, this);
};
parsegraph_Test.prototype.Run = parsegraph_Test.prototype.run;
parsegraph_Test.prototype.runTest = parsegraph_Test.prototype.run;
parsegraph_Test.prototype.runTests = parsegraph_Test.prototype.run;
parsegraph_Test.prototype.runAllTests = parsegraph_Test.prototype.run;
parsegraph_Test.prototype.runAllTests = parsegraph_Test.prototype.run;
parsegraph_Test.prototype.runalltests = parsegraph_Test.prototype.run;
parsegraph_Test.prototype.start = parsegraph_Test.prototype.run;

parsegraph_Test.prototype.test = function() {
  if (arguments.length > 0) {
    return this.addTest.apply(this, arguments);
  }
  return this.run();
};
parsegraph_Test.prototype.Test = parsegraph_Test.prototype.test;

function parsegraph_TestResult(testStatus, testResult, test) {
  this._status = testStatus;
  this._result = testResult;
  this._test = test;
}

parsegraph_TestResult.prototype.testStatus = function() {
  return this._status;
};

parsegraph_TestResult.prototype.testResult = function() {
  return this._result;
};

parsegraph_TestResult.prototype.test = function() {
  return this._test;
};

export default function parsegraph_TestSuite(name, dontAutoadd) {
  if (name === undefined) {
    this._name = 'Test';
  } else {
    this._name = name;
  }

  this._tests = [];

  if (!dontAutoadd && parsegraph_AllTests) {
    parsegraph_AllTests.addTest(this);
  }
}

parsegraph_TestSuite.prototype.name = function() {
  return this._name;
};

parsegraph_TestSuite.prototype.toString = function() {
  return (
    'TestSuite "' + this.name() + '" with ' + this._tests.length + ' tests'
  );
};

parsegraph_TestSuite.prototype.addTest = function(
    testName,
    runner,
    runnerThisArg,
) {
  if (typeof testName === 'object') {
    return this.addTest(testName.name(), testName);
  }
  if (typeof testName === 'function') {
    return this.addTest(
        this.name() + ' ' + (this._tests.length + 1),
        testName,
        runner,
    );
  }
  const test = new parsegraph_Test(testName, runner, runnerThisArg);
  this._tests.push(test);
  return test;
};
parsegraph_TestSuite.prototype.AddTest = parsegraph_TestSuite.prototype.addTest;
parsegraph_TestSuite.prototype.Add = parsegraph_TestSuite.prototype.addTest;
parsegraph_TestSuite.prototype.add = parsegraph_TestSuite.prototype.addTest;

function parsegraph_TestSuiteResult() {
  this._testsStarted = 0;
  this._testsSuccessful = 0;
  this._testsFailed = 0;
  this._testsCrashed = 0;

  this._aggregateResult = document.createElement('h2');

  this._resultList = document.createElement('ul');
}

parsegraph_TestSuiteResult.prototype.connect = function(container) {
  this.disconnect();

  this._container = container;
  this._container.appendChild(this._aggregateResult);
  this._container.appendChild(this._resultList);
};

parsegraph_TestSuiteResult.prototype.disconnect = function() {
  if (!this._container) {
    return;
  }
  this._container.removeChild(this._aggregateResult);
  this._container.removeChild(this._resultList);
  this._container = null;
};

parsegraph_TestSuiteResult.prototype.resultList = function() {
  return this._resultList;
};

parsegraph_TestSuiteResult.prototype.aggregateResult = function() {
  return this._aggregateResult;
};

parsegraph_TestSuiteResult.prototype.testStarted = function() {
  ++this._testsStarted;
};

parsegraph_TestSuiteResult.prototype.testsStarted = function() {
  return this._testsStarted;
};

parsegraph_TestSuiteResult.prototype.testsSuccessful = function() {
  return this._testsSuccessful;
};

parsegraph_TestSuiteResult.prototype.testsFailed = function() {
  return this._testsFailed;
};

parsegraph_TestSuiteResult.prototype.testsCrashed = function() {
  return this._testsCrashed;
};

parsegraph_TestSuiteResult.prototype.testFinished = function(result) {
  ++this['_tests' + result.testStatus()];
};

parsegraph_TestSuiteResult.prototype.isSuccessful = function() {
  return (
    this._testsStarted > 0 && this._testsFailed == 0 && this._testsCrashed == 0
  );
};

parsegraph_TestSuiteResult.prototype.toString = function() {
  if (this.isSuccessful()) {
    return 'All ' + this.testsStarted() + ' tests ran successfully.';
  } else {
    return (
      this.testsSuccessful() +
      ' of ' +
      this.testsStarted() +
      ' tests ran successfully. ' +
      this.testsFailed() +
      ' failed, ' +
      this.testsCrashed() +
      ' crashed'
    );
  }
};

parsegraph_TestSuite.prototype.run = function(
    listener,
    listenerThisArg,
    resultDom,
    testResults,
) {
  const notify = function() {
    if (listener) {
      listener.apply(listenerThisArg, arguments);
    }
  };

  if (!testResults) {
    testResults = new parsegraph_TestSuiteResult();
  }

  // Run the given listener for each test object.
  this._tests.forEach(function(test) {
    if (test.isTestSuite()) {
      var resultLine = document.createElement('li');
      resultLine.appendChild(document.createTextNode(test.name()));
      testResults.resultList().appendChild(resultLine);

      notify('TestStarted', test);
      testResults.testStarted();

      // Run the test.
      var result = test.run(listener, listenerThisArg, resultLine, testResults);

      if (result.testStatus() == 'Crashed') {
        resultLine.appendChild(document.createElement('br'));
        resultLine.appendChild(
            document.createTextNode(result.testResult().toString()),
        );
        resultLine.appendChild(document.createElement('br'));
        resultLine.appendChild(document.createElement('pre'));
        console.log(result.testResult().stack);
        resultLine.lastChild.innerHTML = result
            .testResult()
            .stack.replace(/[\r\n]+/g, '<br/>');
        return;
      }

      // resultLine.appendChild(result.testResult().resultList());
      if (result.testStatus() === 'Successful') {
        resultLine.style.display = 'none';
      }

      testResults.testFinished(result);
      notify('TestFinished', result);

      resultLine.className = result.testStatus();
      resultLine.insertBefore(
          document.createTextNode(': ' + result.testResult()),
          resultLine.firstChild.nextSibling,
      );
    } else if (test.isTest()) {
      var resultLine = document.createElement('li');
      resultLine.appendChild(document.createTextNode(test.name()));
      testResults.resultList().appendChild(resultLine);

      notify('TestStarted', test);
      testResults.testStarted();

      // Run the test.
      var result = test.run(listener, listenerThisArg, resultLine, testResults);

      testResults.testFinished(result);
      notify('TestFinished', result);

      resultLine.className = result.testStatus();
      if (result.testStatus() === 'Crashed') {
        resultLine.appendChild(document.createElement('br'));
        resultLine.appendChild(
            document.createTextNode(result.testResult().toString()),
        );
        resultLine.appendChild(document.createElement('br'));
        resultLine.appendChild(document.createElement('pre'));
        resultLine.lastChild.innerHTML = result
            .testResult()
            .stack.replace(/[\r\n]+/g, '<br/>');
      } else if (result.testStatus() !== 'Successful') {
        resultLine.appendChild(document.createElement('br'));
        resultLine.appendChild(document.createTextNode(result.testResult()));
      }

      if (result.testStatus() === 'Successful') {
        resultLine.style.display = 'none';
      }
    }
  }, this);

  testResults.aggregateResult().innerHTML = testResults.toString();

  return testResults;
};

export const parsegraph_AllTests = new parsegraph_TestSuite('parsegraph');

const parsegraph_TestSuite_Tests = new parsegraph_TestSuite();
parsegraph_TestSuite_Tests.addTest(function() {
  new parsegraph_TestSuite('Default', false);
});
parsegraph_TestSuite_Tests.addTest(function() {
  new parsegraph_TestSuite('Default', false);
});
