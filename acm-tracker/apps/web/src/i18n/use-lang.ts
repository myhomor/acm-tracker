import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS, type Lang } from "./index";

export function useLang() {
  const { i18n } = useTranslation();
  const lang = (SUPPORTED_LANGS.find((l) => i18n.language?.startsWith(l)) ?? "es") as Lang;
  const setLang = (next: Lang) => {
    i18n.changeLanguage(next);
  };
  return { lang, setLang, langs: SUPPORTED_LANGS };
}
