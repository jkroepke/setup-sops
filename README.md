[![CI](https://github.com/jkroepke/setup-sops/actions/workflows/ci.yml/badge.svg)](https://github.com/jkroepke/setup-sops/actions/workflows/ci.yml)
[![GitHub license](https://img.shields.io/github/license/jkroepke/setup-sops)](https://github.com/jkroepke/setup-sops/blob/master/LICENSE)
[![Current Release](https://img.shields.io/github/release/jkroepke/setup-sops.svg?logo=github)](https://github.com/jkroepke/setup-sops/releases/latest)
[![GitHub Repo stars](https://img.shields.io/github/stars/jkroepke/setup-sops?style=flat&logo=github)](https://github.com/jkroepke/setup-sops/stargazers)

# Setup sops

⭐ Don't forget to star this repository! ⭐

## About

GitHub Action for installing [getsops/sops](https://github.com/getsops/sops)

Install a specific version of sops binary on the runner. Acceptable values are
latest or any semantic version string like v2.16.7. Use this action in workflow
to define which version of sops will be used.

```yaml
- name: Stackit Binary Installer
  uses: jkroepke/setup-sops@v1
  with:
    version: '<version>' # default is latest stable
  id: install
```

The cached binary path is prepended to the PATH environment variable as well as
stored in the path output variable. Refer to the action metadata file for
details about all the inputs
[here](https://github.com/jkroepke/setup-sops/blob/main/action.yml).
