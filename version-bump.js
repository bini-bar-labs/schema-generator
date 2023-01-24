const package = require("./package.json");
const { Command } = require("commander");
const { writeFileSync } = require("fs");
const path = require("path");
const program = new Command();
const prettier = require("prettier");



program.argument("type", "patch | minor | major").action((type) => {
  const [major, minor, patch] = package.version.split(".").map(x => parseInt(x, 10));
  const newVersion = (() => {
    switch (type) {
      case "patch": {
        return `${major}.${minor}.${patch + 1}`;
      };
      case "minor": {
        return `${major}.${minor+1}.0`;
      };
      case "major": {
        return `${major + 1}.0.0`;
      }
    }
  })();
  const newPackageContent = {
    ...package,
    version: newVersion
  };
  writeFileSync(path.resolve(__dirname, "package.json"), prettier.format(JSON.stringify(newPackageContent), {parser: "json-stringify"}));
}).parse();