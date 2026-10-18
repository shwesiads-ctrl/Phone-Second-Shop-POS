// Filesystem access is native and restricted to the app's own database.
export function mkdirSync() {
  throw new Error("FILESYSTEM_UNAVAILABLE");
}
export function dirname(path: string) {
  return path.slice(0, path.lastIndexOf("/"));
}
