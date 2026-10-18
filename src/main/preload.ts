import { contextBridge, ipcRenderer } from "electron";
import { operations, type Operation } from "../shared/contracts";
contextBridge.exposeInMainWorld(
  "pos",
  Object.freeze({
    call: (operation: Operation, input: unknown = {}) => {
      if (!operations.includes(operation))
        return Promise.resolve({ ok: false, error: "INVALID_OPERATION" });
      return ipcRenderer.invoke("pos:call", operation, input);
    },
  }),
);
