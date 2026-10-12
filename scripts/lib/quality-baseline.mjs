export function assertQualityBaseline(quality, baseline) {
  for (const field of ["specific_issuer_rate", "specific_relation_rate"]) {
    if (quality[field] < baseline[field]) {
      throw new Error(`${field} ${quality[field]} is below the approved baseline ${baseline[field]}.`);
    }
  }

  if (quality.issuers_generic_only > baseline.issuers_generic_only) {
    throw new Error(`Generic-only issuers ${quality.issuers_generic_only} exceed the approved baseline ${baseline.issuers_generic_only}.`);
  }

  if (quality.sparse_segments.length > baseline.sparse_segments) {
    throw new Error(`Sparse segments ${quality.sparse_segments.length} exceed the approved baseline ${baseline.sparse_segments}.`);
  }
}
