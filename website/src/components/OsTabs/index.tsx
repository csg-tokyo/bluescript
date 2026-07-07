import {useState} from 'react';
import useIsomorphicLayoutEffect from '@docusaurus/useIsomorphicLayoutEffect';
import Tabs from '@theme/Tabs';
import type {Props as TabsProps} from '@theme/Tabs';

const GROUP_ID = 'os';
const STORAGE_KEY = `docusaurus.tab.${GROUP_ID}`;

export type OsTabValue = 'macos' | 'windows';

export function detectOsTabValue(): OsTabValue {
  if (typeof navigator === 'undefined') {
    return 'macos';
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'macos' || stored === 'windows') {
      return stored;
    }
  } catch {
    // ignore
  }

  const ua = navigator.userAgent;
  if (/Win/i.test(ua)) {
    return 'windows';
  }
  if (/Mac/i.test(ua)) {
    return 'macos';
  }

  return 'macos';
}

type OsTabsProps = Omit<TabsProps, 'groupId' | 'defaultValue'>;

export default function OsTabs({children, ...props}: OsTabsProps) {
  const [defaultValue, setDefaultValue] = useState<OsTabValue | null>(null);

  useIsomorphicLayoutEffect(() => {
    setDefaultValue(detectOsTabValue());
  }, []);

  if (defaultValue === null) {
    return <div aria-hidden="true" />;
  }

  return (
    <Tabs groupId={GROUP_ID} defaultValue={defaultValue} {...props}>
      {children}
    </Tabs>
  );
}
