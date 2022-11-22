import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import degit from "degit";
import { execa } from "execa";
import inquirer from "inquirer";

import {
  exit,
  error,
  log,
  info,
  success,
  logWithSpinner,
  stopSpinner,
  isSubdir,
} from "./utils/index.js";

import { FLOWERSHOW_FOLDER_NAME } from "./const.js";

export default class Installer {
  context: any;
  targetDir: string;

  constructor(context: any, targetDir: string) {
    this.context = context;
    this.targetDir = targetDir;
  }

  get templateRepo() {
    // simplify importing data from package.json with this line after we no longer want to support node 16
    // import packageJson from "#package.json" assert { type: "json" };
    const flowershowRepo = require("../../package.json").repository.url.replace(
      "git+",
      ""
    );
    return `${flowershowRepo}/packages/template`;
  }

  async install() {
    const { context, targetDir, templateRepo } = this;
    const flowershowDir = path.resolve(targetDir, FLOWERSHOW_FOLDER_NAME);

    let existsAction;
    if (fs.existsSync(flowershowDir)) {
      const { action } = await inquirer.prompt([
        {
          name: "action",
          type: "list",
          message: `Flowershow template is already installed in directory ${chalk.magenta(
            targetDir
          )}. What do you want to do?:`,
          choices: [
            { name: "Overwrite", value: "overwrite" },
            // { name: 'Merge', value: 'merge' },
            { name: "Cancel", value: null },
          ],
        },
      ]);

      if (!action) {
        exit(0);
      }
      existsAction = action;
    }

    const { contentPath } = await inquirer.prompt([
      {
        name: "contentPath",
        type: "input",
        message: "Path to the folder with your markdown files",
        validate(input) {
          const contentDir = path.resolve(context, input);
          if (!fs.existsSync(contentDir)) {
            error(`Directory ${contentDir} does not exist.`);
            exit(1);
          }
          return true;
        },
      },
    ]);

    const contentDir = path.resolve(context, contentPath);

    // don't allow for installing the template anywhere within the content folder
    // as it will break esbuild
    if (isSubdir(flowershowDir, contentDir)) {
      log(`Provided content directory: ${contentDir}`);
      log(
        `Provided Flowershow template installation directory: ${flowershowDir}`
      );
      error(
        `You can't install the Flowershow template inside your content folder.`
      );
      exit(1);
    }

    const assetFolderChoices = fs
      .readdirSync(contentDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, value: d.name }));

    let assetsFolder;

    if (!assetFolderChoices.length) {
      const { foldersAction } = await inquirer.prompt([
        {
          name: "foldersAction",
          type: "list",
          message:
            "There are no subfolders in your content folder, that could be used as assets folder",
          choices: [
            { name: "I don't need assets folder", value: "none" },
            { name: "Cancel", value: null },
          ],
        },
      ]);

      assetsFolder = foldersAction;
    } else {
      const { assets } = await inquirer.prompt([
        {
          name: "assets",
          type: "list",
          message: "Select a folder with your assets (attachments)",
          choices: [
            ...assetFolderChoices,
            new inquirer.Separator(),
            { name: "I don't need assets folder", value: "none" },
            { name: "Cancel", value: null },
          ],
        },
      ]);

      assetsFolder = assets;
    }

    if (!assetsFolder) {
      exit(0);
    }

    // install flowershow template
    // // if there is no index.md file, create one
    if (!fs.existsSync(`${contentPath}/index.md`)) {
      info(
        `No index.md file found in ${contentDir}. Flowershow will create one for you.`
      );
      const homePageContent = "# Welcome to my Flowershow site!";
      // eslint-disable-next-line no-unused-vars
      fs.writeFile(
        `${contentPath}/index.md`,
        homePageContent,
        { flag: "a" },
        (err) => {} // eslint-disable-line no-unused-vars
      );
    }

    // // if there is no config.js file, create one
    if (!fs.existsSync(`${contentPath}/config.js`)) {
      info(
        `No config.js file found in ${contentDir}. Flowershow will create one for you.`
      );
      fs.writeFile(
        `${contentPath}/config.js`,
        "{}",
        { flag: "a" },
        (err) => {} // eslint-disable-line no-unused-vars
      );
    }

    // create flowershow template
    logWithSpinner({
      symbol: "🌷",
      msg: `Creating Flowershow template in ${chalk.magenta(flowershowDir)}`,
    });

    if (existsAction === "overwrite") {
      fs.rmSync(flowershowDir, { recursive: true, force: true });
    }

    try {
      const emitter = degit(templateRepo);
      await emitter.clone(flowershowDir);
    } catch (err) {
      error(
        `Failed to clone Flowershow template into ${flowershowDir}. This may be a problem with Flowershow. Please let us know about it by submitting an issue: https://github.com/flowershow/flowershow/issues.`
      );
      log(err);
      exit(1);
    }

    // update content and assets symlinks
    const contentSymlinkPath = path.relative(`${flowershowDir}`, contentDir);
    fs.symlinkSync(contentSymlinkPath, `${flowershowDir}/content`);

    if (assetsFolder !== "none") {
      const assetsSymlinkPath = path.relative(
        `${flowershowDir}/public`,
        `${contentDir}/${assetsFolder}`
      );
      fs.symlinkSync(
        assetsSymlinkPath,
        `${flowershowDir}/public/${assetsFolder}`
      );
    }

    // install flowershow dependencies
    logWithSpinner({ symbol: "🌸", msg: `Installing Flowershow dependencies` });
    try {
      const { stdout, stderr } = await execa("npm", ["install"], {
        cwd: flowershowDir,
      });
      log(stdout);
      log(stderr);
      stopSpinner();
      success("Successfuly installed Flowershow!");
    } catch (err) {
      error(`Failed to install Flowershow dependencies: ${err.message}`);
      exit(err.exitCode);
    }
  }
}
