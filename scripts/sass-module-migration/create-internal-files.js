const path = require('path');
const fs = require('fs');
const {sync: glob} = require('glob');

// Find all files with `.import` equivalents and rename them to `-internal`.
glob('**/*.import.scss', {
  cwd: path.join(__dirname, '../../src'),
  absolute: true
}).forEach(file => {
  fs.renameSync(
    file.replace('.import.scss', '.scss'),
    file.replace('.import.scss', '-internal.scss')
  );
});
