export const getParent = (path: string): string =>
  path.slice(0, path.lastIndexOf("/")) || "/";

export const joinPath = (parent: string, name: string): string =>
  parent === "/" ? `/${name}` : `${parent}/${name}`;

export const isWithin = (path: string, parent: string): boolean =>
  path === parent || path.startsWith(`${parent}/`);

