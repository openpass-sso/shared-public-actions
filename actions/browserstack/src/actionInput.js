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
        this.deviceId = core.getInput('deviceId');
        this.buildTag = core.getInput('buildTag');
        this.enablePasscode = core.getInput('enablePasscode');
        this.dedicatedDevice = core.getInput('dedicatedDevice');
        this.iosAppFilePath = core.getInput('iosAppFilePath');
        this.iosTestFilePath = core.getInput('iosTestFilePath');

        this.isAndroid = this.appFilePath && this.testFilePath;
        this.isIOS = this.iosAppFilePath && this.iosTestFilePath;
    }

    _validateInput() {
        if (!this.browserstackUsername) {
            throw Error(`browserstackUsername not set`);
        }
        if (!this.browserstackAccessKey) {
            throw Error(`browserstackAccessKey not set`);
        }

        if (!this.isAndroid && !this.isIOS) {
            throw Error(`Action needs appFilePath & testFilePath (Android) defined or iosAppFilePath & iosTestFilePath (iOS) defined`);
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

        if (this.iosAppFilePath && !fs.existsSync(this.iosAppFilePath)) {
            throw Error(`App specified in iosAppFilePath doesn't exist`);
        }

        if (this.iosTestFilePath && !fs.existsSync(this.iosTestFilePath)) {
            throw Error(`App specified in iosTestFilePath doesn't exist`);
        }
    }
}

module.exports = ActionInput;