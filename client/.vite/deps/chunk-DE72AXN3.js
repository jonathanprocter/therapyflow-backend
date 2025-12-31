import {
  require_jsx_runtime
} from "./chunk-DDJ7NZAD.js";
import {
  require_react
} from "./chunk-HBQ5JO3D.js";
import {
  __toESM
} from "./chunk-G3PMV62Z.js";

// ../node_modules/@radix-ui/react-direction/dist/index.mjs
var React = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var DirectionContext = React.createContext(void 0);
function useDirection(localDir) {
  const globalDir = React.useContext(DirectionContext);
  return localDir || globalDir || "ltr";
}

export {
  useDirection
};
//# sourceMappingURL=chunk-DE72AXN3.js.map
