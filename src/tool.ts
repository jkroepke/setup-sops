import { clean, lt } from 'semver'

export const toolName = 'sops'
export const githubRepository = 'getsops/sops'

// renovate: github=getsops/sops
export const defaultVersion = 'v3.10.2'

export function binaryName(version: string, os: string, arch: string): string {
  version = clean(version) || version

  switch (os) {
    case 'linux':
      return lt(version, '3.8.0')
        ? `${toolName}-${version}.linux`
        : `${toolName}-${version}.linux.${arch}`
    case 'darwin':
      return lt(version, '3.8.0')
        ? `${toolName}-${version}.darwin`
        : `${toolName}-${version}.darwin.${arch}`
    case 'windows':
      return lt(version, '3.9.0')
        ? `${toolName}-${version}.exe`
        : `${toolName}-${version}-${arch}.exe`
    default:
      throw new Error(`Unsupported OS found. OS: ${os} Arch: ${arch}`)
  }
}
