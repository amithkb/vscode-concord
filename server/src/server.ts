import {
    createConnection,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
  } from "vscode-languageserver/node";
  import {CompletionItemKind, CompletionList, Diagnostic, InsertTextFormat, integer} from 'vscode-languageserver-types';
  import * as fs from 'fs';
  import {TextDocument} from "vscode-languageserver-textdocument";
  import SourceMap from "js-yaml-source-map";
  import * as yaml from "js-yaml";
  import { text } from "stream/consumers";
  
  const connection = createConnection(ProposedFeatures.all);
  
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  
  connection.onInitialize((params: InitializeParams) => {
      const result: InitializeResult = {
          capabilities: {
              textDocumentSync: TextDocumentSyncKind.Incremental,
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
          start: {line: position.line, character: 0},
          end: {line: position.line, character: position.character}
      });
      if (line?.includes('call:') || line?.includes('entryPoint:')) {
          const path = textDocument?.uri.split('/');
          let files: Array<string> = [];
          let folderPath: any = '';
          let mainConcordFile = '';
          if (path.includes('concord')) {
              folderPath = '';
              for (let index = 2; index < path.length - 1; index++) {
                  folderPath += path[index] + '/';
                  if (path[index] == 'concord') break;
                  mainConcordFile += path[index] + '/';
              }
              const getFilesRecursively = (directory: any): any => {
                  try{
                      const filesInDirectory = fs.readdirSync(directory);
                      for (const file of filesInDirectory) {
                          let absolute = directory + file;
                          if (fs.statSync(absolute).isDirectory()) {
                              absolute = absolute + '/';
                              getFilesRecursively(absolute);
                          } else {
                              files.push(absolute);
                          }
                      }
                  } catch(err){
                      console.error(err);
                  }
              };
              getFilesRecursively(folderPath);
              files.push(mainConcordFile + 'concord.yml');
          } else {
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
                  const getFilesRecursively = (directory: any): any => {
                      try{
                          const filesInDirectory = fs.readdirSync(directory);
                          for (const file of filesInDirectory) {
                              let absolute = directory + file;
                              if (fs.statSync(absolute).isDirectory()) {
                                  absolute = absolute + '/';
                                  getFilesRecursively(absolute);
                              } else {
                                  files.push(absolute);
                              }
                          }
                      } catch(err){
                          console.error(err);
                      }
                  };
                  getFilesRecursively(concordFolderPath);
              }
          }
          let flowList: string[] = [];
          const resultAlt = CompletionList.create([], false);
          const map = new SourceMap();
          const loaded: any = yaml.load(textDocument.getText(), {listener: map.listen(), json: true});
          if (loaded && loaded.flows) {
            flowList = Object.keys(loaded.flows);
          } 
          flowList.map((flow) => {
              resultAlt.items.push({
                  kind: CompletionItemKind.Property,
                  label: flow,
                  insertText: flow,
                  insertTextFormat: InsertTextFormat.Snippet,
              });
          });
          files.forEach((file: any) => {
              if (String(file).endsWith('concord.yml')) {
                  const filePath = file;
                  try {
                      const fileContent = fs.readFileSync(filePath, 'utf-8');
                      const checkerfile: any = yaml.load(fileContent, {listener: map.listen(), json: true});
                      if (checkerfile && checkerfile.flows) {
                          flowList = Object.keys(checkerfile.flows);
                      }
                      flowList.map((flow) => {
                          resultAlt.items.push({
                              kind: CompletionItemKind.Property,
                              label: flow,
                              insertText: flow,
                              insertTextFormat: InsertTextFormat.Snippet,
                          });
                      });
                  } catch (err) {
                      console.log(`Error reading ${file}:`, err);
                  }
              }
          });
          const uniqueItems = resultAlt.items.filter(
            (arr, index, self) =>
              index ===
              self.findIndex((item) => item.label === arr.label && item.insertText === arr.insertText && item.kind === arr.kind)
          );
          return uniqueItems;
      }
  })
  
  
  connection.onDefinition((params) => {
      let output: any = {};
      try {
          const doc = documents.get(params.textDocument.uri);
          if (!doc) return [];
          const pos = params.position;
          let flowName = '';
          const line = doc?.getText({
              start: {line: pos.line, character: 0},
              end: {line: pos.line + 1, character: -2},
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
          const map = new SourceMap();
          const loaded: any = yaml.load(doc.getText(), {listener: map.listen(), json: true});
          const target = map.lookup(['flows', flowName]);
          if (target) {
              const targetLine = doc?.getText({
                  start: {line: target.line - 2, character: 0},
                  end: {line: target.line - 1, character: 0},
              });
              const targetStart = targetLine.lastIndexOf(flowName);
              const targetEnd = targetStart + flowName.length;
              return [
                  {
                      originSelectionRange: {
                          start: {line: pos.line, character: line.lastIndexOf(':') + 1 + numberOfSpaces},
                          end: {line: pos.line, character: line.lastIndexOf(':') + 2 + numberOfSpaces + lengthOfFlow},
                      },
                      targetUri: params.textDocument.uri,
                      targetRange: {
                          start: {line: target.line - 2, character: targetStart},
                          end: {line: target.line - 2, character: targetEnd},
                      },
                      targetSelectionRange: {
                          start: {line: target.line - 2, character: targetStart},
                          end: {line: target.line - 2, character: targetEnd},
                      },
                  },
              ];
          }
          const path = doc?.uri.split('/');
          let files: Array<string> = [];
          let folderPath: any = '';
          let mainConcordFile = '';
          if (path.includes('concord')) {
              folderPath = '';
              for (let index = 2; index < path.length - 1; index++) {
                  folderPath += path[index] + '/';
                  if (path[index] == 'concord') break;
                  mainConcordFile += path[index] + '/';
              }
              const getFilesRecursively = (directory: any) => {
                  try{
                      const filesInDirectory = fs.readdirSync(directory);
                      for (const file of filesInDirectory) {
                          let absolute = directory + file;
                          if (fs.statSync(absolute).isDirectory()) {
                              absolute = absolute + '/';
                              getFilesRecursively(absolute);
                          } else {
                              files.push(absolute);
                          }
                      }
                  } catch(err){
                      console.error(err);
                  }
              };
              getFilesRecursively(folderPath);
  
              files.push(mainConcordFile + 'concord.yml');
          } else {
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
                  const getFilesRecursively = (directory: any): any => {
                      try{
                          const filesInDirectory = fs.readdirSync(directory);
                          for (const file of filesInDirectory) {
                              let absolute = directory + file;
                              if (fs.statSync(absolute).isDirectory()) {
                                  absolute = absolute + '/';
                                  getFilesRecursively(absolute);
                              } else {
                                  files.push(absolute);
                              }
                          }
                      } catch(err){
                          console.error(err);
                      }
                  };
                  getFilesRecursively(concordFolderPath);
              }
          }
          files.forEach((file: any) => {
              if (String(file).endsWith('concord.yml')) {
                  const filePath = file;
                  try {
                      const fileContent = fs.readFileSync(filePath, 'utf-8');
                      const map = new SourceMap();
                      const loaded: any = yaml.load(fileContent, {listener: map.listen(), json: true});
                      const target = map.lookup(['flows', flowName]);
                      if (fileContent && target && 'file://' + filePath != params.textDocument.uri) {
                          const targetLine = fileContent.split('\n')[target.line - 2];
                          console.log(targetLine);
                          const targetStart = targetLine.lastIndexOf(flowName);
                          const targetEnd = targetStart + flowName.length;
                          output = {
                              originSelectionRange: {
                                  start: {line: pos.line, character: line.lastIndexOf(':') + 1 + numberOfSpaces},
                                  end: {
                                      line: pos.line,
                                      character: line.lastIndexOf(':') + 2 + numberOfSpaces + lengthOfFlow
                                  },
                              },
                              targetUri: 'file://' + filePath,
                              targetRange: {
                                  start: {line: target.line - 2, character: targetStart},
                                  end: {line: target.line - 2, character: targetEnd},
                              },
                              targetSelectionRange: {
                                  start: {line: target.line - 2, character: targetStart},
                                  end: {line: target.line - 2, character: targetEnd},
                              },
                          };
                          return [output];
                      }
                  } catch (err) {
                      console.log(`Error reading ${file}:`, err);
                  }
              }
          });
          return [output];
      } catch (err) {
          console.log(`Error opening file:`, err);
      }
  
      return undefined;
  })
  
  
  documents.onDidChangeContent((change) => {
      runAdditionalValidators(change.document);
  });
  
  
  function runAdditionalValidators(document: TextDocument): Diagnostic[] {
      const result: Diagnostic[] = [];
      const map = new SourceMap();
      const loaded: any = yaml.load(document.getText(), {listener: map.listen(), json: true});
      
      const path = document?.uri.split('/');
      let files: Array<string> = [];
      let folderPath: any = '';
      let mainConcordFile = '';
      if (path.includes('concord')) {
          folderPath = '';
          for (let index = 2; index < path.length - 1; index++) {
              folderPath += path[index] + '/';
              if (path[index] == 'concord') break;
              mainConcordFile += path[index] + '/';
          }
          const getFilesRecursively = (directory: any): any => {
              try{
                  const filesInDirectory = fs.readdirSync(directory);
                  for (const file of filesInDirectory) {
                      let absolute = directory + file;
                      if (fs.statSync(absolute).isDirectory()) {
                          absolute = absolute + '/';
                          getFilesRecursively(absolute);
                      } else {
                          files.push(absolute);
                      }
                  }
              } catch(err){
                  console.error(err);
              }
          };
          getFilesRecursively(folderPath);
          files.push(mainConcordFile + 'concord.yml');
      } else {
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
              const getFilesRecursively = (directory: any): any => {
                  try{
                      const filesInDirectory = fs.readdirSync(directory);
                      for (const file of filesInDirectory) {
                          let absolute = directory + file;
                          if (fs.statSync(absolute).isDirectory()) {
                              absolute = absolute + '/';
                              getFilesRecursively(absolute);
                          } else {
                              files.push(absolute);
                          }
                      }
                  } catch(err){
                      console.error(err);
                  }
              };
              getFilesRecursively(concordFolderPath);
          }
      }
      document
          ?.getText()
          .split('\n')
          .map((currentLine: string, index: integer) => {
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
  
                  if(!loaded.flows[flowName]){
                      files.forEach((file: any) => {
                          if (String(file).endsWith('concord.yml')) {
                              const filePath = file;
                              try {
                                  const fileContent = fs.readFileSync(filePath, 'utf-8');
                                  const map = new SourceMap();
                                  const checkerfile: any = yaml.load(fileContent, {listener: map.listen(), json: true});
                                  if (checkerfile.flows[flowName]) {
                                      flowPresent = true;
                                  }
                              } catch (err) {
                                  console.log(`Error reading ${file}:`, err);
                              }
                          }
                      });
                  }
                  else{
                    flowPresent = true;
                  }
  
                  if (!flowPresent) {
                      result.push({
                          range: {
                              start: {line: lineNumber - 1, character: currentLine.lastIndexOf(':') + 1 + numberOfSpaces},
                              end: {
                                  line: lineNumber - 1,
                                  character: currentLine.lastIndexOf(':') + 2 + numberOfSpaces + lengthOfFlow
                              },
                          },
                          message: 'No such flow',
                      });
                  }
              }
          });
      connection.sendDiagnostics({uri: document.uri, diagnostics: result});
      return result;
  }
  
  documents.listen(connection);
  connection.listen();