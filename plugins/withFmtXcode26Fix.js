const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# PsychotechniPlus Xcode 26 fmt consteval fix';

const PATCH = `
    ${MARKER}
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/^\\s*#\\s*define\\s+FMT_USE_CONSTEVAL\\s+1\\s*$/, '# define FMT_USE_CONSTEVAL 0')
      if patched != content
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
      end
    end
`;

function addFmtPatchToPodfile(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const postInstallMatch = contents.match(/post_install do \|installer\|/);
  if (postInstallMatch) {
    const insertAt = postInstallMatch.index + postInstallMatch[0].length;
    return `${contents.slice(0, insertAt)}${PATCH}${contents.slice(insertAt)}`;
  }

  return `${contents}

post_install do |installer|
${PATCH}
end
`;
}

module.exports = function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfile)) {
        const current = fs.readFileSync(podfile, 'utf8');
        const next = addFmtPatchToPodfile(current);
        if (next !== current) {
          fs.writeFileSync(podfile, next);
        }
      }
      return config;
    },
  ]);
};
