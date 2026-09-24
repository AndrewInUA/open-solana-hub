---
title: 'Alpenswitch на публічному testnet: Solana репетирує перехід на Alpenglow'
seo_title: 'Alpenswitch виводить Alpenglow на публічний testnet'
date: '2026-09-24'
tag: Consensus
description: >-
  Alpenswitch цього тижня переводить Alpenglow на публічний testnet Solana. Що означають дві назви,
  чому 28 вересня – не запуск на mainnet, і що зміниться для валідаторів.
keywords:
  - Alpenswitch
  - Alpenglow
  - SIMD-0384
  - public testnet
teaser: >-
  Публічний testnet цього тижня проходить міграцію з TowerBFT на Alpenglow. Гаманці на mainnet не
  змінюються, і 28 вересня – не дата запуску.
image: /content/media/alpenswitch-testnet-card.png
image_alt: 'Alpenswitch: темний кластер переходить від стопки підтверджень до короткого імпульсу згоди'
---

Цього тижня **публічний testnet** Solana проходить міграцію, яка переводить кластер
 з TowerBFT на Alpenglow. 22 вересня Anza повідомила, що Alpenglow виходить на
 testnet цього тижня і що репетиція використовує ту саму процедуру, яку пізніше
 заплановано для devnet і mainnet-beta. Окремий community cluster уже працює на
 Alpenglow понад чотири місяці й відпрацьовував перемикання. Це не запуск на mainnet.

<figure class="cms-figure cms-figure-hero">
  <img src="/content/media/alpenswitch-testnet-card.png" alt="Alpenswitch: темний кластер переходить від стопки підтверджень до короткого імпульсу згоди" width="1280" height="720" decoding="async" fetchpriority="high" />
  <figcaption>Публічний testnet – місце, де відпрацьовують міграцію. Mainnet і далі узгоджує блоки через TowerBFT.</figcaption>
</figure>

## Дві назви однієї зміни

**Alpenglow** ([SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md))
 – оновлення консенсусу. Воно замінює TowerBFT протоколом голосування **Votor**.
 Голоси йдуть не в леджер, а прямими повідомленнями між валідаторами. Ціль –
 фіналізація приблизно за **150 мілісекунд** замість близько **12,8 секунди** на
 шляху TowerBFT. Саме стільки триває стопка підтверджень на 32 слоти.

**Alpenswitch** ([SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md))
 – процедура міграції. На межі міграції кластер
 перемикається з TowerBFT на Alpenglow. Якщо перемикання не вдається, кластер
 повертається на TowerBFT. Публічний testnet відпрацьовує цей перехід зараз.
 Devnet і mainnet-beta мають пройти ту саму процедуру пізніше, кожен за своїм
 графіком.

Як Votor, Validator Admission Ticket і ще закритий mainnet-гейт виглядали в
 липні – у [нотатці про статус Alpenglow](./alpenglow-consensus-status-july-2026.html).

## Що означає «цього тижня»

Оголошення Anza запустило активацію на публічному testnet. На момент публікації
 міграцію варто читати як **таку, що триває цього тижня**, а не як завершене
 перемикання із зафіксованим часом. Трекер іще може позначати testnet-перехід як
 pending, поки оператори рухаються. Рядок на кшталт «увімкнулося на епосі N» для
 цього оновлення не підходить.

Перший прохід – **лише Agave 4.3**. Firedancer і Frankendancer не підтримують
 цю testnet-міграцію Alpenglow. Операторам на цих клієнтах для репетиції потрібен
 Agave. Це розрив у різноманітті клієнтів саме для цього тесту. Пізніші
 кластери самі визначають свій набір клієнтів.

<div class="callout">
<strong>28 вересня – не запуск Alpenglow</strong>
У розкладі Anza 28 вересня стоїть як орієнтовна дата ввімкнення
 <strong>feature gates Agave 4.3 на mainnet</strong>. Це віха релізу. Це не
 підтверджена активація Alpenglow на mainnet. Alpenglow на mainnet не працює.
 Коли Agave 4.3 вийшов на mainnet 18 вересня, feature gate Alpenglow лишився
 закритим. Як клієнтна лінія дійшла сюди – у
 <a href="./agave-4-2-release-august-2026.html">нотатці про Agave 4.2</a>.
</div>

## Фіналізація і годинник – різні важелі

[Слоти 250 мс](./solana-250ms-slots-september-2026.html) запрацювали на mainnet з
 епохи 1037. Та зміна скоротила слот – вікно, в якому лідер виробляє блок. Вона
 не змінила, скільки мережа чекає, перш ніж блок стане незворотним. Alpenglow –
 інший важіль: як валідатори погоджуються, що блок уже не скасувати. Швидший
 годинник і швидша фіналізація обидва змінюють відчуття застосунків. Це різні
 перемикачі.

<div class="article-analogy">
<strong>Простими словами</strong>
Фіналізація – мить, коли банківський переказ стає незворотним. TowerBFT – очікування
 крізь стопку підтверджень, перш ніж банк визнає платіж завершеним. Votor – короткий
 прямий раунд згоди між валідаторами, які мають поставити підпис: одна розмова там,
 де старий шлях був пачкою квитанцій.
</div>

Коли Alpenglow справді працює на кластері, застосунки на цьому кластері можуть
 відчувати фіналізацію значно раніше. Виконання транзакцій не змінюється: SVM,
 формати транзакцій і комісії лишаються тими самими. Rotor, пізніший шар
 поширення даних, до цього проходу на testnet не входить.

## Що це означає для…

### Валідаторів

Цій репетиції потрібен **Agave 4.3**. Прочитайте операторські нотатки Anza до
 testnet-гейта і не розраховуйте, що Firedancer чи Frankendancer пройдуть цю
 першу міграцію. Community cluster уже тренував перемикання; публічний testnet –
 формальний прохід тієї самої міграції. 28 вересня в розкладі feature gates на
 mainnet – не дата вашого переходу на Alpenglow.

### Делегаторів

Повторне делегування і міграція гаманця не потрібні. Стейк на mainnet-beta і
 далі під TowerBFT. Корисний сигнал той самий, що й для інших оновлень клієнта:
 обирайте операторів, які кажуть, яку версію вони крутять і як планують перехід.
 Ясніший орієнтир – оператор, який може пояснити testnet-репетицію.

### Білдерів

Цьоготижневий прохід на testnet не вимагає змін у mainnet-програмі чи гаманці.
 Не випускайте mainnet UX, який закладає фіналізацію ~150 мс. На mainnet
 finalized і далі означає очікування TowerBFT. На кластері, який завершив
 Alpenswitch, підтвердження і фіналізація зближуються, а vote-транзакції зникають
 із блоків, тож індексерам варто перерахувати базові лічильники **після** того,
 як цей кластер справді мігрував, а не за календарною датою. Тривалість слота і
 фіналізація лишаються різними речами: беріть поточний час слота зі зміни
 [слотів 250 мс](./solana-250ms-slots-september-2026.html) і не вважайте 150 мс
 новою довжиною слота.

### Звичайних користувачів

Якщо ви тримаєте чи надсилаєте SOL на mainnet, нічого налаштовувати не потрібно,
 і цього тижня перекази не почнуть фіналізуватися за 150 мс. Якщо застосунки
 дивляться на публічний testnet, вони можуть почати відчувати фіналізацію набагато
 раніше, щойно міграція на цьому кластері набере чинності. Новий сценарій у
 гаманці не потрібен на жодному з кластерів.

<div class="callout">
<strong>Коротко</strong>
        Публічний testnet репетирує Alpenswitch – перехід із TowerBFT на Alpenglow.
        Mainnet не перемкнувся, і 28 вересня – не цей запуск.
</div>

Джерела:
 [Solana – Alpenglow](https://solana.com/upgrades/alpenglow) ·
 [SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md) ·
 [SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md) ·
 [CoinDesk – тест фіналізації на публічному testnet](https://www.coindesk.com/tech/2026/09/23/solana-starts-testing-upgrade-that-could-cut-finality-from-12-8-seconds-to-150-milliseconds) ·
 [ForkLog – активація на testnet](https://forklog.com/en/alpenglow-begins-activation-phase-in-solana-testnet/)
