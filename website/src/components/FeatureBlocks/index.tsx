import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export type FeatureItem = {
  title: string,
  description: string,
  imageUrl: string,
};

function FeatureBlockItem({item}: {item: FeatureItem}) {
  const imageSrc = useBaseUrl(item.imageUrl);

  return (
    <div className={clsx(styles.featureItem)}>
      <img
        src={imageSrc}
        alt={item.title}
        className={styles.featureItemImage}
      />
      <div className={styles.featureItemTextContent}>
        <h1>{item.title}</h1>
        <p>{item.description}</p>
      </div>
    </div>
  );
}

export default function FeatureBlocks(props: {items: FeatureItem[]}) {
  return (
    <section className={styles.featureContainer}>
      {props.items.map((item, idx) => (
        <FeatureBlockItem key={idx} item={item} />
      ))}
    </section>
  );
}