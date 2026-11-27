# PDF.js browser renderer

Browser-only files from the official npm package `pdfjs-dist@6.5.438`, published by Mozilla. Package integrity: `sha512-vg8Pw1x+AFKy4AMDvhuWl5cOYV8d698UoEANoFFhc79hqXDnZQqnOXoxw3HG907WHOg1JYOvLhP756boddFxpA==`.

The legacy browser build is used for the packaged Chromium version. Browser data files are in `src/renderer/public/pdfjs`, including the upstream license. No Node canvas/native addon dependencies are installed or shipped. The PDF scripting sandbox is not included or used; PDF documents are rendered as static canvas images.

To update, obtain the official npm tarball with `npm pack pdfjs-dist@VERSION --ignore-scripts`, verify its published integrity, copy `legacy/build/pdf.mjs`, `legacy/build/pdf.worker.min.mjs` (renamed `pdf.worker.mjs`), `cmaps`, `standard_fonts`, `wasm`, and LICENSE, and rerun the document import tests and packaged smoke test.
