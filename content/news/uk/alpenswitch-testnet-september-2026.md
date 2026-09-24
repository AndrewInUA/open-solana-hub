---
title: 'Alpenswitch на публічному testnet: Solana репетирує перехід на Alpenglow'
seo_title: 'Alpenswitch ставить Alpenglow на публічний testnet'
date: '2026-09-24'
tag: Consensus
description: >-
  Цього тижня Alpenswitch переводить публічний testnet Solana на Alpenglow. Що означають дві назви,
  що насправді стоїть за 28 вересня, і що зміниться для валідаторів.
keywords:
  - Alpenswitch
  - Alpenglow
  - SIMD-0384
  - public testnet
teaser: >-
  Публічний testnet цього тижня репетирує перехід із TowerBFT на Alpenglow. Гаманці на mainnet не
  змінюються. 28 вересня – дата в розкладі софту, не день запуску.
image: /content/media/alpenswitch-testnet-card.png
image_alt: 'Alpenswitch: темний кластер переходить від стопки підтверджень до короткого імпульсу згоди'
---

Цього тижня **публічний testnet** Solana репетирує міграцію кластера з TowerBFT на
 Alpenglow. 22 вересня Anza повідомила, що Alpenglow виходить на testnet цього
 тижня і що репетиція йде за тією самою процедурою, яку пізніше пройдуть devnet і
 mainnet-beta. Окремий кластер спільноти вже понад чотири місяці працює на
 Alpenglow і не раз відпрацьовував це перемикання. На mainnet запуск ще не відбувся.

<figure class="cms-figure cms-figure-hero">
  <img src="/content/media/alpenswitch-testnet-card.png" alt="Alpenswitch: темний кластер переходить від стопки підтверджень до короткого імпульсу згоди" width="1280" height="720" decoding="async" fetchpriority="high" />
  <figcaption>Публічний testnet – місце репетиції міграції. На mainnet блоки й далі узгоджуються через TowerBFT.</figcaption>
</figure>

## Дві назви однієї зміни

**Alpenglow** ([SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md))
 – це оновлення консенсусу. Alpenglow замінює TowerBFT протоколом голосування
 **Votor**. Голоси більше не потрапляють у блок як транзакції: валідатори
 надсилають їх одне одному напряму. Орієнтир за фіналізацією – близько
 **150 мілісекунд** замість приблизно **12,8 секунди** на шляху TowerBFT. Саме
 стільки займає накопичення підтверджень протягом 32 слотів.

**Alpenswitch** ([SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md))
 – це сама процедура переходу. На межі міграції кластер перемикається з TowerBFT
 на Alpenglow. Якщо перемикання зривається, кластер лишається на TowerBFT.
 Публічний testnet відпрацьовує цей перехід зараз. Devnet і mainnet-beta мають
 пройти ту саму процедуру пізніше, кожен у свій час.

Як у липні виглядали Votor, Validator Admission Ticket і ще закритий gate на
 mainnet – у
 <a href="./alpenglow-consensus-status-july-2026.html" target="_blank" rel="noopener noreferrer">нотатці про статус Alpenglow</a>.

## Що означає «цього тижня»

Оголошення Anza запустило активацію на публічному testnet. На момент публікації
 це міграція, **яка триває цього тижня**, а не завершене перемикання з точною
 годиною. Трекер ще може позначати перехід на testnet як pending, поки оператори
 до нього готуються. Писати «увімкнулося на епосі N» для цього оновлення зарано.

На цьому першому запуску працює **лише Agave 4.3**. Firedancer і Frankendancer
 цю testnet-міграцію Alpenglow не підтримують. Операторам на цих клієнтах для
 репетиції потрібен Agave. На цьому тесті набір клієнтів ще не повний. Які
 клієнти будуть на devnet і mainnet, вирішуватиметься окремо.

<div class="callout">
<strong>Що насправді означає 28 вересня</strong>
 Agave 4.3 на mainnet уже стоїть. Клієнт вийшов 18 вересня: код Alpenglow у
 ньому є, а перемикач ще вимкнений. Feature gate – це і є той перемикач. Софт
 може вже стояти на валідаторі, а одну з можливостей увімкнуть пізніше.
28 вересня в календарі Anza – орієнтовний день, коли на mainnet можуть відкрити
 частину таких перемикачів Agave 4.3. Це дата в розкладі софту. Вона не переводить
 mainnet на Alpenglow. Операторські нотатки й далі відкладають саме це перемикання
 консенсусу на пізніший реліз. Поки gate Alpenglow справді не відкриють, mainnet
 фіналізує блоки через TowerBFT. Як клієнтна лінія дійшла сюди – у
 <a href="./agave-4-2-release-august-2026.html" target="_blank" rel="noopener noreferrer">нотатці про Agave 4.2</a>.
</div>

## Фіналізація і годинник – різні важелі

<a href="./solana-250ms-slots-september-2026.html" target="_blank" rel="noopener noreferrer">Слоти 250 мс</a> запрацювали на mainnet з
 епохи 1037. Та зміна скоротила слот – вікно, в якому лідер збирає блок. Вона не
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
 у цю репетицію на testnet не входить.

## Що це означає для…

### Валідаторів

Для цієї репетиції потрібен **Agave 4.3**. Перш ніж на testnet відкриється gate,
 прочитайте нотатки Anza для операторів. Firedancer і Frankendancer цей перший
 перехід не проходять. Кластер спільноти вже тренував перемикання; публічний
 testnet – офіційний прогін тієї самої міграції. 28 вересня можуть відкрити
 частину gates Agave 4.3 на mainnet. Це не день, коли mainnet переходить на
 Alpenglow.

### Делегаторів

Повторно делегувати стейк чи міняти гаманець не потрібно. Стейк на mainnet-beta
 і далі живе під TowerBFT. Орієнтир той самий, що й за інших оновлень клієнта:
 обирайте операторів, які прямо кажуть, яку версію крутять і як готуються до
 переходу. Краще той, хто може пояснити цю репетицію на testnet.

### Білдерів

Цей тиждень на testnet не вимагає змін у програмі чи гаманці на mainnet. Не
 випускайте mainnet-інтерфейс, який розраховує на фіналізацію близько 150 мс. На
 mainnet finalized і далі означає очікування TowerBFT. На кластері, де Alpenswitch
 уже завершився, підтвердження і фіналізація зближуються, а vote-транзакції
 зникають із блоків. Індексерам варто оновити базові лічильники **після** реальної
 міграції цього кластера, а не за датою в календарі. Довжина слота і фіналізація –
 різні речі: беріть поточну тривалість слота зі зміни
 <a href="./solana-250ms-slots-september-2026.html" target="_blank" rel="noopener noreferrer">слотів 250 мс</a>
 і не вважайте 150 мс новою довжиною слота.

### Звичайних користувачів

Якщо ви тримаєте чи надсилаєте SOL на mainnet, нічого налаштовувати не потрібно.
 Цього тижня ваші перекази не почнуть фіналізуватися за 150 мс. Якщо застосунок
 працює з публічним testnet, фіналізація там може відчуватися набагато раніше,
 щойно міграція на цьому кластері відбудеться. Гаманець міняти не потрібно ні на
 mainnet, ні на testnet.

<div class="callout">
<strong>Коротко</strong>
        Публічний testnet репетирує Alpenswitch – перехід із TowerBFT на Alpenglow.
        Mainnet цього переходу ще не зробив. 28 вересня – можливий день для інших
        перемикачів Agave 4.3, не для запуску Alpenglow.
</div>

Джерела:
 [Solana – Alpenglow](https://solana.com/upgrades/alpenglow) ·
 [SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md) ·
 [SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md) ·
 [CoinDesk – тест фіналізації на публічному testnet](https://www.coindesk.com/tech/2026/09/23/solana-starts-testing-upgrade-that-could-cut-finality-from-12-8-seconds-to-150-milliseconds) ·
 [ForkLog – активація на testnet](https://forklog.com/en/alpenglow-begins-activation-phase-in-solana-testnet/)
