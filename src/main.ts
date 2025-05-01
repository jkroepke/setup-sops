// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as core from '@actions/core'

import { HttpClient } from '@actions/http-client'
import {
  binaryName,
  githubRepository,
  toolName,
  defaultVersion
} from './tool.js'
import * as toolCache from '@actions/tool-cache'
import util from 'util'
import fs from 'fs'

function getExecutableExtension(): string {
  return getRunnerOS() === 'windows' ? '.exe' : ''
}

async function latestVersion(
  githubRepo: string,
  toolName: string,
  stableVersion: string
): Promise<string> {
  try {
    const httpClient = new HttpClient()
    const res = await httpClient.getJson<{ tag_name: string }>(
      `https://github.com/${githubRepo}/releases/latest`
    )

    if (res.statusCode !== 200 || !res.result || !res.result.tag_name) {
      core.warning(
        `Cannot get the latest ${toolName} info from https://github.com/${githubRepo}/releases/latest. Invalid response: ${JSON.stringify(res)}. Using default version ${stableVersion}.`
      )

      return stableVersion
    }

    return res.result.tag_name
  } catch (e) {
    core.warning(
      `Cannot get the latest ${toolName} info from https://github.com/${githubRepo}/releases/latest. Error ${e}. Using default version ${stableVersion}.`
    )
  }

  return stableVersion
}

function getRunnerArch(): string {
  const runnerArch = process.env['RUNNER_ARCH']! as string
  if (runnerArch.startsWith('X')) {
    return 'amd64'
  }

  return runnerArch
}

function getRunnerOS(): string {
  const runnerOs = process.env['RUNNER_OS']! as string
  if (runnerOs.match(/^Win/)) {
    return 'windows'
  } else if (runnerOs.match(/^Linux/)) {
    return 'linux'
  } else if (runnerOs.match(/^Darwin|MacOS/)) {
    return 'darwin'
  }

  throw new Error(
    `Unsupported OS found. OS: ${runnerOs} Arch: ${getRunnerArch()}`
  )
}

async function download(version: string): Promise<string> {
  if (!version) {
    version = await latestVersion(githubRepository, toolName, defaultVersion)
  }

  const url = downloadURL(version)
  const binaryName = toolName + getExecutableExtension()

  let cachedToolpath = toolCache.find(toolName, version)
  if (!cachedToolpath) {
    let downloadPath
    try {
      downloadPath = await toolCache.downloadTool(url)
    } catch (exception) {
      throw new Error(
        util.format(
          'Failed to download %s from location %s. Error: %s',
          binaryName,
          downloadPath,
          exception
        )
      )
    }

    await fs.promises.chmod(downloadPath, 0o777)
    cachedToolpath = await toolCache.cacheFile(
      downloadPath,
      binaryName,
      toolName,
      version
    )
  }

  const binaryPath = toolCache.find(toolName, version)
  if (!binaryPath) {
    throw new Error(
      util.format(
        '%s executable not found in path %s',
        binaryName,
        cachedToolpath
      )
    )
  }

  await fs.promises.chmod(binaryPath, 0o777)

  return binaryPath
}

function downloadURL(version: string): string {
  return util.format(
    'https://github.com/%s/releases/download/%s/%s',
    githubRepository,
    version,
    binaryName(version, getRunnerOS(), getRunnerArch())
  )
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    let version = core.getInput('version', { required: true })
    if (version.toLocaleLowerCase() === 'latest') {
      version = await latestVersion(githubRepository, toolName, defaultVersion)
    } else if (!version.toLocaleLowerCase().startsWith('v')) {
      version = 'v' + version
    }

    const cachedPath = await download(version)

    core.addPath(cachedPath)
    core.info(
      `${toolName} version: '${version}' has been cached at ${cachedPath}`
    )
    core.setOutput('path', cachedPath)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
