"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const log = (msg) => console.log(`\n${msg}`);
const exit = (msg) => {
    console.error(msg);
    process.exit(1);
};
const run = (cmd, cwd) => {
    (0, child_process_1.execSync)(cmd, { encoding: "utf8", stdio: "inherit", cwd });
};
const getPlatform = () => {
    switch (process.platform) {
        case "darwin":
            return "mac";
        case "win32":
            return "windows";
        default:
            return "linux";
    }
};
const getEnv = (name) => process.env[name.toUpperCase()] || null;
const setEnv = (name, value) => {
    if (value) {
        process.env[name.toUpperCase()] = value.toString();
    }
};
const getInput = (name, required) => {
    const value = getEnv(`INPUT_${name}`);
    if (required && !value) {
        exit(`"${name}" input variable is not defined`);
        return "";
    }
    else {
        return value;
    }
};
(function () {
    var _a, _b;
    const platform = getPlatform();
    const release = getInput("release", true) === "true";
    const packageRoot = getInput("package_root", true);
    const buildScriptName = getInput("build_script_name", true);
    const skipBuild = getInput("skip_build") === "true";
    const packageManager = (_b = (_a = getInput("package_manager", true)) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase()) === null || _b === void 0 ? void 0 : _b.trim();
    if (!["npm", "pnpm", "yarn"].includes(packageManager)) {
        exit(`"${packageManager}" not supported! Please use NPM, PNPM or Yarn`);
        return;
    }
    const args = getInput("args") || "";
    const maxAttempts = parseInt(getInput("max_build_attempts") || "1");
    const packageJsonPath = (0, path_1.join)(packageRoot, "package.json");
    const yarnLockPath = (0, path_1.join)(packageRoot, "yarn.lock");
    // NOTE: Determine which package mananger to run
    const canUseYarn = packageManager === "yarn" && (0, fs_1.existsSync)(yarnLockPath);
    const package_manager_used = packageManager === "yarn" && !canUseYarn ? "npm" : packageManager;
    // NOTE: Display used package manager
    if (packageManager === "yarn" && !canUseYarn) {
        log(`No Yarn lock file found! Falling back...`);
    }
    log(`Using ${package_manager_used} for directory "${packageRoot}"`);
    // NOTE: package.json required
    if (!(0, fs_1.existsSync)(packageJsonPath)) {
        exit(`"package.json" not found in "${packageJsonPath}"`);
        return;
    }
    // NOTE: EB reads GH_TOKEN
    setEnv("GH_TOKEN", getInput("github_token", true));
    // NOTE: Set code signing certificate and password importing through the config
    if (platform === "mac") {
        setEnv("CSC_LINK", getInput("mac_certs"));
        setEnv("CSC_KEY_PASSWORD", getInput("mac_certs_password"));
        setEnv("APPLE_ID", getInput("apple_id"));
        setEnv("APPLE_ID_PASSWORD", getInput("apple_id_password"));
        setEnv("APPLE_ID_TEAM", getInput("apple_id_team"));
    }
    else if (platform === "windows") {
        setEnv("CSC_LINK", getInput("windows_certs"));
        setEnv("CSC_KEY_PASSWORD", getInput("windows_certs_password"));
    }
    // NOTE: Disable console ads
    setEnv("ADBLOCK", true);
    log(`Installing dependencies using ${package_manager_used}…`);
    run(package_manager_used === "pnpm"
        ? "pnpm install"
        : package_manager_used === "npm"
            ? "npm install"
            : "yarn", packageRoot);
    // Run NPM build script if it exists
    if (skipBuild) {
        log("Skipping build script...");
    }
    else {
        log("Running the build script…");
        if (package_manager_used !== "YARN") {
            run(`npm run ${buildScriptName} --if-present`, packageRoot);
        }
        else {
            // TODO: Use `yarn run ${buildScriptName} --if-present` once supported
            // https://github.com/yarnpkg/yarn/issues/6894
            const pkgJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, "utf8"));
            if (pkgJson.scripts && pkgJson.scripts[buildScriptName]) {
                run(`yarn run ${buildScriptName}`, packageRoot);
            }
        }
    }
    log(`Building${release ? " and releasing" : ""} the Electron application…`);
    for (let i = 0; i < maxAttempts; i += 1) {
        try {
            const ebRunCommand = package_manager_used !== "yarn" ? "npx --no-install" : "yarn run";
            run(`${ebRunCommand} electron-builder --${platform} ${release ? "--publish always" : ""} ${args}`, packageRoot);
            break;
        }
        catch (err) {
            if (i < maxAttempts - 1) {
                log(`Attempt ${i + 1} failed:`);
                log(err === null || err === void 0 ? void 0 : err.toString());
            }
            else {
                throw err;
            }
        }
    }
})();
