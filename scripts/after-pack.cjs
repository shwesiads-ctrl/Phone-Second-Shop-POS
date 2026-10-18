const fs = require("node:fs");
const path = require("node:path");
// A precise uninstall manifest prevents recursive deletion of user-added files.
module.exports = async (context) => {
  if (context.electronPlatformName !== "win32") return;
  const files = [],
    directories = [];
  function visit(directory, relative = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Unexpected symlink in Windows package");
      if (entry.isDirectory()) {
        visit(path.join(directory, entry.name), child);
        directories.push(child);
      } else if (entry.isFile()) files.push(child);
    }
  }
  visit(context.appOutDir);
  const quote = (value) =>
    value
      .replaceAll("$", "$$")
      .replaceAll('"', '$\\"')
      .replaceAll(path.sep, "\\");
  const lines = [
    "; Generated from the actual packaged application. Do not edit.",
  ];
  for (const file of files.sort())
    lines.push(`Delete "$INSTDIR\\${quote(file)}"`);
  for (const directory of directories.sort(
    (a, b) => b.split(path.sep).length - a.split(path.sep).length,
  ))
    lines.push(`RMDir "$INSTDIR\\${quote(directory)}"`);
  fs.writeFileSync(
    path.join(context.packager.projectDir, "build", "uninstall-files.nsh"),
    lines.join("\n") + "\n",
  );
};
