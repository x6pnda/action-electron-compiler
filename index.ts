import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const log = (msg?: string) => console.log(`\n${msg}`);

const exit = (msg: string) => {
	console.error(msg);
	process.exit(1);
};

const run = (cmd: string, cwd?: string) => {
	execSync(cmd, { encoding: "utf8", stdio: "inherit", cwd });
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

const getEnv = (name: string) => process.env[name.toUpperCase()] || null;

const setEnv = (name: string, value?: any) => {
	if (value) {
		process.env[name.toUpperCase()] = value.toString();
	}
};

const getInput = <B extends boolean>(
	name: string,
	required?: B
): B extends true ? string : string | null => {
	const value = getEnv(`INPUT_${name}`);
	if (required && !value) {
		exit(`"${name}" input variable is not defined`);
		return "" as string;
	} else {
		return value as string;
	}
};

(function () {
	const platform = getPlatform();
	const release = getInput("release", true) === "true";
	const packageRoot = getInput("package_root", true);
	const buildScriptName = getInput("build_script_name", true);
	const skipBuild = getInput("skip_build") === "true";
	const packageManager = getInput("package_manager", true)
		?.toLocaleLowerCase()
		?.trim();
	if (!["npm", "pnpm", "yarn"].includes(packageManager)) {
		exit(`"${packageManager}" not supported! Please use NPM, PNPM or Yarn`);
		return;
	}
	const args = getInput("args") || "";
	const maxAttempts = parseInt(getInput("max_build_attempts") || "1");

	const packageJsonPath = join(packageRoot, "package.json");
	const yarnLockPath = join(packageRoot, "yarn.lock");

	// NOTE: Determine which package mananger to run
	const canUseYarn = packageManager === "yarn" && existsSync(yarnLockPath);
	const package_manager_used =
		packageManager === "yarn" && !canUseYarn ? "npm" : packageManager;

	// NOTE: Display used package manager
	if (packageManager === "yarn" && !canUseYarn) {
		log(`No Yarn lock file found! Falling back...`);
	}
	log(`Using ${package_manager_used} for directory "${packageRoot}"`);

	// NOTE: package.json required
	if (!existsSync(packageJsonPath)) {
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
	} else if (platform === "windows") {
		setEnv("CSC_LINK", getInput("windows_certs"));
		setEnv("CSC_KEY_PASSWORD", getInput("windows_certs_password"));
	}

	// NOTE: Disable console ads
	setEnv("ADBLOCK", true);

	log(`Installing dependencies using ${package_manager_used}…`);
	run(
		package_manager_used === "pnpm"
			? "pnpm install"
			: package_manager_used === "npm"
			? "npm install"
			: "yarn",
		packageRoot
	);

	// Run NPM build script if it exists
	if (skipBuild) {
		log("Skipping build script...");
	} else {
		log("Running the build script…");
		if (package_manager_used !== "YARN") {
			run(`npm run ${buildScriptName} --if-present`, packageRoot);
		} else {
			// TODO: Use `yarn run ${buildScriptName} --if-present` once supported
			// https://github.com/yarnpkg/yarn/issues/6894
			const pkgJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
			if (pkgJson.scripts && pkgJson.scripts[buildScriptName]) {
				run(`yarn run ${buildScriptName}`, packageRoot);
			}
		}
	}

	log(`Building${release ? " and releasing" : ""} the Electron application…`);
	for (let i = 0; i < maxAttempts; i += 1) {
		try {
			const ebRunCommand =
				package_manager_used !== "yarn" ? "npx --no-install" : "yarn run";
			run(
				`${ebRunCommand} electron-builder --${platform} ${
					release ? "--publish always" : ""
				} ${args}`,
				packageRoot
			);
			break;
		} catch (err) {
			if (i < maxAttempts - 1) {
				log(`Attempt ${i + 1} failed:`);
				log(err?.toString());
			} else {
				throw err;
			}
		}
	}
})();
