#!/usr/bin/env node
const { program } = require("commander");
const copy = require("./copy");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs");

const workingDirectory = process.cwd();

function updatePackageJson(destinationPath, projectName, isLibrary) {
  const packageJsonPath = path.join(destinationPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    packageJson.name = !isLibrary ? `@project/${projectName}` : `@chancetop/${projectName}`;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

function main() {
  program
  .argument('<string>', "type of project to generate: nextjs | react-library | library")
  .requiredOption("-n, --name <name>", "The name of the project")
  .option("-d, --destination <destination>", "The destination of the project")

  program.parse();

  const type = program.args[0];
  const options = program.opts();
  const projectName = options.name;
  let sourcePath = "";
  let destinationPath = options.destination;
  if (!destinationPath) {
    switch (type) {
      case "nextjs":
        sourcePath = path.resolve(__dirname, "./templates/nextjs");
        destinationPath = path.resolve(workingDirectory, "./apps/" + projectName);
        break;
      case "react-library":
        sourcePath = path.resolve(__dirname, "./templates/react-library");
        destinationPath = path.resolve(workingDirectory, "./packages/" + projectName);
        break;
      case "library":
        sourcePath = path.resolve(__dirname, "./templates/library");
        destinationPath = path.resolve(workingDirectory, "./packages/" + projectName);
        break;
    }
  }

  copy(sourcePath, destinationPath);
  updatePackageJson(destinationPath, projectName, ["react-library", "library"].includes(type));
  runInstall();
  runPrettier(destinationPath);
}

function runInstall(){
  child_process.spawn("pnpm", ["install"], {
    stdio: "inherit",
  });
}

function runPrettier(destination) {
  console.log(destination);
  
  child_process.spawn("pnpm", ["format"], {
    stdio: "inherit",
  });
}

main();
