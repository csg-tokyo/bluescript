import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Get Started',
      items: [
        'tutorial/get-started/introduction',
        'tutorial/get-started/setup-environment',
        'tutorial/get-started/create-project-and-run',
        "tutorial/get-started/blink-led",
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'tutorial/guides/inline-c',
        'tutorial/guides/repl',
        'tutorial/guides/interrupts',
        'tutorial/guides/imports-and-includes',
        'tutorial/guides/try-without-microcontroller',
      ],
    },
  ],
  referenceSidebar: [
    {
      type: 'category',
      label: 'Language',
      items: [
        'reference/language/intro',
        'reference/language/primitive-types',
        'reference/language/literals',
        'reference/language/built-in-objects',
        'reference/language/expressions-operators',
        'reference/language/statements-declarations',
        'reference/language/functions',
        'reference/language/classes',
        'reference/language/enum-type',
        'reference/language/nullable-type',
        'reference/language/import-declarations',
        'reference/language/native-code'
      ]
    },
    {
      type: 'category',
      label: 'Libraries',
      items: [
        'reference/libraries/builtin',
        'reference/libraries/standard'
      ]
    },
    'reference/cli',
    'reference/bsconfig',
  ]
};

export default sidebars;
