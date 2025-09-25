import clsx from 'clsx';
import styles from './styles.module.css';

export type FeatureItem = {
  title: string,
  description: string,
  imageUrl: string,
};

export default function FeatureBlocks(props: {items: FeatureItem[]}) {
  return (
    <section className={styles.featureContainer}>
      {props.items.map((item, idx) => (
        <div
          key={idx}
          className={clsx(styles.featureItem)}
        >
          <img
            src={item.imageUrl}
            alt={item.title}
            className={styles.featureItemImage}
          />
          <div className={styles.featureItemTextContent}>
            <h1>{item.title}</h1>
            <p>{item.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}