import {
  useActivePlugin,
  useDocsPreferredVersion,
  useDocsVersion,
  useDocVersionSuggestions,
} from '@docusaurus/plugin-content-docs/client';
import Link from '@docusaurus/Link';
import Admonition from '@theme/Admonition';
import CodeBlock from '@theme/CodeBlock';

const STABLE_DOC_VERSION = /^\d+\.\d+\.x$/;
const PRERELEASE_DOC_VERSION = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)\.x$/;

const FROM_SOURCE_INSTALL = `git clone https://github.com/csg-tokyo/bluescript.git
cd bluescript
npm install
npm run build:all
cd cli
npm link`;

/**
 * Map a Docusaurus docs version to an npm install package specifier.
 * - last stable → @bscript/cli (latest)
 * - older stable (e.g. 2.0.x) → @bscript/cli@2.0
 * - prerelease (e.g. 2.1.0-alpha.x) → @bscript/cli@alpha (npm dist-tag)
 */
export function toNpmPackageSpec(
  docVersion: string,
  isLast = false,
): string {
  const prerelease = docVersion.match(PRERELEASE_DOC_VERSION);
  if (prerelease) {
    return `@bscript/cli@${prerelease[1]}`;
  }

  if (isLast && STABLE_DOC_VERSION.test(docVersion)) {
    return '@bscript/cli';
  }

  if (STABLE_DOC_VERSION.test(docVersion)) {
    return `@bscript/cli@${docVersion.replace(/\.x$/, '')}`;
  }

  return '@bscript/cli';
}

function NextVersionNote(): JSX.Element {
  const {pluginId} = useActivePlugin({failfast: true});
  const {savePreferredVersionName} = useDocsPreferredVersion(pluginId);
  const {latestDocSuggestion, latestVersionSuggestion} =
    useDocVersionSuggestions(pluginId);

  const latestDocPath =
    latestDocSuggestion?.path ??
    latestVersionSuggestion.docs.find(
      (doc) => doc.id === latestVersionSuggestion.mainDocId,
    )!.path;

  return (
    <Admonition type="info">
      The <b>Next</b> version is not released yet, so it cannot be installed from
      npm. For the released package, switch to the{' '}
      <Link
        to={latestDocPath}
        onClick={() => savePreferredVersionName(latestVersionSuggestion.name)}>
        latest version ({latestVersionSuggestion.label})
      </Link>
      .
    </Admonition>
  );
}

export default function InstallCli(): JSX.Element {
  const {version, isLast} = useDocsVersion();

  if (version === 'current') {
    return (
      <>
        <CodeBlock language="bash">{FROM_SOURCE_INSTALL}</CodeBlock>
        <NextVersionNote />
      </>
    );
  }

  const pkg = toNpmPackageSpec(version, isLast);
  return <CodeBlock language="bash">{`npm install -g ${pkg}`}</CodeBlock>;
}
