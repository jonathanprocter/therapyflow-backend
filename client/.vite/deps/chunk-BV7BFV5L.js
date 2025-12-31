import {
  require_react
} from "./chunk-HBQ5JO3D.js";
import {
  __toESM
} from "./chunk-G3PMV62Z.js";

// ../node_modules/@radix-ui/primitive/dist/index.mjs
function composeEventHandlers(originalEventHandler, ourEventHandler, { checkForDefaultPrevented = true } = {}) {
  return function handleEvent(event) {
    originalEventHandler?.(event);
    if (checkForDefaultPrevented === false || !event.defaultPrevented) {
      return ourEventHandler?.(event);
    }
  };
}

// ../node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs
var React = __toESM(require_react(), 1);
function useCallbackRef(callback) {
  const callbackRef = React.useRef(callback);
  React.useEffect(() => {
    callbackRef.current = callback;
  });
  return React.useMemo(() => (...args) => callbackRef.current?.(...args), []);
}

// ../node_modules/@radix-ui/react-use-layout-effect/dist/index.mjs
var React2 = __toESM(require_react(), 1);
var useLayoutEffect2 = globalThis?.document ? React2.useLayoutEffect : () => {
};

export {
  composeEventHandlers,
  useCallbackRef,
  useLayoutEffect2
};
//# sourceMappingURL=chunk-BV7BFV5L.js.map
