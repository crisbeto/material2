/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {JsonParseMode, normalize, parseJson} from '@angular-devkit/core';
import {
  ProjectDefinition,
  ProjectDefinitionCollection,
  WorkspaceDefinition,
} from '@angular-devkit/core/src/workspace';
import {readJsonWorkspace} from '@angular-devkit/core/src/workspace/json/reader';
import {Tree} from '@angular-devkit/schematics';
import {WorkspacePath} from '../update-tool/file-system';

/** Name of the default Angular CLI workspace configuration files. */
const defaultWorkspaceConfigPaths = ['/angular.json', '/.angular.json'];

/** Gets the tsconfig path from the given target within the specified project. */
export function getTargetTsconfigPath(project: ProjectDefinition,
                                      targetName: string): WorkspacePath|null {
  const tsconfig = project.targets?.get(targetName)?.options?.tsConfig;
  return tsconfig ? normalize(tsconfig as string) : null;
}

/**
 * Resolve the workspace configuration of the specified tree gracefully. We cannot use the utility
 * functions from the default Angular schematics because those might not be present in older
 * versions of the CLI. Also it's important to resolve the workspace gracefully because
 * the CLI project could be still using `.angular-cli.json` instead of the new config.
 */
export function getWorkspaceConfigGracefully(tree: Tree): null|WorkspaceDefinition {
  const path = defaultWorkspaceConfigPaths.find(filePath => tree.exists(filePath));
  const configBuffer = tree.read(path!);

  if (!path || !configBuffer) {
    return null;
  }

  readJsonWorkspace(path, tree)

  try {
    // Parse the workspace file as JSON5 which is also supported for CLI
    // workspace configurations.
    const parsed: any = parseJson(configBuffer.toString(), JsonParseMode.Json5);
    if (parsed.projects) {
      parsed.projects = new ProjectDefinitionCollection(parsed.projects);
    }
    debugger;
    return parsed as unknown as WorkspaceDefinition;
  } catch (e) {
    return null;
  }
}
