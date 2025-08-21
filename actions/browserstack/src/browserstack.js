const request = require('request');
const core = require('@actions/core');
const fs = require('fs');
const path = require('path');

const ANDROID_APP_ENDPOINT = "api-cloud.browserstack.com/app-automate/espresso/v2/app";
const ANDROID_TESTSUITE_ENDPOINT = "api-cloud.browserstack.com/app-automate/espresso/v2/test-suite";
const ANDROID_TRIGGER_BUILD_ENDPOINT = "api-cloud.browserstack.com/app-automate/espresso/v2/build";
const ANDROID_BUILDS_ENDPOINT = "api-cloud.browserstack.com/app-automate/espresso/v2/builds";

const IOS_APP_ENDPOINT = "api-cloud.browserstack.com/app-automate/xcuitest/v2/app";
const IOS_TESTSUITE_ENDPOINT = "api-cloud.browserstack.com/app-automate/xcuitest/v2/test-suite";
const IOS_TRIGGER_BUILD_ENDPOINT = "api-cloud.browserstack.com/app-automate/xcuitest/v2/xctestrun-build";
const IOS_BUILDS_ENDPOINT = "api-cloud.browserstack.com/app-automate/xcuitest/v2/builds";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

class Browserstack {

    static _doPost(options) {
        return new Promise(function (resolve, reject) {
                request.post(options, function (error, res, body) {
                    if (!error && res.statusCode === 200) {
                        resolve(body);
                    } else {
                        reject(error ? error : body);
                    }
                });
            }
        );
    }

    static _doGet(options) {
        return new Promise(function (resolve, reject) {
                request.get(options, function (error, res, body) {
                    if (!error && res.statusCode === 200) {
                        resolve(body);
                    } else {
                        reject(error ? error : body);
                    }
                });
            }
        );
    }

    static async _uploadFile(actionInput, filePath, endpoint) {
        const formData = {};

        formData.file = {
            value: fs.createReadStream(filePath),
            options: {
                filename: path.parse(filePath).base,
                contentType: null,
            },
        };

        const options = {
            url: `https://${actionInput.browserstackUsername}:${actionInput.browserstackAccessKey}@${endpoint}`,
            formData,
        };
        if (actionInput.customId) formData.custom_id = actionInput.customId;

        core.info(`Uploading file ${filePath}...`);
        let response;
        try {
            response = await this._doPost(options);
            core.info(`Uploaded complete ${response}`);
            return response;
        } catch (error) {
            core.setFailed(error);
            return null;
        }
    }

    static async _triggerAndroidBuild(actionInput, appUrl, testSuiteUrl) {
        const body = {
            app: appUrl,
            testSuite: testSuiteUrl,
            devices: actionInput.devices.split(","),
            networkLogs: true,
            deviceLogs: true,
        };
        if (actionInput.project) body.project = actionInput.project;
        if (actionInput.buildTag) body.buildTag = actionInput.buildTag;
        if (actionInput.deviceId) body.deviceId = actionInput.deviceId;
        if (actionInput.enablePasscode === 'true') body.enablePasscode = true;
        if (actionInput.dedicatedDevice === 'true') body.dedicatedDevice = true;

        const options = {
            url: `https://${actionInput.browserstackUsername}:${actionInput.browserstackAccessKey}@${ANDROID_TRIGGER_BUILD_ENDPOINT}`,
            body: JSON.stringify(body),
            headers: {
                'content-type': 'application/json'
            }
        };

        core.info(`Triggering android build with app=${appUrl} and testSuite=${testSuiteUrl} on devices=${actionInput.devices}`);
        let response;
        try {
            response = await this._doPost(options);
            core.info(`Triggered build ${response}`);
            return response;
        } catch (error) {
            core.setFailed(error);
            return null;
        }
    }

    static async _triggerIOSBuild(actionInput, appUrl, testSuiteUrl) {
        const body = {
            app: appUrl,
            testSuite: testSuiteUrl,
            devices: actionInput.devices.split(","),
            networkLogs: true,
            deviceLogs: true,
        };
        if (actionInput.project) body.project = actionInput.project;
        if (actionInput.buildTag) body.buildTag = actionInput.buildTag;

        const options = {
            url: `https://${actionInput.browserstackUsername}:${actionInput.browserstackAccessKey}@${IOS_TRIGGER_BUILD_ENDPOINT}`,
            body: JSON.stringify(body),
            headers: {
                'content-type': 'application/json'
            }
        };

        core.info(`Triggering ios build with app=${appUrl} and testSuite=${testSuiteUrl} on devices=${actionInput.devices}`);
        let response;
        try {
            response = await this._doPost(options);
            core.info(`Triggered build ${response}`);
            return response;
        } catch (error) {
            core.setFailed(error);
            return null;
        }
    }

    static async _checkBuild(actionInput, endpoint, buildId) {
        const options = {
            url: `https://${actionInput.browserstackUsername}:${actionInput.browserstackAccessKey}@${endpoint}/${buildId}`,
        };

        let buildSuccessful = false;
        let checkStatus = true;

        let response;

        while (checkStatus) {
            await delay(30000);

            response = await this._doGet(options);
            core.info(`Build status ${response}`);
            if (!response) return false;

            const build = JSON.parse(response);
            checkStatus = build.status === 'queued' || build.status === 'running';
            buildSuccessful = build.status === 'passed'
        }

        core.exportVariable("test_result", response);

        if (!buildSuccessful) {
            core.setFailed(response);
            return false;
        }

        return true;
    }

    static async uploadAndroidAndRunTests(actionInput) {

        const appFileResponse = await this._uploadFile(actionInput, actionInput.appFilePath, ANDROID_APP_ENDPOINT);
        if (!appFileResponse) return false;

        const appUrl = JSON.parse(appFileResponse).app_url;
        core.exportVariable("app_url", appUrl);

        const testFileResponse = await this._uploadFile(actionInput, actionInput.testFilePath, ANDROID_TESTSUITE_ENDPOINT);
        if (!testFileResponse) return false;

        const testSuiteUrl = JSON.parse(testFileResponse).test_suite_url;
        core.exportVariable("test_suite_url", testSuiteUrl);

        const buildResponse = await this._triggerAndroidBuild(actionInput, appUrl, testSuiteUrl);
        if (!buildResponse) return false;

        const buildId = JSON.parse(buildResponse).build_id;
        core.exportVariable("build_id", buildId);

        return await this._checkBuild(actionInput, ANDROID_BUILDS_ENDPOINT, buildId);
    }

    static async uploadIOSAndRunTests(actionInput) {

        const appFileResponse = await this._uploadFile(actionInput, actionInput.iosAppFilePath, IOS_APP_ENDPOINT);
        if (!appFileResponse) return false;

        const appUrl = JSON.parse(appFileResponse).app_url;
        core.exportVariable("app_url", appUrl);

        const testFileResponse = await this._uploadFile(actionInput, actionInput.iosTestFilePath, IOS_TESTSUITE_ENDPOINT);
        if (!testFileResponse) return false;

        const testSuiteUrl = JSON.parse(testFileResponse).test_suite_url;
        core.exportVariable("test_suite_url", testSuiteUrl);

        const buildResponse = await this._triggerIOSBuild(actionInput, appUrl, testSuiteUrl);
        if (!buildResponse) return false;

        const buildId = JSON.parse(buildResponse).build_id;
        core.exportVariable("build_id", buildId);

        return await this._checkBuild(actionInput, IOS_BUILDS_ENDPOINT, buildId);
    }
}

module.exports = Browserstack;