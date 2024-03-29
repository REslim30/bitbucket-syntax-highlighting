const _allCodeLinesCssSelector = "[data-qa=code-line] pre > span:last-child";
const _diffFileSelector = "article[data-qa=pr-diff-file-styles]";

// Some extensions map well to Prism languages, others don't. e.g.
// .java -> java, .json -> json
// vs
// .tf -> hcl
const extensionToPrismLanguageMap = new Map([
    ['tf', 'hcl'],

    // Common files
    ['Vagrantfile', 'ruby'],
    ['vue', 'html'],
])

runWhenUrlChanges(() => {
  const url = location.href;
  if (url.match(/https:\/\/bitbucket.org\/.+\/.+\/pull-requests\/.+/)) {
    // "#pull-request-details" is used instead of "section[aria-label="Diffs"]" because the latter
    // is replaced with a new element when the PR is updated (e.g. when a new change is pushed and user refreshes).
    waitForElement('#pull-request-details').then((diffSection) => {
      allDiffsObserver.observe(diffSection, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    });
  }
});

const allDiffsObserver = new MutationObserver((mutations) => {
  mutations
    .forEach((mutation) => {
      // On a regular PR, highlight the diff when it is added to the DOM.
      // This also highlights the diff when moving from an image diff to a code diff in a large PR.
      // When moving from an image diff to a code diff, the "article[data-qa=pr-diff-file-styles]" element is added.
      // (it is removed when moving from a code diff to an image diff)
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0 && mutation.addedNodes[0]?.getAttribute?.('data-qa') === 'pr-diff-file-styles') {
        highlightDiffFile(mutation.addedNodes[0]);
        return;
      }

      // On a large PR, highlight the first diff.
      // The first diff appears when the 'section[aria-label="Diffs"]' element is added.
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0 && mutation.addedNodes[0]?.getAttribute?.('aria-label') === 'Diffs') {
        highlightDiffFile(mutation.addedNodes[0].querySelector(_diffFileSelector));
        return;
      }

      // On a large PR, highlight the diff when moving between diffs
      // When moving between code diffs, the aria-label attribute changes.
      // Mutations are not triggered on added nodes or removed nodes.
      // Probably due to how React updates the dom based on the virtual dom.
      if (mutation.type === 'attributes' && mutation.attributeName === 'aria-label') {
        highlightDiffFile(mutation.target);
        return;
      }
    });
});

function highlightDiffFile(diffFile) {
  // The aria-label attribute contains the file name, with additional text. E.g.
  // aria-label="Diff of file src/main/java/com/example/Example.java"
  // We only want the file extension
  // Remove the "Diff of file " prefix
  const filePath = diffFile
      .getAttribute('aria-label')
      .replace(/^Diff of file /, '')

  const fileName = filePath.split('/').at(-1);
  // Some files don't have an extension, e.g. Makefile, Vagrantfile
  // In this case, we use the file name as the extension.
  const fileExtension = (fileName.includes("."))
      ? fileName.split('.').at(-1)
      : fileName;

// Some extensions map well to Prism languages, others don't. e.g.
// .java -> java, .json -> json
// vs
// .tf -> hcl
  const prismLanguage = extensionToPrismLanguageMap.get(fileExtension) ?? fileExtension;
  diffFile.querySelectorAll(_allCodeLinesCssSelector).forEach((codeLine) => {
    codeLine.classList.add(`bb-syntax-highlighter-${prismLanguage}`);
    Prism.highlightElement(codeLine);
  });
}

function runWhenUrlChanges(callback) {
  let lastUrl = location.url;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      callback();
    }
  }).observe(document, { subtree: true, childList: true });
}
