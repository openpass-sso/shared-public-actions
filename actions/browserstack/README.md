# BrowserStack Action

This action fulfils the following objectives in your runner environment:
* Uploading the app/testsuite paths provided to BrowserStack
* Starting the testrun on BrowserStack
* Waiting until the tests are done and checking the result

## Prerequisites
* The **actions/checkout@v4** action should be invoked prior to invoking this action as we will be using config files committed to the repo
* App and Tests have to be built before this step see:
  * Android: https://www.browserstack.com/docs/app-automate/espresso/getting-started
  * iOS: https://www.browserstack.com/docs/app-automate/api-reference/xcuitest/xctestplan

## Inputs
* `browserstackUsername`:
    * Browserstack Username
* `browserstackAccessKey`:
    * Browserstack Access Key
* `appFilePath`:
    * Path to the Android app that will be uploaded
* `testFilePath`:
    * Path to the Android test apk that will be uploaded
* `iosAppFilePath`:
    * Path to the iOS app that will be uploaded
* `iosTestFilePath`:
    * Path to the iOS test runner that will be uploaded
* `devices`:
    * Devices to test on see https://www.browserstack.com/list-of-browsers-and-platforms/app_automate'
* `project`:
    * Optional projectname that will be shown on BrowserStack
* `buildTag`:
    * Optional buildTag for the testrun that will be shown on BrowserStack
* `customId`:
    * Optional customId for the uploaded packages that will be shown on BrowserStack

Either `appFilePath` and `testFilePath`, or `iosAppFilePath` and `iosTestFilePath` should be provided. Running tests on both Android and iOS in a single invocation is not supported.

## Outputs
* `app_url`:
  * The app url on Browserstack
* `test_suite_url`:
  * The test file url on Browserstack
* `build_id`:
  * The build id for the triggered testrun
* `test_result`:
  * The test result from BrowserStack (json)

## Usage
Use the code snippet below in your workflow to upload run an Android test:
```yaml
  name: Upload and Run Tests on Browserstack
  uses: openpass-sso/shared-public-actions/actions/browserstack@main
  with:
    browserstackUsername: ${{ secrets.BROWSERSTACK_USERNAME }}
    browserstackAccessKey: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
    project: example
    customId: example_android
    buildTag: example_android
    appFilePath: ${{ github.workspace }}/build/app/outputs/flutter-apk/app-dev-debug.apk
    testFilePath: ${{ github.workspace }}/build/app/outputs/apk/androidTest/dev/debug/app-dev-debug-androidTest.apk
    devices: Samsung Galaxy Tab S9-13.0,Samsung Galaxy Tab S8-12.0
```

or to run an iOS test:

```yaml
  name: Upload and Run Tests on Browserstack
  uses: openpass-sso/shared-public-actions/actions/browserstack@main
  with:
    browserstackUsername: ${{ secrets.BROWSERSTACK_USERNAME }}
    browserstackAccessKey: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
    project: example
    customId: example_ios
    buildTag: example_ios
    appFilePath: ${{ github.workspace }}/build/app.ipa
    testFilePath: ${{ github.workspace }}/build/test-runner-and-xctestrun.zip
    devices: iPhone 16 Pro-18
```

# Acknowledgements

Forked with thanks from [chrisbanes/browserstack-android-action](https://github.com/chrisbanes/browserstack-android-action), originally forked from [Grodien/browserstack-flutter-action](https://github.com/Grodien/browserstack-flutter-action).