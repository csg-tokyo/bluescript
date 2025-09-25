import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'tutorial/get-started',
    {
      type: 'category',
      label: 'Examples',
      items: [
        'tutorial/examples/blink-led'
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
        'reference/language/nullable-type',
        'reference/language/import-declarations',
        'reference/language/native-code'
      ]
    },
    {
      type: 'category',
      label: 'Packages',
      items: [
        'reference/packages/gpio'
      ]
    }, 
    {
      type: 'category',
      label: 'CLI',
      items: [
        'reference/cli/install'
      ]
    }
  ]
};

export default sidebars;
