# SSL Certificates

Place your SSL certificates here:

- `fullchain.pem` - Full certificate chain
- `privkey.pem` - Private key

## Generate with Let's Encrypt:

```bash
# Install certbot
apt install certbot

# Generate certificates
certbot certonly --standalone -d whisnap.com -d www.whisnap.com

# Copy to this directory
cp /etc/letsencrypt/live/whisnap.com/fullchain.pem ./nginx/ssl/
cp /etc/letsencrypt/live/whisnap.com/privkey.pem ./nginx/ssl/
```

## For Development:

```bash
# Generate self-signed certificate for testing
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./nginx/ssl/privkey.pem \
  -out ./nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=CA/L=SF/O=Whisnap/CN=whisnap.com"
```