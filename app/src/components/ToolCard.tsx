/**
 * Açılır araç kartı.
 *
 * Tasarımda gövde React durumunda saklıydı (`sc-if value="{{ t.open }}"`,
 * tasarım kanvası silindi 04-09-2026), yani dokuz aracın `when` ve `note`
 * metni kart açılmadıkça DOM'da YOKTU — sitenin en yoğun bilgi taşıyan bölümü
 * hiç indekslenmiyordu.
 *
 * Native `<details>` ile metin her zaman HTML'de duruyor, JavaScript'siz de
 * açılıp kapanıyor, ve `+`/`–` işareti `details[open]` üzerinden CSS'te
 * üretiliyor. Sonuç: sunucu bileşeni, sıfır istemci JavaScript'i.
 */

export function ToolCard({
  name,
  line,
  when,
  note,
}: {
  name: string;
  line: string;
  when: string;
  note: string;
}) {
  return (
    <details className="tcard">
      <summary className="tcard-s">
        <span className="tcard-sign" aria-hidden="true" />
        <code className="tcard-n">{name}</code>
        <span className="tcard-l">{line}</span>
      </summary>
      <div className="tcard-b">
        <div className="tcard-when">
          <span className="lbl">WHEN IT IS CALLED</span>
          <br />
          {when}
        </div>
        <div className="tcard-note">
          <span className="lbl">DO NOT SKIP THIS</span>
          <br />
          {note}
        </div>
      </div>
    </details>
  );
}
