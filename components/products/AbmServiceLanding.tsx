import HtmlContent from "@/components/site/HtmlContent";

import styles from "./AbmServiceLanding.module.css";

export default function AbmServiceLanding({ html }: { html: string }) {
  return (
    <section className={styles.source} aria-label="ABM service content">
      <HtmlContent html={html} mode="abm-service" />
    </section>
  );
}
