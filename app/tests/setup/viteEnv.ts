import { registerHooks } from "node:module";

const TEST_ENV = JSON.stringify({
  VITE_API_URL: "http://localhost:8000/api",
  MODE: "test",
  DEV: false,
  PROD: false,
});

registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!url.includes("/src/") || result.source == null) {
      return result;
    }
    const source = String(result.source);
    if (!source.includes("import.meta.env")) {
      return result;
    }
    return { ...result, source: source.replaceAll("import.meta.env", `(${TEST_ENV})`) };
  },
});
