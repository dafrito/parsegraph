const counts: { [key: string]: number } = {};

/**
 * @param {string} prefix the optional prefix to use on the ID, defaults to 'parsegraph-unique'
 *
 * @return {string} a new, unique, string ID
 */
export default function generateID(prefix?: string): string {
  if (!prefix) {
    prefix = "parsegraph-unique";
  }
  if (!(prefix in counts)) {
    counts[prefix] = 0;
  }
  return prefix + "-" + ++counts[prefix];
}
