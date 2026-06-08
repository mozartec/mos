export function toPosixPath(path) {
  return path.replaceAll('\\', '/');
}

export function globToRegExp(glob) {
  const pattern = toPosixPath(glob);
  let re = '^';

  // Supported glob tokens:
  // - `**/` => zero or more path segments
  // - `**`  => any sequence (including `/`)
  // - `*`   => any sequence except `/`
  // - `?`   => exactly one character
  for (let i = 0; i < pattern.length; ) {
    const ch = pattern[i];

    if (ch === '*') {
      const next = pattern[i + 1];
      const charAfterNext = i + 2 < pattern.length ? pattern[i + 2] : '';
      if (next === '*' && charAfterNext === '/') {
        re += '(?:[^/]+/)*';
        i += 3;
        continue;
      }
      if (next === '*') {
        re += '.*';
        i += 2;
        continue;
      }
      re += '[^/]*';
      i += 1;
      continue;
    }

    if (ch === '?') {
      re += '.';
      i += 1;
      continue;
    }

    re += escapeRegExpChar(ch);
    i += 1;
  }

  re += '$';
  return new RegExp(re);
}

function escapeRegExpChar(ch) {
  return /[-\\^$.*+?()[\]{}|]/.test(ch) ? `\\${ch}` : ch;
}
