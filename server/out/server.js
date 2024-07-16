"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const fs = require("fs");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const js_yaml_source_map_1 = require("js-yaml-source-map");
const yaml = require("js-yaml");
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
connection.onInitialize((params) => {
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: false,
            },
            definitionProvider: {
                workDoneProgress: false
            },
        },
    };
    return result;
});
connection.onCompletion((params) => {
    const textDocument = documents.get(params.textDocument.uri);
    if (!textDocument) {
        return [];
    }
    const position = params.position;
    const line = textDocument.getText({
        start: { line: position.line, character: 0 },
        end: { line: position.line, character: position.character }
    });
    if (line?.includes('call:') || line?.includes('entryPoint:')) {
        const path = textDocument?.uri.split('/');
        let files = [];
        let folderPath = '';
        let mainConcordFile = '';
        if (path.includes('concord')) {
            folderPath = '';
            for (let index = 2; index < path.length - 1; index++) {
                folderPath += path[index] + '/';
                if (path[index] == 'concord')
                    break;
                mainConcordFile += path[index] + '/';
            }
            const getFilesRecursively = (directory) => {
                const filesInDirectory = fs.readdirSync(directory);
                for (const file of filesInDirectory) {
                    let absolute = directory + file;
                    if (fs.statSync(absolute).isDirectory()) {
                        absolute = absolute + '/';
                        getFilesRecursively(absolute);
                    }
                    else {
                        files.push(absolute);
                    }
                }
            };
            getFilesRecursively(folderPath);
            files.push(mainConcordFile + 'concord.yml');
        }
        else {
            folderPath = '';
            for (let index = 2; index < path.length - 1; index++) {
                folderPath += path[index] + '/';
            }
            files = fs.readdirSync(folderPath);
            for (let index = 0; index < files.length; index++) {
                files[index] = folderPath + files[index];
            }
            if (path[path.length - 1] == 'concord.yml') {
                let concordFolderPath = '';
                for (let index = 2; index < path.length - 1; index++) {
                    concordFolderPath += path[index] + '/';
                }
                concordFolderPath += 'concord/';
                const getFilesRecursively = (directory) => {
                    const filesInDirectory = fs.readdirSync(directory);
                    for (const file of filesInDirectory) {
                        let absolute = directory + file;
                        if (fs.statSync(absolute).isDirectory()) {
                            absolute = absolute + '/';
                            getFilesRecursively(absolute);
                        }
                        else {
                            files.push(absolute);
                        }
                    }
                };
                getFilesRecursively(concordFolderPath);
            }
        }
        let flowList;
        const resultAlt = vscode_languageserver_types_1.CompletionList.create([], false);
        files.forEach((file) => {
            if (String(file).endsWith('concord.yml')) {
                const filePath = file;
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const map = new js_yaml_source_map_1.default();
                    const checkerfile = yaml.load(fileContent, { listener: map.listen(), json: true });
                    if (checkerfile && checkerfile.flows) {
                        flowList = Object.keys(checkerfile.flows);
                    }
                    flowList.map((flow) => {
                        resultAlt.items.push({
                            kind: vscode_languageserver_types_1.CompletionItemKind.Property,
                            label: flow,
                            insertText: flow,
                            insertTextFormat: vscode_languageserver_types_1.InsertTextFormat.Snippet,
                        });
                    });
                }
                catch (err) {
                    console.log(`Error reading ${file}:`, err);
                }
            }
        });
        return resultAlt;
    }
});
connection.onDefinition((params) => {
    let output = {};
    try {
        const doc = documents.get(params.textDocument.uri);
        if (!doc)
            return [];
        const pos = params.position;
        let flowName = '';
        const line = doc?.getText({
            start: { line: pos.line, character: 0 },
            end: { line: pos.line + 1, character: -2 },
        });
        if (line?.includes('call:') || line?.includes('entryPoint:')) {
            flowName = line.slice(line.lastIndexOf(':') + 2);
        }
        flowName = flowName.replace(/(\r\n|\n|\r| |"|')/gm, '');
        let numberOfSpaces = 0;
        let currentChar = ' ';
        let currIndex = line.lastIndexOf(':') + 2;
        while (currentChar == ' ') {
            currentChar = line[currIndex];
            numberOfSpaces++;
            currIndex++;
        }
        let lengthOfFlow = 0;
        while (currentChar != '\n' && currentChar != ' ' && currIndex < line.length) {
            lengthOfFlow++;
            currIndex++;
            currentChar = line[currIndex];
        }
        const map = new js_yaml_source_map_1.default();
        const loaded = yaml.load(doc.getText(), { listener: map.listen(), json: true });
        const target = map.lookup(['flows', flowName]);
        if (target) {
            const targetLine = doc?.getText({
                start: { line: target.line - 2, character: 0 },
                end: { line: target.line - 1, character: 0 },
            });
            const targetStart = targetLine.lastIndexOf(flowName);
            const targetEnd = targetStart + flowName.length;
            return [
                {
                    originSelectionRange: {
                        start: { line: pos.line, character: line.lastIndexOf(':') + 1 + numberOfSpaces },
                        end: { line: pos.line, character: line.lastIndexOf(':') + 2 + numberOfSpaces + lengthOfFlow },
                    },
                    targetUri: params.textDocument.uri,
                    targetRange: {
                        start: { line: target.line - 2, character: targetStart },
                        end: { line: target.line - 2, character: targetEnd },
                    },
                    targetSelectionRange: {
                        start: { line: target.line - 2, character: targetStart },
                        end: { line: target.line - 2, character: targetEnd },
                    },
                },
            ];
        }
        const path = doc?.uri.split('/');
        let files = [];
        let folderPath = '';
        let mainConcordFile = '';
        if (path.includes('concord')) {
            folderPath = '';
            for (let index = 2; index < path.length - 1; index++) {
                folderPath += path[index] + '/';
                if (path[index] == 'concord')
                    break;
                mainConcordFile += path[index] + '/';
            }
            const getFilesRecursively = (directory) => {
                const filesInDirectory = fs.readdirSync(directory);
                for (const file of filesInDirectory) {
                    let absolute = directory + file;
                    if (fs.statSync(absolute).isDirectory()) {
                        absolute = absolute + '/';
                        getFilesRecursively(absolute);
                    }
                    else {
                        files.push(absolute);
                    }
                }
            };
            getFilesRecursively(folderPath);
            files.push(mainConcordFile + 'concord.yml');
        }
        else {
            folderPath = '';
            for (let index = 2; index < path.length - 1; index++) {
                folderPath += path[index] + '/';
            }
            files = fs.readdirSync(folderPath);
            for (let index = 0; index < files.length; index++) {
                files[index] = folderPath + files[index];
            }
            if (path[path.length - 1] == 'concord.yml') {
                let concordFolderPath = '';
                for (let index = 2; index < path.length - 1; index++) {
                    concordFolderPath += path[index] + '/';
                }
                concordFolderPath += 'concord/';
                const getFilesRecursively = (directory) => {
                    const filesInDirectory = fs.readdirSync(directory);
                    for (const file of filesInDirectory) {
                        let absolute = directory + file;
                        if (fs.statSync(absolute).isDirectory()) {
                            absolute = absolute + '/';
                            getFilesRecursively(absolute);
                        }
                        else {
                            files.push(absolute);
                        }
                    }
                };
                getFilesRecursively(concordFolderPath);
            }
        }
        files.forEach((file) => {
            if (String(file).endsWith('concord.yml')) {
                const filePath = file;
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const map = new js_yaml_source_map_1.default();
                    const loaded = yaml.load(fileContent, { listener: map.listen(), json: true });
                    const target = map.lookup(['flows', flowName]);
                    if (fileContent && target && 'file://' + filePath != params.textDocument.uri) {
                        const targetLine = fileContent.split('\n')[target.line - 2];
                        console.log(targetLine);
                        const targetStart = targetLine.lastIndexOf(flowName);
                        const targetEnd = targetStart + flowName.length;
                        output = {
                            originSelectionRange: {
                                start: { line: pos.line, character: line.lastIndexOf(':') + 1 + numberOfSpaces },
                                end: { line: pos.line, character: line.lastIndexOf(':') + 2 + numberOfSpaces + lengthOfFlow },
                            },
                            targetUri: 'file://' + filePath,
                            targetRange: {
                                start: { line: target.line - 2, character: targetStart },
                                end: { line: target.line - 2, character: targetEnd },
                            },
                            targetSelectionRange: {
                                start: { line: target.line - 2, character: targetStart },
                                end: { line: target.line - 2, character: targetEnd },
                            },
                        };
                        return [output];
                    }
                }
                catch (err) {
                    console.log(`Error reading ${file}:`, err);
                }
            }
        });
        return [output];
    }
    catch (err) {
        console.log(`Error opening file:`, err);
    }
    return undefined;
});
documents.onDidChangeContent((change) => {
    runAdditionalValidators(change.document);
});
function runAdditionalValidators(document) {
    const result = [];
    const map = new js_yaml_source_map_1.default();
    const loaded = yaml.load(document.getText(), { listener: map.listen(), json: true });
    const path = document?.uri.split('/');
    let files = [];
    let folderPath = '';
    let mainConcordFile = '';
    if (path.includes('concord')) {
        folderPath = '';
        for (let index = 2; index < path.length - 1; index++) {
            folderPath += path[index] + '/';
            if (path[index] == 'concord')
                break;
            mainConcordFile += path[index] + '/';
        }
        const getFilesRecursively = (directory) => {
            const filesInDirectory = fs.readdirSync(directory);
            for (const file of filesInDirectory) {
                let absolute = directory + file;
                if (fs.statSync(absolute).isDirectory()) {
                    absolute = absolute + '/';
                    getFilesRecursively(absolute);
                }
                else {
                    files.push(absolute);
                }
            }
        };
        getFilesRecursively(folderPath);
        files.push(mainConcordFile + 'concord.yml');
    }
    else {
        folderPath = '';
        for (let index = 2; index < path.length - 1; index++) {
            folderPath += path[index] + '/';
        }
        files = fs.readdirSync(folderPath);
        for (let index = 0; index < files.length; index++) {
            files[index] = folderPath + files[index];
        }
        if (path[path.length - 1] == 'concord.yml') {
            let concordFolderPath = '';
            for (let index = 2; index < path.length - 1; index++) {
                concordFolderPath += path[index] + '/';
            }
            concordFolderPath += 'concord/';
            const getFilesRecursively = (directory) => {
                const filesInDirectory = fs.readdirSync(directory);
                for (const file of filesInDirectory) {
                    let absolute = directory + file;
                    if (fs.statSync(absolute).isDirectory()) {
                        absolute = absolute + '/';
                        getFilesRecursively(absolute);
                    }
                    else {
                        files.push(absolute);
                    }
                }
            };
            getFilesRecursively(concordFolderPath);
        }
    }
    document
        ?.getText()
        .split('\n')
        .map((currentLine, index) => {
        if (currentLine.includes('call:') || currentLine.includes('entryPoint:')) {
            const lineNumber = index + 1;
            let flowName = currentLine.slice(currentLine.lastIndexOf(':') + 2);
            flowName = flowName.replace(/(\r\n|\n|\r| |"|')/gm, '');
            let numberOfSpaces = 0;
            let currentChar = ' ';
            let currentIndex = currentLine.lastIndexOf(':') + 2;
            while (currentChar == ' ') {
                currentChar = currentLine[currentIndex];
                numberOfSpaces++;
                currentIndex++;
            }
            let lengthOfFlow = 0;
            while (currentChar != '\n' && currentChar != ' ' && currentIndex < currentLine.length) {
                lengthOfFlow++;
                currentIndex++;
                currentChar = currentLine[currentIndex];
            }
            let flowPresent = false;
            files.forEach((file) => {
                if (String(file).endsWith('concord.yml')) {
                    const filePath = file;
                    try {
                        const fileContent = fs.readFileSync(filePath, 'utf-8');
                        const map = new js_yaml_source_map_1.default();
                        const checkerfile = yaml.load(fileContent, { listener: map.listen(), json: true });
                        if (checkerfile.flows[flowName]) {
                            flowPresent = true;
                        }
                    }
                    catch (err) {
                        console.log(`Error reading ${file}:`, err);
                    }
                }
            });
            if (!flowPresent) {
                result.push({
                    range: {
                        start: { line: lineNumber - 1, character: currentLine.lastIndexOf(':') + 1 + numberOfSpaces },
                        end: { line: lineNumber - 1, character: currentLine.lastIndexOf(':') + 2 + numberOfSpaces + lengthOfFlow },
                    },
                    message: 'No such flow',
                });
            }
        }
    });
    connection.sendDiagnostics({ uri: document.uri, diagnostics: result });
    return result;
}
documents.listen(connection);
connection.listen();
//# sourceMappingURL=server.js.map