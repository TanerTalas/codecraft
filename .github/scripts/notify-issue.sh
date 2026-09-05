#!/usr/bin/env bash
#
# Tekilleştirilmiş issue bildirimi. Başlık argüman, gövde stdin.
#
#   printf '%s\n' "olan biten" | .github/scripts/notify-issue.sh "Başlık"
#
# Aynı başlıklı AÇIK bir issue varsa oraya yorum ekler, yoksa yeni issue açar.
# Aynı arıza her gün yeni issue açmasın diye; kapatılmış bir issue yeniden
# açılmaz, yenisi açılır — kapatmak "gördüm, bitti" demek.
#
# NEDEN AYRI DOSYA: bu mantık data.yml içinde tek kopya olarak duruyordu ve
# üç bildirim yolu olunca üç kez kopyalanacaktı.
#
# TASARIM KURALI: bu script'in kendisi patlarsa HİÇ haber gelmez ve bu sessiz
# bir arızadır. O yüzden zorunlu olmayan her adım (atama gibi) hataya
# dayanıklı: issue'nun var olması, süslenmesinden önemli.
set -euo pipefail

title="${1:?kullanım: notify-issue.sh \"Başlık\" < gövde}"
body="$(cat)"

# jq --arg ile: başlıkta tırnak geçerse gh'nin --jq ifadesi bozulurdu.
number=$(gh issue list --state open --limit 100 --json number,title \
  | jq -r --arg t "$title" '[.[] | select(.title == $t) | .number] | first // empty')

if [ -n "$number" ]; then
  gh issue comment "$number" --body "$body"
  echo "issue #$number güncellendi: $title"
  exit 0
fi

url=$(gh issue create --title "$title" --body "$body")
echo "issue açıldı: $url"

# Atama AYRI ve hataya dayanıklı: depo sahibinin issue e-postası alıp almadığı
# watch ayarına bağlı ve dışarıdan görülemiyor, atama onu ayardan bağımsız
# garantiye alıyor. Ama atanamıyorsa (izin, kullanıcı adı) issue yine de
# açılmış olmalı — bu yüzden create'in bayrağı değil, sonrasında ayrı adım.
if [ -n "${ISSUE_ASSIGNEE:-}" ]; then
  gh issue edit "$url" --add-assignee "$ISSUE_ASSIGNEE" \
    || echo "uyarı: '$ISSUE_ASSIGNEE' atanamadı, issue açık kaldı"
fi
