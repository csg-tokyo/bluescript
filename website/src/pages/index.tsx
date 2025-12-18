import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import FeatureBlocks, {FeatureItem} from '@site/src/components/FeatureBlocks';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="docs/tutorial/get-started/introduction">
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="docs/reference/language/intro">
            Go to Reference
          </Link>
        </div>
      </div>
    </header>
  );
}

const featureItems: FeatureItem[] = [
  {
    title: 'TypeScript-like Syntax',
    description: 'Leverage the skills you already have. If you know TypeScript, you can start programming with BlueScript with almost no learning curve. Enjoy modern features like type safety and a clean syntax to build robust embedded applications effortlessly.',
    imageUrl: 'img/example-blink.png',
  },
  {
    title: 'Native Speed, Tiny Footprint',
    description: 'Performance that matters. BlueScript compiles directly to native code, delivering exceptional performance. This means blazing-fast execution—20x faster than MicroPython on average. With no VM and no unnecessary libraries, your applications stay small and lean, perfect for resource-constrained devices.\n[1] S. Marr, DLS’16',
    imageUrl: 'img/execution-time.png',
  },
  {
    title: 'Untethered Wireless Workflow',
    description: 'BlueScript allows you to update and restart your programs wirelessly over Bluetooth. Stop fumbling with short, cumbersome USB cables. Update code and see your changes instantly from across the room.',
    imageUrl: 'img/wireless-coding.png',
  },
  {
    title: 'Interactive development',
    description: "Don't just write code—interact with it. BlueScript features a unique notebook-style environment where you can modify and debug your program live, as it runs on the device. Tweak variables, test functions, and find bugs faster than ever.",
    imageUrl: 'img/interactive-shell.png',
  },
  {
    title: 'Seamless C Integration',
    description: "Need to get closer to the hardware or optimize a critical section? Easily embed C code directly into your BlueScript program using clean code\`\` template literals. Get the best of both worlds without the hassle.",
    imageUrl: 'img/c-integration.png',
  },
]

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <FeatureBlocks items={featureItems}/>
      </main>
    </Layout>
  );
}
