export function snakeToPascal(str: string) {
  const camelCase = str.toLowerCase().replace(/([-_][a-z])/g, (group) =>
    group
      .toUpperCase()
      .replace("-", "")
      .replace("_", "")
  );

  return camelCase[0].toUpperCase() + camelCase.slice(1);
}

export function snakeToCamel(str: string) {
  return str.toLowerCase().replace(/([-_][a-z])/g, (group) =>
    group
      .toUpperCase()
      .replace("-", "")
      .replace("_", "")
  );
}
