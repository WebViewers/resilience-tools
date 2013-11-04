# Resilience Tools

Node.js tool for building WebViewers.
This is a simple tool is designed to package directories into .zip files.
It can optionally post those zip files to an XWiki instance for rapid
prototyping and it can instead of a .zip, generate a Maven build which
will output a .zip.

To use:

* Create a directory called `/src` this is where all of your webviewer
files will be placed, `package.json` will be in the root of your webviewer
directory, **not** in `/src`.

* Add this to your `package.json`:

        "dependencies": {
            "resilience-tools": "~0.3.2"
        },

* add a file called `./do` containing the following:

        #!/usr/bin/env node
        require('resilience-tools').commandLine();

* In your readme, instruct users to first type `npm install` and then `./do`
in order to "compile" your webviewer.

See https://github.com/WebViewers/textedit-webviewer for an example.
