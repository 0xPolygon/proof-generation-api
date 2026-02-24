// This exists as a js file because .lintstagedrc w/ large #s of impacted files fails, but lintstagedrc.js works :)

export default {
  '*.{ts,cts,mts,tsx,js,cjs,mjs}': (files) => {
    // const filteredFiles = files.filter((file) => !file.includes('exampleStr'));
    return files.length > 0
      ? [`prettier --write ${files.join(' ')}`, `eslint --fix ${files.join(' ')}`]
      : [];
  },
  '*.{json,md}': (files) => {
    // const filteredFiles = files.filter((file) => !file.includes('exampleStr'));
    return files.length > 0 ? `prettier --write ${files.join(' ')}` : [];
  }
};
