import * as path from "path";
import * as vscode from "vscode";
import {ExtensionContext, workspace} from "vscode";
import {registerYamlSchemaSupport} from "./yaml-schema";
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind,} from "vscode-languageclient/node";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
    await registerYamlSchemaSupport();
    let config = vscode.workspace.getConfiguration('yaml');
    config.update('schemas', {"https://repo1.maven.org/maven2/com/walmartlabs/concord/runtime/v2/concord-runtime-model-v2/2.14.0/concord-runtime-model-v2-2.14.0-schema.json": ["*.concord.yml", "concord.yml", "concord.yaml", "*.concord.yaml"]}, vscode.ConfigurationTarget.Global);
    config.update('schemas', {"https://repo1.maven.org/maven2/com/walmartlabs/concord/runtime/v2/concord-runtime-model-v2/2.14.0/concord-runtime-model-v2-2.14.0-schema.json": ["*.concord.yml", "concord.yml", "concord.yaml", "*.concord.yaml"]}, vscode.ConfigurationTarget.Workspace);
    const serverModule = context.asAbsolutePath(
        path.join("server", "out", "server.js")
    );
    const serverOptions: ServerOptions = {
        run: {module: serverModule, transport: TransportKind.ipc},
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };


    const clientOptions: LanguageClientOptions = {
        // Register the server for all documents by default
        documentSelector: [{scheme: "file", language: "yaml"}],
        synchronize: {

            fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
        },
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        "concord-vscode",
        "Concord VSCode",
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
