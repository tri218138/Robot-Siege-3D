# Robot Three.js

Trò chơi sinh tồn multiplayer chạy trên trình duyệt, sử dụng Three.js cho phần hiển thị và WebSocket cho kết nối thời gian thực.

## Installation

Yêu cầu:

- Node.js `20.19+` hoặc `22.12+`
- npm

Cài đặt dependencies:

```bash
npm install
```

## Start local

Chạy WebSocket server trong terminal thứ nhất:

```bash
npm run server
```

Server mặc định chạy tại `ws://127.0.0.1:8080`.

Chạy Vite development server trong terminal thứ hai:

```bash
npm run dev
```

Sau đó mở [http://localhost:5173](http://localhost:5173) trên trình duyệt.

## Điều khiển

- `W`, `A`, `S`, `D`: di chuyển
- `Space`: đổi vũ khí

## Các lệnh khác

```bash
npm test       # Chạy test
npm run build  # Build production
npm run preview # Xem trước production build
```
