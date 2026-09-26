Để học các công nghệ làm game web kiểu như hình trên, bạn chưa cần bắt đầu bằng game sinh tồn phức tạp. Một kịch bản tốt để học là:

## Game: “Robot sống sót 60 giây”

Người chơi điều khiển một robot trong một map nhỏ. Quái xuất hiện từ 4 phía và đi về phía robot. Robot tự động bắn kẻ địch gần nhất. Mỗi quái chết sẽ rơi coin. Sống sót đủ 60 giây thì thắng.

Gameplay:

```text
          Enemy
            ↓

Enemy →   🤖   ← Enemy
          Player

            ↑
          Enemy
```

Game này đủ đơn giản để bạn hoàn thành, nhưng lại chạm gần như toàn bộ công nghệ quan trọng của một browser game.

### Stack mình đề xuất cho lần đầu

Bạn có thể dùng:

```text
Frontend:
React
   ↓
Three.js / React Three Fiber
   ↓
Rapier Physics

Multiplayer:
WebSocket

Backend:
Go hoặc Node.js

Database:
PostgreSQL
```

Nhưng **đừng học tất cả cùng lúc**. Hãy build theo từng level.

---

# Level 1 — Render một map 3D

Mục tiêu đầu tiên chỉ là mở browser và thấy:

```text
+-----------------------------+
|                             |
|                             |
|             🤖              |
|                             |
|                             |
+-----------------------------+
```

Bạn sẽ học:

- Scene
- Camera
- Light
- Mesh
- Material
- Game loop

Ví dụ nếu dùng Three.js:

```javascript
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

document.body.appendChild(renderer.domElement);
```

Tạo mặt đất:

```javascript
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({
    color: 0x88aa66
  })
);

floor.rotation.x = -Math.PI / 2;

scene.add(floor);
```

Tạo player:

```javascript
const player = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({
    color: 0x4488ff
  })
);

scene.add(player);
```

Sau đó chạy:

```javascript
function animate() {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);
}

animate();
```

Đây chính là **game loop**.

Browser cố gọi:

```text
animate()
animate()
animate()
...
```

khoảng 60 lần/giây.

---

# Level 2 — Cho player di chuyển

Tiếp theo thêm:

```text
W = lên
S = xuống
A = trái
D = phải
```

Bạn lắng nghe keyboard:

```javascript
const keys = {};

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});
```

Trong game loop:

```javascript
if (keys["w"]) {
  player.position.z -= 0.05;
}

if (keys["s"]) {
  player.position.z += 0.05;
}

if (keys["a"]) {
  player.position.x -= 0.05;
}

if (keys["d"]) {
  player.position.x += 0.05;
}
```

Bây giờ bạn đã có game:

```text
Browser
   ↓
Keyboard
   ↓
Game loop
   ↓
Update player position
   ↓
Render
```

---

# Level 3 — Thêm enemy

Bạn có thể tạo một cube đỏ:

```javascript
const enemy = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({
    color: 0xff4444
  })
);

enemy.position.set(8, 0.5, 8);

scene.add(enemy);
```

Enemy luôn đi về phía player.

Ý tưởng toán học:

```text
enemy ---------> player
```

Code:

```javascript
const direction = new THREE.Vector3();

direction.subVectors(
  player.position,
  enemy.position
);

direction.normalize();

enemy.position.add(
  direction.multiplyScalar(0.02)
);
```

Đây chính là dạng AI đơn giản nhất:

```text
Seek Target
```

Bạn chưa cần machine learning hay LLM.

---

# Level 4 — Collision

Giả sử:

```text
🤖 = player
👾 = enemy

👾 → 🤖
```

Khi khoảng cách:

```javascript
enemy.position.distanceTo(player.position)
```

nhỏ hơn:

```javascript
1
```

thì player bị damage.

```javascript
if (
  enemy.position.distanceTo(player.position) < 1
) {
  playerHP -= 10;
}
```

Ví dụ:

```text
HP: 100

enemy touches player

HP: 90
```

Sau này bạn mới thay bằng physics engine như **Rapier**.

Rapier sẽ giải quyết tốt hơn:

```text
collision
rigid body
velocity
walls
obstacles
triggers
```

---

# Level 5 — Auto shooting

Bây giờ robot tự tìm enemy gần nhất.

Ví dụ:

```text
        E2

E1              E3

        🤖
```

Game tính:

```text
distance(player, E1)
distance(player, E2)
distance(player, E3)
```

Enemy gần nhất là target.

Sau đó tạo bullet:

```text
🤖 ------> 🔸 ------> 👾
```

Pseudo-code:

```javascript
target = findNearestEnemy();

bullet.direction =
  target.position - player.position;
```

Game loop update:

```javascript
bullet.position += bullet.direction * speed;
```

Nếu:

```text
bullet touches enemy
```

thì:

```javascript
enemy.hp -= damage;
```

---

# Level 6 — Spawn nhiều enemy

Ban đầu:

```text
Enemy 1
```

Sau 10 giây:

```text
Enemy 1
Enemy 2
Enemy 3
```

Sau 30 giây:

```text
Enemy x 20
```

Bạn tạo:

```javascript
const enemies = [];
```

Ví dụ:

```javascript
function spawnEnemy() {
  const enemy = createEnemy();

  enemy.position.set(
    random(-10, 10),
    0.5,
    random(-10, 10)
  );

  enemies.push(enemy);

  scene.add(enemy);
}
```

Cứ 2 giây:

```javascript
setInterval(spawnEnemy, 2000);
```

Bây giờ bạn bắt đầu có gameplay giống Vampire Survivors.

---

# Level 7 — Coin

Khi enemy chết:

```text
👾
 ↓ chết

🪙
```

Player chạy qua coin:

```text
🤖 → 🪙
```

thì:

```javascript
coins += 1;
```

UI React có thể hiện:

```text
❤️ HP: 80

🪙 Coin: 27

⏱ 42 / 60 sec
```

Đây là chỗ React rất hữu ích.

Three.js xử lý:

```text
game world
```

React xử lý:

```text
HUD
menu
buttons
settings
score
```

Kiến trúc sẽ giống:

```text
React
│
├── Main menu
├── HP bar
├── Score
├── Timer
│
└── Three.js Canvas
      │
      ├── Player
      ├── Enemy
      ├── Bullet
      └── Map
```

---

# Level 8 — Camera giống screenshot

Game trong ảnh dùng camera kiểu:

```text
       Camera
          \
           \
            🤖
─────────────── Ground
```

Thường gọi là:

**isometric / top-down perspective camera**

Ví dụ:

```javascript
camera.position.set(
  0,
  12,
  10
);

camera.lookAt(
  player.position
);
```

Sau đó camera follow player:

```javascript
camera.position.x = player.position.x;
camera.position.z = player.position.z + 10;
```

Bạn sẽ có cảm giác giống game trong screenshot.

---

# Level 9 — Thêm Multiplayer

Đến đây mới nên học WebSocket.

Hai người chơi:

```text
Browser A

    🤖 A
       \
        WebSocket
           |
        Server
           |
        WebSocket
       /
    🤖 B

Browser B
```

Client A gửi:

```json
{
  "type": "move",
  "x": 5.2,
  "z": 8.7
}
```

Server nhận rồi gửi cho B:

```json
{
  "playerId": "A",
  "x": 5.2,
  "z": 8.7
}
```

Browser B render:

```text
Player A ở vị trí
x=5.2
z=8.7
```

---

# Level 10 — Server authoritative

Ban đầu bạn có thể để client nói:

```json
{
  "x": 200,
  "y": 100
}
```

Nhưng người chơi có thể hack JS.

Ví dụ hacker gửi:

```text
HP = 999999

speed = 1000

coin = 999999
```

Do đó game thật thường chuyển sang:

```text
Client
   |
   | "I press W"
   ↓
Server
   |
   | calculate movement
   ↓
Game State
```

Thay vì client gửi:

```json
{
  "x": 100
}
```

client gửi:

```json
{
  "moveX": 0,
  "moveY": 1
}
```

Server quyết định:

```text
old position
+
speed
×
deltaTime
```

ra vị trí mới.

Đây là khái niệm rất quan trọng:

> **Authoritative server**

---

# Phiên bản multiplayer hoàn chỉnh

Game architecture cuối cùng có thể là:

```text
                   PostgreSQL
                       ↑
                       |
                   Game Server
                 Go / Node.js
                       |
               WebSocket server
              /        |        \
             /         |         \
            ↓          ↓          ↓

        Browser A   Browser B   Browser C

          React       React       React
            ↓           ↓           ↓
        Three.js    Three.js    Three.js
```

Server giữ:

```javascript
Room {
    players
    enemies
    bullets
    coins
    wave
    timer
}
```

Ví dụ:

```json
{
  "room": "abc123",

  "players": {
    "p1": {
      "x": 3,
      "z": 8,
      "hp": 90
    },

    "p2": {
      "x": 6,
      "z": 2,
      "hp": 70
    }
  },

  "wave": 4,

  "remainingEnemies": 12
}
```

---

# Game loop thực tế

Đây là trái tim của toàn bộ game:

```text
while game is running:

    read input

    update players

    update enemies

    update bullets

    detect collisions

    update HP

    spawn enemies

    collect coins

    check win / lose

    render
```

Tương đương:

```javascript
function gameLoop(deltaTime) {

    updatePlayer(deltaTime);

    updateEnemies(deltaTime);

    updateBullets(deltaTime);

    checkCollisions();

    updateCamera();

    render();
}
```

Nếu hiểu được đoạn này thì bạn đã hiểu một phần rất lớn về cách game vận hành.

---

# Lộ trình mình khuyên bạn

Đừng bắt đầu bằng:

```text
React
+
Three.js
+
Rapier
+
WebSocket
+
Postgres
+
Redis
+
multiplayer
```

ngay lập tức.

Hãy đi:

```text
1. Three.js scene
        ↓
2. Player movement
        ↓
3. Enemy follow player
        ↓
4. Shooting
        ↓
5. Collision
        ↓
6. Enemy waves
        ↓
7. Coins + HP
        ↓
8. React HUD
        ↓
9. Multiplayer WebSocket
        ↓
10. Server authoritative
```

Một milestone rất hợp lý là:

> **Một map 3D 20×20m, một nhân vật di chuyển WASD, 10 con quái chạy về phía người chơi, nhân vật tự bắn và thắng nếu sống được 60 giây.**

Nếu bạn làm được game nhỏ này, bạn sẽ hiểu đủ nền tảng để nhìn một game như **Zappets trong ảnh** và bắt đầu hình dung được từng subsystem của nó được implement như thế nào.