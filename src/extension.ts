'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OutgoingMessage } from 'http';
import { rejects } from 'assert';

const TEST_OR_FIXTURE_RE = /(^|;|\s+|\/\/|\/\*)fixture\s*(\(.+?\)|`.+?`)|(^|;|\s+|\/\/|\/\*)test\s*(?:\.[a-zA-Z]+\([^\)]*\))*\s*\(\s*(.+?)\s*('|"|`)\s*,/gm;
const CLEANUP_TEST_OR_FIXTURE_NAME_RE = /(^\(?\s*(\'|"|`))|((\'|"|`)\s*\)?$)/g;
const BROWSER_ALIASES = ['ie', 'firefox', 'chrome', 'chrome-canary', 'chromium', 'opera', 'safari', 'edge'];
const PORTABLE_BROWSERS = ["portableFirefox", "portableChrome"];
const TESTCAFE_PATH = "./node_modules/testcafe/lib/cli/index.js";
const HEADLESS_MODE_POSTFIX = ":headless";

var browserTools = require('testcafe-browser-tools');
let controller: TestCafeTestController;

function registerRunTestsCommands(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInIE', () => {
			controller.runTests("ie");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInFirefox', () => {
			controller.runTests("firefox");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInChrome', () => {
			controller.runTests("chrome");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInPortableFirefox', () => {
			controller.runTests("portableFirefox", true);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInPortableChrome', () => {
			controller.runTests("portableChrome", true);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInChromeCanary', () => {
			controller.runTests("chrome-canary");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInChromium', () => {
			controller.runTests("chromium");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInOpera', () => {
			controller.runTests("opera");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInSafari', () => {
			controller.runTests("safari");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestsInEdge', () => {
			controller.runTests("edge");
		})
	);
}

function registerRunTestFileCommands(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInIE', args => {
			controller.startTestRun({ name: "ie" }, args.fsPath, "file");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInFirefox', args => {
			controller.startTestRun({ name: "firefox" }, args.fsPath, "file");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInChrome', args => {
			controller.startTestRun({ name: "chrome" }, args.fsPath, "file");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInPortableFirefox', args => {
			controller.startTestRun({ name: "portableFirefox", isPortable: true }, args.fsPath, "file", undefined);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInPortableChrome', args => {
			controller.startTestRun({ name: "portableChrome", isPortable: true }, args.fsPath, "file", undefined);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInChromeCanary', args => {
			controller.startTestRun({ name: "chrome-canary" }, args.fsPath, "file");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInChromium', args => {
			controller.startTestRun({ name: "chromium" }, args.fsPath, "file");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInOpera', args => {
			controller.startTestRun({ name: "opera" }, args.fsPath, "file");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInSafari', args => {
			controller.startTestRun({ name: "safari" }, args.fsPath, "file");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('testcaferunner.runTestFileInEdge', args => {
			controller.startTestRun({ name: "edge" }, args.fsPath, "file");
		})
	);
}

function getBrowserList() {
	return browserTools.getInstallations()
		.then((installations: any) => {
			return Object.keys(installations);
		});
}

function updateInstalledBrowserFlags() {
	return getBrowserList()
		.then((installations: any) => {
			for (var aliase of BROWSER_ALIASES) {
				if (installations.indexOf(aliase) !== -1) { vscode.commands.executeCommand('setContext', 'testcaferunner.' + aliase + 'Installed', true); }
			}
			for (var aliase of PORTABLE_BROWSERS) {
				if (getPortableBrowserPath(aliase)) { vscode.commands.executeCommand('setContext', 'testcaferunner.' + aliase + 'Installed', true); }
			}
		});
}

function getPortableBrowserPath(browser: string): string | undefined {
	switch (browser) {
		case "portableFirefox":
			return vscode.workspace.getConfiguration("testcafeTestRunner").get("portableFirefoxPath");
		case "portableChrome":
			return vscode.workspace.getConfiguration("testcafeTestRunner").get("portableChromePath");
		default:
			throw new Error("Unknown portable browser");
	}
}

export function activate(context: vscode.ExtensionContext) {
	controller = new TestCafeTestController();

	vscode.commands.executeCommand('setContext', 'testcaferunner.canRerun', false);

	updateInstalledBrowserFlags()
		.then(() => {
			registerRunTestsCommands(context);
			registerRunTestFileCommands(context);

			context.subscriptions.push(
				vscode.commands.registerCommand('testcaferunner.updateBrowserList', () => {
					updateInstalledBrowserFlags();
				})
			);

			context.subscriptions.push(
				vscode.commands.registerCommand('testcaferunner.repeatRun', () => {
					controller.repeatLastRun();
				})
			);

			context.subscriptions.push(controller);

			vscode.commands.executeCommand('setContext', 'testcaferunner.readyForUX', true);
		});
}

// this method is called when your extension is deactivated
export function deactivate() {
}

class TestCafeTestController {
	lastBrowser: IBrowser | undefined;
	lastFile: string | undefined;
	lastType: string | undefined;
	lastName: string | undefined;

	private runTask() {
		vscode.window.showInformationMessage('The task: Get typescript warning / errors is running, please check the terminal to see the output');
		vscode.commands.executeCommand("workbench.action.tasks.runTask", "Get typescript warning / errors");
		// if (vscode.workspace.workspaceFolders) {

		// 	let task = new vscode.Task(
		// 		{ type: 'shell', task: 'Get typescript warning / errors' },
		// 		vscode.workspace.workspaceFolders[0],
		// 		'Get typescript warning / errors',
		// 		'shell',
		// 		new vscode.ShellExecution('yarn tsc; .\\removeJsFiles.ps1')
		// 	  );
		// 	vscode.tasks.executeTask(task);
		// }
	}

	public runTests(browser: string, isPortable: boolean = false) {
		let editor = vscode.window.activeTextEditor;

		if (!editor) { return; }

		let doc = editor.document;

		if (doc.languageId !== "javascript" && doc.languageId !== "typescript") { return; }

		var document = editor.document;
		var selection = editor.selection;

		if (!selection || !selection.active) { return; }

		var cursorPosition = document.getText(new vscode.Range(0, 0, selection.active.line, selection.active.character)).length;
		var textBeforeSelection = document.getText(new vscode.Range(0, 0, selection.end.line + 1, 0));

		var [type, name] = this.findTestOrFixtureName(textBeforeSelection, cursorPosition);

		this.startTestRun({ name: browser, isPortable: isPortable }, document.fileName, type, name);

		// this.runTask();
	}

	public repeatLastRun() {
		if (!this.lastBrowser || !this.lastFile || (this.lastType !== "file" && !this.lastName)) {
			vscode.window.showErrorMessage(`Previous test is not found.`);
			return;
		}

		this.startTestRun(this.lastBrowser, this.lastFile, this.lastType as string, this.lastName);
	}

	private cropMatchString(matchString: string) {
		matchString = matchString.trim().replace(/;|\/\/|\/\*/, '');

		return matchString.trim();
	}

	private isTest(matchString: string) {
		return this.cropMatchString(matchString).indexOf('test') === 0;
	}

	private findTestOrFixtureName(text: string, cursorPosition: any): string[] {
		var match = TEST_OR_FIXTURE_RE.exec(text);
		var matches = [];

		while (match !== null) {
			var test = this.isTest(match[0]);
			var name = test ? match[4] : match[2];
			var realIndex = match.index + match[0].length - this.cropMatchString(match[0]).length;

			matches.push({
				type: test ? 'test' : 'fixture',
				name: name.replace(CLEANUP_TEST_OR_FIXTURE_NAME_RE, ''),
				index: realIndex
			});

			match = TEST_OR_FIXTURE_RE.exec(text);
		}

		var lastOne = null;

		if (matches.length) {
			for (var i = matches.length - 1; i >= 0; i--) {
				if (cursorPosition >= matches[i].index) {
					lastOne = matches[i];
					break;
				}
			}
		}

		if (lastOne) { return [lastOne.type, lastOne.name]; }

		return ['', ''];
	}

	private getOverriddenWorkspacePath(): string {
		const alternateWorkspacePath = vscode.workspace.getConfiguration('testcafeTestRunner').get('workspaceRoot');
		if (typeof (alternateWorkspacePath) === 'string' && alternateWorkspacePath.length > 0) {
			return alternateWorkspacePath;
		}
		return '';
	}

	private isLiverRunner(): boolean | undefined {
		const useLiveRunner = vscode.workspace.getConfiguration('testcafeTestRunner').get('useLiveRunner');
		if (typeof (useLiveRunner) === 'boolean' && useLiveRunner) {
			return useLiveRunner;
		}
	}

	private isHeadlessMode(): boolean | undefined {
		const useHeadlessMode = vscode.workspace.getConfiguration('testcafeTestRunner').get('useHeadlessMode');
		if (typeof (useHeadlessMode) === 'boolean' && useHeadlessMode) {
			return useHeadlessMode;
		}
	}

	public startTestRun(browser: IBrowser, filePath: string, type: string, name: string = "") {
		if (!type) {
			vscode.window.showErrorMessage(`No tests found. Position the cursor inside a test() function or fixture.`);
			return;
		}
		let browserArg = browser.name;
		this.lastBrowser = browser;
		this.lastFile = filePath;
		this.lastType = type;
		this.lastName = name;
		if (browser.isPortable) {
			const path = getPortableBrowserPath(browser.name);
			browserArg = `path:\`${path}\``;
		}
		if (this.isHeadlessMode()) { browserArg += HEADLESS_MODE_POSTFIX; }

		var args = [browserArg, filePath];

		var customArguments = vscode.workspace.getConfiguration("testcafeTestRunner").get("customArguments");
		if (typeof (customArguments) === "string") {
			const argPattern = /[^\s"]+|"([^"]*)"/g;
			let match;
			do {
				match = argPattern.exec(<string>customArguments);
				if (match !== null) { args.push(match[1] ? match[1] : match[0]); }
			} while (match !== null);
		}

		if (type !== "file") {
			args.push("--" + type);
			args.push(name);
		}

		const workspacePathOverride = this.getOverriddenWorkspacePath();
		if (this.isLiverRunner()) { args.push("--live"); }
		var testCafePath = path.resolve(vscode.workspace.rootPath as string, workspacePathOverride, TESTCAFE_PATH);
		if (!fs.existsSync(testCafePath)) {
			vscode.window.showErrorMessage(`TestCafe package is not found at path ${testCafePath}. Install the testcafe package in your working directory or set the "testcafeTestRunner.workspaceRoot" property.`);
			return;
		}

		var workingDirectory = path.resolve(vscode.workspace.rootPath as string, workspacePathOverride);
		var wsFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;
		vscode.debug.startDebugging(wsFolder, {
			name: "Launch current test(s) with TestCafe",
			request: "launch",
			type: "node",
			cwd: workingDirectory,
			program: testCafePath,
			args: args,
			console: "integratedTerminal",
			internalConsoleOptions: "neverOpen",
			runtimeArgs: [
				"--no-deprecation"
			],
			// preLaunchTask: "Get typescript warning / errors"
			postDebugTask: "Get typescript warning / errors"
		});

		// vscode.debug.startDebugging(wsFolder, {
		// 	name: "Get typescript warning / errors",
		// 	request: "yarn tsc; .\\removeJsFiles.ps1",
		// 	type: "shell",
		// 	cwd: workingDirectory,
		// 	args: args,
		// 	console: "integratedTerminal",
		// });
		vscode.commands.executeCommand('setContext', 'testcaferunner.canRerun', true);
	}

	dispose() {

	}
}


interface IBrowser {
	name: string;
	isPortable?: boolean;
}



// // The module 'vscode' contains the VS Code extensibility API
// // Import the module and reference it with the alias vscode in your code below
// import * as vscode from 'vscode';

// // this method is called when your extension is activated
// // your extension is activated the very first time the command is executed
// export function activate(context: vscode.ExtensionContext) {

// 	// Use the console to output diagnostic information (console.log) and errors (console.error)
// 	// This line of code will only be executed once when your extension is activated
// 	console.log('Congratulations, your extension "custom-testcafe-testrunner" is now active!');

// 	// The command has been defined in the package.json file
// 	// Now provide the implementation of the command with registerCommand
// 	// The commandId parameter must match the command field in package.json
// 	let disposable = vscode.commands.registerCommand('custom-testcafe-testrunner.helloWorld', () => {
// 		// The code you place here will be executed every time your command is executed
// 		// Display a message box to the user
// 		vscode.window.showInformationMessage('Hello World from custom-testcafe-testRunner!');
// 	});

// 	context.subscriptions.push(disposable);
// }

// // this method is called when your extension is deactivated
// export function deactivate() {}
