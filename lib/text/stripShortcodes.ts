// lib/text/stripShortcodes.ts
export function stripShortcodes(input: unknown): string {
  const s = typeof input === "string" ? input : "";
  if (!s) return "";

  return (
    s
      // Divi 계열: [et_pb_...], [/et_pb_...]
      .replace(/\[\/?et_pb[^\]]*\]/gi, " ")
      // 혹시 남아있는 다른 shortcode도 같이 제거하고 싶으면(선택):
      // .replace(/\[\/?[a-z0-9_:-]+[^\]]*\]/gi, " ")

      // html 태그가 섞여있으면 제거(선택)
      .replace(/<\/?[^>]+>/g, " ")

      // 공백 정리
      .replace(/\s+/g, " ")
      .trim()
  );
}
