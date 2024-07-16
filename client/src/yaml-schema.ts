import * as vscode from 'vscode';
import * as semver from 'semver';
const VSCODE_YAML_EXTENSION_ID = "redhat.vscode-yaml";

declare type YamlSchemaContributor = (schema: string,
    requestSchema: (resource: string) => string | undefined,
    requestSchemaContent: (uri: string) => string) => void;


export async function registerYamlSchemaSupport(): Promise<void> {
    const yamlPlugin: any = await activateYamlExtension();
    if (!yamlPlugin || !yamlPlugin.registerContributor) {
        return;
    }
}
export async function activateYamlExtension(): Promise<{registerContributor: YamlSchemaContributor} | undefined> {
    const ext = vscode.extensions.getExtension(VSCODE_YAML_EXTENSION_ID);
    if (!ext) {
        vscode.window.showWarningMessage('Please install \'YAML Support by Red Hat\' via the Extensions pane.');
        return undefined;
    }
    const yamlPlugin = await ext.activate();
    if (!yamlPlugin || !yamlPlugin.registerContributor) {
        vscode.window.showWarningMessage('The installed Red Hat YAML extension doesn\'t support Intellisense. Please upgrade \'YAML Support by Red Hat\' via the Extensions pane.');
        return undefined;
    }
  
    if (ext.packageJSON.version && !semver.gte(ext.packageJSON.version, '0.0.15')) {
        vscode.window.showWarningMessage('The installed Red Hat YAML extension doesn\'t support multiple schemas. Please upgrade \'YAML Support by Red Hat\' via the Extensions pane.');
    }
    return yamlPlugin;
}