
export function nameCheckerFactory (name: string) {
  const re = new RegExp(name, 'i');
  return (item: string) => re.test(item);
}
