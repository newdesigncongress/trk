
# Technically Responsible Knowledge

## Install

```
npm install
```

## Use

```
SESSION_SECRET='any arbitrary secret' development=true npm start

```

The site will be accessible at http://localhost:80

For full functionality, you will also need to set up a [Sendgrid](https://sendgrid.com/) account and a [Recaptcha](https://www.google.com/recaptcha/admin) account that serves `localhost` or your own domain. In this case, you would start the server like so:


```
SENDGRID_API_KEY='your sendgrid API key' SESSION_SECRET='any arbitrary secret' RECAPTCHA_SECRET='your recaptcha secret' development=true npm start

```

