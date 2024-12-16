const { expect } = require('chai');
const sinon = require('sinon');
const core = require('@actions/core');
const fs = require('fs');
const ActionInput = require('../src/actionInput');

describe('Action Tests', () => {
    let stubbedInput;
    let stubbedExists;

    function setupAndroid() {
        stubbedInput.withArgs("appFilePath").returns("some/random/app/path.apk");
        stubbedInput.withArgs("testFilePath").returns("some/random/test/path.apk");
        stubbedInput.withArgs("devices").returns("Samsung Galaxy S23-13.0,Samsung Galaxy Tab S8-12.0");
        stubbedExists.withArgs("some/random/app/path.apk").returns(true);
        stubbedExists.withArgs("some/random/test/path.apk").returns(true);
    }

    beforeEach(() => {
        stubbedInput = sinon.stub(core, 'getInput');
        stubbedInput.withArgs("browserstackUsername").returns("username");
        stubbedInput.withArgs("browserstackAccessKey").returns("secretAccessKey");
        stubbedInput.withArgs("project").returns("actionTest");
        stubbedExists = sinon.stub(fs, 'existsSync');
    });

    afterEach(() => {
        core.getInput.restore();
        fs.existsSync.restore();
    });

    context('parse and validate input', () => {
        it('should read values from input and validate them', () => {
            setupAndroid();

            const actionInput = new ActionInput();
            expect(actionInput.browserstackUsername).to.equal("username");
            expect(actionInput.browserstackAccessKey).to.equal("secretAccessKey");
            expect(actionInput.project).to.equal("actionTest");
            expect(actionInput.appFilePath).to.equal("some/random/app/path.apk");
            expect(actionInput.testFilePath).to.equal("some/random/test/path.apk");
            expect(actionInput.devices).to.equal("Samsung Galaxy S23-13.0,Samsung Galaxy Tab S8-12.0");
        });

        it('should give error message in case appFilePath specified does not exist', () => {
            setupAndroid();
            stubbedExists.withArgs("some/random/app/path.apk").returns(false);
            expect(() => new ActionInput()).to.throw("App specified in appFilePath doesn't exist");
        });

        it('should give error message in case testFilePath specified does not exist', () => {
            setupAndroid();
            stubbedExists.withArgs("some/random/test/path.apk").returns(false);
            expect(() => new ActionInput()).to.throw("App specified in testFilePath doesn't exist");
        });
    });
});