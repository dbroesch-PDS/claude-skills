# Build Setup Reference

## package.json

```json
{
  "name": "com.author.pluginname",
  "version": "1.0.0",
  "description": "My Stream Deck plugin",
  "private": true,
  "scripts": {
    "build": "rollup -c --bundleConfigAsCjs",
    "watch": "rollup -c --bundleConfigAsCjs -w"
  },
  "dependencies": {
    "@elgato/streamdeck": "^0.6.0"
  },
  "devDependencies": {
    "@rollup/plugin-commonjs": "^25.0.7",
    "@rollup/plugin-node-resolve": "^15.2.3",
    "@rollup/plugin-typescript": "^11.1.6",
    "rollup": "^4.13.0",
    "tslib": "^2.6.2",
    "typescript": "^5.4.2"
  }
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "noUnusedLocals": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "target": "ES2022"
  },
  "include": ["src/**/*"]
}
```

## rollup.config.mjs

Replace `com.author.pluginname` with your actual plugin UUID folder name.

```javascript
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.author.pluginname.sdPlugin";

export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    format: "cjs",
    sourcemap: isWatching,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
      return url.pathToFileURL(
        path.resolve(path.dirname(sourcemapPath), relativeSourcePath)
      ).href;
    },
  },
  plugins: [
    {
      name: "watch-externals",
      buildStart() {
        if (isWatching) this.addWatchFile(`${sdPlugin}/manifest.json`);
      },
    },
    typescript({ mapRoot: isWatching ? "./" : undefined }),
    nodeResolve({ browser: false, exportConditions: ["node"] }),
    commonjs(),
  ],
};
```

## Notes

- The output goes to `<uuid>.sdPlugin/bin/plugin.js` — this is what `manifest.json` references via `"CodePath": "bin/plugin.js"`
- `npm run watch` enables hot reload — Stream Deck re-launches the plugin when the file changes
- Node.js built-ins (`crypto`, `http`, `child_process`, `fs`) are available — no polyfills needed
- `fetch` is available natively in Node 18+
- Use `.js` extensions in imports even for `.ts` source files (TypeScript module resolution requirement)
