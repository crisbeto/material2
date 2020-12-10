const path = require('path');
const fs = require('fs');
const {sync: glob} = require('glob');

glob('**/*.import.scss', {
  cwd: path.join(__dirname, '../../src'),
  absolute: true
}).forEach(fileName => {
  const content = fs.readFileSync(fileName, 'utf8');
  let newContent = content;

  // Run in reverse to make replacement easier.
  extractForwardStatements(content).reverse().forEach(span => {
    const text = content.substring(...span);
    const file = text.match(/@forward '(.*)'/)[1];

    if (text.includes(' hide ') && !text.includes(' as ')) {
      const newText = `@forward '${file}-internal';`;

      if (newContent.indexOf(newText) > -1) {
        // +1 on the end so the new line gets dropped.
        newContent = replaceText(newContent, span[0], span[1] + 1, '');
      } else {
        newContent = replaceText(newContent, ...span, newText);
      }
    } else {
      let newFile = file;

      if (file.endsWith('.import')) {
        newFile = file.slice(0, '.import'.length * -1);
      } else {
        newFile = file + '-internal';
      }

      newContent = replaceText(newContent, ...span, text.replace(`'${file}'`, `'${newFile}'`));
    }
  });

  if (newContent !== content) {
    fs.unlinkSync(fileName);
    fs.writeFileSync(fileName.replace('.import', ''), newContent);
  }
});


function replaceText(text, from, to, replacement) {
  // Note that this isn't efficient whatsoever, but it's the shortest.
  const parts = text.split('');
  const result = parts.slice(0, from);
  replacement && result.push(replacement);
  result.push(...parts.slice(to));
  return result.join('');
}

function extractForwardStatements(input) {
  const statements = [];
  let i = input.indexOf('@forward');

  while (i > -1 && i < input.length) {
    const end = input.indexOf(';', i);
    const sliceEnd = end === -1 ? input.length : end + 1;
    statements.push([i, sliceEnd]);

    if (end > -1) {
      i = input.indexOf('@forward', end);
    }
  }

  return statements;
}
