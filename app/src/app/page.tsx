"use client";

// Adım 0.2 ölçümü: Next, @codecraft/core/browser'ı derleyebiliyor mu.
// Ölçülen şey ham .ts uzantılı göreli import'ların paketleyiciden geçmesi.
import * as core from "@codecraft/core/browser";

const { checkFeasibility, buildSystemPrompt } = core;

export default function Page() {
  const blocked = checkFeasibility("Fareme basılı tutmuş gibi otomatik kazsın");
  const promptLength = buildSystemPrompt({
    version: "1.26.40.5",
    minEngineVersion: [1, 26, 40],
    engineVersion: "1.26.40",
    modules: {},
    documentTypes: [],
    patterns: [],
    formatVersions: {},
    identities: [],
  }).length;

  // Barrel'in tamami paketlenmeli: agac budamasi generate/callModel/normalize'i
  // atarsa olcum bir sey kanitlamaz.
  const surface = Object.keys(core).sort().join(", ");

  return (
    <main>
      <p>tarayici yuzeyi: {surface}</p>
      <p>yapılabilirlik: {blocked.blocked ? blocked.category : "engel yok"}</p>
      <p>sistem prompt uzunluğu: {promptLength}</p>
    </main>
  );
}
