import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.dbroesch.github-prs.sdPlugin";

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
        if (isWatching) {
          this.addWatchFile(`${sdPlugin}/manifest.json`);
        }
      },
    },
    typescript({ mapRoot: isWatching ? "./" : undefined }),
    nodeResolve({ browser: false, exportConditions: ["node"] }),
    commonjs(),
    isWatching
      ? {
          name: "streamdeck-reloader",
          generateBundle() {
            this.emitFile({
              type: "asset",
              fileName: "reloader.js",
              source: "",
            });
          },
        }
      : undefined,
  ].filter(Boolean),
};
