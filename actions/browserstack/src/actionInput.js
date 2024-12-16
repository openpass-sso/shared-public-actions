const core = require('@actions/core');
const fs = require("fs");

class ActionInput {
    constructor() {
        this._parseInput();
        this._validateInput();
    }

    _parseInput() {
        this.browserstackUsername = core.getInput('browserstackUsername');
        this.browserstackAccessKey = core.getInput('browserstackAccessKey');
        this.project = core.getInput('project');
        this.appFilePath = core.getInput('appFilePath');
        this.testFilePath = core.getInput('testFilePath');
        this.devices = core.getInput('devices');
        this.customId = core.getInput('customId');
        this.buildTag = core.getInput('buildTag');

        this.isAndroid = this.appFilePath && this.testFilePath;
    }

    _validateInput() {
        if (!this.browserstackUsername) {
            throw Error(`browserstackUsername not set`);
        }
        if (!this.browserstackAccessKey) {
            throw Error(`browserstackAccessKey not set`);
        }

        if (!this.appFilePath && !this.testFilePath) {
            throw Error(`Action needs appFilePath & testFilePath (Android) defined`);
        }

        if (!this.devices) {
            throw Error(`Action needs at least 1 device defined`);
        }

        if (this.appFilePath && !fs.existsSync(this.appFilePath)) {
            throw Error(`App specified in appFilePath doesn't exist`);
        }

        if (this.testFilePath && !fs.existsSync(this.testFilePath)) {
            throw Error(`App specified in testFilePath doesn't exist`);
        }

        if (this.testPackagePath && !fs.existsSync(this.testPackagePath)) {
            throw Error(`Package specified in testPackagePath doesn't exist`);
        }
    }
}

module.exports = ActionInput;