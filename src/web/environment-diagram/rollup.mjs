// What a web plugin's rollup build needs in order to inline the environment-diagram library, which
// is TypeScript source in this package. A plugin lists the result in `plugins`, before the
// TypeScript plugin, and has a matching `paths` entry in its tsconfig (see the README).
import { fileURLToPath } from "node:url";

/** The id of the module that stands for every `konva/lib/...` import. */
const KONVA_SUBPATHS = "\0konva-subpaths-from-host";
/** What the library imports from those subpaths at run time. */
const KONVA_CLASSES = [
  "Easings",
  "Group",
  "Label",
  "Layer",
  "Node",
  "Rect",
  "Shape",
  "Stage",
  "Text",
];

export function environmentDiagram() {
  return [
    {
      // Yarn resolves a workspace dependency through a virtual path that the TypeScript plugin does not
      // transform, so the library is resolved to its real path here, as a relative import would be.
      name: "environment-diagram-source",
      resolveId(source) {
        return source === "@sourceacademy/web-environment-diagram"
          ? fileURLToPath(new URL("./src/index.ts", import.meta.url))
          : null;
      },
    },
    {
      // The library imports Konva's classes from subpaths (`konva/lib/Group`, ...). Bundled, they would
      // be a second copy next to the host's (the one react-konva draws with), and `instanceof Group`
      // would fail for the nodes that react-konva makes. So every subpath is the host's own Konva:
      // the classes are taken from the external `konva` object.
      name: "konva-subpaths-from-host",
      resolveId(source) {
        return source.startsWith("konva/lib/") ? KONVA_SUBPATHS : null;
      },
      load(id) {
        return id === KONVA_SUBPATHS
          ? `import Konva from "konva"; export const { ${KONVA_CLASSES.join(", ")} } = Konva;`
          : null;
      },
    },
  ];
}
