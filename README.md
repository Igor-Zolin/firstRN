# 📱 firstRN — React Native проект

Проект сделан на **React Native** +  **Expo** . Ниже — чёткая инструкция по подготовке окружения, установке зависимостей и запуску на устройстве или эмуляторе.

---

## 🚀 Быстрый старт

Эти шаги приведут тебя от клонирования репозитория до запуска приложения.

### 📥 1. Склонировать репозиторий

Открой терминал и выполни:

<pre class="overflow-visible! px-0!" data-start="553" data-end="627"><div class="relative w-full my-4"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼs ͼ16"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼ10">git</span><span> clone https://github.com/Igor-Zolin/firstRN.git</span><br/><span class="ͼ10">cd</span><span> firstRN</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 🛠 Установка зависимостей

React Native через Expo требует Node.js, менеджер пакетов (npm или Yarn) и сам Expo CLI.

### ✅ 2. Убедись, что установлен Node.js

Проверь:

<pre class="overflow-visible! px-0!" data-start="806" data-end="832"><div class="relative w-full my-4"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼs ͼ16"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼ10">node</span><span></span><span class="ͼ12">-v</span><br/><span class="ͼ10">npm</span><span></span><span class="ͼ12">-v</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

> Если версии не выводятся — установи последнюю Node.js с официального сайта.

---

### 📦 3. Установка зависимостей проекта

В корне проекта выполни:

<pre class="overflow-visible! px-0!" data-start="986" data-end="1004"><div class="relative w-full my-4"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼs ͼ16"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼ10">npm</span><span> ci</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

🎯 Эта команда прочитает файл `package-lock.json` и установит все зависимости  **точно так, как указано** , без изменения версий.

---

## 📲 Установка Expo CLI

Expo — инструмент для разработки React Native-приложений.

### 📌 4. Установи Expo глобально (если не установлен)

<pre class="overflow-visible! px-0!" data-start="1281" data-end="1316"><div class="relative w-full my-4"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼs ͼ16"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼ10">npm</span><span> install </span><span class="ͼ12">-g</span><span> expo-cli</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 🔧 Запуск проекта

### ▶️ 5. Запустить проект в режиме разработки

<pre class="overflow-visible! px-0!" data-start="1393" data-end="1422"><div class="relative w-full my-4"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼs ͼ16"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>npx expo </span><span class="ͼ10">start</span><span></span><span class="ͼ12">-c</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Флаг `-c` (clean) очищает кэш — полезно при проблемах со сборкой.

После этого откроется панель Expo:

* Сканируй QR-код в Expo Go на мобильном
* Или запусти на эмуляторе Android / iOS

---

## 📱 Как работать с приложением

| Платформа    | Команда                |
| --------------------- | ----------------------------- |
| Android               | Нажать `a`в Expo CLI |
| iOS (Mac)             | Нажать `i`            |
| Веб-браузер | Нажать `w`            |

---

## 🧰 Что здесь используется

🔹 **React Native** — кроссплатформенные мобильные приложения

🔹 **Expo** — удобная среда разработки и инструменты для запуска

🔹 **npm ci** — установка зависимостей без обновлений

Приложение запускается как обычный React Native через Expo фазу трансляции JS кода в нативный UI компонент.

---

## 🛠 Возможные проблемы и решения

### ❗ Ошибки после клона

Если приложение не запускается:

1. Удали папку `node_modules`
   <pre class="overflow-visible! px-0!" data-start="2315" data-end="2352"><div class="relative w-full my-4"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼs ͼ16"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼ10">rm</span><span></span><span class="ͼ12">-rf</span><span> node_modules</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>
2. Очисти кеш npm и Expo:
   <pre class="overflow-visible! px-0!" data-start="2382" data-end="2423"><div class="relative w-full my-4"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼs ͼ16"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼ10">npm</span><span> cache clean </span><span class="ͼ12">--force</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>
3. Запусти заново:
   <pre class="overflow-visible! px-0!" data-start="2446" data-end="2491"><div class="relative w-full my-4"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼs ͼ16"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼ10">npm</span><span> ci</span><br/><span>npx expo </span><span class="ͼ10">start</span><span></span><span class="ͼ12">-c</span></div></div></div></div></div></div></div></div></div></div></div></div></pre>
