// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from 'path'
import * as util from 'util'
import * as fs from 'fs'
import * as semver from 'semver'

import * as toolCache from '@actions/tool-cache'
import * as core from '@actions/core'

const sopsToolName = 'sops'
// renovate: github=getsops/sops
const stableSopsVersion = 'v3.10.2'
const sopsAllReleasesUrl = 'https://api.github.com/repos/getsops/sops/releases'

type ResponseType = {
  tag_name?: string
}

function getExecutableExtension(): string {
  const runnerOs = process.env['RUNNER_OS']! as string
  if (runnerOs.match(/^Win/)) {
    return '.exe'
  }
  return ''
}

function getSopsBinaryName(version: string): string {
  const runnerArch = process.env['RUNNER_ARCH']! as string
  const runnerOs = process.env['RUNNER_OS']! as string
  const archExtension = runnerArch.startsWith('X') ? 'amd64' : 'arm64'

  switch (runnerOs) {
    case 'Linux':
      return semver.lt(version, '3.8.0')
        ? util.format('sops-%s.linux', version)
        : util.format('sops-%s.linux.%s', version, archExtension)

    case 'macOS':
      return semver.lt(version, '3.8.0')
        ? util.format('sops-%s.darwin', version)
        : util.format('sops-%s.darwin.%s', version, archExtension)

    case 'Windows':
      return semver.lt(version, '3.9.0')
        ? util.format('sops-%s.exe', version)
        : util.format('sops-%s.%s.exe', version, archExtension)
    default:
      throw new Error(
        `Unsupported OS found. OS: ${runnerOs} Arch: ${runnerArch}`
      )
  }
}

function getSopsDownloadURL(version: string): string {
  return util.format(
    'https://github.com/getsops/sops/releases/download/%s/%s',
    version,
    getSopsBinaryName(version)
  )
}

async function getStableSopsVersion(): Promise<string> {
  try {
    const downloadPath = await toolCache.downloadTool(sopsAllReleasesUrl)
    const responseArray = JSON.parse(
      fs.readFileSync(downloadPath, 'utf8').toString().trim()
    )
    let latestSopsVersion = semver.clean(stableSopsVersion) || stableSopsVersion // Ensure non-null value
    responseArray.forEach((response: ResponseType) => {
      if (response && response.tag_name) {
        const currentSopsVersion =
          semver.clean(response.tag_name.toString()) || '' // Ensure non-null value
        if (
          currentSopsVersion &&
          currentSopsVersion.indexOf('rc') === -1 &&
          semver.gt(currentSopsVersion, latestSopsVersion)
        ) {
          // If current sops version is not a pre-release and is greater than the latest sops version
          latestSopsVersion = currentSopsVersion
        }
      }
    })
    latestSopsVersion = 'v' + latestSopsVersion
    return latestSopsVersion
  } catch (error) {
    core.warning(
      util.format(
        'Cannot get the latest Sops info from %s. Error %s. Using default Sops version %s.',
        sopsAllReleasesUrl,
        error,
        stableSopsVersion
      )
    )
  }

  return stableSopsVersion
}

async function walk(
  dir: string,
  fileToFind: string,
  filelist: string[] = []
): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(fullPath, fileToFind, filelist)
    } else {
      core.debug(entry.name)
      if (entry.name === fileToFind) {
        filelist.push(fullPath)
      }
    }
  }

  return filelist
}

async function downloadSops(version: string): Promise<string> {
  if (!version) {
    version = await getStableSopsVersion()
  }

  const sopsBinaryName = sopsToolName + getExecutableExtension()

  let cachedToolpath = toolCache.find(sopsToolName, version)
  if (!cachedToolpath) {
    let sopsDownloadPath
    try {
      sopsDownloadPath = await toolCache.downloadTool(
        getSopsDownloadURL(version)
      )
    } catch (exception) {
      throw new Error(
        util.format(
          'Failed to download Sops from location %s. Error: %s',
          getSopsDownloadURL(version),
          exception
        )
      )
    }

    await fs.promises.chmod(sopsDownloadPath, 0o777)
    cachedToolpath = await toolCache.cacheFile(
      sopsDownloadPath,
      sopsBinaryName,
      sopsToolName,
      version
    )
  }

  const sopsPath = await findSopsBinary(cachedToolpath, sopsBinaryName)
  if (!sopsPath) {
    throw new Error(
      util.format(
        '%s executable not found in path %s',
        sopsBinaryName,
        cachedToolpath
      )
    )
  }

  await fs.promises.chmod(sopsPath, 0o777)
  return sopsPath
}

async function findSopsBinary(
  rootFolder: string,
  sopsBinName: string
): Promise<string> {
  await fs.promises.chmod(rootFolder, 0o777)
  const files = await walk(rootFolder, sopsBinName)

  if (!files) {
    throw new Error(
      util.format('Sops executable not found in path ', rootFolder)
    )
  } else {
    return files[0]
  }
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
      version = await getStableSopsVersion()
    } else if (!version.toLocaleLowerCase().startsWith('v')) {
      version = 'v' + version
    }

    const cachedPath = await downloadSops(version)

    try {
      if (
        process.env['PATH'] &&
        !process.env['PATH'].startsWith(path.dirname(cachedPath))
      ) {
        core.addPath(path.dirname(cachedPath))
      }
    } catch {
      //do nothing, set as output variable
    }

    console.log(
      `Sops tool version: '${version}' has been cached at ${cachedPath}`
    )
    core.setOutput('sops-path', cachedPath)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
