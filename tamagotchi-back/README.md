# Game API Documentation

## Описание проекта

Это бэкэнд API для игрового приложения с системой пользователей, опыта, монет и косметических скинов. Проект построен на Express.js и SQLite.

---

## Установка

### 1. Требования

- Node.js (v14 или выше)
- npm

### 2. Установка зависимостей

```bash
npm install express bcrypt jsonwebtoken dotenv sqlite3
```

### 3. Создание файла .env

```
PORT=3000
JWT_SECRET=your_super_secret_key_change_this_in_production
```

### 4. Запуск проекта

```bash
node index.js
```

Сервер будет запущен на `http://127.0.0.1:3000`

---

## API Эндпоинты

### 1. Проверка здоровья сервера

```
GET /api/heartbeat
```

**Ответ:**

```json
{
  "code": 200,
  "message": "Healthy!"
}
```

---

### 2. Регистрация пользователя		

```
POST /api/auth/register
```

**Требуемые поля:**

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Успешный ответ (201):**

```json
{
  "code": 201,
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  },
  "token": "eyJhbGc..."
}
```

**Ошибки:**

- `400` — Отсутствуют обязательные поля или пароли не совпадают
- `409` — Пользователь или email уже существует
- `500` — Ошибка сервера

---

### 3. Вход в аккаунт

```
POST /api/auth/login
```

**Требуемые поля:**

```json
{
  "username": "testuser",
  "password": "password123"
}
```

**Успешный ответ (200):**

```json
{
  "code": 200,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "lvl": 5,
    "xp": 1500,
    "coins": 5000,
    "beanz": 100
  },
  "token": "eyJhbGc..."
}
```

**Ошибки:**

- `400` — Отсутствуют username или password
- `401` — Неверные учетные данные
- `500` — Ошибка сервера

---

### 4. Получить профиль текущего пользователя

```
GET /api/auth/me
```

**Заголовки:**

```
Authorization: Bearer <token>
```

**Успешный ответ (200):**

```json
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "lvl": 5,
  "xp": 1500,
  "coins": 5000,
  "beanz": 100,
  "created_at": "2024-01-15 10:30:00"
}
```

**Ошибки:**

- `401` — Токен отсутствует
- `403` — Токен невалиден или истёк
- `404` — Пользователь не найден

---

### 5. Получить инвентарь пользователя

```
GET /api/users/:id/inventory
```

**Заголовки:**

```
Authorization: Bearer <token>
```

**Пример запроса:**

```
GET /api/users/1/inventory
```

**Успешный ответ (200):**

```json
{
  "user_id": 1,
  "items": [
    {
      "id": 1,
      "quantity": 1,
      "name": "Golden Head",
      "type": "head",
      "model_name": "golden_head.png",
      "rarity": "epic"
    },
    {
      "id": 2,
      "quantity": 1,
      "name": "Red Body",
      "type": "body",
      "model_name": "red_body.png",
      "rarity": "common"
    }
  ]
}
```

**Ошибки:**

- `401` — Токен отсутствует
- `403` — Доступ запрещен (можно смотреть только свой инвентарь)
- `500` — Ошибка сервера

---

### 6. Получить все доступные предметы

```
GET /api/items
```

**Успешный ответ (200):**

```json
[
  {
    "id": 1,
    "name": "Golden Head",
    "type": "head",
    "model_name": "golden_head.png",
    "rarity": "epic",
    "price": 500,
    "created_at": "2024-01-15 10:30:00"
  },
  {
    "id": 2,
    "name": "Red Body",
    "type": "body",
    "model_name": "red_body.png",
    "rarity": "common",
    "price": 100,
    "created_at": "2024-01-15 10:30:00"
  }
]
```

---

### 7. Заполнить БД тестовыми данными

```
GET /api/seed
```

**Успешный ответ (200):**

```json
{
  "code": 200,
  "message": "Database seeded successfully!",
  "data": {
    "users": 3,
    "items": 7,
    "inventory_entries": 8
  }
}
```

---

## Структура БД

### Таблица `users`

| Поле   | Тип   | Описание                                        |
| ---------- | -------- | ------------------------------------------------------- |
| id         | INTEGER  | Уникальный ID пользователя        |
| username   | TEXT     | Уникальное имя пользователя    |
| email      | TEXT     | Email (уникальный)                            |
| password   | TEXT     | Хешированный пароль                   |
| lvl        | INTEGER  | Уровень игрока (по умолчанию 1) |
| xp         | INTEGER  | Опыт (по умолчанию 0)                    |
| coins      | INTEGER  | Монеты (по умолчанию 0)                |
| beanz      | INTEGER  | Премиум валюта (по умолчанию 0) |
| created_at | DATETIME | Дата регистрации                         |

### Таблица `items`

| Поле   | Тип   | Описание                                 |
| ---------- | -------- | ------------------------------------------------ |
| id         | INTEGER  | Уникальный ID предмета         |
| name       | TEXT     | Название скина                      |
| type       | TEXT     | Тип (head, body, boots, cape)                 |
| model_name | TEXT     | Название файла картинки     |
| rarity     | TEXT     | Редкость (common, rare, epic, legendary) |
| price      | INTEGER  | Цена в монетах                       |
| created_at | DATETIME | Дата создания                        |

### Таблица `inventory`

| Поле    | Тип   | Описание                                 |
| ----------- | -------- | ------------------------------------------------ |
| id          | INTEGER  | Уникальный ID записи             |
| user_id     | INTEGER  | ID пользователя (FK)                 |
| item_id     | INTEGER  | ID предмета (FK)                         |
| quantity    | INTEGER  | Количество (по умолчанию 1) |
| acquired_at | DATETIME | Дата получения                      |

---

## Пример использования (Client-side)

### Регистрация

```javascript
const response = await fetch('http://127.0.0.1:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'newplayer',
    email: 'newplayer@game.com',
    password: 'securepass123',
    confirmPassword: 'securepass123'
  })
});

const data = await response.json();
localStorage.setItem('token', data.token);
```

### Вход

```javascript
const response = await fetch('http://127.0.0.1:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'newplayer',
    password: 'securepass123'
  })
});

const data = await response.json();
localStorage.setItem('token', data.token);
```

### Получить профиль

```javascript
const token = localStorage.getItem('token');
const response = await fetch('http://127.0.0.1:3000/api/auth/me', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});

const user = await response.json();
console.log(user);
```

### Получить инвентарь

```javascript
const token = localStorage.getItem('token');
const userId = 1;
const response = await fetch(`http://127.0.0.1:3000/api/users/${userId}/inventory`, {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});

const inventory = await response.json();
console.log(inventory.items);
```

---

## Безопасность

1. **Пароли** хешируются с помощью bcrypt перед сохранением в БД
2. **JWT токены** используются для аутентификации (действительны 7 дней)
3. **CORS** рекомендуется настроить перед использованием в production
4. **JWT_SECRET** должен быть сильным и приватным
5. Инвентарь доступен только владельцу (проверка ID)

---

## Возможные улучшения

- Добавить CORS middleware
- Реализовать покупку/продажу предметов
- Добавить систему друзей
- Реализовать лидерборд
- Добавить refresh tokens
- Валидировать email с отправкой письма
- Добавить рейт-лимитинг

---

## Лицензия

MIT
