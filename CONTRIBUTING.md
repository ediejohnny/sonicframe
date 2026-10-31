# Contributing to SonicFrame.js

Thank you for helping. Bugs, ideas and questions go in
[the issues](https://github.com/ediejohnny/sonicframe/issues); changes come as pull requests.

## Getting ready

1. Install [Node.js](https://nodejs.org/) 22.18 or newer, then clone the repository and run `npm install`.
2. `npm run dev` serves `/playground/`, the docs site with every example live.
3. `npm test` runs the tests. Before a pull request, run the whole check (format, lint, types, tests, the package and
   its size) with `powershell -File scripts/check.ps1`; without PowerShell, run `npm run lint`,
   `npm run types:check`, `npm test` and `npm run build`.

A change keeps the public API working, comes with a test that fails without it, and keeps every new behavior off
until the app turns it on.

## Adding a language

SonicFrame speaks English (`en`, the default), Portuguese as spoken in Brazil (`pt`) and in Portugal (`pt-PT`),
Spanish (`es`) and French (`fr`). A new language is one file and one line, and anyone can send it.

1. **Pick its tag.** Use the [BCP 47](https://www.rfc-editor.org/info/bcp47) tag of the language, not of a
   country: Japanese is `ja` (`jp` is the code of Japan), German is `de`, Brazilian Portuguese is plain `pt`. Add a
   region only for a variant that differs from the plain language, as `pt-PT` does.
2. **Copy English.** Copy `src/core/languages/en.ts` to a file named after the tag in lowercase (`ja.ts`,
   `pt-pt.ts`), rename the constant (`JA`), say in the first comment which language it is, and translate every
   phrase.
    - Keep every `{name}` mark of a phrase (`{time}`, `{count}`…): SonicFrame fills them in. Move them where your
      language puts them.
    - Keep the meaning short and plain: most phrases are names and values a screen reader says.
    - Numbers and units in the wave in words ("33 seconds") come from the browser in your language; you do not write
      them.
    - A regional variant builds on its language and holds only what it says otherwise, as `pt-pt.ts` builds on
      `pt.ts`.
3. **Register it.** Add the tag to the `Language` type and one line to the `LANGUAGES` table in
   `src/core/languages/language.ts`.
4. **Test it.** `npm test` checks every language by itself: the folder's files are all registered, and each one has
   every phrase of English, nothing more, with the same marks. Then try it in the docs site with a player whose
   `a11y.lang` is your tag.
5. **Send the pull request.** Say which language it is and whether you speak it. The maintainer reviews the code;
   the words are reviewed by another speaker of the language whenever one is around, so a friend's read before you
   send it helps.

An app can also bring a language without waiting for a release: `registerLanguage('ja', words)` takes a whole
language at run time, checked the same way (`languageProblems(words)` says what is missing). See
[Languages](https://ediejohnny.github.io/sonicframe/languages.html).

## License

By contributing, you agree that your work is released under the [MIT License](LICENSE).
