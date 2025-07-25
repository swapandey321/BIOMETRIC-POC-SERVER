## Setup Instructions

### 1. Generate Server Certificates

```sh
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -subj "/CN=<your-domain-here>" -addext "subjectAltName=DNS:localhost,IP:<your-ip-here>"
```
**Example:**
```sh
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:192.168.1.178"
```

---

### 2. Setup Android Keystore

```sh
cd ~/.android
keytool -genkey -v -keystore <keystore-here>.keystore -alias <alias-name-here> -keyalg RSA -keysize 2048 -validity 10000
```
**Example:**
```sh
keytool -genkey -v -keystore my-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000
```

---

## Running the Server

### 1. Start the Server

```sh
node server.js
```

### 2. Run ngrok

```sh
ngrok http https://localhost:3000
```

---

## Testing

Access the following URL to test:

```
https://e40c98b3179b.ngrok-free.app/.well-known/assetlinks.json
```