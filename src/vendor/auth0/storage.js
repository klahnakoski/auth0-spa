import * as Cookies from 'es-cookie';


export const getAllKeys = () => Object.keys(Cookies.getAll() || {});

export const get = (key) => {
  const value = Cookies.get(key);
  if (typeof value === 'undefined') {
    return;
  }
  return JSON.parse(value);
};
export const save = (
  key,
  value,
  options
) => {
  Cookies.set(key, JSON.stringify(value), {
    expires: options.daysUntilExpire
  });
};
export const remove = (key) => {
  Cookies.remove(key);
};
