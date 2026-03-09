# Mobile setup (iOS / Android)

## 1) Backend

```bash
cd backend
npm install
npm run dev
```

The backend already listens on `0.0.0.0` and port `3000`.

## 2) Frontend

```bash
cd frontend
npm install
```

### Web (local backend)

```bash
npm run start:web
```

### Mobile (auto LAN detection)

```bash
npm run start:mobile
```

This mode resolves the host automatically from Expo and uses `http://<LAN_IP>:3000` on native devices.

### Mobile (remote backend)

```bash
npm run start:mobile:remote
```

This mode forces:

`EXPO_PUBLIC_BACKEND_URL=https://virem-backend.onrender.com`

## 3) Open in phone

- Install **Expo Go** on iOS/Android.
- Scan the QR shown by `expo start`.
- Keep phone and computer on the same Wi-Fi when using local backend.

## 4) Build APK / IPA (optional)

```bash
npm i -g eas-cli
eas login
eas build -p android
eas build -p ios
```

(Requires Apple/Google developer setup for store distribution.)
