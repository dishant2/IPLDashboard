"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Processor = void 0;
const _ = require("lodash");
const escapeHtml = require("escape-html");
const Constants_1 = require("./Constants");
const IO_1 = require("../utils/IO");
const path = require("path");
const Logger_1 = require("../utils/Logger");
const chalk = require("chalk");
const util_1 = require("util");
const Config_1 = require("./Config");
const ImageSnapshotDifference_1 = require("../render/diff/ImageSnapshotDifference");
class Processor {
    constructor(mResults, mExplicitConfig, mProcessParms) {
        this.mResults = mResults;
        this.mExplicitConfig = mExplicitConfig;
        this.mProcessParms = mProcessParms;
        this.testResultObject = (suiteName, testId, testDescription) => {
            return {
                ancestorTitles: [suiteName],
                duration: 0,
                failureDetails: [""],
                failureMessages: [""],
                fullName: suiteName + " " + testDescription,
                invocations: 1,
                location: null,
                numPassingAsserts: 0,
                status: "failed",
                title: testDescription,
                id: testId,
            };
        };
        this.getTestCasesFromTestFile = (testFilePath) => {
            const testFileContent = IO_1.IO.readFileSync(testFilePath);
            let splittedContent = testFileContent.split(":::");
            let testResults = [];
            let suiteName = "";
            let describeTitleMatch = testFileContent.match(/(?<=describe\()\".*?\"/);
            if (describeTitleMatch && Array.isArray(describeTitleMatch)) {
                suiteName = describeTitleMatch[0].split(":::")[2].replace(/\"+$/, "");
                let contentToBeRead = testFileContent.split(/(?<=describe\()[\",\'].*?[\",\']/)[1];
                do {
                    const itTestDescription = contentToBeRead.match(/(?<=it\()\".*?\"/);
                    const testDescription = contentToBeRead.match(/(?<=test\()\".*?\"/);
                    let testId = "";
                    let testDisplayText = "";
                    if (testDescription) {
                        testId = testDescription[0].split(":::")[1];
                        testDisplayText = testDescription[0]
                            .split(":::")[2]
                            .replace(/\"+$/, "");
                        contentToBeRead = contentToBeRead.split(testDescription[0])[1];
                    }
                    else if (itTestDescription) {
                        testId = itTestDescription[0].split(":::")[1];
                        testDisplayText = itTestDescription[0]
                            .split(":::")[2]
                            .replace(/\"+$/, "");
                        contentToBeRead = contentToBeRead.split(itTestDescription[0])[1];
                    }
                    else {
                        break;
                    }
                    const result = this.testResultObject(suiteName, testId, testDisplayText);
                    testResults.push(result);
                } while (contentToBeRead);
            }
            else {
                describeTitleMatch = testFileContent.match(/(?<=describe\()\'.*?\'/);
                if (describeTitleMatch) {
                    suiteName = describeTitleMatch[0].split(":::")[2].replace(/\'+$/, "");
                    let contentToBeRead = testFileContent.split(/(?<=describe\()[\",\'].*?[\",\']/)[1];
                    do {
                        const itTestDescription = contentToBeRead.match(/(?<=it\()\'.*?\'/);
                        const testDescription = contentToBeRead.match(/(?<=test\()\'.*?\'/);
                        let testId = "";
                        let testDisplayText = "";
                        if (testDescription) {
                            testId = testDescription[0].split(":::")[1];
                            testDisplayText = testDescription[0]
                                .split(":::")[2]
                                .replace(/\'+$/, "");
                            contentToBeRead = contentToBeRead.split(testDescription[0])[1];
                        }
                        else if (itTestDescription) {
                            testId = itTestDescription[0].split(":::")[1];
                            testDisplayText = itTestDescription[0]
                                .split(":::")[2]
                                .replace(/\'+$/, "");
                            contentToBeRead = contentToBeRead.split(itTestDescription[0])[1];
                        }
                        else {
                            break;
                        }
                        const result = this.testResultObject(suiteName, testId, testDisplayText);
                        testResults.push(result);
                    } while (contentToBeRead);
                }
            }
            return testResults;
        };
    }
    static run(results, explicitConfig, parms) {
        return new Processor(results, explicitConfig, parms).generate();
    }
    getEvaluationResultStatus(status) {
        switch (status) {
            case "passed":
                return "CORRECT";
            case "failed":
                return "INCORRECT";
            case "pending":
            default:
                return "INCORRECT";
        }
    }
    generate() {
        const substitute = {};
        const substituteWithCustomData = {};
        if (util_1.isNullOrUndefined(this.mResults)) {
            throw new Error(Constants_1.Constants.NO_INPUT);
        }
        const config = new Config_1.Config(this.logger, this.mExplicitConfig, this.mProcessParms).buildConfig();
        const results = this.mResults;
        results.testResults = results.testResults.map((eachSuite) => {
            if (eachSuite.testResults.length === 0) {
                eachSuite.testResults = this.getTestCasesFromTestFile(eachSuite.testFilePath);
                results.numFailedTests =
                    results.numFailedTests + eachSuite.testResults.length;
                results.numTotalTests =
                    results.numTotalTests + eachSuite.testResults.length;
                eachSuite.numFailingTests = eachSuite.testResults.length;
            }
            else {
                eachSuite.testResults = eachSuite.testResults.map((eachTest) => {
                    if (!eachTest.id && eachTest.ancestorTitles && eachTest.fullName) {
                        const ancestorTitles = eachTest.ancestorTitles.map((eachAncestorTitle) => eachAncestorTitle.split(":::")[2]);
                        const idAndTitle = eachTest.title.split(":::");
                        const fullName = ancestorTitles.join(" ").concat(idAndTitle[2]);
                        let errorMessages = [];
                        if (eachTest.failureDetails &&
                            eachTest.failureDetails.length > 0 &&
                            eachTest.failureDetails[0].actual &&
                            eachTest.failureDetails[0].expected &&
                            !eachTest.failureDetails[0].pass) {
                            const readableMessage = `Expected ${eachTest.failureDetails[0].expected}, but received ${eachTest.failureDetails[0].actual}`;
                            errorMessages.push(readableMessage);
                        }
                        else if (eachTest.failureDetails &&
                            eachTest.failureDetails.length > 0 &&
                            eachTest.failureDetails[0].matcherResult) {
                            const readableMessage = `Expected "${eachTest.failureDetails[0].matcherResult.expected}", but received "${eachTest.failureDetails[0].matcherResult.actual}"`;
                            errorMessages.push(readableMessage);
                        }
                        else if (eachTest.failureMessages &&
                            eachTest.failureMessages.length > 0) {
                            const errorMessage = eachTest.failureMessages[0]
                                .split("\n")[0]
                                .trim();
                            const readableMessage = errorMessage.replace(/\x1B\[[0-9;]*m/g, "");
                            errorMessages.push(readableMessage);
                        }
                        eachTest.id = idAndTitle[1];
                        eachTest.title = idAndTitle[2];
                        eachTest.ancestorTitles = ancestorTitles;
                        eachTest.fullName = fullName;
                        eachTest.errorMessages = errorMessages;
                    }
                    return eachTest;
                });
            }
            return eachSuite;
        });
        const customConfigResults = results.testResults.map((eachTestSuite) => {
            return eachTestSuite.testResults.map((eachTest) => {
                return {
                    test_case_id: eachTest.id,
                    evaluation_result: this.getEvaluationResultStatus(eachTest.status),
                    title: eachTest.title,
                    errorMessages: eachTest.errorMessages,
                };
            });
        });
        const flattenedResults = _.flatten(customConfigResults);
        const resultsData = {
            test_case_results: flattenedResults,
        };
        substitute.results = results;
        substitute.rawResults = JSON.stringify(results, null, 2);
        substitute.jestStareConfig = config;
        substitute.rawJestStareConfig = JSON.stringify(config, null, 2);
        substituteWithCustomData.results = resultsData;
        substituteWithCustomData.rawResults = JSON.stringify(resultsData, null, 2);
        substituteWithCustomData.jestStareConfig = config;
        substituteWithCustomData.rawJestStareConfig = JSON.stringify(config, null, 2);
        if (this.mProcessParms && this.mProcessParms.reporter) {
            this.mProcessParms.reporter.jestStareConfig = config;
            substitute.globalConfig = JSON.stringify(this.mProcessParms.reporter.mGlobalConfig, null, 2);
        }
        this.generateReport(config.resultDir, substitute, this.mProcessParms, substituteWithCustomData);
        this.collectImageSnapshots(config.resultDir, this.mResults);
        if (config.additionalResultsProcessors != null) {
            this.execute(this.mResults, config.additionalResultsProcessors);
        }
        return this.mResults;
    }
    collectImageSnapshots(resultDir, results) {
        results.testResults.forEach((rootResult) => {
            if (rootResult.numFailingTests) {
                rootResult.testResults.forEach((testResult) => {
                    testResult.failureMessages.forEach((failureMessage) => {
                        if (typeof failureMessage === "string" &&
                            ImageSnapshotDifference_1.ImageSnapshotDifference.containsDiff(failureMessage)) {
                            const diffImagePath = ImageSnapshotDifference_1.ImageSnapshotDifference.parseDiffImagePath(failureMessage);
                            const diffImageName = ImageSnapshotDifference_1.ImageSnapshotDifference.parseDiffImageName(failureMessage);
                            if (IO_1.IO.existsSync(diffImagePath)) {
                                IO_1.IO.mkdirsSync(resultDir + Constants_1.Constants.IMAGE_SNAPSHOT_DIFF_DIR);
                                const reportDiffImagePath = resultDir + Constants_1.Constants.IMAGE_SNAPSHOT_DIFF_DIR + diffImageName;
                                IO_1.IO.copyFileSync(diffImagePath, reportDiffImagePath);
                            }
                        }
                    });
                });
            }
        });
    }
    e(str) {
        return escapeHtml(str).replace(/&#39/g, "&#x27");
    }
    createBaseHtml(substitute) {
        const head = `<head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>ccbp test reporter</title>
            <link href="https://unpkg.com/tailwindcss@^1.0/dist/tailwind.min.css" rel="stylesheet">
            <link rel="preconnect" href="https://fonts.gstatic.com">
	        <link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet">
            <script src="https://kit.fontawesome.com/522ee478c4.js" crossorigin="anonymous"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/alpinejs/2.3.0/alpine.js"></script>
            <script src="js/view.js"></script>
        </head>`;
        const body = `<body><div id="test-results">${this.e(substitute.rawResults)}</div></body>`;
        const html = `<html lang="en">${head}${body}</html>`;
        return html;
    }
    generateReport(resultDir, substitute, parms, substituteWithCustomData) {
        IO_1.IO.mkdirsSync(resultDir);
        const jsDir = resultDir + Constants_1.Constants.JS_DIR;
        IO_1.IO.mkdirsSync(jsDir);
        IO_1.IO.writeFileSync(jsDir + Constants_1.Constants.JEST_STARE_JS, this.obtainJsRenderFile(Constants_1.Constants.JEST_STARE_JS));
        IO_1.IO.writeFileSync(resultDir + substitute.jestStareConfig.resultHtml, this.createBaseHtml(substitute));
        IO_1.IO.writeFileSync(resultDir + substitute.jestStareConfig.resultJson, substituteWithCustomData.rawResults);
        let type = " ";
        type +=
            parms && parms.reporter
                ? Constants_1.Constants.REPORTERS
                : Constants_1.Constants.TEST_RESULTS_PROCESSOR;
        this.logger.info(Constants_1.Constants.LOGO +
            type +
            Constants_1.Constants.LOG_MESSAGE +
            resultDir +
            substitute.jestStareConfig.resultHtml +
            Constants_1.Constants.SUFFIX);
    }
    execute(jestTestData, processors) {
        for (const processor of processors) {
            if (processor === Constants_1.Constants.NAME) {
                this.logger.error("Error: In order to avoid infinite loops, " +
                    "jest-stare cannot be listed as an additional processor. Skipping... ");
                continue;
            }
            try {
                require(processor)(jestTestData);
                this.logger.info(Constants_1.Constants.LOGO +
                    " passed results to additional processor " +
                    chalk.white('"' + processor + '"') +
                    Constants_1.Constants.SUFFIX);
            }
            catch (e) {
                this.logger.error('Error executing additional processor: "' + processor + '" ' + e);
            }
        }
    }
    addThirdParty(dependency) {
        return __awaiter(this, void 0, void 0, function* () {
            const location = require.resolve(dependency.requireDir + dependency.file);
            yield IO_1.IO.writeFileSync(dependency.targetDir + dependency.file, IO_1.IO.readFileSync(location));
        });
    }
    obtainWebFile(name) {
        return IO_1.IO.readFileSync(path.resolve(__dirname + "/../../web/" + name));
    }
    obtainJsRenderFile(name) {
        return IO_1.IO.readFileSync(path.resolve(__dirname + "/../render/" + name));
    }
    set logger(logger) {
        this.mLog = logger;
    }
    get logger() {
        if (util_1.isNullOrUndefined(this.mLog)) {
            this.logger = new Logger_1.Logger();
        }
        return this.mLog;
    }
}
exports.Processor = Processor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvY2Vzc29yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3Byb2Nlc3Nvci9Qcm9jZXNzb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzVCLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQywyQ0FBd0M7QUFFeEMsb0NBQWlDO0FBRWpDLDZCQUE2QjtBQUU3Qiw0Q0FBeUM7QUFDekMsK0JBQStCO0FBRy9CLCtCQUF5QztBQUV6QyxxQ0FBa0M7QUFDbEMsb0ZBQWlGO0FBU2pGLE1BQWEsU0FBUztJQWtDcEIsWUFDVSxRQUEwQixFQUMxQixlQUFrQyxFQUNsQyxhQUE2QjtRQUY3QixhQUFRLEdBQVIsUUFBUSxDQUFrQjtRQUMxQixvQkFBZSxHQUFmLGVBQWUsQ0FBbUI7UUFDbEMsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBZXZDLHFCQUFnQixHQUFHLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsRUFBRTtZQUN4RCxPQUFPO2dCQUNMLGNBQWMsRUFBRSxDQUFDLFNBQVMsQ0FBQztnQkFDM0IsUUFBUSxFQUFFLENBQUM7Z0JBQ1gsY0FBYyxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNwQixlQUFlLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JCLFFBQVEsRUFBRSxTQUFTLEdBQUcsR0FBRyxHQUFHLGVBQWU7Z0JBQzNDLFdBQVcsRUFBRSxDQUFDO2dCQUNkLFFBQVEsRUFBRSxJQUFJO2dCQUNkLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLE1BQU0sRUFBRSxRQUFRO2dCQUNoQixLQUFLLEVBQUUsZUFBZTtnQkFDdEIsRUFBRSxFQUFFLE1BQU07YUFDWCxDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBRUYsNkJBQXdCLEdBQUcsQ0FBQyxZQUFZLEVBQUUsRUFBRTtZQUMxQyxNQUFN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