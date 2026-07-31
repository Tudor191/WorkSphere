/**
 * Token-ul contului de developer/platformă trăiește STRICT în memorie,
 * într-un modul separat de `tokenStore` (auth-ul obișnuit de companie) —
 * cele două sesiuni nu trebuie să se poată amesteca sau suprascrie una pe
 * cealaltă. Nu există refresh token/cookie pentru acest cont: la reîncărcarea
 * paginii, developerul se reautentifică (simplu, acceptabil pentru un panou
 * folosit rar).
 */
let platformAccessToken: string | null = null;

export const platformTokenStore = {
  get: () => platformAccessToken,
  set: (token: string | null) => {
    platformAccessToken = token;
  },
};
