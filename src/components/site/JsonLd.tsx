/** Structured data for search engines and AI answer engines (schema.org JSON-LD). */
export function JsonLd({ data }: { data: object }) {
  // Escape "<" so text can never close the script tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
