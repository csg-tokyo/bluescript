import clsx from 'clsx';
import styles from './styles.module.css';
import Link from '@docusaurus/Link';

export type FeatureItem = {
  title: string,
  description: string,
  link?: string,
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
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.title}
              className={styles.featureItemImage}
            />
          )}
          <div className={styles.featureItemTextContent}>
            <h1>{item.title}</h1>
            <p>{item.description}</p>
            {/* {item.link && (
              <Link className="button button--secondary margin-top--md" to={item.link}>
                Learn More
              </Link>
            )} */}
          </div>
        </div>
      ))}
    </section>
  );
}