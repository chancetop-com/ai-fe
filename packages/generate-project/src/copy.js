const fs = require("fs");
const path = require("path");

function copy(sourcePath, destinationPath) {
  if (fs.existsSync(destinationPath)) {
    throw new Error(`Destination path ${destinationPath} is existed.`);
  }
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(sourcePath);
    for (const file of files) {
      const sourceFile = path.join(sourcePath, file);
      const destFile = path.join(destinationPath, file);
      copy(sourceFile, destFile);
    }
  } else if (stat.isFile()) {
    // 确保目标目录存在
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

module.exports = copy;
