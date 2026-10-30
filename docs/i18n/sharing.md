# X共有・共有メタデータ

実装は [src/ranking/config.ts](../../src/ranking/config.ts)、画面への反映は [src/ui/screens.ts](../../src/ui/screens.ts)。選択言語で本文・ボタンラベル・ハッシュタグを更新し、URL・スコア・クリア判定・正式番号の根拠を維持する。

## URLと符号化

intentの送信先は `https://twitter.com/intent/tweet`。`new URLSearchParams({ text })` を使い、必要な場合だけ `url` パラメーターを追加する。日本語・中国語・タイ語・アクセント文字・改行・`#` をこのAPIで符号化する。文字列をURLへ直接連結したり、二重に `encodeURIComponent` を適用したりしない。

canonicalは全言語共通の `https://chameleonjp-lab.github.io/takkeu/`。ホーム共有では本文を `text`、canonicalを別の `url` パラメーターへ入れる。結果共有ではcanonicalを本文の末尾に入れ、別の `url` は付けない。これにより重複URLを避ける。外部ランキングURLや一時object URLをXのゲームURLに使わない。

ハッシュタグは日本語の `#タッケウ`、それ以外の14言語は `#TAKKEU`。ブランドを示す識別子なので、各言語の別のタグへ意訳しない。

## 有効性と正式番号

| 入口・状態 | 生成する共有 |
| --- | --- |
| ホーム、端末自己ベストが有効な整数かつ1以上 | 自己ベスト本文＋canonical |
| ホーム、未設定・0・負数・小数・NaN・Infinity等 | 一般紹介本文＋canonical |
| 結果、有限・整数・0以上の確定スコア | 通常結果本文。0や旧ルールの高スコアも共有可能 |
| 結果、負数・小数・非数・無限値 | `null`。リンクのhrefを外し、`aria-disabled=true` |
| `cleared=true` かつスコアが3500以外 | `null`。不正なクリア文を生成しない |
| 正しい3500クリア、正式番号未確認 | クリア本文。番号の行は省略 |
| 正しい3500クリア、サーバーの正式登録が確認済み | クリア本文に正式番号の行を追加 |
| 通常結果に番号だけ渡す | 番号を表示しない。クリアへ昇格させない |

`scoreShareUrl` の番号引数は正の安全な整数（`Number.isSafeInteger`）だけを認める。画面は現在の結果の `ResultHallState.status === 'registered'` のときだけその正式番号を渡す。確認中・失敗・対象外・匿名の状態から、仮番号や推測した番号を発行しない。同名での再クリアはサーバーが返す同じ番号を使う。旧ルールの高スコアから新しい殿堂番号を作らない。

翻訳変更でランキング送信や殿堂登録を再実行しない。スコア・クリア状態・正式番号・言語を共有リンクの更新キーに含め、最新の状態から本文だけを再生成する。ランキングへの送信上限と、過去のスコアも共有できる条件は別の既存仕様として保持する。

## 15言語の本文テンプレート

`{score}` はその入口の有効なスコア、`{tag}` は上記タグ、`{url}` はcanonical。`{ordinal}` は「改行＋同言語の正式番号文」または空文字で、空のときに番号用の空行を追加しない。実際の共有ではすべて補間し、波括弧を残さない。`\n` は改行を表す。

### ja — 日本語

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `タップ＆ドラッグで遊べる卓球ゲーム「タッケウ」！\n何ラリーつなげられる？ {tag}` |
| ホーム・自己ベスト | `卓球ゲーム「タッケウ」で自己ベスト{score}ラリー！\n何ラリーつなげられる？ {tag}` |
| 通常結果 | `タッケウで{score}ラリー達成！\nあなたは何ラリーできるかな？\n{tag}\n{url}` |
| 3500クリア | `タッケウ3500ラリー、ゲームクリア！{ordinal}\n3500ラリーの殿堂入りに挑戦しよう！\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `殿堂登録 第{number}号` |
| タグ | `#タッケウ` |

### en — English

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU: a table tennis game you play by tapping and dragging!\nHow long can you keep the rally going? {tag}` |
| ホーム・自己ベスト | `My best in the table tennis game TAKKEU is {score} rallies!\nHow long can you keep it going? {tag}` |
| 通常結果 | `I reached {score} rallies in TAKKEU!\nHow many can you get?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU: 3500 rallies, game cleared!{ordinal}\nTake on the 3500-rally Hall of Fame challenge!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Hall of Fame No. {number}` |
| タグ | `#TAKKEU` |

### es — Español

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `¡TAKKEU, el juego de tenis de mesa que se juega tocando y arrastrando!\n¿Cuántas devoluciones puedes encadenar? {tag}` |
| ホーム・自己ベスト | `¡Mi récord en el juego de tenis de mesa TAKKEU es de {score} devoluciones!\n¿Cuántas puedes encadenar? {tag}` |
| 通常結果 | `¡He conseguido {score} devoluciones en TAKKEU!\n¿Cuántas puedes conseguir tú?\n{tag}\n{url}` |
| 3500クリア | `¡TAKKEU: 3500 devoluciones, juego completado!{ordinal}\n¡Acepta el reto del Salón de la Fama de las 3500 devoluciones!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Salón de la Fama n.º {number}` |
| タグ | `#TAKKEU` |

### pt-BR — Português (Brasil)

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU: o jogo de tênis de mesa que você joga tocando e arrastando!\nQuantas rebatidas consegue emendar? {tag}` |
| ホーム・自己ベスト | `Meu recorde no jogo de tênis de mesa TAKKEU é de {score} rebatidas!\nQuantas você consegue emendar? {tag}` |
| 通常結果 | `Alcancei {score} rebatidas no TAKKEU!\nQuantas você consegue?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU: 3500 rebatidas, jogo vencido!{ordinal}\nEncare o desafio das 3500 rebatidas e entre no Hall da Fama!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Hall da Fama nº {number}` |
| タグ | `#TAKKEU` |

### zh-Hans — 简体中文

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `点击加拖动，就能玩乒乓球游戏TAKKEU！\n你能连续回球多少次？ {tag}` |
| ホーム・自己ベスト | `我在乒乓球游戏TAKKEU中创下个人最佳：{score}次回球！\n你能连续回球多少次？ {tag}` |
| 通常結果 | `我在TAKKEU达成了{score}次回球！\n你能回球多少次？\n{tag}\n{url}` |
| 3500クリア | `TAKKEU达成3500次回球，通关！{ordinal}\n来挑战3500次回球，入选名人堂吧！\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `名人堂编号 第{number}号` |
| タグ | `#TAKKEU` |

### fr — Français

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU, le jeu de tennis de table où il suffit de toucher et de glisser !\nCombien de renvois peux-tu enchaîner ? {tag}` |
| ホーム・自己ベスト | `Mon record dans le jeu de tennis de table TAKKEU : {score} renvois !\nCombien peux-tu en enchaîner ? {tag}` |
| 通常結果 | `J’ai atteint {score} renvois dans TAKKEU !\nEt toi, combien peux-tu en faire ?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU : 3500 renvois, partie gagnée !{ordinal}\nRelève le défi des 3500 renvois pour entrer au Panthéon !\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Panthéon nº {number}` |
| タグ | `#TAKKEU` |

### de — Deutsch

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU, das Tischtennisspiel zum Tippen und Ziehen!\nWie viele Ballwechsel schaffst du? {tag}` |
| ホーム・自己ベスト | `Meine Bestleistung im Tischtennisspiel TAKKEU: {score} Ballwechsel!\nWie viele schaffst du? {tag}` |
| 通常結果 | `Ich habe in TAKKEU {score} Ballwechsel geschafft!\nWie viele schaffst du?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU: 3500 Ballwechsel, Spiel geschafft!{ordinal}\nStell dich der Herausforderung und komm in die Ruhmeshalle der 3500 Ballwechsel!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Ruhmeshalle Nr. {number}` |
| タグ | `#TAKKEU` |

### ko — 한국어

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `탭과 드래그로 즐기는 탁구 게임 TAKKEU!\n몇 랠리까지 이어 갈 수 있나요? {tag}` |
| ホーム・自己ベスト | `탁구 게임 TAKKEU에서 개인 최고 {score}랠리!\n몇 랠리까지 이어 갈 수 있나요? {tag}` |
| 通常結果 | `TAKKEU에서 {score}랠리 달성!\n당신은 몇 랠리까지 할 수 있나요?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU 3500랠리, 게임 클리어!{ordinal}\n3500랠리 명예의 전당에 도전하세요!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `명예의 전당 등록 제{number}호` |
| タグ | `#TAKKEU` |

### ru — Русский

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU — настольный теннис с касаниями и перетаскиванием!\nСколько мячей подряд отобьёшь ты? {tag}` |
| ホーム・自己ベスト | `Мой рекорд в настольном теннисе TAKKEU — {score} ударов!\nСколько мячей подряд отобьёшь ты? {tag}` |
| 通常結果 | `В TAKKEU у меня {score} ударов!\nА сколько сможешь ты?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU: 3500 ударов, игра пройдена!{ordinal}\nИспытай себя и попади в Зал славы за 3500 ударов!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Зал славы № {number}` |
| タグ | `#TAKKEU` |

### it — Italiano

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU, il tennis tavolo da giocare con tocchi e trascinamenti!\nQuanti scambi sai fare di fila? {tag}` |
| ホーム・自己ベスト | `Il mio record nel tennis tavolo TAKKEU: {score} scambi!\nQuanti ne sai fare di fila? {tag}` |
| 通常結果 | `Ho raggiunto {score} scambi in TAKKEU!\nTu quanti ne sai fare?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU: 3500 scambi, gioco completato!{ordinal}\nAccetta la sfida ed entra nell'Albo d'onore dei 3500 scambi!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Albo d'onore n. {number}` |
| タグ | `#TAKKEU` |

### zh-Hant — 繁體中文

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `點一下再拖曳，就能玩桌球遊戲TAKKEU！\n你能連續回球多少次？ {tag}` |
| ホーム・自己ベスト | `我在桌球遊戲TAKKEU中創下個人最佳：{score}次回球！\n你能連續回球多少次？ {tag}` |
| 通常結果 | `我在TAKKEU達成了{score}次回球！\n你能回球多少次？\n{tag}\n{url}` |
| 3500クリア | `TAKKEU達成3500次回球，過關！{ordinal}\n來挑戰3500次回球，入選名人堂吧！\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `名人堂編號 第{number}號` |
| タグ | `#TAKKEU` |

### id — Bahasa Indonesia

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU, game tenis meja dengan ketuk dan seret!\nBerapa reli yang bisa Anda sambungkan? {tag}` |
| ホーム・自己ベスト | `Rekor pribadi saya {score} reli di game tenis meja TAKKEU!\nBerapa reli yang bisa Anda sambungkan? {tag}` |
| 通常結果 | `Saya mencapai {score} reli di TAKKEU!\nBerapa reli yang bisa Anda sambungkan?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU 3500 reli, permainan tuntas!{ordinal}\nTantang diri masuk Galeri Kehormatan 3500 reli!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Galeri Kehormatan No. {number}` |
| タグ | `#TAKKEU` |

### tr — Türkçe

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `Dokunup sürükleyerek oynanan masa tenisi oyunu TAKKEU!\nSen kaç ralli sürdürebilirsin? {tag}` |
| ホーム・自己ベスト | `Masa tenisi oyunu TAKKEU'da kişisel rekorum {score} ralli!\nSen kaç ralli sürdürebilirsin? {tag}` |
| 通常結果 | `TAKKEU'da {score} ralli yaptım!\nSen kaç ralli yapabilirsin?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU'da 3500 ralli, oyun tamamlandı!{ordinal}\n3500 ralli yapıp Onur Listesi'ne girmeyi dene!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Onur Listesi No. {number}` |
| タグ | `#TAKKEU` |

### vi — Tiếng Việt

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU, trò bóng bàn chơi bằng cách chạm và kéo!\nBạn có thể nối được bao nhiêu lần trả bóng? {tag}` |
| ホーム・自己ベスト | `Kỷ lục cá nhân của tôi là {score} lần trả bóng trong trò bóng bàn TAKKEU!\nBạn có thể nối được bao nhiêu lần? {tag}` |
| 通常結果 | `Tôi đạt {score} lần trả bóng trong TAKKEU!\nBạn có thể nối được bao nhiêu lần?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU, hoàn thành 3500 lần trả bóng!{ordinal}\nThử thách ghi danh danh vọng 3500 lần trả bóng!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `Danh vọng số {number}` |
| タグ | `#TAKKEU` |

### th — ไทย

| 用途 | 本文 |
| --- | --- |
| ホーム・一般 | `TAKKEU เกมปิงปองที่เล่นด้วยการแตะและลาก!\nคุณจะโต้บอลต่อเนื่องได้กี่ครั้ง? {tag}` |
| ホーム・自己ベスト | `สถิติส่วนตัวของฉันคือโต้บอล {score} ครั้งในเกมปิงปอง TAKKEU!\nคุณจะโต้ต่อเนื่องได้กี่ครั้ง? {tag}` |
| 通常結果 | `ฉันโต้บอลได้ {score} ครั้งใน TAKKEU!\nคุณจะโต้บอลได้กี่ครั้ง?\n{tag}\n{url}` |
| 3500クリア | `TAKKEU โต้บอลครบ 3500 ครั้ง ผ่านเกมแล้ว!{ordinal}\nท้าทายหอเกียรติยศโต้บอล 3500 ครั้งกัน!\n{tag}\n{url}` |
| 正式番号の行（改行を前置） | `หอเกียรติยศ หมายเลข {number}` |
| タグ | `#TAKKEU` |

## 文字数の余裕

Xの通常投稿280の目安に対し、下表は現在の訳文を `score=9007199254740991`、`hallNumber=9007199254740991`（各16桁）で補間した長い例の重み付き文字数。ホームには別パラメーターのcanonicalと区切り1文字を含める。結果は本文内のcanonicalを含める。URLはt.coの23、基本ラテン・キリル・タイ等の一部範囲は1、CJK等は2として集計した。日本語や中国語を単純な文字列長だけで判定しない。

| 言語 | ホーム一般 | ホーム自己ベスト | 通常結果 | クリア＋正式番号 |
| --- | --- | --- | --- | --- |
| ja | 105 | 115 | 101 | 133 |
| en | 132 | 132 | 99 | 148 |
| es | 142 | 142 | 117 | 178 |
| pt-BR | 135 | 139 | 101 | 163 |
| zh-Hans | 89 | 113 | 89 | 125 |
| fr | 144 | 140 | 118 | 157 |
| de | 118 | 131 | 113 | 188 |
| ko | 101 | 115 | 102 | 134 |
| ru | 123 | 131 | 94 | 147 |
| it | 127 | 124 | 102 | 164 |
| zh-Hant | 89 | 111 | 89 | 125 |
| id | 118 | 138 | 117 | 154 |
| tr | 117 | 130 | 100 | 151 |
| vi | 132 | 159 | 126 | 155 |
| th | 105 | 131 | 101 | 148 |

この集計はローカル辞書とテンプレートの確認で、Xへの投稿・実サービスでの受理を実施したという意味ではない。アプリ側で翻訳本文の切断は行わない。訳文を増やすときはURL・改行・タグ・長いスコアと番号を含めた余裕を再確認する。

## OGP・Twitterカード

`index.html` のcanonical、`og:url`、OGP/Twitterのtitle・description・image・image:alt、`og:locale=ja_JP` と既存OGP画像は依頼どおり変更しない。選択言語のX本文とは独立した固定の日本語メタデータとして扱う。固定値の全文は [text-inventory.md](text-inventory.md) に載せる。アプリ起動後のタブタイトルは選択言語へ翻訳する。

賞状のPNG共有は別の `navigator.share({ files, title })`。PNGの本文・alt・共有タイトルと、選択言語に属する画像の破棄処理は [certificate.md](certificate.md) を参照。PNGのobject URLはXのcanonicalに流用しない。
