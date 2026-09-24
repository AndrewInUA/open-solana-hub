---
title: 'Alpenswitch у публічному тестнеті: Solana відпрацьовує перехід на новий консенсус Alpenglow'
seo_title: 'Alpenglow на публічному testnet Solana: що таке Alpenswitch'
date: '2026-09-24'
tag: Consensus
description: >-
  Alpenswitch цього тижня переводить публічний testnet Solana на Alpenglow: фіналізація близько
  150 мс. 28 вересня – не запуск на mainnet.
keywords:
  - Alpenswitch
  - Alpenglow testnet
  - фіналізація Solana 150 мс
  - публічний testnet Solana
teaser: >-
  Публічний тестнет Solana цього тижня відпрацьовує міграцію з TowerBFT на Alpenglow. У розкладі
  Anza є ще позначка 28 вересня. На mainnet запуск ще не відбувся.
image: /content/media/alpenswitch-testnet-card.png
image_alt: 'Alpenswitch: темний кластер переходить від стопки підтверджень до короткого імпульсу згоди'
---

Цього тижня публічний тестнет Solana відпрацьовує міграцію кластера з протоколу
 TowerBFT на оновлений консенсус Alpenglow. 22 вересня Anza повідомила, що
 Alpenglow виходить в тестнет цього тижня і що відпрацювання йде за тією самою
 процедурою, яку пізніше пройдуть devnet і mainnet-beta. Окремий кластер спільноти
 вже понад чотири місяці працює на Alpenglow і не раз відпрацьовував це
 перемикання. На mainnet запуск ще не відбувся.

<figure class="cms-figure cms-figure-hero">
  <img src="/content/media/alpenswitch-testnet-card.png" alt="Alpenswitch: темний кластер переходить від стопки підтверджень до короткого імпульсу згоди" width="1280" height="720" decoding="async" fetchpriority="high" />
  <figcaption>Публічний testnet – місце перевірки міграції. На mainnet блоки й далі поки що узгоджуються через TowerBFT.</figcaption>
</figure>

## Дві назви однієї зміни

**Alpenglow** (<a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md" target="_blank" rel="noopener noreferrer" data-new-tab="on">SIMD-0326</a>)
 – це оновлення консенсусу. Alpenglow замінює TowerBFT протоколом голосування
 **Votor**. Голоси більше не потрапляють у блок як транзакції: валідатори
 надсилають їх одне одному напряму. Орієнтир за фіналізацією – близько **150 мілісекунд**. Цифра, яку й досі
 називають для TowerBFT, – близько **12,8 секунди**: це 32 слоти на старому
 такті 400 мс. Зараз слоти 250 мс, тож та сама низка підтверджень займає менше
 реального часу. Alpenglow доходить до 150 мс не тим, що коротшає слот.

**Alpenswitch** (<a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md" target="_blank" rel="noopener noreferrer" data-new-tab="on">SIMD-0384</a>)
 – це власне процедура переходу. На межі міграції кластер перемикається з TowerBFT
 на Alpenglow. Якщо перемикання зривається, кластер лишається на TowerBFT.
 Публічний тестнет відпрацьовує цей перехід саме зараз. Devnet і mainnet-beta мають
 пройти ту саму процедуру пізніше, кожен у свій час.

Як у липні виглядали Votor, Validator Admission Ticket і ще закритий gate на
 mainnet – читайте у
 <a href="./alpenglow-consensus-status-july-2026.html" target="_blank" rel="noopener noreferrer" data-new-tab="on">нотатці про статус Alpenglow</a>.

## Що оголосила Anza

22 вересня Anza повідомила, що Alpenglow виходить на публічний тестнет цього
 тижня. Там прямо сказано про процедуру: тестнет проходить ту саму міграцію, яку
 пізніше пройдуть devnet і mainnet-beta. Кластер спільноти вже понад чотири
 місяці працює на Alpenglow і відпрацьовував цей перехід.

Міграцію на тестнеті варто розуміти як **таку, що триває цього тижня**. Публічний
 трекер ще може позначати її як pending, поки оператори готуються. Завершеного
 часу на кшталт «перемкнулося на епосі N» поки немає.

Перший прохід – **лише Agave 4.3**. Firedancer і Frankendancer цю testnet-міграцію
 Alpenglow не підтримують, тож операторам на цих клієнтах для тестування потрібен
 Agave. Пізніші кластери самі оберуть свій набір клієнтів.

У тому самому розкладі Anza є й інша дата, і саме її плутають із новиною про
 тестнет. **28 вересня** стоїть як орієнтовний день, коли на mainnet увімкнуть
 feature gates Agave 4.3. Ця дата лежить у календарі релізу поруч з оголошенням
 про тестнет. Це інший пункт.

<div class="callout">
<strong>Що означає позначка 28 вересня</strong>
Agave 4.3 на mainnet уже встановлений. Він вийшов 18 вересня: код Alpenglow
 усередині є, а перемикач ще вимкнений. Feature gate – це і є той перемикач:
 софт може вже стояти на валідаторі, а одну можливість увімкнуть пізніше.
 28 вересня – орієнтовний день у тому календарі, коли відкриють частину цих
 перемикачів. Він не переводить mainnet на Alpenglow. Операторські нотатки й
 далі відкладають перемикання консенсусу на пізніший реліз. Поки gate Alpenglow
 справді не відкриють, mainnet фіналізує блоки через TowerBFT. Як клієнтна лінія
 дійшла сюди – читайте у
 <a href="./agave-4-2-release-august-2026.html" target="_blank" rel="noopener noreferrer" data-new-tab="on">нотатці про Agave 4.2</a>.
</div>

## Фіналізація і годинник – різні важелі

<a href="./solana-250ms-slots-september-2026.html" target="_blank" rel="noopener noreferrer" data-new-tab="on">Слоти 250 мс</a> запрацювали на mainnet з епохи 1037. Та зміна скоротила слот – вікно, в якому лідер збирає блок. Вона не
 змінила, скільки мережа чекає, перш ніж блок стане незворотним. Alpenglow – інший
 важіль: як валідатори домовляються, що блок уже не скасувати. Швидший такт і
 швидша фіналізація обидва роблять застосунки спритнішими. Вмикаються вони окремо.

<div class="article-analogy">
<strong>Простими словами</strong>
Фіналізація – це мить, коли банківський переказ стає незворотним. TowerBFT – це
 коли банк чекає цілу низку підтверджень, перш ніж визнати платіж завершеним.
 Votor – коротка пряма домовленість валідаторів, які мають підтвердити блок:
 одна розмова замість пачки квитанцій.
</div>

Коли Alpenglow справді працює на кластері, застосунки на ньому відчувають
 фіналізацію значно раніше. Виконання транзакцій не змінюється: SVM, формати
 транзакцій і комісії лишаються тими самими. Rotor, пізніший шар поширення даних,
 у це пропрацювання на тестнет не входить.

## Що це означає для…

### Валідаторів

Для цього тестування потрібен **Agave 4.3**. Перш ніж на testnet відкриється gate,
 прочитайте нотатки Anza для операторів. Firedancer і Frankendancer цей перший
 перехід не проходять. Кластер спільноти вже тренував перемикання; публічний
 тестнет – офіційний прогін тієї самої міграції. Позначка 28 вересня може
 відкрити частину gates Agave 4.3 на mainnet. Це не день, коли mainnet переходить
 на Alpenglow.

### Делегаторів

Ця зміна консенсусу взагалі не має для вас створювати якогось додаткового
 клопоту. Стейк, який ви вже делегували, лишається на тому самому валідаторі і
 під час тестування у тестнеті, і коли mainnet перейде пізніше.

### Білдерів

Цей тиждень на тестнеті не вимагає змін у програмі чи гаманці на mainnet. Не
 випускайте mainnet-інтерфейс, який розраховує на фіналізацію близько 150 мс. На
 mainnet finalized і далі означає очікування TowerBFT. На кластері, де Alpenswitch
 уже завершився, підтвердження і фіналізація зближуються, а vote-транзакції
 зникають із блоків. Індексерам варто оновити базові лічильники після реальної
 міграції цього кластера, а не за датою в календарі. Довжина слота і фіналізація –
 різні речі: беріть поточну тривалість слота зі зміни
 <a href="./solana-250ms-slots-september-2026.html" target="_blank" rel="noopener noreferrer" data-new-tab="on">слотів 250 мс</a>
 і не вважайте 150 мс новою довжиною слота.

### Звичайних користувачів

Якщо ви тримаєте чи надсилаєте SOL на mainnet, нічого налаштовувати не потрібно.
 Цього тижня ваші перекази не почнуть фіналізуватися за 150 мс. Якщо застосунок
 працює з публічним тестнетом, фіналізація там може відчуватися набагато раніше,
 щойно міграція на цьому кластері відбудеться. Гаманець міняти не потрібно ні на
 mainnet, ні на тестнеті.

<div class="callout">
<strong>Коротко</strong>
        Публічний testnet відпрацьовує Alpenswitch – перехід з TowerBFT на Alpenglow.
        Рядок 28 вересня в розкладі Anza – це можливий день для інших перемикачів
        Agave 4.3. Mainnet на Alpenglow ще не перейшов.
</div>

Джерела:
 <a href="https://solana.com/upgrades/alpenglow" target="_blank" rel="noopener noreferrer" data-new-tab="on">Solana – Alpenglow</a> ·
 <a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md" target="_blank" rel="noopener noreferrer" data-new-tab="on">SIMD-0326</a> ·
 <a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md" target="_blank" rel="noopener noreferrer" data-new-tab="on">SIMD-0384</a> ·
 <a href="https://www.coindesk.com/tech/2026/09/23/solana-starts-testing-upgrade-that-could-cut-finality-from-12-8-seconds-to-150-milliseconds" target="_blank" rel="noopener noreferrer" data-new-tab="on">CoinDesk – тест фіналізації на публічному testnet</a> ·
 <a href="https://forklog.com/en/alpenglow-begins-activation-phase-in-solana-testnet/" target="_blank" rel="noopener noreferrer" data-new-tab="on">ForkLog – активація на testnet</a>
