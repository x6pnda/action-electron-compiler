# GitHub action for electron-builder

**Easy, cleaned and updated action for building, compiling and releasing Electron applications**

This is a GitHub Action for building and compiling Electron applications with GitHub CI/CD. It uses [`electron-builder`](https://github.com/electron-userland/electron-builder) to compile and package the appication and optionally release it to a platform of your choice.

This action is an updated, refactored and cleaned up version of [`samuelmeuli/action-electron-builder`](https://github.com/samuelmeuli/action-electron-builder). The action hasn't gotten any updates in over 2 years and it was missing some basic features such as PNPM support. Basically a no nonsense action for Electron.

## Setup

1. Configure your application and electron-builder.

2. Configure your workflow script. Either run build before we package electron or we run build default before packaging. You can configure this.

3. **Add a workflow file** to your project (e.g. `.github/workflows/build.yml`):

    ```yml
    name: Build/release

    on: push

    jobs:
        release:
            runs-on: ${{ matrix.os }}

            strategy:
                matrix:
                    os: [macos-latest, ubuntu-latest, windows-latest]

            steps:
                - name: Check out Git repository
                  uses: actions/checkout@v1

                - name: Install Node.js, NPM and Yarn
                  uses: actions/setup-node@v1
                  with:
                      node-version: 16

                - name: Compile Electron App
                  uses: x6Pnda/action-electron-compiler@v1
                  with:
                      # GitHub token, automatically provided to the action
                      # (Optional)
                      github_token: ${{ secrets.github_token }}

                      # If the commit is tagged with a version (e.g. "v1.0.0"),
                      # (Optional)
                      release: ${{ startsWith(github.ref, 'refs/tags/v') }}

                      # Package manager. NPM, PNPM and Yarn supported. Install Yarn and PNPM yourself. Default is NPM
                      # (Optional)
                      package_manager: NPM

                      # Skip buiding the application
                      # (Optional)
                      skip_build: false
    ```

There are more options located in the [`action.yml`](./action.yml) file. Good luck.

## Usage

### Building

Using this the workflow above, GitHub will build your app every time you push a commit.

### Releasing

When you want to create a new release, follow these steps:

1. Update the version in your project's `package.json` file (e.g. `1.2.3`)
2. Commit that change (`git commit -am v1.2.3`)
3. Tag your commit (`git tag v1.2.3`). Make sure your tag name's format is `v*.*.*`. Your workflow will use this tag to detect when to create a release
4. Push your changes to GitHub (`git push && git push --tags`)

After building successfully, the action will publish your release artifacts. By default, a new release draft will be created on GitHub with download links for your app. If you want to change this behavior, have a look at the [`electron-builder` docs](https://www.electron.build).

## Configuration

### Notarization

Use your aftersign script. Make your life easy and copy paste it from @electron/notarize. You can use the environment variables APPLE_ID and APPLE_ID_PASSWORD to get the variables set inside the action. Will look into Windows at a later time. The point of this action is to compile, not to notarize. Don't create unicorns...

## Development

Create an issue or suggestion. Before submitting: don't overcomplicate things. Think is it really needed or something which makes it harder for other users.
