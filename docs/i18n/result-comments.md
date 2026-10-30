# スコア別コメント44段階・15言語

閾値の基準は [tests/helpers/resultCases.ts](../../tests/helpers/resultCases.ts)、選択処理は [src/ui/resultComments.ts](../../src/ui/resultComments.ts)。下表は15辞書から転記した44段階、計660訳。段階の条件・順番・日本語原文を変更せず、短い励ましと高得点ほど強い達成感を各言語で表す。

入力は有限値なら `floor` して0以上に補正する。負値と `NaN/Infinity/-Infinity` は0点扱い。0〜49は5点刻み、50〜199は10点刻み、200以上は100点刻み、2000以上は最後のコメントを使う。テスト表の最終上限100000000は既存ランキング範囲の代表値で、関数のコメント選択自体は2000以上に上限を設けない。

結果画面の3500クリア時は、この表の通常コメントを `3500ラリー達成！ゲームクリア！` の翻訳で置き換える。3000到達の通知は継続を伝え、クリアとは扱わない。節目通知では同じ表のコメントを `{score} RALLY · {comment}` の翻訳に差し込む。スコアの計算、終了条件、色・演出・音の条件はこの表に含めず、既存の判定を使う。

表は読みやすく5言語ずつに分割し、共通の `C01〜C44` と最小・最大で対応させる。両端を含む範囲で、最後の「∞」は2000以上すべて。日本語欄がそのまま翻訳キーで、全15言語を同一のキーから参照する。

## ja / en / es / pt-BR / zh-Hans

| 段階 | 最小 | 最大 | ja | en | es | pt-BR | zh-Hans |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | 0 | 4 | 次こそ決めよう！ | Get it next time! | ¡La próxima lo consigues! | Na próxima você consegue! | 下次一定行！ |
| C02 | 5 | 9 | ラリー、開幕！ | Rally on! | ¡Empieza el peloteo! | Começou a troca de bolas! | 对打，开场！ |
| C03 | 10 | 14 | いいぞ、つながる！ | Nice, keep it going! | ¡Bien, sigue así! | Boa, continue assim! | 漂亮，接上了！ |
| C04 | 15 | 19 | コツをつかんだ！ | You’ve got the hang of it! | ¡Ya le tienes el truco! | Pegou o jeito! | 找到窍门了！ |
| C05 | 20 | 24 | 返球センスあり！ | A knack for returns! | ¡Talento para devolver! | Talento para devolver! | 回球很有天赋！ |
| C06 | 25 | 29 | いい手応え！ | Looking good! | ¡Buenas sensaciones! | Mandando bem! | 手感不错！ |
| C07 | 30 | 34 | 打ち返し上手！ | Great returns! | ¡Grandes devoluciones! | Belas rebatidas! | 回得漂亮！ |
| C08 | 35 | 39 | リズムに乗ってきた！ | Finding your rhythm! | ¡Vas tomando ritmo! | Entrando no ritmo! | 节奏来了！ |
| C09 | 40 | 44 | ラリーが止まらない！ | This rally won’t stop! | ¡El peloteo no para! | Essa troca não para! | 连续回球停不下来！ |
| C10 | 45 | 49 | 50が見えてきた！ | 50 in sight! | ¡50 a la vista! | 50 à vista! | 50就在眼前！ |
| C11 | 50 | 59 | 50の壁、突破！ | Past the 50 mark! | ¡Barrera de 50 superada! | Barreira dos 50 superada! | 突破50大关！ |
| C12 | 60 | 69 | ラケットが冴える！ | That paddle is on fire! | ¡Esa pala está que arde! | Essa raquete está afiada! | 球拍火力全开！ |
| C13 | 70 | 79 | 反応速度がすごい！ | Lightning reactions! | ¡Reacciones de vértigo! | Reações incríveis! | 反应快得惊人！ |
| C14 | 80 | 89 | 流れを完全につかんだ！ | You’re in full flow! | ¡Tienes el ritmo dominado! | Dominou o ritmo! | 节奏尽在掌握！ |
| C15 | 90 | 99 | 100まであと少し！ | Almost at 100! | ¡Ya casi son 100! | Quase nos 100! | 离100只差一点！ |
| C16 | 100 | 109 | 3桁の世界へ突入！ | Into 3 digits! | ¡Entras en las 3 cifras! | Chegou aos 3 dígitos! | 迈入3位数！ |
| C17 | 110 | 119 | 止まらない絶好調！ | An unstoppable streak! | ¡Una racha imparable! | Uma sequência imbatível! | 状态爆棚，停不下来！ |
| C18 | 120 | 129 | 驚異の集中力！ | Incredible focus! | ¡Concentración increíble! | Concentração impressionante! | 专注力惊人！ |
| C19 | 130 | 139 | 返球マスター！ | Return master! | ¡Maestría en las devoluciones! | Mestre das rebatidas! | 回球大师！ |
| C20 | 140 | 149 | 全部返すつもり！？ | Going to return them all?! | ¡¿Vas a devolverlas todas?! | Vai devolver todas?! | 这是要一球不漏？！ |
| C21 | 150 | 159 | 完全にゾーン突入！ | Fully in the zone! | ¡Concentración total! | Concentração total! | 进入巅峰状态！ |
| C22 | 160 | 169 | 目が追いつかない！ | Too fast to follow! | ¡La vista no te sigue! | Os olhos nem acompanham! | 眼睛都跟不上了！ |
| C23 | 170 | 179 | ここまで来るか！ | Look how far you’ve come! | ¡Mira hasta dónde llegas! | Olha até onde você chegou! | 竟然打到了这里！ |
| C24 | 180 | 189 | 反射神経、覚醒！ | Reflexes awakened! | ¡Reflejos despiertos! | Reflexos despertados! | 反应力觉醒！ |
| C25 | 190 | 199 | 200目前の猛攻！ | Charging toward 200! | ¡Ataque rumbo a 200! | Ataque rumo aos 200! | 向200全力冲刺！ |
| C26 | 200 | 299 | ここから超人級！ | Superhuman from here! | ¡Nivel sobrehumano! | Nível sobre-humano! | 超人级表现登场！ |
| C27 | 300 | 399 | ラリーの猛者、現る！ | A rally champion emerges! | ¡Surge una leyenda del peloteo! | Surgiu uma fera das rebatidas! | 对打高手现身！ |
| C28 | 400 | 499 | 人間離れしてきた！ | Beyond human now! | ¡Esto ya no es humano! | Isso já não é humano! | 强得超乎想象！ |
| C29 | 500 | 599 | 卓球の化身！ | Table tennis incarnate! | ¡El tenis de mesa en persona! | O tênis de mesa em pessoa! | 乒乓之魂附体！ |
| C30 | 600 | 699 | 卓球台が休みたがってる！ | The table needs a break! | ¡La mesa pide un descanso! | A mesa está pedindo descanso! | 球台都想歇一歇了！ |
| C31 | 700 | 799 | 無限ラリーモード！ | Endless rally mode! | ¡Modo peloteo infinito! | Modo rebatidas infinitas! | 无限对打模式！ |
| C32 | 800 | 899 | 反射神経、異常値！ | Off-the-charts reflexes! | ¡Reflejos fuera de escala! | Reflexos fora de escala! | 这反应力太离谱！ |
| C33 | 900 | 999 | 伝説まであと一歩！ | One step from legend! | ¡A un paso de la leyenda! | A um passo da lenda! | 离传奇只差一步！ |
| C34 | 1000 | 1099 | 4桁の怪物、誕生！ | A 4-digit monster is born! | ¡Nace un monstruo de 4 cifras! | Nasceu um monstro de 4 dígitos! | 4位数神级高手诞生！ |
| C35 | 1100 | 1199 | 常識を置き去り！ | Leaving limits behind! | ¡Dejas atrás los límites! | Deixando os limites para trás! | 把常识甩在身后！ |
| C36 | 1200 | 1299 | ボールを完全支配！ | Total ball control! | ¡Control total de la pelota! | Controle total da bola! | 每一球都在掌控中！ |
| C37 | 1300 | 1399 | 未来が見えてる！？ | Can you see the future?! | ¡¿Ves el futuro?! | Você vê o futuro?! | 你能预知下一球？！ |
| C38 | 1400 | 1499 | 重力さえ味方する！ | Even gravity is on your side! | ¡Hasta la gravedad te ayuda! | Até a gravidade está do seu lado! | 连重力都在助攻！ |
| C39 | 1500 | 1599 | 卓球の次元を突破！ | Table tennis, next dimension! | ¡El tenis de mesa en otra dimensión! | Tênis de mesa em outra dimensão! | 突破乒乓的次元！ |
| C40 | 1600 | 1699 | これは記録じゃない、事件！ | This score is making headlines! | ¡Esta marca hace historia! | Essa marca está fazendo história! | 这成绩要轰动全场！ |
| C41 | 1700 | 1799 | 人類の限界を更新！ | Raising the human limit! | ¡Un nuevo límite humano! | Um novo limite para a humanidade! | 刷新人类极限！ |
| C42 | 1800 | 1899 | 神速ラリーの領域！ | Godspeed rally territory! | ¡Peloteo a velocidad divina! | Rebatidas em velocidade divina! | 神速回球的境界！ |
| C43 | 1900 | 1999 | 神話まで、あと一歩！ | One step from myth! | ¡A un paso del mito! | A um passo do mito! | 离神话仅一步之遥！ |
| C44 | 2000 | ∞ | ラリーの神、降臨。 | The rally god has arrived. | Ha llegado la deidad del peloteo. | A divindade das rebatidas chegou. | 回球之神，降临！ |

## fr / de / ko / ru / it

| 段階 | 最小 | 最大 | fr | de | ko | ru | it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | 0 | 4 | La prochaine sera la bonne ! | Beim nächsten Mal klappt’s! | 다음엔 해내자! | В следующий раз получится! | La prossima volta ce la farai! |
| C02 | 5 | 9 | L’échange est lancé ! | Der Ballwechsel beginnt! | 랠리, 시작! | Розыгрыш начался! | Che lo scambio abbia inizio! |
| C03 | 10 | 14 | Bien joué, continue ! | Gut so, weiter geht’s! | 좋아, 이어 간다! | Отлично, продолжаем! | Bene così, continua! |
| C04 | 15 | 19 | Tu as pris le coup ! | Du hast den Dreh raus! | 감을 잡았어! | Ты освоился! | Ci hai preso la mano! |
| C05 | 20 | 24 | Du talent au renvoi ! | Ein Händchen für Rückschläge! | 리턴에 재능이 있어! | Чувствуешь, как отбивать! | Hai talento nei rinvii! |
| C06 | 25 | 29 | Ça s’annonce bien ! | Das fühlt sich gut an! | 손맛이 좋은데! | Хорошее начало! | Ottime sensazioni! |
| C07 | 30 | 34 | De beaux renvois ! | Stark zurückgespielt! | 받아치기 고수! | Ловко отбиваешь! | Sai proprio rinviare! |
| C08 | 35 | 39 | Tu trouves ton rythme ! | Du findest deinen Rhythmus! | 리듬을 탔어! | Входишь в ритм! | Stai entrando nel ritmo! |
| C09 | 40 | 44 | L’échange ne s’arrête plus ! | Der Ballwechsel läuft und läuft! | 랠리가 멈추지 않아! | Розыгрыш не остановить! | Lo scambio non si ferma! |
| C10 | 45 | 49 | 50 en vue ! | Die 50 sind in Sicht! | 50이 보인다! | 50 уже близко! | I 50 sono vicini! |
| C11 | 50 | 59 | Le cap des 50 est franchi ! | Die 50 geknackt! | 50의 벽 돌파! | Рубеж 50 пройден! | La barriera dei 50 è superata! |
| C12 | 60 | 69 | La raquette est en feu ! | Dein Schläger läuft heiß! | 라켓이 날아다닌다! | Ракетка в ударе! | La racchetta è in gran forma! |
| C13 | 70 | 79 | Des réactions fulgurantes ! | Blitzschnelle Reaktionen! | 반응 속도 대단해! | Молниеносная реакция! | Reazioni fulminee! |
| C14 | 80 | 89 | Tu maîtrises le rythme ! | Du hast den Lauf voll im Griff! | 흐름을 완전히 잡았어! | Ты полностью поймал ритм! | Hai il ritmo in pugno! |
| C15 | 90 | 99 | Bientôt 100 ! | Fast bei 100! | 100까지 조금만 더! | Ещё немного до 100! | Manca poco a 100! |
| C16 | 100 | 109 | Bienvenue dans les 3 chiffres ! | Jetzt wird’s 3-stellig! | 3자리 세계에 입성! | Теперь 3-значный счёт! | Si passa alle 3 cifre! |
| C17 | 110 | 119 | Une série imparable ! | Unaufhaltsam in Bestform! | 거침없는 절정의 컨디션! | На пике — и без остановки! | Inarrestabile e al massimo! |
| C18 | 120 | 129 | Une concentration incroyable ! | Was für eine Konzentration! | 놀라운 집중력! | Невероятная концентрация! | Concentrazione incredibile! |
| C19 | 130 | 139 | Maître du renvoi ! | Meister der Rückschläge! | 리턴 마스터! | Мастер возвратов! | Maestro dei rinvii! |
| C20 | 140 | 149 | Tu comptes toutes les renvoyer ?! | Willst du wirklich alle erwischen?! | 모든 공을 받아칠 셈이야?! | Решил отбить вообще всё?! | Vuoi proprio rimandarle tutte?! |
| C21 | 150 | 159 | En pleine concentration ! | Voll im Tunnel! | 완벽한 몰입 상태! | Полное погружение в игру! | Concentrazione totale! |
| C22 | 160 | 169 | Les yeux ne suivent plus ! | Da kommen die Augen kaum mit! | 눈으로도 못 따라가겠어! | Глаза не успевают! | Gli occhi non ti stanno dietro! |
| C23 | 170 | 179 | Te voilà déjà si loin ! | So weit hast du’s geschafft! | 여기까지 오다니! | Как далеко ты зашёл! | Guarda fin dove sei arrivato! |
| C24 | 180 | 189 | Des réflexes éveillés ! | Deine Reflexe sind erwacht! | 반사 신경 각성! | Рефлексы пробудились! | Riflessi risvegliati! |
| C25 | 190 | 199 | À l’assaut des 200 ! | Mit Vollgas auf die 200! | 200을 향한 맹공! | Мощный рывок к 200! | Assalto ai 200! |
| C26 | 200 | 299 | Un niveau surhumain ! | Ab jetzt wird’s übermenschlich! | 이제부터 초인급! | Теперь это сверхспособности! | Da qui si diventa sovrumani! |
| C27 | 300 | 399 | Un as des échanges apparaît ! | Ein Ballwechsel-Champion ist da! | 랠리의 강자 등장! | Вот он, мастер розыгрышей! | Ecco un campione degli scambi! |
| C28 | 400 | 499 | Ça dépasse l’humain ! | Langsam wird’s übermenschlich! | 인간의 한계를 넘어! | Это уже за гранью человеческого! | Ormai oltre i limiti umani! |
| C29 | 500 | 599 | Le tennis de table incarné ! | Tischtennis in Person! | 탁구의 화신! | Воплощение настольного тенниса! | Il tennis tavolo fatto persona! |
| C30 | 600 | 699 | La table réclame une pause ! | Der Tisch braucht eine Pause! | 탁구대도 쉬고 싶대! | Стол просит передышку! | Il tavolo chiede una pausa! |
| C31 | 700 | 799 | Mode échange infini ! | Endloser Ballwechsel-Modus! | 무한 랠리 모드! | Режим бесконечного розыгрыша! | Modalità scambio infinito! |
| C32 | 800 | 899 | Des réflexes hors norme ! | Reflexe außerhalb jeder Skala! | 반사 신경이 상상 초월! | Рефлексы за пределами шкалы! | Riflessi fuori scala! |
| C33 | 900 | 999 | À un pas de la légende ! | Nur ein Schritt zur Legende! | 전설까지 한 걸음! | Один шаг до легенды! | A un passo dalla leggenda! |
| C34 | 1000 | 1099 | Un monstre à 4 chiffres est né ! | Ein 4-stelliges Monster! | 4자리 괴물 탄생! | Родился 4-значный монстр! | È nato un mostro da 4 cifre! |
| C35 | 1100 | 1199 | Tu dépasses toutes les limites ! | Alle Grenzen hinter dir! | 상식을 뛰어넘었어! | Все пределы остались позади! | Hai superato ogni limite! |
| C36 | 1200 | 1299 | Maîtrise totale de la balle ! | Den Ball völlig im Griff! | 공을 완벽히 지배한다! | Мяч под полным контролем! | Controllo totale della palla! |
| C37 | 1300 | 1399 | Tu vois le futur ?! | Kannst du die Zukunft sehen?! | 미래가 보이는 거야?! | Ты видишь будущее?! | Riesci a vedere il futuro?! |
| C38 | 1400 | 1499 | Même la gravité est de ton côté ! | Selbst die Schwerkraft hilft dir! | 중력마저 내 편! | Даже гравитация за тебя! | Anche la gravità è con te! |
| C39 | 1500 | 1599 | Le tennis de table change de dimension ! | Eine neue Tischtennis-Dimension! | 탁구의 차원을 돌파! | Новое измерение настольного тенниса! | Una nuova dimensione del tennis tavolo! |
| C40 | 1600 | 1699 | Ce score fait l’événement ! | Das ist ein Ereignis fürs Geschichtsbuch! | 탁구계를 뒤흔들 기록! | Это событие войдёт в историю! | Questo risultato farà storia! |
| C41 | 1700 | 1799 | Les limites humaines reculent ! | Die Grenzen des Menschen verschoben! | 인류의 한계 경신! | Новый предел человеческих возможностей! | Hai spostato i limiti umani! |
| C42 | 1800 | 1899 | Des échanges à vitesse divine ! | Ballwechsel in göttlichem Tempo! | 신의 속도로 잇는 랠리! | Розыгрыш на божественной скорости! | Scambi a velocità divina! |
| C43 | 1900 | 1999 | À un pas du mythe ! | Nur ein Schritt zum Mythos! | 신화까지 한 걸음! | Ещё шаг — и ты миф! | A un passo dal mito! |
| C44 | 2000 | ∞ | La divinité des échanges est arrivée. | Der Gott der Ballwechsel ist da. | 랠리의 신, 강림! | Бог розыгрышей явился. | È arrivata la divinità degli scambi. |

## zh-Hant / id / tr / vi / th

| 段階 | 最小 | 最大 | zh-Hant | id | tr | vi | th |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | 0 | 4 | 下次一定行！ | Kali berikutnya pasti bisa! | Bir dahakine başaracaksın! | Lần sau nhất định làm được! | ครั้งหน้าต้องทำได้! |
| C02 | 5 | 9 | 對打，開場！ | Reli dimulai! | Ralli başladı! | Màn đôi công bắt đầu! | เริ่มโต้บอลกันเลย! |
| C03 | 10 | 14 | 漂亮，接上了！ | Bagus, terus sambung! | Harika, devam! | Hay lắm, tiếp tục nào! | ดีมาก โต้ต่อไป! |
| C04 | 15 | 19 | 抓到訣竅了！ | Mulai menguasai! | İşin sırrını çözdün! | Nắm được bí quyết rồi! | จับทางได้แล้ว! |
| C05 | 20 | 24 | 很有回球天分！ | Berbakat mengembalikan bola! | Karşı vuruşa yeteneğin var! | Có khiếu trả bóng đấy! | มีแววตีลูกกลับเก่ง! |
| C06 | 25 | 29 | 手感正好！ | Makin mantap! | İyi gidiyorsun! | Tay vợt vào guồng! | มือเริ่มมาแล้ว! |
| C07 | 30 | 34 | 回得漂亮！ | Jago mengembalikan! | Çok iyi geri vuruyorsun! | Trả bóng điêu luyện! | ตีลูกกลับได้เยี่ยม! |
| C08 | 35 | 39 | 節奏來了！ | Ritmenya mulai dapat! | Ritmi yakalıyorsun! | Bắt được nhịp rồi! | เข้าจังหวะแล้ว! |
| C09 | 40 | 44 | 連續回球停不下來！ | Relinya tak berhenti! | Ralli durmak bilmiyor! | Đôi công không ngừng! | โต้บอลไม่มีหยุด! |
| C10 | 45 | 49 | 50就在眼前！ | 50 mulai terlihat! | 50 göründü! | Đã thấy mốc 50! | มองเห็นเป้าหมาย 50 แล้ว! |
| C11 | 50 | 59 | 突破50大關！ | Tembus batas 50! | 50 sınırı aşıldı! | Vượt ngưỡng 50 rồi! | ทะลุกำแพง 50 แล้ว! |
| C12 | 60 | 69 | 球拍火力全開！ | Bet makin tajam! | Raketin formunda! | Vợt ngày càng sắc bén! | ไม้เริ่มคมขึ้นทุกที! |
| C13 | 70 | 79 | 反應快得驚人！ | Reaksi luar biasa cepat! | Tepkilerin inanılmaz hızlı! | Phản ứng nhanh tuyệt vời! | ตอบสนองเร็วสุดยอด! |
| C14 | 80 | 89 | 節奏盡在掌握！ | Alurnya sudah dikuasai! | Akışı tamamen yakaladın! | Hoàn toàn làm chủ nhịp đấu! | คุมจังหวะได้หมดแล้ว! |
| C15 | 90 | 99 | 離100只差一點！ | Sedikit lagi ke 100! | 100'e az kaldı! | Sắp chạm mốc 100! | อีกนิดก็ถึง 100! |
| C16 | 100 | 109 | 邁入3位數！ | Masuk wilayah 3 digit! | 3 haneli sayılara hoş geldin! | Bước vào thế giới 3 chữ số! | เข้าสู่โลก 3 หลัก! |
| C17 | 110 | 119 | 狀態爆棚，停不下來！ | Terus melaju tanpa henti! | Zirvedesin, durmak yok! | Phong độ cao không ngừng! | ฟอร์มแรงไม่หยุด! |
| C18 | 120 | 129 | 專注力驚人！ | Konsentrasi menakjubkan! | İnanılmaz odaklanma! | Tập trung đáng kinh ngạc! | สมาธิน่าทึ่ง! |
| C19 | 130 | 139 | 回球大師！ | Ahli pengembalian bola! | Karşı vuruş ustası! | Bậc thầy trả bóng! | ปรมาจารย์ตีลูกกลับ! |
| C20 | 140 | 149 | 這是要一球不漏？！ | Mau mengembalikan semuanya?! | Hepsini mi karşılayacaksın?! | Định trả hết mọi quả sao?! | จะตีคืนทุกลูกเลยเหรอ?! |
| C21 | 150 | 159 | 進入巔峰狀態！ | Fokus penuh, tak tergoyahkan! | Tamamen oyuna kilitlendin! | Hoàn toàn nhập tâm! | สมาธิเข้าขั้นสุดยอด! |
| C22 | 160 | 169 | 眼睛都跟不上了！ | Mata tak bisa mengikuti! | Gözler yetişemiyor! | Mắt không theo kịp! | มองตามไม่ทันแล้ว! |
| C23 | 170 | 179 | 竟然打到這裡了！ | Bisa sampai sejauh ini! | Buralara kadar geldin! | Đi xa đến thế này cơ đấy! | มาได้ไกลขนาดนี้เลย! |
| C24 | 180 | 189 | 反應力覺醒！ | Refleks pun bangkit! | Reflekslerin uyandı! | Phản xạ thức tỉnh! | ปฏิกิริยาเร็วขึ้นอีกขั้น! |
| C25 | 190 | 199 | 朝200全力衝刺！ | Serbuan menuju 200! | 200'e doğru tam gaz! | Dồn dập tiến sát 200! | รุกไม่หยุด ใกล้ถึง 200! |
| C26 | 200 | 299 | 超人級表現登場！ | Mulai masuk kelas manusia super! | Buradan sonrası insanüstü! | Từ đây là đẳng cấp siêu nhân! | จากนี้ระดับยอดมนุษย์! |
| C27 | 300 | 399 | 對打高手現身！ | Jagoan reli telah muncul! | Bir ralli ustası doğdu! | Cao thủ đôi công xuất hiện! | ยอดฝีมือโต้บอลปรากฏตัว! |
| C28 | 400 | 499 | 強得超乎想像！ | Makin melampaui manusia! | İnsan sınırlarını aşıyorsun! | Vượt tầm người thường! | เริ่มเกินขีดมนุษย์แล้ว! |
| C29 | 500 | 599 | 桌球之魂附體！ | Perwujudan tenis meja! | Masa tenisi sende hayat buldu! | Hiện thân của bóng bàn! | ร่างอวตารแห่งปิงปอง! |
| C30 | 600 | 699 | 球桌都想喘口氣了！ | Mejanya ingin istirahat! | Masa artık mola istiyor! | Bàn bóng cũng muốn nghỉ! | โต๊ะปิงปองอยากพักแล้ว! |
| C31 | 700 | 799 | 無限對打模式！ | Mode reli tanpa akhir! | Sonsuz ralli modu! | Chế độ đôi công vô tận! | โหมดโต้บอลไม่รู้จบ! |
| C32 | 800 | 899 | 這反應力太誇張！ | Refleks di luar nalar! | Reflekslerin ölçeğe sığmıyor! | Phản xạ vượt chuẩn! | ปฏิกิริยาไวเกินมาตรฐาน! |
| C33 | 900 | 999 | 離傳奇只差一步！ | Selangkah menuju legenda! | Efsaneye bir adım kaldı! | Cách huyền thoại một bước! | อีกก้าวเดียวสู่ตำนาน! |
| C34 | 1000 | 1099 | 4位數神級高手誕生！ | Monster 4 digit telah lahir! | 4 haneli bir canavar doğdu! | Quái vật 4 chữ số ra đời! | อสูร 4 หลักถือกำเนิด! |
| C35 | 1100 | 1199 | 把常識甩在身後！ | Melampaui akal sehat! | Bütün sınırlar geride kaldı! | Bỏ lại mọi lẽ thường! | ทิ้งทุกสามัญสำนึกไว้ข้างหลัง! |
| C36 | 1200 | 1299 | 每一球都在掌控中！ | Bola sepenuhnya dikuasai! | Top tamamen kontrolünde! | Hoàn toàn làm chủ quả bóng! | คุมลูกบอลได้ทั้งหมด! |
| C37 | 1300 | 1399 | 你能預知下一球？！ | Bisa melihat masa depan?! | Geleceği mi görüyorsun?! | Nhìn thấy tương lai sao?! | มองเห็นอนาคตเหรอ?! |
| C38 | 1400 | 1499 | 連重力都在助攻！ | Gravitasi pun mendukung! | Yer çekimi bile senin yanında! | Trọng lực cũng đứng về bạn! | แม้แต่แรงโน้มถ่วงยังเข้าข้าง! |
| C39 | 1500 | 1599 | 突破桌球的次元！ | Menembus dimensi tenis meja! | Masa tenisinde yeni bir boyut! | Vượt chiều không gian bóng bàn! | ทะลุมิติแห่งปิงปอง! |
| C40 | 1600 | 1699 | 這成績要轟動全場！ | Bukan rekor biasa, ini sensasi! | Bu sonuç tarihe geçer! | Một kỷ lục gây chấn động! | นี่ไม่ใช่แค่สถิติ แต่เป็นเรื่องสะเทือนวงการ! |
| C41 | 1700 | 1799 | 刷新人類極限！ | Batas manusia terlampaui! | İnsanlığın sınırlarını yeniledin! | Phá vỡ giới hạn con người! | ทลายขีดจำกัดมนุษย์! |
| C42 | 1800 | 1899 | 神速回球的境界！ | Reli secepat kilat! | İlahi hızda ralli! | Đôi công nhanh như chớp! | โต้บอลเร็วระดับเทพ! |
| C43 | 1900 | 1999 | 離神話僅一步之遙！ | Selangkah menuju mitos! | Destan olmaya bir adım kaldı! | Cách thần thoại một bước! | อีกก้าวเดียวสู่ตำนานเทพ! |
| C44 | 2000 | ∞ | 回球之神，降臨！ | Dewa reli telah turun. | Rallinin tanrısı geldi. | Thần đôi công giáng lâm. | เทพแห่งการโต้บอลจุติแล้ว |

## 保守時の確認

訳文の追加・修正時は44段階が各辞書にすべて残ること、最小値・最大値で同じキーが選ばれること、句読点込みの日本語原文を維持することを確認する。日本語以外の表に日本語の仮名が紛れないことと、50・100・200等の数値が必要な訳文から落ちないことも辞書検査の対象。各言語の母語話者による校閲や実機の表示結果は、辞書の機械検査とは区別して [release-readiness.md](release-readiness.md) に記録する。
