function getSemanticVersion(row, fallback = "unknown") {
  if (!row || typeof row !== "object") {
    return fallback;
  }

  const semanticVersion =
    typeof row.semantic_version === "string" && row.semantic_version.trim().length > 0
      ? row.semantic_version.trim()
      : null;
  if (semanticVersion) {
    return semanticVersion;
  }

  const semanticsVersion =
    typeof row.semantics_version === "string" && row.semantics_version.trim().length > 0
      ? row.semantics_version.trim()
      : null;
  if (semanticsVersion) {
    return semanticsVersion;
  }

  return fallback;
}

module.exports = {
  getSemanticVersion
};
